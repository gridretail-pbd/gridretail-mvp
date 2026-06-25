-- ============================================================================
-- MIGRACIÓN CONSOLIDADA: Módulo RRHH — GridRetail
-- Fecha: 2026-02-13
-- Versión: 1.0
--
-- INSTRUCCIONES:
--   Ejecutar este script COMPLETO en Supabase SQL Editor.
--   Contiene 5 migraciones en orden de dependencia:
--     020 - Core RRHH (usuarios_rrhh, status_log, ai_tasks, ALTER tiendas)
--     021 - Reclutamiento (candidatos, etapas, entrevistas, documentos)
--     022 - Contratos (contratos, renovacion_lotes, renovacion_decisiones)
--     023 - Operativo (asistencia, turnos, horarios, incidencias, permisos)
--     024 - Gestión (movimientos, offboarding, documentos, alertas)
--
-- PREREQUISITOS:
--   - Tablas 'usuarios' y 'tiendas' deben existir
--   - Función 'trigger_set_updated_at()' debe existir
--   - Función 'auth.uid()' de Supabase Auth debe estar disponible
--
-- RESULTADO:
--   21 tablas nuevas + 1 ALTER + 61 índices + 12 triggers + 61 RLS policies
-- ============================================================================

-- ============================================================================
-- MIGRACIÓN 020: Core RRHH
-- Módulo: RRHH
-- Fecha: 2026-02-13
-- Contenido: usuarios_rrhh, usuarios_status_log, ai_tasks, ALTER tiendas
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. ALTER tiendas — Agregar coordenadas GPS para validación de asistencia
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS radio_validacion_metros INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS zona VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hora_apertura TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS hora_cierre TIME DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS hc_minimo INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS hc_ideal INTEGER DEFAULT 3;

COMMENT ON COLUMN tiendas.gps_lat IS 'Latitud de la tienda para validación GPS de asistencia';
COMMENT ON COLUMN tiendas.gps_lng IS 'Longitud de la tienda para validación GPS de asistencia';
COMMENT ON COLUMN tiendas.radio_validacion_metros IS 'Radio en metros para validar marcación GPS (default 100m)';
COMMENT ON COLUMN tiendas.zona IS 'Zona geográfica (NORTE, SUR, ESTE, CENTRO)';
COMMENT ON COLUMN tiendas.hora_apertura IS 'Hora estándar de apertura';
COMMENT ON COLUMN tiendas.hora_cierre IS 'Hora estándar de cierre';
COMMENT ON COLUMN tiendas.hc_minimo IS 'Headcount mínimo requerido para operar';
COMMENT ON COLUMN tiendas.hc_ideal IS 'Headcount ideal de operación';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. usuarios_rrhh — Extensión 1:1 de usuarios con datos laborales
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_rrhh (
    id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,

    -- Datos personales ampliados
    fecha_nacimiento DATE,
    genero VARCHAR(20),
    estado_civil VARCHAR(20),
    telefono_personal VARCHAR(20),
    direccion_domiciliaria TEXT,
    distrito_residencia VARCHAR(100),
    gps_domicilio_lat DECIMAL(10,7),
    gps_domicilio_lng DECIMAL(10,7),

    -- Contacto de emergencia
    contacto_emergencia_nombre VARCHAR(200),
    contacto_emergencia_telefono VARCHAR(20),
    contacto_emergencia_parentesco VARCHAR(50),

    -- Datos bancarios
    banco VARCHAR(100),
    numero_cuenta VARCHAR(50),
    cci VARCHAR(25),

    -- Datos laborales
    fecha_ingreso DATE NOT NULL,
    fecha_fin_contrato DATE,
    tipo_contrato_actual VARCHAR(20) DEFAULT 'PLAZO_FIJO',
    regimen_laboral VARCHAR(50),
    cargo_formal VARCHAR(100),
    area_funcional VARCHAR(30) DEFAULT 'COMERCIAL',
    jefe_directo_id UUID REFERENCES usuarios(id),
    remuneracion_actual DECIMAL(10,2),

    -- Status RRHH
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    -- Operativo
    talla_uniforme VARCHAR(10),
    tiene_equipo_corporativo BOOLEAN DEFAULT false,
    equipo_corporativo_detalle TEXT,
    foto_url TEXT,

    -- Metadata
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT usuarios_rrhh_genero_check
        CHECK (genero IS NULL OR genero IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA')),
    CONSTRAINT usuarios_rrhh_estado_civil_check
        CHECK (estado_civil IS NULL OR estado_civil IN ('SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO')),
    CONSTRAINT usuarios_rrhh_tipo_contrato_check
        CHECK (tipo_contrato_actual IN ('PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA')),
    CONSTRAINT usuarios_rrhh_area_funcional_check
        CHECK (area_funcional IN ('COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION')),
    CONSTRAINT usuarios_rrhh_status_check
        CHECK (status IN (
            'CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA',
            'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'
        ))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_status ON usuarios_rrhh(status);
CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_fecha_ingreso ON usuarios_rrhh(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_fecha_fin_contrato ON usuarios_rrhh(fecha_fin_contrato);
CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_jefe_directo ON usuarios_rrhh(jefe_directo_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_area ON usuarios_rrhh(area_funcional);

DROP TRIGGER IF EXISTS set_updated_at ON usuarios_rrhh;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON usuarios_rrhh
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE usuarios_rrhh IS 'Extensión 1:1 de usuarios con datos laborales, personales y bancarios para RRHH';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. usuarios_status_log — Historial de cambios de estado
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status_anterior VARCHAR(20),
    status_nuevo VARCHAR(20) NOT NULL,
    motivo TEXT,
    fecha_efectiva DATE NOT NULL DEFAULT CURRENT_DATE,
    registrado_por UUID REFERENCES usuarios(id),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT status_log_anterior_check
        CHECK (status_anterior IS NULL OR status_anterior IN (
            'CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA',
            'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'
        )),
    CONSTRAINT status_log_nuevo_check
        CHECK (status_nuevo IN (
            'CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA',
            'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'
        ))
);

CREATE INDEX IF NOT EXISTS idx_status_log_usuario ON usuarios_status_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_status_log_fecha ON usuarios_status_log(fecha_efectiva);
CREATE INDEX IF NOT EXISTS idx_status_log_status_nuevo ON usuarios_status_log(status_nuevo);

COMMENT ON TABLE usuarios_status_log IS 'Historial de cambios de estado laboral del colaborador con trazabilidad';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ai_tasks — Registro de todas las tareas AI ejecutadas
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(40) NOT NULL,
    modulo VARCHAR(30) NOT NULL DEFAULT 'RRHH',
    entidad_tipo VARCHAR(30),
    entidad_id UUID,
    modelo VARCHAR(50),
    prompt_version VARCHAR(20),
    input_summary TEXT,
    output JSONB,
    ai_confidence DECIMAL(5,4),
    tokens_input INTEGER,
    tokens_output INTEGER,
    costo_estimado_usd DECIMAL(8,6),
    latency_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    reintentos INTEGER DEFAULT 0,
    solicitado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_tasks_tipo_check
        CHECK (tipo IN (
            'CV_PARSING', 'ENTREVISTA_TRANSCRIPCION', 'ENTREVISTA_ANALISIS',
            'CONTRATO_GENERACION', 'RENOVACION_RESUMEN', 'SCORING_CANDIDATO',
            'RIESGO_FUGA', 'CHATBOT_QUERY', 'DOCUMENTO_OCR', 'EMAIL_DRAFT',
            'ANOMALIA_DETECCION', 'INDUCCION_PLAN', 'OFFBOARDING_CHECKLIST'
        )),
    CONSTRAINT ai_tasks_status_check
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_tipo ON ai_tasks(tipo);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_entidad ON ai_tasks(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created ON ai_tasks(created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON ai_tasks;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON ai_tasks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE ai_tasks IS 'Log de todas las tareas AI ejecutadas. Permite auditoría, mejora de prompts y monitoreo de costos';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policies — Migración 020
-- ────────────────────────────────────────────────────────────────────────────

-- usuarios_rrhh: cada usuario ve su propia ficha; RRHH y jefatura ven todo
ALTER TABLE usuarios_rrhh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_rrhh_select_propia" ON usuarios_rrhh
    FOR SELECT USING (
        id = auth.uid()
    );

CREATE POLICY "usuarios_rrhh_select_gestion" ON usuarios_rrhh
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS', 'SUPERVISOR'
            )
        )
    );

CREATE POLICY "usuarios_rrhh_insert" ON usuarios_rrhh
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

CREATE POLICY "usuarios_rrhh_update_propia" ON usuarios_rrhh
    FOR UPDATE USING (
        id = auth.uid()
    )
    WITH CHECK (
        id = auth.uid()
    );

CREATE POLICY "usuarios_rrhh_update_gestion" ON usuarios_rrhh
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- usuarios_status_log: lectura para supervisores+; escritura solo RRHH/ADMIN
ALTER TABLE usuarios_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_log_select" ON usuarios_status_log
    FOR SELECT USING (
        usuario_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS', 'SUPERVISOR'
            )
        )
    );

CREATE POLICY "status_log_insert" ON usuarios_status_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- ai_tasks: solo RRHH/ADMIN/Backoffice ven y gestionan
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_tasks_select" ON ai_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'BACKOFFICE_OPERACIONES',
                'GERENTE_COMERCIAL', 'GERENTE_GENERAL'
            )
        )
    );

CREATE POLICY "ai_tasks_all" ON ai_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );


-- ############################################################################
-- ############################################################################

-- ============================================================================
-- MIGRACIÓN 021: Reclutamiento
-- Módulo: RRHH
-- Fecha: 2026-02-13
-- Contenido: candidatos, candidatos_etapas, candidatos_entrevistas,
--            candidatos_documentos
-- Depende de: 020_rrhh_core.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. candidatos — Registro central del pipeline de reclutamiento
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Datos personales
    dni VARCHAR(8) NOT NULL,
    nombre_completo VARCHAR(200) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(200),
    fecha_nacimiento DATE,
    genero VARCHAR(20),
    distrito_residencia VARCHAR(100),
    direccion TEXT,
    gps_domicilio_lat DECIMAL(10,7),
    gps_domicilio_lng DECIMAL(10,7),

    -- Experiencia y disponibilidad
    experiencia_telecom BOOLEAN NOT NULL DEFAULT false,
    experiencia_detalle TEXT,
    disponibilidad_horario VARCHAR(50),
    disponibilidad_detalle TEXT,

    -- Pipeline
    etapa_actual VARCHAR(30) NOT NULL DEFAULT 'CAPTACION',
    fecha_captacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),

    -- Fuente
    fuente_captacion VARCHAR(30) NOT NULL DEFAULT 'CONVOCATORIA',
    referido_por UUID REFERENCES usuarios(id),

    -- Tienda destino (si ya se sabe)
    tienda_destino_id UUID REFERENCES tiendas(id),

    -- AI Scoring
    ai_score DECIMAL(5,2),
    ai_score_detalle JSONB,
    ai_task_id UUID REFERENCES ai_tasks(id),

    -- CV parseado por AI
    cv_url TEXT,
    cv_datos_extraidos JSONB,
    foto_url TEXT,

    -- Consulta a Entel
    entel_fecha_envio DATE,
    entel_estado VARCHAR(20),
    entel_fecha_respuesta DATE,
    entel_observaciones TEXT,

    -- Usuario Entel (credenciales)
    entel_usuario_fecha_solicitud DATE,
    entel_usuario_estado VARCHAR(20),
    entel_usuario_confirmado BOOLEAN DEFAULT false,

    -- Inducción
    induccion_fecha_inicio DATE,
    induccion_fecha_fin DATE,
    induccion_capacitador_id UUID REFERENCES usuarios(id),
    induccion_checklist JSONB,
    induccion_evaluacion VARCHAR(20),

    -- Sombra
    sombra_tienda_id UUID REFERENCES tiendas(id),
    sombra_mentor_id UUID REFERENCES usuarios(id),
    sombra_fecha_inicio DATE,
    sombra_fecha_fin DATE,
    sombra_evaluacion_mentor JSONB,
    sombra_evaluacion_supervisor JSONB,
    sombra_resultado VARCHAR(20),

    -- Descarte
    descartado BOOLEAN NOT NULL DEFAULT false,
    descarte_etapa VARCHAR(30),
    descarte_motivo TEXT,
    descarte_fecha DATE,
    descartado_por UUID REFERENCES usuarios(id),

    -- Si se convirtió en usuario
    usuario_generado_id UUID REFERENCES usuarios(id),

    -- Metadata
    notas TEXT,
    registrado_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT candidatos_etapa_check
        CHECK (etapa_actual IN (
            'CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL',
            'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA', 'ALTA', 'DESCARTADO'
        )),
    CONSTRAINT candidatos_fuente_check
        CHECK (fuente_captacion IN ('REFERIDO', 'PORTAL_EMPLEO', 'CONVOCATORIA', 'REINGRESO', 'BANCO_TALENTO')),
    CONSTRAINT candidatos_entel_estado_check
        CHECK (entel_estado IS NULL OR entel_estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'OBSERVADO')),
    CONSTRAINT candidatos_entel_usuario_estado_check
        CHECK (entel_usuario_estado IS NULL OR entel_usuario_estado IN ('SOLICITADO', 'EN_PROCESO', 'ENTREGADO')),
    CONSTRAINT candidatos_induccion_eval_check
        CHECK (induccion_evaluacion IS NULL OR induccion_evaluacion IN ('APROBADO', 'DESAPROBADO', 'EN_CURSO')),
    CONSTRAINT candidatos_sombra_resultado_check
        CHECK (sombra_resultado IS NULL OR sombra_resultado IN ('APROBADO', 'DESAPROBADO', 'EXTENDER')),
    CONSTRAINT candidatos_genero_check
        CHECK (genero IS NULL OR genero IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'))
);

CREATE INDEX IF NOT EXISTS idx_candidatos_dni ON candidatos(dni);
CREATE INDEX IF NOT EXISTS idx_candidatos_etapa ON candidatos(etapa_actual);
CREATE INDEX IF NOT EXISTS idx_candidatos_descartado ON candidatos(descartado);
CREATE INDEX IF NOT EXISTS idx_candidatos_fuente ON candidatos(fuente_captacion);
CREATE INDEX IF NOT EXISTS idx_candidatos_fecha_captacion ON candidatos(fecha_captacion);
CREATE INDEX IF NOT EXISTS idx_candidatos_referido_por ON candidatos(referido_por);
CREATE INDEX IF NOT EXISTS idx_candidatos_tienda_destino ON candidatos(tienda_destino_id);

DROP TRIGGER IF EXISTS set_updated_at ON candidatos;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON candidatos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE candidatos IS 'Registro central de candidatos en el pipeline de reclutamiento con todas las etapas inline';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. candidatos_etapas — Historial de movimientos por el pipeline
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidatos_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    etapa VARCHAR(30) NOT NULL,
    fecha_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_salida TIMESTAMPTZ,
    resultado VARCHAR(20),
    notas TEXT,
    registrado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT etapas_etapa_check
        CHECK (etapa IN (
            'CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL',
            'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA', 'ALTA', 'DESCARTADO'
        )),
    CONSTRAINT etapas_resultado_check
        CHECK (resultado IS NULL OR resultado IN ('APROBADO', 'RECHAZADO', 'EN_CURSO', 'PENDIENTE'))
);

CREATE INDEX IF NOT EXISTS idx_candidatos_etapas_candidato ON candidatos_etapas(candidato_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_etapas_etapa ON candidatos_etapas(etapa);

COMMENT ON TABLE candidatos_etapas IS 'Historial de movimientos del candidato por el pipeline. Permite medir tiempos por etapa.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. candidatos_entrevistas — Entrevistas multi-nivel
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidatos_entrevistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    nivel INTEGER NOT NULL DEFAULT 1,
    entrevistador_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_programada TIMESTAMPTZ,
    fecha_realizada TIMESTAMPTZ,

    -- Captura
    tipo_captura VARCHAR(10),
    media_url TEXT,
    duracion_segundos INTEGER,

    -- Transcripción
    transcripcion_texto TEXT,
    transcripcion_ai_task_id UUID REFERENCES ai_tasks(id),

    -- Análisis AI
    ai_analisis JSONB,
    ai_analisis_task_id UUID REFERENCES ai_tasks(id),

    -- Evaluación humana (scorecard)
    scorecard JSONB,
    observaciones TEXT,

    -- Resultado
    resultado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT entrevistas_tipo_captura_check
        CHECK (tipo_captura IS NULL OR tipo_captura IN ('VIDEO', 'AUDIO', 'TEXTO')),
    CONSTRAINT entrevistas_resultado_check
        CHECK (resultado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO'))
);

CREATE INDEX IF NOT EXISTS idx_entrevistas_candidato ON candidatos_entrevistas(candidato_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_entrevistador ON candidatos_entrevistas(entrevistador_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_resultado ON candidatos_entrevistas(resultado);

DROP TRIGGER IF EXISTS set_updated_at ON candidatos_entrevistas;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON candidatos_entrevistas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE candidatos_entrevistas IS 'Entrevistas multi-nivel con scorecard humana y análisis AI paralelo';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. candidatos_documentos — Documentos adjuntos del candidato
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidatos_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    nombre_archivo VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    mime_type VARCHAR(100),
    tamano_bytes INTEGER,
    ai_texto_extraido TEXT,
    ai_task_id UUID REFERENCES ai_tasks(id),
    subido_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT documentos_candidato_tipo_check
        CHECK (tipo IN ('CV', 'FOTO', 'DNI', 'CERTIFICADO', 'ANTECEDENTES', 'OTRO'))
);

CREATE INDEX IF NOT EXISTS idx_candidatos_docs_candidato ON candidatos_documentos(candidato_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_docs_tipo ON candidatos_documentos(tipo);

COMMENT ON TABLE candidatos_documentos IS 'Repositorio de documentos del candidato en Supabase Storage';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policies — Migración 021
-- ────────────────────────────────────────────────────────────────────────────

-- candidatos: RRHH/ADMIN gestiona; JV y superiores consultan; todos pueden referir
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidatos_select" ON candidatos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "candidatos_select_propio_referido" ON candidatos
    FOR SELECT USING (
        referido_por = auth.uid()
    );

CREATE POLICY "candidatos_insert" ON candidatos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.activo = true
        )
    );

CREATE POLICY "candidatos_update" ON candidatos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

CREATE POLICY "candidatos_delete" ON candidatos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('ADMIN')
        )
    );

-- candidatos_etapas, candidatos_entrevistas, candidatos_documentos:
-- Heredan visibilidad del candidato padre. Gestión solo RRHH/ADMIN.

ALTER TABLE candidatos_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cand_etapas_select" ON candidatos_etapas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "cand_etapas_all" ON candidatos_etapas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

ALTER TABLE candidatos_entrevistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cand_entrevistas_select" ON candidatos_entrevistas
    FOR SELECT USING (
        entrevistador_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "cand_entrevistas_insert" ON candidatos_entrevistas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL')
        )
    );

CREATE POLICY "cand_entrevistas_update" ON candidatos_entrevistas
    FOR UPDATE USING (
        entrevistador_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

ALTER TABLE candidatos_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cand_docs_select" ON candidatos_documentos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "cand_docs_all" ON candidatos_documentos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );


-- ############################################################################
-- ############################################################################

-- ============================================================================
-- MIGRACIÓN 022: Contratos y Ciclo de Renovación
-- Módulo: RRHH
-- Fecha: 2026-02-13
-- Contenido: contratos, renovacion_lotes, renovacion_decisiones
-- Depende de: 020_rrhh_core.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. contratos — Historial de contratos por colaborador
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo_contrato VARCHAR(20) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    cargo VARCHAR(100) NOT NULL,
    remuneracion DECIMAL(10,2) NOT NULL,
    tienda_asignada_id UUID REFERENCES tiendas(id),

    -- Estado del contrato
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',

    -- Documento
    documento_url TEXT,
    documento_generado_por_ai BOOLEAN DEFAULT false,
    ai_task_id UUID REFERENCES ai_tasks(id),

    -- Firma electrónica
    firma_colaborador_timestamp TIMESTAMPTZ,
    firma_colaborador_ip VARCHAR(45),
    firma_colaborador_geo JSONB,
    firma_colaborador_user_agent TEXT,

    -- Trazabilidad
    contrato_anterior_id UUID REFERENCES contratos(id),
    lote_renovacion_id UUID,  -- FK se agrega después de crear renovacion_lotes
    motivo_no_renovacion TEXT,

    -- Metadata
    notas TEXT,
    generado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contratos_tipo_check
        CHECK (tipo_contrato IN ('PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA')),
    CONSTRAINT contratos_estado_check
        CHECK (estado IN ('BORRADOR', 'ENVIADO', 'FIRMADO', 'VIGENTE', 'VENCIDO', 'CANCELADO', 'NO_RENOVADO'))
);

CREATE INDEX IF NOT EXISTS idx_contratos_usuario ON contratos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contratos_estado ON contratos(estado);
CREATE INDEX IF NOT EXISTS idx_contratos_fecha_fin ON contratos(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_contratos_tienda ON contratos(tienda_asignada_id);
CREATE INDEX IF NOT EXISTS idx_contratos_lote ON contratos(lote_renovacion_id);

DROP TRIGGER IF EXISTS set_updated_at ON contratos;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON contratos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE contratos IS 'Historial completo de contratos por colaborador con soporte de firma electrónica';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. renovacion_lotes — Ciclos mensuales de renovación
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS renovacion_lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo VARCHAR(7) NOT NULL,  -- Formato YYYY-MM
    fecha_generacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_limite_visado DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'GENERADO',
    total_colaboradores INTEGER DEFAULT 0,
    resumen JSONB,
    generado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lotes_periodo_check
        CHECK (periodo ~ '^\d{4}-\d{2}$'),
    CONSTRAINT lotes_estado_check
        CHECK (estado IN (
            'GENERADO', 'EN_VISADO_JV', 'EN_VISADO_KAM',
            'LISTO_PARA_RRHH', 'EJECUTADO', 'CANCELADO'
        ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_periodo ON renovacion_lotes(periodo);

DROP TRIGGER IF EXISTS set_updated_at ON renovacion_lotes;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON renovacion_lotes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Ahora que renovacion_lotes existe, agregar la FK en contratos
ALTER TABLE contratos
    ADD CONSTRAINT contratos_lote_fk
    FOREIGN KEY (lote_renovacion_id) REFERENCES renovacion_lotes(id);

COMMENT ON TABLE renovacion_lotes IS 'Lotes mensuales de renovación con flujo de visado JV → KAM → RRHH';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. renovacion_decisiones — Decisión de renovación por colaborador
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS renovacion_decisiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lote_id UUID NOT NULL REFERENCES renovacion_lotes(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    contrato_actual_id UUID REFERENCES contratos(id),

    -- Resumen AI
    ai_resumen TEXT,
    ai_recomendacion VARCHAR(20),
    ai_task_id UUID REFERENCES ai_tasks(id),

    -- Indicadores snapshot (congelados al momento de generar)
    indicadores_snapshot JSONB,

    -- Visado JV
    decision_jv VARCHAR(20),
    decision_jv_motivo TEXT,
    decision_jv_id UUID REFERENCES usuarios(id),
    decision_jv_fecha TIMESTAMPTZ,

    -- Visado KAM
    decision_kam VARCHAR(20),
    decision_kam_motivo TEXT,
    decision_kam_id UUID REFERENCES usuarios(id),
    decision_kam_fecha TIMESTAMPTZ,

    -- Decisión final
    decision_final VARCHAR(20),
    ejecutado_por UUID REFERENCES usuarios(id),
    ejecutado_fecha TIMESTAMPTZ,
    contrato_nuevo_id UUID REFERENCES contratos(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT decisiones_ai_rec_check
        CHECK (ai_recomendacion IS NULL OR ai_recomendacion IN ('RENOVAR', 'NO_RENOVAR', 'EVALUAR')),
    CONSTRAINT decisiones_jv_check
        CHECK (decision_jv IS NULL OR decision_jv IN ('RENOVAR', 'NO_RENOVAR', 'PENDIENTE_EVALUAR')),
    CONSTRAINT decisiones_kam_check
        CHECK (decision_kam IS NULL OR decision_kam IN ('CONFIRMAR', 'REVERTIR')),
    CONSTRAINT decisiones_final_check
        CHECK (decision_final IS NULL OR decision_final IN ('RENOVAR', 'NO_RENOVAR')),
    CONSTRAINT decisiones_unique_lote_usuario
        UNIQUE (lote_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_decisiones_lote ON renovacion_decisiones(lote_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_usuario ON renovacion_decisiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_final ON renovacion_decisiones(decision_final);

DROP TRIGGER IF EXISTS set_updated_at ON renovacion_decisiones;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON renovacion_decisiones
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE renovacion_decisiones IS 'Decisiones de renovación por colaborador con trazabilidad completa JV/KAM/RRHH';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policies — Migración 022
-- ────────────────────────────────────────────────────────────────────────────

-- contratos: colaborador ve los suyos; gestión RRHH/ADMIN
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_select_propio" ON contratos
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "contratos_select_gestion" ON contratos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "contratos_all" ON contratos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- renovacion_lotes: RRHH gestiona; JV/KAM leen para visar
ALTER TABLE renovacion_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lotes_select" ON renovacion_lotes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "lotes_all" ON renovacion_lotes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- renovacion_decisiones: JV/KAM pueden actualizar su parte; RRHH todo
ALTER TABLE renovacion_decisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decisiones_select" ON renovacion_decisiones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "decisiones_update_jv" ON renovacion_decisiones
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol = 'JEFE_VENTAS'
        )
    );

CREATE POLICY "decisiones_all" ON renovacion_decisiones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL')
        )
    );


-- ############################################################################
-- ############################################################################

-- ============================================================================
-- MIGRACIÓN 023: Módulos Operativos RRHH
-- Módulo: RRHH
-- Fecha: 2026-02-13
-- Contenido: asistencia, apertura_cierre_tienda, horarios_tienda, turnos,
--            asignacion_turnos, incidencias_laborales, solicitudes_permiso
-- Depende de: 020_rrhh_core.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. asistencia — Marcaciones de entrada/salida
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tienda_id UUID NOT NULL REFERENCES tiendas(id),
    tipo VARCHAR(10) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Timestamps
    hora_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hora_dispositivo TIMESTAMPTZ,

    -- Foto selfie
    foto_url TEXT,

    -- GPS
    gps_lat DECIMAL(10,7),
    gps_lng DECIMAL(10,7),
    gps_accuracy DECIMAL(8,2),
    dentro_radio BOOLEAN,
    distancia_tienda_metros DECIMAL(8,2),
    mock_location_detectado BOOLEAN DEFAULT false,

    -- Validación
    estado VARCHAR(20) NOT NULL DEFAULT 'VALIDO',
    es_tardanza BOOLEAN DEFAULT false,
    minutos_tardanza INTEGER DEFAULT 0,

    -- Edición posterior
    observaciones TEXT,
    editado_por UUID REFERENCES usuarios(id),
    editado_motivo TEXT,
    editado_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT asistencia_tipo_check
        CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    CONSTRAINT asistencia_estado_check
        CHECK (estado IN ('VALIDO', 'OBSERVADO', 'JUSTIFICADO', 'RECHAZADO', 'EDITADO')),
    CONSTRAINT asistencia_unique_marcacion
        UNIQUE (usuario_id, tienda_id, fecha, tipo)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_usuario_fecha ON asistencia(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_tienda_fecha ON asistencia(tienda_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_estado ON asistencia(estado);

COMMENT ON TABLE asistencia IS 'Marcaciones de entrada/salida con selfie georeferenciada y sistema anti-fraude de 4 capas';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. apertura_cierre_tienda — Registro de apertura/cierre diario
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apertura_cierre_tienda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tienda_id UUID NOT NULL REFERENCES tiendas(id),
    tipo VARCHAR(10) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Evidencia
    foto_url TEXT,
    gps_lat DECIMAL(10,7),
    gps_lng DECIMAL(10,7),

    -- Headcount
    cantidad_hc INTEGER NOT NULL DEFAULT 0,
    usuarios_presentes UUID[],

    -- Novedad
    novedades TEXT,
    registrado_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT apertura_cierre_tipo_check
        CHECK (tipo IN ('APERTURA', 'CIERRE')),
    CONSTRAINT apertura_cierre_unique
        UNIQUE (tienda_id, fecha, tipo)
);

CREATE INDEX IF NOT EXISTS idx_apertura_cierre_tienda_fecha ON apertura_cierre_tienda(tienda_id, fecha);

COMMENT ON TABLE apertura_cierre_tienda IS 'Registro diario de apertura y cierre de tienda con foto y headcount';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. horarios_tienda — Horarios base por tienda y día de semana
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horarios_tienda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tienda_id UUID NOT NULL REFERENCES tiendas(id),
    dia_semana INTEGER NOT NULL,  -- 0=Lunes, 6=Domingo
    hora_apertura TIME NOT NULL DEFAULT '09:00',
    hora_cierre TIME NOT NULL DEFAULT '21:00',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT horarios_dia_check CHECK (dia_semana BETWEEN 0 AND 6),
    CONSTRAINT horarios_unique UNIQUE (tienda_id, dia_semana)
);

DROP TRIGGER IF EXISTS set_updated_at ON horarios_tienda;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON horarios_tienda
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE horarios_tienda IS 'Horarios base de operación por tienda y día de semana';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. turnos — Catálogo de tipos de turno
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    hora_inicio TIME,
    hora_fin TIME,
    es_partido BOOLEAN DEFAULT false,
    hora_corte_inicio TIME,
    hora_corte_fin TIME,
    tolerancia_tardanza_minutos INTEGER DEFAULT 5,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE turnos IS 'Catálogo de tipos de turno con horarios y tolerancia de tardanza';

-- Seed de turnos base
INSERT INTO turnos (codigo, nombre, hora_inicio, hora_fin, tolerancia_tardanza_minutos) VALUES
    ('APERTURA', 'Turno Apertura', '09:00', '15:00', 5),
    ('CIERRE', 'Turno Cierre', '15:00', '21:00', 5),
    ('COMPLETO', 'Turno Completo', '09:00', '21:00', 5)
ON CONFLICT (codigo) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. asignacion_turnos — Turnos asignados a colaboradores
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asignacion_turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tienda_id UUID NOT NULL REFERENCES tiendas(id),
    turno_id UUID NOT NULL REFERENCES turnos(id),
    fecha DATE NOT NULL,
    es_dia_descanso BOOLEAN NOT NULL DEFAULT false,
    es_feriado BOOLEAN DEFAULT false,
    notas TEXT,
    asignado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT asignacion_unique UNIQUE (usuario_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asignacion_usuario_fecha ON asignacion_turnos(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asignacion_tienda_fecha ON asignacion_turnos(tienda_id, fecha);

DROP TRIGGER IF EXISTS set_updated_at ON asignacion_turnos;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON asignacion_turnos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE asignacion_turnos IS 'Programación de turnos por colaborador, día y tienda';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. incidencias_laborales — Registro de faltas disciplinarias
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidencias_laborales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(30) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion TEXT,
    
    -- Referencia a asistencia (si aplica)
    asistencia_id UUID REFERENCES asistencia(id),

    -- Flujo
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA',
    descargo_colaborador TEXT,
    descargo_fecha TIMESTAMPTZ,
    resolucion TEXT,
    resolucion_por UUID REFERENCES usuarios(id),
    resolucion_fecha TIMESTAMPTZ,

    -- Documento adjunto (amonestación escrita, acta)
    documento_url TEXT,

    -- Trazabilidad
    generada_automaticamente BOOLEAN DEFAULT false,
    registrado_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT incidencias_tipo_check
        CHECK (tipo IN (
            'TARDANZA', 'FALTA_INJUSTIFICADA', 'FALTA_JUSTIFICADA',
            'ABANDONO_PUESTO', 'AMONESTACION_VERBAL', 'AMONESTACION_ESCRITA',
            'SUSPENSION', 'SALIDA_ANTICIPADA', 'OTRO'
        )),
    CONSTRAINT incidencias_estado_check
        CHECK (estado IN ('REGISTRADA', 'NOTIFICADA', 'EN_DESCARGO', 'RESUELTA', 'ESCALADA', 'ANULADA'))
);

CREATE INDEX IF NOT EXISTS idx_incidencias_usuario ON incidencias_laborales(usuario_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_tipo ON incidencias_laborales(tipo);
CREATE INDEX IF NOT EXISTS idx_incidencias_fecha ON incidencias_laborales(fecha);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias_laborales(estado);

DROP TRIGGER IF EXISTS set_updated_at ON incidencias_laborales;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON incidencias_laborales
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE incidencias_laborales IS 'Registro disciplinario con flujo de notificación, descargo y resolución';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. solicitudes_permiso — Solicitudes de permisos y vacaciones
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes_permiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(30) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    horas_solicitadas DECIMAL(4,1),
    motivo TEXT NOT NULL,
    documento_adjunto_url TEXT,

    -- Aprobación
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    aprobado_por UUID REFERENCES usuarios(id),
    aprobado_fecha TIMESTAMPTZ,
    motivo_rechazo TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT permisos_tipo_check
        CHECK (tipo IN (
            'PERMISO_HORAS', 'PERMISO_DIA', 'VACACIONES',
            'LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD',
            'LICENCIA_FALLECIMIENTO', 'OTRO'
        )),
    CONSTRAINT permisos_estado_check
        CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO')),
    CONSTRAINT permisos_fechas_check
        CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_permisos_usuario ON solicitudes_permiso(usuario_id);
CREATE INDEX IF NOT EXISTS idx_permisos_estado ON solicitudes_permiso(estado);
CREATE INDEX IF NOT EXISTS idx_permisos_fechas ON solicitudes_permiso(fecha_inicio, fecha_fin);

DROP TRIGGER IF EXISTS set_updated_at ON solicitudes_permiso;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON solicitudes_permiso
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE solicitudes_permiso IS 'Solicitudes de permisos, vacaciones y licencias con flujo de aprobación';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policies — Migración 023
-- ────────────────────────────────────────────────────────────────────────────

-- asistencia
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asistencia_select_propia" ON asistencia
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "asistencia_select_gestion" ON asistencia
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS',
                'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

CREATE POLICY "asistencia_insert" ON asistencia
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

CREATE POLICY "asistencia_update" ON asistencia
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('SUPERVISOR', 'BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- apertura_cierre_tienda
ALTER TABLE apertura_cierre_tienda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apertura_cierre_select" ON apertura_cierre_tienda
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
                'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

CREATE POLICY "apertura_cierre_insert" ON apertura_cierre_tienda
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

-- horarios_tienda, turnos, asignacion_turnos
ALTER TABLE horarios_tienda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horarios_select" ON horarios_tienda
    FOR SELECT USING (true);  -- Todos ven horarios

CREATE POLICY "horarios_all" ON horarios_tienda
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turnos_select" ON turnos
    FOR SELECT USING (true);  -- Todos ven catálogo de turnos

CREATE POLICY "turnos_all" ON turnos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

ALTER TABLE asignacion_turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asignacion_select_propia" ON asignacion_turnos
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "asignacion_select_gestion" ON asignacion_turnos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS',
                'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

CREATE POLICY "asignacion_all" ON asignacion_turnos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

-- incidencias_laborales
ALTER TABLE incidencias_laborales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidencias_select_propia" ON incidencias_laborales
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "incidencias_select_gestion" ON incidencias_laborales
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS',
                'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

CREATE POLICY "incidencias_insert" ON incidencias_laborales
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS',
                'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

CREATE POLICY "incidencias_update" ON incidencias_laborales
    FOR UPDATE USING (
        usuario_id = auth.uid()  -- colaborador puede agregar descargo
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- solicitudes_permiso
ALTER TABLE solicitudes_permiso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permisos_select_propio" ON solicitudes_permiso
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "permisos_select_gestion" ON solicitudes_permiso
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'SUPERVISOR', 'JEFE_VENTAS', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );

CREATE POLICY "permisos_insert" ON solicitudes_permiso
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
    );

CREATE POLICY "permisos_update" ON solicitudes_permiso
    FOR UPDATE USING (
        (usuario_id = auth.uid() AND estado = 'PENDIENTE')  -- puede cancelar si pendiente
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'SUPERVISOR', 'JEFE_VENTAS', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'BACKOFFICE_RRHH', 'ADMIN'
            )
        )
    );


-- ############################################################################
-- ############################################################################

-- ============================================================================
-- MIGRACIÓN 024: Gestión (movimientos, offboarding, documentos, alertas)
-- Módulo: RRHH
-- Fecha: 2026-02-13
-- Contenido: movimientos_personal, offboarding_checklist,
--            documentos_colaborador, alertas_rrhh
-- Depende de: 020_rrhh_core.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. movimientos_personal — Historial de movimientos
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo_movimiento VARCHAR(30) NOT NULL,
    fecha_efectiva DATE NOT NULL,
    motivo TEXT,

    -- Snapshot de datos
    datos_anteriores JSONB,
    datos_nuevos JSONB,

    -- Referencias opcionales
    contrato_id UUID REFERENCES contratos(id),
    tienda_origen_id UUID REFERENCES tiendas(id),
    tienda_destino_id UUID REFERENCES tiendas(id),

    -- Trazabilidad
    autorizado_por UUID NOT NULL REFERENCES usuarios(id),
    documento_url TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT movimientos_tipo_check
        CHECK (tipo_movimiento IN (
            'INGRESO', 'TRANSFERENCIA', 'CAMBIO_ROL', 'CAMBIO_ZONA',
            'PROMOCION', 'CAMBIO_REMUNERACION',
            'CESE_VOLUNTARIO', 'CESE_DESPIDO', 'CESE_NO_RENOVACION',
            'CESE_ABANDONO', 'CESE_PERIODO_PRUEBA', 'REINGRESO'
        ))
);

CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos_personal(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_personal(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_personal(fecha_efectiva);

COMMENT ON TABLE movimientos_personal IS 'Historial de todos los movimientos de personal con datos antes/después';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. offboarding_checklist — Tareas de salida por colaborador
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offboarding_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo_salida VARCHAR(30) NOT NULL,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_cierre DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'EN_PROCESO',

    -- Tareas (JSONB array con checklist adaptativo)
    tareas JSONB NOT NULL DEFAULT '[]',

    -- AI
    generado_por_ai BOOLEAN DEFAULT false,
    ai_task_id UUID REFERENCES ai_tasks(id),

    -- Trazabilidad
    responsable_id UUID NOT NULL REFERENCES usuarios(id),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT offboarding_tipo_check
        CHECK (tipo_salida IN (
            'RENUNCIA', 'NO_RENOVACION', 'DESPIDO',
            'ABANDONO', 'PERIODO_PRUEBA', 'MUTUO_ACUERDO'
        )),
    CONSTRAINT offboarding_estado_check
        CHECK (estado IN ('EN_PROCESO', 'COMPLETADO', 'CANCELADO'))
);

CREATE INDEX IF NOT EXISTS idx_offboarding_usuario ON offboarding_checklist(usuario_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_estado ON offboarding_checklist(estado);

DROP TRIGGER IF EXISTS set_updated_at ON offboarding_checklist;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON offboarding_checklist
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE offboarding_checklist IS 'Checklist adaptativo de offboarding generado según tipo de salida';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. documentos_colaborador — Repositorio digital por persona
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_colaborador (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(30) NOT NULL,
    nombre_archivo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    url TEXT NOT NULL,
    mime_type VARCHAR(100),
    tamano_bytes INTEGER,

    -- OCR / AI
    ai_texto_extraido TEXT,
    ai_task_id UUID REFERENCES ai_tasks(id),

    -- Metadata
    fecha_documento DATE,
    es_confidencial BOOLEAN DEFAULT false,
    subido_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT docs_tipo_check
        CHECK (tipo IN (
            'CV', 'FOTO', 'DNI', 'CONTRATO', 'AMONESTACION',
            'CERTIFICADO', 'CARTA_NOTARIAL', 'LIQUIDACION',
            'EVALUACION', 'ENTREVISTA_GRABACION', 'ENTREVISTA_TRANSCRIPCION',
            'LICENCIA_MEDICA', 'OTRO'
        ))
);

CREATE INDEX IF NOT EXISTS idx_docs_usuario ON documentos_colaborador(usuario_id);
CREATE INDEX IF NOT EXISTS idx_docs_tipo ON documentos_colaborador(tipo);

COMMENT ON TABLE documentos_colaborador IS 'Repositorio digital de documentos por colaborador con soporte OCR';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. alertas_rrhh — Alertas automáticas del sistema
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas_rrhh (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(40) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    nivel VARCHAR(10) NOT NULL DEFAULT 'INFO',

    -- Contexto
    entidad_tipo VARCHAR(30),
    entidad_id UUID,
    modulo VARCHAR(30),
    datos_contexto JSONB,

    -- Destinatarios
    destinatario_id UUID REFERENCES usuarios(id),
    destinatario_rol VARCHAR(30),

    -- Estado
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    leida_at TIMESTAMPTZ,
    accion_tomada TEXT,
    accion_por UUID REFERENCES usuarios(id),
    accion_at TIMESTAMPTZ,

    -- Metadata
    generada_por VARCHAR(20) NOT NULL DEFAULT 'SISTEMA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT alertas_tipo_check
        CHECK (tipo IN (
            'CONTRATO_POR_VENCER', 'VISADO_PENDIENTE', 'PERIODO_PRUEBA_VENCER',
            'CANDIDATO_ESTANCADO', 'AUSENCIA_SIN_JUSTIFICAR', 'ABANDONO_POTENCIAL',
            'RIESGO_FUGA', 'INCIDENCIA_REINCIDENTE', 'COBERTURA_BAJA',
            'CUMPLEANOS', 'TURNO_SIN_ASIGNAR', 'PERMISO_PENDIENTE',
            'OFFBOARDING_PENDIENTE', 'GENERAL'
        )),
    CONSTRAINT alertas_nivel_check
        CHECK (nivel IN ('INFO', 'WARNING', 'CRITICAL')),
    CONSTRAINT alertas_estado_check
        CHECK (estado IN ('PENDIENTE', 'LEIDA', 'ACCIONADA', 'DESCARTADA')),
    CONSTRAINT alertas_generada_por_check
        CHECK (generada_por IN ('SISTEMA', 'AI', 'MANUAL'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_destinatario ON alertas_rrhh(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_rrhh(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_estado ON alertas_rrhh(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_nivel ON alertas_rrhh(nivel);
CREATE INDEX IF NOT EXISTS idx_alertas_created ON alertas_rrhh(created_at DESC);

COMMENT ON TABLE alertas_rrhh IS 'Alertas contextuales automáticas del módulo RRHH con priorización';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policies — Migración 024
-- ────────────────────────────────────────────────────────────────────────────

-- movimientos_personal
ALTER TABLE movimientos_personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimientos_select" ON movimientos_personal
    FOR SELECT USING (
        usuario_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "movimientos_all" ON movimientos_personal
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- offboarding_checklist
ALTER TABLE offboarding_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offboarding_select" ON offboarding_checklist
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS'
            )
        )
    );

CREATE POLICY "offboarding_all" ON offboarding_checklist
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- documentos_colaborador
ALTER TABLE documentos_colaborador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_select_propio" ON documentos_colaborador
    FOR SELECT USING (
        usuario_id = auth.uid() AND es_confidencial = false
    );

CREATE POLICY "docs_select_gestion" ON documentos_colaborador
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL'
            )
        )
    );

CREATE POLICY "docs_all" ON documentos_colaborador
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

-- alertas_rrhh
ALTER TABLE alertas_rrhh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_select_propia" ON alertas_rrhh
    FOR SELECT USING (destinatario_id = auth.uid());

CREATE POLICY "alertas_select_gestion" ON alertas_rrhh
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (
                'BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_COMERCIAL',
                'GERENTE_GENERAL', 'JEFE_VENTAS', 'SUPERVISOR'
            )
        )
    );

CREATE POLICY "alertas_update" ON alertas_rrhh
    FOR UPDATE USING (
        destinatario_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );

CREATE POLICY "alertas_insert" ON alertas_rrhh
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('BACKOFFICE_RRHH', 'ADMIN')
        )
    );
