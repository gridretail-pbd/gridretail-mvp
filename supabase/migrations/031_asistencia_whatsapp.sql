-- ============================================================================
-- MIGRACIÓN 031: Control de Asistencia vía Agente WhatsApp — FASE 0
-- Módulo: RRHH → Control de Asistencia
-- Spec:   SPEC_ASISTENCIA_WHATSAPP.md v1.1 (§3 Modelo de datos, §8 Fase 0)
-- Fecha:  2026-08-18
-- ============================================================================
--
-- Contenido:
--   1. Tabla marcaciones_raw        (bandeja de entrada cruda + auditoría)
--   2. Tabla usuarios_whatsapp      (resolución de identidad JID/LID → usuarios)
--   3. Tabla wa_conversaciones_dm   (estado de diálogo 1:1 del bot)
--   4. ALTER asistencia             (nuevos tipos + trazabilidad WhatsApp)
--   5. alertas_rrhh.tipo            (6 tipos nuevos)
--   6. system_config                (11 claves de parametrización)
--   7. Storage                      (bucket privado de fotos de marcación)
--   8. Índices, triggers y RLS
--
-- Notas de compatibilidad:
--   · `asistencia.tipo` era VARCHAR(10); los nuevos valores REFRIGERIO_INICIO /
--     REFRIGERIO_FIN no caben, por eso se amplía a VARCHAR(20) ANTES de
--     recrear el CHECK.
--   · Las credenciales (EVOLUTION_API_KEY, WHATSAPP_WEBHOOK_SECRET) NO viven
--     en system_config: van en env vars de Vercel (spec §3.6 y §10.1).
--   · Modo sombra: `asistencia.dm_habilitado` se siembra en TRUE por defecto
--     según el spec, pero esta migración lo deja en FALSE porque Fase 0 corre
--     en modo sombra (spec §7.6). Cambiar a 'true' al activar Fase 1.
--   · IDENTIDAD (post-033): `asistencia.usuario_id` referencia `usuarios_rrhh(id)`
--     — la PERSONA, no la cuenta. Por eso `usuarios_whatsapp.usuario_id` y
--     `marcaciones_raw.usuario_id_resuelto` también apuntan a `usuarios_rrhh`:
--     el personal solo-RRHH (limpieza, seguridad) no tiene fila en `usuarios`
--     y es justamente quien marca por WhatsApp sin poder entrar a la app.
--     Las columnas de auditoría (`verificado_por`) sí apuntan a `usuarios`.
--     Consecuencia para Fase 1 (§4.4): el DNI y el teléfono se buscan en
--     `usuarios_rrhh` (`dni`, `telefono_personal`) y la regla USUARIO_INACTIVO
--     evalúa `usuarios_rrhh.status`, no `usuarios.activo`.
--   · RLS: DESHABILITADO, coherente con 008_disable_rls_for_mvp y 032
--     (GridRetail no usa Supabase Auth: `auth.uid()` siempre es NULL).
--     Las políticas quedan escritas y comentadas al final para el día que se
--     migre a Supabase Auth.
--
-- Numeración: el número 031 estaba libre (el repo saltó de la 030 a la 032).
--   Esta migración rellena ese hueco, por lo que se APLICA DESPUÉS de la 032
--   (login/modo tienda) y de la 033 (desacople usuarios_rrhh), aunque su
--   número sea menor. La siguiente migración libre del proyecto es la 034.
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLA marcaciones_raw
-- Todo lo que llega del grupo se guarda ANTES de intentar procesarlo.
-- Red de seguridad: nada se pierde aunque falle el AI o la identidad.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marcaciones_raw (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación del mensaje WhatsApp
    wa_message_id          VARCHAR(100) NOT NULL,
    wa_grupo_jid           VARCHAR(100) NOT NULL,
    wa_remitente_jid       VARCHAR(100) NOT NULL,
    wa_remitente_telefono  VARCHAR(20),
    wa_push_name           VARCHAR(100),
    wa_timestamp           TIMESTAMPTZ  NOT NULL,

    -- Contenido
    tipo_mensaje           VARCHAR(20)  NOT NULL,
    caption                TEXT,
    media_url              TEXT,
    media_hash             VARCHAR(64),
    payload                JSONB        NOT NULL,

    -- Procesamiento
    estado_proceso         VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
    error_detalle          TEXT,
    asistencia_id          UUID REFERENCES asistencia(id)    ON DELETE SET NULL,
    -- PERSONA (post-033), no cuenta: coherente con asistencia.usuario_id
    usuario_id_resuelto    UUID REFERENCES usuarios_rrhh(id) ON DELETE SET NULL,
    procesado_at           TIMESTAMPTZ,

    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Constraints (idempotentes)
ALTER TABLE marcaciones_raw DROP CONSTRAINT IF EXISTS marcaciones_raw_tipo_mensaje_check;
ALTER TABLE marcaciones_raw ADD  CONSTRAINT marcaciones_raw_tipo_mensaje_check
    CHECK (tipo_mensaje IN ('IMAGE', 'TEXT', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'OTRO'));

ALTER TABLE marcaciones_raw DROP CONSTRAINT IF EXISTS marcaciones_raw_estado_proceso_check;
ALTER TABLE marcaciones_raw ADD  CONSTRAINT marcaciones_raw_estado_proceso_check
    CHECK (estado_proceso IN ('PENDIENTE', 'PROCESADO', 'NO_IDENTIFICADO', 'IGNORADO', 'ERROR'));

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcaciones_raw_wa_message
    ON marcaciones_raw (wa_message_id);
CREATE INDEX IF NOT EXISTS idx_marcaciones_raw_estado
    ON marcaciones_raw (estado_proceso, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marcaciones_raw_remitente
    ON marcaciones_raw (wa_remitente_jid, wa_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_marcaciones_raw_media_hash
    ON marcaciones_raw (media_hash) WHERE media_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marcaciones_raw_grupo_fecha
    ON marcaciones_raw (wa_grupo_jid, wa_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_marcaciones_raw_usuario
    ON marcaciones_raw (usuario_id_resuelto) WHERE usuario_id_resuelto IS NOT NULL;

COMMENT ON TABLE  marcaciones_raw IS
    'Bandeja de entrada cruda del webhook de WhatsApp. Se persiste todo mensaje del grupo/DM antes de procesarlo. Spec SPEC_ASISTENCIA_WHATSAPP §3.2.';
COMMENT ON COLUMN marcaciones_raw.wa_message_id IS 'ID del mensaje WhatsApp (key.id). UNIQUE: garantiza idempotencia del webhook.';
COMMENT ON COLUMN marcaciones_raw.wa_timestamp  IS 'messageTimestamp de WhatsApp. Fuente de verdad de la hora de marcación.';
COMMENT ON COLUMN marcaciones_raw.media_url     IS 'Ruta en Storage: asistencia/YYYY/MM/DD/<id>.jpg';
COMMENT ON COLUMN marcaciones_raw.media_hash    IS 'SHA-256 del binario. Permite detectar foto repetida (código FOTO_REPETIDA).';
COMMENT ON COLUMN marcaciones_raw.payload       IS 'Webhook completo de Evolution, sin el base64 de la imagen.';


-- ============================================================================
-- 2. TABLA usuarios_whatsapp
-- Mapea identificadores técnicos de WhatsApp (JID con teléfono o LID opaco)
-- a usuarios de GridRetail.
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios_whatsapp (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- PERSONA (usuarios_rrhh), no cuenta: permite vincular personal solo-RRHH
    -- (limpieza, seguridad) que no tiene fila en `usuarios`.
    usuario_id           UUID NOT NULL REFERENCES usuarios_rrhh(id) ON DELETE CASCADE,

    wa_jid               VARCHAR(100),
    wa_lid               VARCHAR(100),
    telefono             VARCHAR(20),

    metodo_vinculacion   VARCHAR(20)  NOT NULL,
    verificado           BOOLEAN      NOT NULL DEFAULT false,
    verificado_por       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    verificado_at        TIMESTAMPTZ,
    activo               BOOLEAN      NOT NULL DEFAULT true,

    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE usuarios_whatsapp DROP CONSTRAINT IF EXISTS usuarios_whatsapp_identificador_check;
ALTER TABLE usuarios_whatsapp ADD  CONSTRAINT usuarios_whatsapp_identificador_check
    CHECK (wa_jid IS NOT NULL OR wa_lid IS NOT NULL);

ALTER TABLE usuarios_whatsapp DROP CONSTRAINT IF EXISTS usuarios_whatsapp_metodo_check;
ALTER TABLE usuarios_whatsapp ADD  CONSTRAINT usuarios_whatsapp_metodo_check
    CHECK (metodo_vinculacion IN ('TELEFONO_RRHH', 'DNI_DM', 'MANUAL', 'IMPORTACION'));

-- Un JID / LID / teléfono no puede apuntar a dos usuarios
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_whatsapp_jid
    ON usuarios_whatsapp (wa_jid) WHERE wa_jid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_whatsapp_lid
    ON usuarios_whatsapp (wa_lid) WHERE wa_lid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_whatsapp_telefono
    ON usuarios_whatsapp (telefono) WHERE telefono IS NOT NULL AND activo = true;
CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp_usuario
    ON usuarios_whatsapp (usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp_activo
    ON usuarios_whatsapp (activo, verificado);

DROP TRIGGER IF EXISTS set_updated_at ON usuarios_whatsapp;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON usuarios_whatsapp
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE  usuarios_whatsapp IS
    'Vínculo entre identificadores de WhatsApp y el maestro de personal (usuarios_rrhh). Spec SPEC_ASISTENCIA_WHATSAPP §3.3 / §4.4.';
COMMENT ON COLUMN usuarios_whatsapp.usuario_id     IS 'FK → usuarios_rrhh.id (la PERSONA). Coherente con asistencia.usuario_id tras la migración 033.';
COMMENT ON COLUMN usuarios_whatsapp.verificado_por IS 'FK → usuarios.id — cuenta que verificó el vínculo (columna de auditoría).';
COMMENT ON COLUMN usuarios_whatsapp.wa_jid   IS 'JID con teléfono expuesto, ej. 51947367258@s.whatsapp.net';
COMMENT ON COLUMN usuarios_whatsapp.wa_lid   IS 'LID opaco cuando el contacto oculta su número, ej. 123456789@lid';
COMMENT ON COLUMN usuarios_whatsapp.telefono IS 'E.164 sin ''+'' (ej. 51947367258).';


-- ============================================================================
-- 3. TABLA wa_conversaciones_dm
-- Estado del diálogo 1:1 del bot con cada remitente (onboarding por DNI,
-- pedidos de reenvío, desambiguación de tipo).
-- ============================================================================

CREATE TABLE IF NOT EXISTS wa_conversaciones_dm (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_remitente_jid          VARCHAR(100) NOT NULL,
    estado                    VARCHAR(30)  NOT NULL DEFAULT 'IDLE',
    contexto                  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ultimo_mensaje_bot_at     TIMESTAMPTZ,
    ultimo_mensaje_usuario_at TIMESTAMPTZ,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_conversaciones_dm DROP CONSTRAINT IF EXISTS wa_conversaciones_dm_estado_check;
ALTER TABLE wa_conversaciones_dm ADD  CONSTRAINT wa_conversaciones_dm_estado_check
    CHECK (estado IN ('IDLE', 'ESPERANDO_DNI', 'ESPERANDO_REENVIO', 'ESPERANDO_TIPO', 'ESPERANDO_APOYO', 'BLOQUEADO'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_conversaciones_dm_jid
    ON wa_conversaciones_dm (wa_remitente_jid);
CREATE INDEX IF NOT EXISTS idx_wa_conversaciones_dm_estado
    ON wa_conversaciones_dm (estado) WHERE estado <> 'IDLE';

DROP TRIGGER IF EXISTS set_updated_at ON wa_conversaciones_dm;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON wa_conversaciones_dm
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE  wa_conversaciones_dm IS
    'Máquina de estados del diálogo 1:1 del bot con cada remitente. Spec SPEC_ASISTENCIA_WHATSAPP §3.4.';
COMMENT ON COLUMN wa_conversaciones_dm.contexto IS
    'Contexto del turno, ej. {"asistencia_id":"...","marcacion_raw_id":"...","intentos":1}';


-- ============================================================================
-- 4. ALTER asistencia
-- ============================================================================

-- 4.1 Ampliar `tipo` para los valores REFRIGERIO_* (VARCHAR(10) no alcanza)
ALTER TABLE asistencia ALTER COLUMN tipo TYPE VARCHAR(20);

ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_tipo_check;
ALTER TABLE asistencia ADD  CONSTRAINT asistencia_tipo_check
    CHECK (tipo IN ('ENTRADA', 'SALIDA', 'REFRIGERIO_INICIO', 'REFRIGERIO_FIN'));

-- 4.2 Origen y trazabilidad WhatsApp
ALTER TABLE asistencia
    ADD COLUMN IF NOT EXISTS origen              VARCHAR(20) NOT NULL DEFAULT 'APP',
    ADD COLUMN IF NOT EXISTS marcacion_raw_id    UUID REFERENCES marcaciones_raw(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS wa_message_id       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS wa_remitente_jid    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS caption_original    TEXT,
    ADD COLUMN IF NOT EXISTS app_detectada       VARCHAR(30),
    ADD COLUMN IF NOT EXISTS ai_extraccion       JSONB,
    ADD COLUMN IF NOT EXISTS ai_confianza        DECIMAL(4,3),
    ADD COLUMN IF NOT EXISTS motivos_observacion TEXT[],
    ADD COLUMN IF NOT EXISTS notificado_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reenvio_de_id       UUID REFERENCES asistencia(id) ON DELETE SET NULL;

ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_origen_check;
ALTER TABLE asistencia ADD  CONSTRAINT asistencia_origen_check
    CHECK (origen IN ('APP', 'WHATSAPP_GRUPO', 'WHATSAPP_DM', 'MANUAL'));

ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_app_detectada_check;
ALTER TABLE asistencia ADD  CONSTRAINT asistencia_app_detectada_check
    CHECK (app_detectada IS NULL OR app_detectada IN ('TIMEMARK', 'GPS_MAP_CAMERA', 'NINGUNA', 'OTRA'));

ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_ai_confianza_check;
ALTER TABLE asistencia ADD  CONSTRAINT asistencia_ai_confianza_check
    CHECK (ai_confianza IS NULL OR (ai_confianza >= 0 AND ai_confianza <= 1));

-- 4.3 Índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_asistencia_wa_message
    ON asistencia (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asistencia_origen_fecha
    ON asistencia (origen, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencia_marcacion_raw
    ON asistencia (marcacion_raw_id) WHERE marcacion_raw_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asistencia_observadas
    ON asistencia (estado, fecha DESC) WHERE estado = 'OBSERVADO';

COMMENT ON COLUMN asistencia.origen              IS 'APP | WHATSAPP_GRUPO | WHATSAPP_DM | MANUAL';
COMMENT ON COLUMN asistencia.marcacion_raw_id    IS 'FK → marcaciones_raw.id — mensaje crudo que originó esta marcación.';
COMMENT ON COLUMN asistencia.ai_extraccion       IS 'Salida completa de Claude Vision. Esquema en SPEC_ASISTENCIA_WHATSAPP §3.1.';
COMMENT ON COLUMN asistencia.motivos_observacion IS 'Códigos de regla incumplida (§4.5): APP_NO_VALIDA, SIN_ROSTRO, FUERA_DE_RADIO, ...';
COMMENT ON COLUMN asistencia.reenvio_de_id       IS 'Si esta fila reemplaza una marcación observada previa (§4.7).';


-- ============================================================================
-- 5. alertas_rrhh — 6 tipos nuevos (§3.5)
-- Recrea el CHECK de `tipo` si existe, con los 14 tipos previos + los 6 nuevos.
-- ============================================================================

DO $$
DECLARE
    c RECORD;
BEGIN
    -- Elimina cualquier CHECK existente sobre alertas_rrhh que involucre `tipo`
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE rel.relname = 'alertas_rrhh'
          AND ns.nspname = 'public'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%tipo%'
    LOOP
        EXECUTE format('ALTER TABLE alertas_rrhh DROP CONSTRAINT %I', c.conname);
    END LOOP;

    EXECUTE $ck$
        ALTER TABLE alertas_rrhh ADD CONSTRAINT alertas_rrhh_tipo_check
        CHECK (tipo IN (
            -- v3.0 (migración 024)
            'CONTRATO_POR_VENCER', 'VISADO_PENDIENTE', 'PERIODO_PRUEBA_VENCER',
            'CANDIDATO_ESTANCADO', 'AUSENCIA_SIN_JUSTIFICAR', 'ABANDONO_POTENCIAL',
            'RIESGO_FUGA', 'INCIDENCIA_REINCIDENTE', 'COBERTURA_BAJA',
            'CUMPLEANOS', 'TURNO_SIN_ASIGNAR', 'PERMISO_PENDIENTE',
            'OFFBOARDING_PENDIENTE', 'GENERAL',
            -- v3.2 (migración 031 — asistencia WhatsApp)
            'TIENDA_SIN_APERTURA', 'MARCACION_OBSERVADA', 'REFRIGERIO_SIN_RETORNO',
            'SALIDA_NO_MARCADA', 'REMITENTE_NO_IDENTIFICADO', 'WHATSAPP_DESCONECTADO'
        ))
    $ck$;
END $$;


-- ============================================================================
-- 6. system_config — parámetros del módulo (§3.6)
-- Categoría propia 'asistencia'. Ninguna clave es secreta: las credenciales
-- de Evolution viven en env vars de Vercel.
-- ============================================================================

INSERT INTO system_config (key, value, description, is_secret, category) VALUES
    ('asistencia.wa.grupo_jid',              '120363159136433081@g.us',
     'JID del grupo "Asistencia Tiendas Express" monitoreado por el bot',                 false, 'asistencia'),
    ('asistencia.wa.instance',               'pbd-asistencia',
     'Nombre de la instancia de Evolution API (Baileys)',                                 false, 'asistencia'),
    ('asistencia.wa.storage_bucket',         'asistencia',
     'Bucket privado de Supabase Storage donde se guardan las selfies de marcación',      false, 'asistencia'),
    ('asistencia.apps_validas',              '["TIMEMARK","GPS_MAP_CAMERA"]',
     'Apps de selfie fedateada aceptadas (JSON array)',                                   false, 'asistencia'),
    ('asistencia.tolerancia_tardanza_min',   '5',
     'Tolerancia de tardanza en minutos si el turno no define la suya',                   false, 'asistencia'),
    ('asistencia.tolerancia_watermark_min',  '10',
     'Máxima diferencia permitida entre la hora del watermark y la del mensaje',          false, 'asistencia'),
    ('asistencia.radio_default_m',           '150',
     'Radio GPS por defecto en metros si la tienda no define radio_validacion_metros',    false, 'asistencia'),
    ('asistencia.refrigerio_max_min',        '60',
     'Duración máxima de refrigerio en minutos',                                          false, 'asistencia'),
    ('asistencia.alerta_apertura_delay_min', '15',
     'Minutos después de la hora de apertura para alertar TIENDA_SIN_APERTURA',           false, 'asistencia'),
    ('asistencia.dm_habilitado',             'false',
     'Kill switch de DMs. FALSE durante el modo sombra de Fase 0; TRUE al activar Fase 1',false, 'asistencia'),
    ('asistencia.resumen_grupo_habilitado',  'false',
     'Publicar un resumen diario en el grupo (desactivado por defecto)',                  false, 'asistencia')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 7. STORAGE — bucket privado para las selfies de marcación
-- Estructura de rutas: asistencia/YYYY/MM/DD/<marcacion_raw_id>.jpg
-- (Si tu proyecto ya usa el bucket `rrhh-asistencia`, ajusta la clave
--  system_config 'asistencia.wa.storage_bucket' y omite este bloque.)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('asistencia', 'asistencia', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 8. RLS — DESHABILITADO (coherente con 008_disable_rls_for_mvp y 032)
-- GridRetail no usa Supabase Auth: la sesión se resuelve en la app, por lo que
-- auth.uid() siempre es NULL y cualquier política basada en él bloquearía todo.
-- Las políticas equivalentes quedan escritas al final del archivo, comentadas,
-- para el día que se migre a Supabase Auth.
-- ============================================================================

ALTER TABLE marcaciones_raw      DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_whatsapp    DISABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversaciones_dm DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- POLÍTICAS RLS (referencia — solo si algún día se migra a Supabase Auth)
-- No ejecutar hoy: auth.uid() es NULL con la autenticación propia de GridRetail
-- y estas políticas bloquearían todo acceso. Ver 008_disable_rls_for_mvp.
-- ============================================================================
-- ALTER TABLE marcaciones_raw ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY marcaciones_raw_select_policy ON marcaciones_raw
--     FOR SELECT USING (EXISTS (
--         SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.activo = true
--           AND u.rol IN ('SUPERVISOR','JEFE_VENTAS','GERENTE_COMERCIAL',
--                         'GERENTE_GENERAL','BACKOFFICE_RRHH','BACKOFFICE_AUDITORIA','ADMIN')));
--
-- CREATE POLICY marcaciones_raw_update_policy ON marcaciones_raw
--     FOR UPDATE USING (EXISTS (
--         SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.activo = true
--           AND u.rol IN ('SUPERVISOR','BACKOFFICE_RRHH','ADMIN')));
--
-- CREATE POLICY marcaciones_raw_delete_policy ON marcaciones_raw
--     FOR DELETE USING (EXISTS (
--         SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'ADMIN'));
--
-- -- Sin política de INSERT: solo el service role (webhook) inserta.
--
-- ALTER TABLE usuarios_whatsapp ENABLE ROW LEVEL SECURITY;
--
-- -- OJO: usuario_id es usuarios_rrhh.id (persona). El "propio" se resuelve
-- -- vía usuarios_rrhh.usuario_id = auth.uid() tras la migración 033.
-- CREATE POLICY usuarios_whatsapp_select_policy ON usuarios_whatsapp
--     FOR SELECT USING (
--         EXISTS (SELECT 1 FROM usuarios_rrhh r
--                 WHERE r.id = usuarios_whatsapp.usuario_id AND r.usuario_id = auth.uid())
--         OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.activo = true
--               AND u.rol IN ('SUPERVISOR','JEFE_VENTAS','GERENTE_COMERCIAL',
--                             'GERENTE_GENERAL','BACKOFFICE_RRHH','ADMIN')));
--
-- CREATE POLICY usuarios_whatsapp_all_policy ON usuarios_whatsapp
--     FOR ALL USING (EXISTS (
--         SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.activo = true
--           AND u.rol IN ('BACKOFFICE_RRHH','ADMIN')));
--
-- ALTER TABLE wa_conversaciones_dm ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY wa_conversaciones_dm_select_policy ON wa_conversaciones_dm
--     FOR SELECT USING (EXISTS (
--         SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.activo = true
--           AND u.rol IN ('SUPERVISOR','BACKOFFICE_RRHH','ADMIN')));
--
-- CREATE POLICY wa_conversaciones_dm_all_policy ON wa_conversaciones_dm
--     FOR ALL USING (EXISTS (
--         SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.activo = true
--           AND u.rol IN ('BACKOFFICE_RRHH','ADMIN')));

-- ============================================================================
-- ROLLBACK (referencia — no ejecutar salvo necesidad)
-- ============================================================================
-- BEGIN;
--   ALTER TABLE asistencia
--     DROP COLUMN IF EXISTS reenvio_de_id,       DROP COLUMN IF EXISTS notificado_at,
--     DROP COLUMN IF EXISTS motivos_observacion, DROP COLUMN IF EXISTS ai_confianza,
--     DROP COLUMN IF EXISTS ai_extraccion,       DROP COLUMN IF EXISTS app_detectada,
--     DROP COLUMN IF EXISTS caption_original,    DROP COLUMN IF EXISTS wa_remitente_jid,
--     DROP COLUMN IF EXISTS wa_message_id,       DROP COLUMN IF EXISTS marcacion_raw_id,
--     DROP COLUMN IF EXISTS origen;
--   ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_tipo_check;
--   ALTER TABLE asistencia ADD  CONSTRAINT asistencia_tipo_check CHECK (tipo IN ('ENTRADA','SALIDA'));
--   DROP TABLE IF EXISTS wa_conversaciones_dm;
--   DROP TABLE IF EXISTS usuarios_whatsapp;
--   DROP TABLE IF EXISTS marcaciones_raw;
--   DELETE FROM system_config WHERE category = 'asistencia';
-- COMMIT;
