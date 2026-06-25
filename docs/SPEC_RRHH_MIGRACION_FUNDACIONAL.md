# Módulo RRHH — Migración Fundacional y Spec de Desarrollo
## GridRetail

**Versión:** 1.0  
**Fecha:** 2026-02-13  
**Para:** Claude Code — Desarrollo Frontend + Backend  
**Prerrequisito:** Luis ejecuta las migraciones SQL en Supabase SQL Editor. Claude Code referencia este documento para implementar tipos, queries, rutas y componentes.

**Documento padre:** `SPEC_MODULO_RRHH.md` (lineamientos generales y lógica de negocio)

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-02-13 | Versión inicial: 21 tablas nuevas, 1 ALTER, tipos TS, schemas Zod, rutas |

---

## 1. RESUMEN

### 1.1 Alcance de esta Migración

Se crean **21 tablas nuevas** y se altera **1 tabla existente** (`tiendas`) para soportar todo el módulo RRHH. Las tablas se organizan en 5 migraciones SQL ejecutadas en orden:

| Migración | Contenido | Tablas |
|-----------|-----------|--------|
| `020_rrhh_core.sql` | Extensión de usuarios + status + alteración tiendas + AI tasks | 3 nuevas + 1 ALTER |
| `021_rrhh_reclutamiento.sql` | Pipeline de candidatos | 4 nuevas |
| `022_rrhh_contratos.sql` | Contratos y ciclo de renovación | 3 nuevas |
| `023_rrhh_operativo.sql` | Asistencia, horarios, turnos, incidencias, permisos | 7 nuevas |
| `024_rrhh_gestion.sql` | Movimientos, offboarding, documentos, alertas | 4 nuevas |

### 1.2 Dependencias entre Migraciones

```
020_rrhh_core ──────────────┬──────────────────────────────────┐
  (usuarios_rrhh,           │                                  │
   usuarios_status_log,     │                                  │
   ai_tasks,                │                                  │
   ALTER tiendas)           │                                  │
                            ▼                                  ▼
              021_rrhh_reclutamiento              022_rrhh_contratos
              (candidatos,                        (contratos,
               candidatos_etapas,                  renovacion_lotes,
               candidatos_entrevistas,             renovacion_decisiones)
               candidatos_documentos)                      │
                            │                              │
                            ▼                              ▼
                        023_rrhh_operativo ◄────────────────┘
                        (asistencia, apertura_cierre_tienda,
                         horarios_tienda, turnos,
                         asignacion_turnos,
                         incidencias_laborales,
                         solicitudes_permiso)
                                    │
                                    ▼
                          024_rrhh_gestion
                          (movimientos_personal,
                           offboarding_checklist,
                           documentos_colaborador,
                           alertas_rrhh)
```

### 1.3 Tablas Existentes Referenciadas

| Tabla | Rol en módulo RRHH |
|-------|-------------------|
| `usuarios` | Base de todo usuario/colaborador. FK principal. |
| `tiendas` | Ubicaciones. Se agrega lat/lng para validación GPS asistencia. |
| `usuarios_tiendas` | Relación M:N. Consultada para asignaciones y transferencias. |

### 1.4 Convenciones Seguidas

- Nomenclatura en **español, snake_case** (consistente con tablas Core)
- PKs tipo **UUID** con `gen_random_uuid()`
- Enums como **CHECK constraints** (no tipos PostgreSQL), consistente con `commission_schemes.status`, `ventas.estado`, etc.
- Trigger `trigger_set_updated_at()` reutilizado (ya existe en BD)
- RLS con grupos de roles definidos en `GRIDRETAIL_QUICK_REFERENCE.md`
- `created_at TIMESTAMPTZ DEFAULT NOW()` y `updated_at TIMESTAMPTZ DEFAULT NOW()` en toda tabla que lo necesite

---

## 2. MIGRACIONES SQL

### 2.1 Migración 020: Core RRHH

```sql
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
```

### 2.2 Migración 021: Reclutamiento

```sql
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
```

### 2.3 Migración 022: Contratos

```sql
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
```

### 2.4 Migración 023: Operativo

```sql
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
```

### 2.5 Migración 024: Gestión

```sql
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
```

---

## 3. TIPOS TYPESCRIPT

### 3.1 Enums y Constantes

```typescript
// src/lib/rrhh/types.ts

// ─── Status del Colaborador ────────────────────────────────────────────────
export const USUARIO_STATUS = [
  'CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA',
  'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'
] as const;
export type UsuarioStatus = typeof USUARIO_STATUS[number];

// ─── Pipeline de Candidatos ────────────────────────────────────────────────
export const ETAPA_PIPELINE = [
  'CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL',
  'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA', 'ALTA', 'DESCARTADO'
] as const;
export type EtapaPipeline = typeof ETAPA_PIPELINE[number];

export const FUENTE_CAPTACION = [
  'REFERIDO', 'PORTAL_EMPLEO', 'CONVOCATORIA', 'REINGRESO', 'BANCO_TALENTO'
] as const;
export type FuenteCaptacion = typeof FUENTE_CAPTACION[number];

// ─── Contratos ─────────────────────────────────────────────────────────────
export const TIPO_CONTRATO = ['PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA'] as const;
export type TipoContrato = typeof TIPO_CONTRATO[number];

export const ESTADO_CONTRATO = [
  'BORRADOR', 'ENVIADO', 'FIRMADO', 'VIGENTE', 'VENCIDO', 'CANCELADO', 'NO_RENOVADO'
] as const;
export type EstadoContrato = typeof ESTADO_CONTRATO[number];

// ─── Renovación ────────────────────────────────────────────────────────────
export const ESTADO_LOTE = [
  'GENERADO', 'EN_VISADO_JV', 'EN_VISADO_KAM',
  'LISTO_PARA_RRHH', 'EJECUTADO', 'CANCELADO'
] as const;
export type EstadoLote = typeof ESTADO_LOTE[number];

export const DECISION_JV = ['RENOVAR', 'NO_RENOVAR', 'PENDIENTE_EVALUAR'] as const;
export type DecisionJV = typeof DECISION_JV[number];

export const DECISION_KAM = ['CONFIRMAR', 'REVERTIR'] as const;
export type DecisionKAM = typeof DECISION_KAM[number];

export const DECISION_FINAL = ['RENOVAR', 'NO_RENOVAR'] as const;
export type DecisionFinal = typeof DECISION_FINAL[number];

export const AI_RECOMENDACION = ['RENOVAR', 'NO_RENOVAR', 'EVALUAR'] as const;
export type AIRecomendacion = typeof AI_RECOMENDACION[number];

// ─── Asistencia ────────────────────────────────────────────────────────────
export const TIPO_MARCACION = ['ENTRADA', 'SALIDA'] as const;
export type TipoMarcacion = typeof TIPO_MARCACION[number];

export const ESTADO_ASISTENCIA = ['VALIDO', 'OBSERVADO', 'JUSTIFICADO', 'RECHAZADO', 'EDITADO'] as const;
export type EstadoAsistencia = typeof ESTADO_ASISTENCIA[number];

// ─── Incidencias ───────────────────────────────────────────────────────────
export const TIPO_INCIDENCIA = [
  'TARDANZA', 'FALTA_INJUSTIFICADA', 'FALTA_JUSTIFICADA',
  'ABANDONO_PUESTO', 'AMONESTACION_VERBAL', 'AMONESTACION_ESCRITA',
  'SUSPENSION', 'SALIDA_ANTICIPADA', 'OTRO'
] as const;
export type TipoIncidencia = typeof TIPO_INCIDENCIA[number];

export const ESTADO_INCIDENCIA = [
  'REGISTRADA', 'NOTIFICADA', 'EN_DESCARGO', 'RESUELTA', 'ESCALADA', 'ANULADA'
] as const;
export type EstadoIncidencia = typeof ESTADO_INCIDENCIA[number];

// ─── Permisos ──────────────────────────────────────────────────────────────
export const TIPO_PERMISO = [
  'PERMISO_HORAS', 'PERMISO_DIA', 'VACACIONES',
  'LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD',
  'LICENCIA_FALLECIMIENTO', 'OTRO'
] as const;
export type TipoPermiso = typeof TIPO_PERMISO[number];

export const ESTADO_PERMISO = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO'] as const;
export type EstadoPermiso = typeof ESTADO_PERMISO[number];

// ─── Movimientos ───────────────────────────────────────────────────────────
export const TIPO_MOVIMIENTO = [
  'INGRESO', 'TRANSFERENCIA', 'CAMBIO_ROL', 'CAMBIO_ZONA',
  'PROMOCION', 'CAMBIO_REMUNERACION',
  'CESE_VOLUNTARIO', 'CESE_DESPIDO', 'CESE_NO_RENOVACION',
  'CESE_ABANDONO', 'CESE_PERIODO_PRUEBA', 'REINGRESO'
] as const;
export type TipoMovimiento = typeof TIPO_MOVIMIENTO[number];

// ─── Offboarding ───────────────────────────────────────────────────────────
export const TIPO_SALIDA = [
  'RENUNCIA', 'NO_RENOVACION', 'DESPIDO',
  'ABANDONO', 'PERIODO_PRUEBA', 'MUTUO_ACUERDO'
] as const;
export type TipoSalida = typeof TIPO_SALIDA[number];

// ─── Documentos ────────────────────────────────────────────────────────────
export const TIPO_DOCUMENTO_CANDIDATO = [
  'CV', 'FOTO', 'DNI', 'CERTIFICADO', 'ANTECEDENTES', 'OTRO'
] as const;
export type TipoDocumentoCandidato = typeof TIPO_DOCUMENTO_CANDIDATO[number];

export const TIPO_DOCUMENTO_COLABORADOR = [
  'CV', 'FOTO', 'DNI', 'CONTRATO', 'AMONESTACION',
  'CERTIFICADO', 'CARTA_NOTARIAL', 'LIQUIDACION',
  'EVALUACION', 'ENTREVISTA_GRABACION', 'ENTREVISTA_TRANSCRIPCION',
  'LICENCIA_MEDICA', 'OTRO'
] as const;
export type TipoDocumentoColaborador = typeof TIPO_DOCUMENTO_COLABORADOR[number];

// ─── Alertas ───────────────────────────────────────────────────────────────
export const TIPO_ALERTA = [
  'CONTRATO_POR_VENCER', 'VISADO_PENDIENTE', 'PERIODO_PRUEBA_VENCER',
  'CANDIDATO_ESTANCADO', 'AUSENCIA_SIN_JUSTIFICAR', 'ABANDONO_POTENCIAL',
  'RIESGO_FUGA', 'INCIDENCIA_REINCIDENTE', 'COBERTURA_BAJA',
  'CUMPLEANOS', 'TURNO_SIN_ASIGNAR', 'PERMISO_PENDIENTE',
  'OFFBOARDING_PENDIENTE', 'GENERAL'
] as const;
export type TipoAlerta = typeof TIPO_ALERTA[number];

export const NIVEL_ALERTA = ['INFO', 'WARNING', 'CRITICAL'] as const;
export type NivelAlerta = typeof NIVEL_ALERTA[number];

// ─── AI Tasks ──────────────────────────────────────────────────────────────
export const TIPO_AI_TASK = [
  'CV_PARSING', 'ENTREVISTA_TRANSCRIPCION', 'ENTREVISTA_ANALISIS',
  'CONTRATO_GENERACION', 'RENOVACION_RESUMEN', 'SCORING_CANDIDATO',
  'RIESGO_FUGA', 'CHATBOT_QUERY', 'DOCUMENTO_OCR', 'EMAIL_DRAFT',
  'ANOMALIA_DETECCION', 'INDUCCION_PLAN', 'OFFBOARDING_CHECKLIST'
] as const;
export type TipoAITask = typeof TIPO_AI_TASK[number];

export const ESTADO_AI_TASK = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type EstadoAITask = typeof ESTADO_AI_TASK[number];

// ─── Áreas funcionales ────────────────────────────────────────────────────
export const AREA_FUNCIONAL = [
  'COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION'
] as const;
export type AreaFuncional = typeof AREA_FUNCIONAL[number];

export const GENERO = ['MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'] as const;
export type Genero = typeof GENERO[number];

export const ESTADO_CIVIL = ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'] as const;
export type EstadoCivil = typeof ESTADO_CIVIL[number];
```

### 3.2 Interfaces de Datos

```typescript
// src/lib/rrhh/interfaces.ts
import type {
  UsuarioStatus, EtapaPipeline, FuenteCaptacion, TipoContrato,
  EstadoContrato, EstadoLote, DecisionJV, DecisionKAM, DecisionFinal,
  AIRecomendacion, TipoMarcacion, EstadoAsistencia, TipoIncidencia,
  EstadoIncidencia, TipoPermiso, EstadoPermiso, TipoMovimiento,
  TipoSalida, TipoAITask, EstadoAITask, AreaFuncional, Genero,
  EstadoCivil, NivelAlerta, TipoAlerta
} from './types';

// ─── Core ──────────────────────────────────────────────────────────────────
export interface UsuarioRRHH {
  id: string;
  fecha_nacimiento: string | null;
  genero: Genero | null;
  estado_civil: EstadoCivil | null;
  telefono_personal: string | null;
  direccion_domiciliaria: string | null;
  distrito_residencia: string | null;
  gps_domicilio_lat: number | null;
  gps_domicilio_lng: number | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  contacto_emergencia_parentesco: string | null;
  banco: string | null;
  numero_cuenta: string | null;
  cci: string | null;
  fecha_ingreso: string;
  fecha_fin_contrato: string | null;
  tipo_contrato_actual: TipoContrato;
  regimen_laboral: string | null;
  cargo_formal: string | null;
  area_funcional: AreaFuncional;
  jefe_directo_id: string | null;
  remuneracion_actual: number | null;
  status: UsuarioStatus;
  talla_uniforme: string | null;
  tiene_equipo_corporativo: boolean;
  equipo_corporativo_detalle: string | null;
  foto_url: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones (opcionales, para queries con join)
  usuario?: { nombre_completo: string; dni: string; codigo_asesor: string; rol: string; activo: boolean };
  jefe_directo?: { nombre_completo: string } | null;
}

export interface UsuarioStatusLog {
  id: string;
  usuario_id: string;
  status_anterior: UsuarioStatus | null;
  status_nuevo: UsuarioStatus;
  motivo: string | null;
  fecha_efectiva: string;
  registrado_por: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Reclutamiento ─────────────────────────────────────────────────────────
export interface Candidato {
  id: string;
  dni: string;
  nombre_completo: string;
  telefono: string;
  email: string | null;
  fecha_nacimiento: string | null;
  genero: Genero | null;
  distrito_residencia: string | null;
  direccion: string | null;
  gps_domicilio_lat: number | null;
  gps_domicilio_lng: number | null;
  experiencia_telecom: boolean;
  experiencia_detalle: string | null;
  disponibilidad_horario: string | null;
  disponibilidad_detalle: string | null;
  etapa_actual: EtapaPipeline;
  fecha_captacion: string;
  fecha_ultima_actualizacion: string | null;
  fuente_captacion: FuenteCaptacion;
  referido_por: string | null;
  tienda_destino_id: string | null;
  ai_score: number | null;
  ai_score_detalle: Record<string, unknown> | null;
  ai_task_id: string | null;
  cv_url: string | null;
  cv_datos_extraidos: Record<string, unknown> | null;
  foto_url: string | null;
  entel_fecha_envio: string | null;
  entel_estado: string | null;
  entel_fecha_respuesta: string | null;
  entel_observaciones: string | null;
  entel_usuario_fecha_solicitud: string | null;
  entel_usuario_estado: string | null;
  entel_usuario_confirmado: boolean;
  induccion_fecha_inicio: string | null;
  induccion_fecha_fin: string | null;
  induccion_capacitador_id: string | null;
  induccion_checklist: Record<string, unknown> | null;
  induccion_evaluacion: string | null;
  sombra_tienda_id: string | null;
  sombra_mentor_id: string | null;
  sombra_fecha_inicio: string | null;
  sombra_fecha_fin: string | null;
  sombra_evaluacion_mentor: Record<string, unknown> | null;
  sombra_evaluacion_supervisor: Record<string, unknown> | null;
  sombra_resultado: string | null;
  descartado: boolean;
  descarte_etapa: string | null;
  descarte_motivo: string | null;
  descarte_fecha: string | null;
  descartado_por: string | null;
  usuario_generado_id: string | null;
  notas: string | null;
  registrado_por: string;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales
  referido_por_usuario?: { nombre_completo: string } | null;
  tienda_destino?: { nombre: string; codigo: string } | null;
  entrevistas?: CandidatoEntrevista[];
  etapas?: CandidatoEtapa[];
  documentos?: CandidatoDocumento[];
}

export interface CandidatoEtapa {
  id: string;
  candidato_id: string;
  etapa: EtapaPipeline;
  fecha_entrada: string;
  fecha_salida: string | null;
  resultado: string | null;
  notas: string | null;
  registrado_por: string | null;
  created_at: string;
}

export interface CandidatoEntrevista {
  id: string;
  candidato_id: string;
  nivel: number;
  entrevistador_id: string;
  fecha_programada: string | null;
  fecha_realizada: string | null;
  tipo_captura: 'VIDEO' | 'AUDIO' | 'TEXTO' | null;
  media_url: string | null;
  duracion_segundos: number | null;
  transcripcion_texto: string | null;
  transcripcion_ai_task_id: string | null;
  ai_analisis: Record<string, unknown> | null;
  ai_analisis_task_id: string | null;
  scorecard: ScorecardData | null;
  observaciones: string | null;
  resultado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  created_at: string;
  updated_at: string;
  // Relaciones
  entrevistador?: { nombre_completo: string; rol: string };
}

export interface ScorecardData {
  criterios: ScorecardCriterio[];
  observaciones_generales?: string;
}

export interface ScorecardCriterio {
  nombre: string;
  puntaje: number;  // 1-5
  peso: number;     // peso relativo
  observacion?: string;
}

export interface CandidatoDocumento {
  id: string;
  candidato_id: string;
  tipo: string;
  nombre_archivo: string;
  url: string;
  mime_type: string | null;
  tamano_bytes: number | null;
  ai_texto_extraido: string | null;
  ai_task_id: string | null;
  subido_por: string;
  created_at: string;
}

// ─── Contratos ─────────────────────────────────────────────────────────────
export interface Contrato {
  id: string;
  usuario_id: string;
  tipo_contrato: TipoContrato;
  fecha_inicio: string;
  fecha_fin: string | null;
  cargo: string;
  remuneracion: number;
  tienda_asignada_id: string | null;
  estado: EstadoContrato;
  documento_url: string | null;
  documento_generado_por_ai: boolean;
  ai_task_id: string | null;
  firma_colaborador_timestamp: string | null;
  firma_colaborador_ip: string | null;
  firma_colaborador_geo: Record<string, unknown> | null;
  contrato_anterior_id: string | null;
  lote_renovacion_id: string | null;
  motivo_no_renovacion: string | null;
  notas: string | null;
  generado_por: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  usuario?: { nombre_completo: string; dni: string; codigo_asesor: string };
  tienda_asignada?: { nombre: string; codigo: string } | null;
}

export interface RenovacionLote {
  id: string;
  periodo: string;
  fecha_generacion: string;
  fecha_limite_visado: string | null;
  estado: EstadoLote;
  total_colaboradores: number;
  resumen: Record<string, unknown> | null;
  generado_por: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  decisiones?: RenovacionDecision[];
}

export interface RenovacionDecision {
  id: string;
  lote_id: string;
  usuario_id: string;
  contrato_actual_id: string | null;
  ai_resumen: string | null;
  ai_recomendacion: AIRecomendacion | null;
  ai_task_id: string | null;
  indicadores_snapshot: IndicadoresSnapshot | null;
  decision_jv: DecisionJV | null;
  decision_jv_motivo: string | null;
  decision_jv_id: string | null;
  decision_jv_fecha: string | null;
  decision_kam: DecisionKAM | null;
  decision_kam_motivo: string | null;
  decision_kam_id: string | null;
  decision_kam_fecha: string | null;
  decision_final: DecisionFinal | null;
  ejecutado_por: string | null;
  ejecutado_fecha: string | null;
  contrato_nuevo_id: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  usuario?: { nombre_completo: string; dni: string; codigo_asesor: string; rol: string };
  usuario_rrhh?: UsuarioRRHH;
}

export interface IndicadoresSnapshot {
  ventas_mes?: number;
  comision_mes?: number;
  cuota_cumplimiento?: number;
  tardanzas_mes?: number;
  faltas_mes?: number;
  incidencias_activas?: number;
  antiguedad_meses?: number;
  [key: string]: unknown;
}

// ─── Asistencia ────────────────────────────────────────────────────────────
export interface Asistencia {
  id: string;
  usuario_id: string;
  tienda_id: string;
  tipo: TipoMarcacion;
  fecha: string;
  hora_servidor: string;
  hora_dispositivo: string | null;
  foto_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  dentro_radio: boolean | null;
  distancia_tienda_metros: number | null;
  mock_location_detectado: boolean;
  estado: EstadoAsistencia;
  es_tardanza: boolean;
  minutos_tardanza: number;
  observaciones: string | null;
  editado_por: string | null;
  editado_motivo: string | null;
  editado_at: string | null;
  created_at: string;
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string };
  tienda?: { nombre: string; codigo: string };
}

// ─── Incidencias ───────────────────────────────────────────────────────────
export interface IncidenciaLaboral {
  id: string;
  usuario_id: string;
  tipo: TipoIncidencia;
  fecha: string;
  descripcion: string | null;
  asistencia_id: string | null;
  estado: EstadoIncidencia;
  descargo_colaborador: string | null;
  descargo_fecha: string | null;
  resolucion: string | null;
  resolucion_por: string | null;
  resolucion_fecha: string | null;
  documento_url: string | null;
  generada_automaticamente: boolean;
  registrado_por: string;
  created_at: string;
  updated_at: string;
}

// ─── Permisos ──────────────────────────────────────────────────────────────
export interface SolicitudPermiso {
  id: string;
  usuario_id: string;
  tipo: TipoPermiso;
  fecha_inicio: string;
  fecha_fin: string;
  horas_solicitadas: number | null;
  motivo: string;
  documento_adjunto_url: string | null;
  estado: EstadoPermiso;
  aprobado_por: string | null;
  aprobado_fecha: string | null;
  motivo_rechazo: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Movimientos ───────────────────────────────────────────────────────────
export interface MovimientoPersonal {
  id: string;
  usuario_id: string;
  tipo_movimiento: TipoMovimiento;
  fecha_efectiva: string;
  motivo: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  contrato_id: string | null;
  tienda_origen_id: string | null;
  tienda_destino_id: string | null;
  autorizado_por: string;
  documento_url: string | null;
  notas: string | null;
  created_at: string;
}

// ─── Offboarding ───────────────────────────────────────────────────────────
export interface OffboardingChecklist {
  id: string;
  usuario_id: string;
  tipo_salida: TipoSalida;
  fecha_inicio: string;
  fecha_cierre: string | null;
  estado: 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO';
  tareas: OffboardingTarea[];
  generado_por_ai: boolean;
  ai_task_id: string | null;
  responsable_id: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface OffboardingTarea {
  id: string;
  titulo: string;
  completada: boolean;
  completada_por?: string;
  completada_fecha?: string;
  notas?: string;
  orden: number;
}

// ─── AI Tasks ──────────────────────────────────────────────────────────────
export interface AITask {
  id: string;
  tipo: TipoAITask;
  modulo: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  modelo: string | null;
  prompt_version: string | null;
  input_summary: string | null;
  output: Record<string, unknown> | null;
  ai_confidence: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  costo_estimado_usd: number | null;
  latency_ms: number | null;
  status: EstadoAITask;
  error_message: string | null;
  reintentos: number;
  solicitado_por: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Alertas ───────────────────────────────────────────────────────────────
export interface AlertaRRHH {
  id: string;
  tipo: TipoAlerta;
  titulo: string;
  mensaje: string;
  nivel: NivelAlerta;
  entidad_tipo: string | null;
  entidad_id: string | null;
  modulo: string | null;
  datos_contexto: Record<string, unknown> | null;
  destinatario_id: string | null;
  destinatario_rol: string | null;
  estado: 'PENDIENTE' | 'LEIDA' | 'ACCIONADA' | 'DESCARTADA';
  leida_at: string | null;
  accion_tomada: string | null;
  accion_por: string | null;
  accion_at: string | null;
  generada_por: 'SISTEMA' | 'AI' | 'MANUAL';
  created_at: string;
}
```

### 3.3 Schemas Zod

```typescript
// src/lib/rrhh/schemas.ts
import { z } from 'zod';
import {
  USUARIO_STATUS, ETAPA_PIPELINE, FUENTE_CAPTACION, TIPO_CONTRATO,
  ESTADO_CONTRATO, TIPO_MARCACION, ESTADO_ASISTENCIA, TIPO_INCIDENCIA,
  TIPO_PERMISO, ESTADO_PERMISO, TIPO_MOVIMIENTO, TIPO_SALIDA,
  GENERO, ESTADO_CIVIL, AREA_FUNCIONAL
} from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────
const dniSchema = z.string().length(8, 'DNI debe tener 8 dígitos').regex(/^\d{8}$/, 'DNI solo números');
const telefonoSchema = z.string().min(7).max(20);
const uuidOptional = z.string().uuid().optional().nullable();

// ─── Candidato ─────────────────────────────────────────────────────────────
export const candidatoCreateSchema = z.object({
  dni: dniSchema,
  nombre_completo: z.string().min(3, 'Nombre requerido').max(200),
  telefono: telefonoSchema,
  email: z.string().email().optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  genero: z.enum(GENERO).optional().nullable(),
  distrito_residencia: z.string().min(2).optional().nullable(),
  direccion: z.string().optional().nullable(),
  experiencia_telecom: z.boolean(),
  experiencia_detalle: z.string().optional().nullable(),
  disponibilidad_horario: z.string().optional().nullable(),
  disponibilidad_detalle: z.string().optional().nullable(),
  fuente_captacion: z.enum(FUENTE_CAPTACION),
  referido_por: uuidOptional,
  tienda_destino_id: uuidOptional,
  notas: z.string().optional().nullable(),
});
export type CandidatoCreateData = z.infer<typeof candidatoCreateSchema>;

export const candidatoAvanzarEtapaSchema = z.object({
  candidato_id: z.string().uuid(),
  etapa_destino: z.enum(ETAPA_PIPELINE),
  notas: z.string().optional().nullable(),
});

export const candidatoDescartarSchema = z.object({
  candidato_id: z.string().uuid(),
  motivo: z.string().min(5, 'Motivo requerido'),
});

// ─── Entrevista ────────────────────────────────────────────────────────────
export const entrevistaCreateSchema = z.object({
  candidato_id: z.string().uuid(),
  nivel: z.number().int().min(1).max(5),
  entrevistador_id: z.string().uuid(),
  fecha_programada: z.string().optional().nullable(),
});

export const entrevistaEvaluarSchema = z.object({
  entrevista_id: z.string().uuid(),
  scorecard: z.object({
    criterios: z.array(z.object({
      nombre: z.string(),
      puntaje: z.number().min(1).max(5),
      peso: z.number().min(0).max(100),
      observacion: z.string().optional(),
    })),
    observaciones_generales: z.string().optional(),
  }),
  observaciones: z.string().optional().nullable(),
  resultado: z.enum(['APROBADO', 'RECHAZADO']),
});

// ─── Contrato ──────────────────────────────────────────────────────────────
export const contratoCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo_contrato: z.enum(TIPO_CONTRATO),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional().nullable(),
  cargo: z.string().min(2),
  remuneracion: z.number().positive(),
  tienda_asignada_id: uuidOptional,
  contrato_anterior_id: uuidOptional,
  notas: z.string().optional().nullable(),
});
export type ContratoCreateData = z.infer<typeof contratoCreateSchema>;

// ─── Renovación Decisión ───────────────────────────────────────────────────
export const renovacionVisadoJVSchema = z.object({
  decision_id: z.string().uuid(),
  decision: z.enum(['RENOVAR', 'NO_RENOVAR', 'PENDIENTE_EVALUAR']),
  motivo: z.string().optional().nullable(),
}).refine(
  (data) => data.decision === 'RENOVAR' || (data.motivo && data.motivo.length >= 5),
  { message: 'Motivo obligatorio si no renueva o deja pendiente', path: ['motivo'] }
);

export const renovacionVisadoKAMSchema = z.object({
  decision_id: z.string().uuid(),
  decision: z.enum(['CONFIRMAR', 'REVERTIR']),
  motivo: z.string().optional().nullable(),
}).refine(
  (data) => data.decision === 'CONFIRMAR' || (data.motivo && data.motivo.length >= 5),
  { message: 'Motivo obligatorio si revierte decisión del JV', path: ['motivo'] }
);

// ─── Asistencia ────────────────────────────────────────────────────────────
export const asistenciaMarcacionSchema = z.object({
  tienda_id: z.string().uuid(),
  tipo: z.enum(TIPO_MARCACION),
  hora_dispositivo: z.string(),
  foto_url: z.string().optional().nullable(),
  gps_lat: z.number().min(-90).max(90),
  gps_lng: z.number().min(-180).max(180),
  gps_accuracy: z.number().optional().nullable(),
  mock_location_detectado: z.boolean().optional(),
});

// ─── Incidencia ────────────────────────────────────────────────────────────
export const incidenciaCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo: z.enum(TIPO_INCIDENCIA),
  fecha: z.string(),
  descripcion: z.string().optional().nullable(),
  asistencia_id: uuidOptional,
});

export const incidenciaDescargoSchema = z.object({
  incidencia_id: z.string().uuid(),
  descargo: z.string().min(10, 'El descargo debe ser más detallado'),
});

// ─── Permiso ───────────────────────────────────────────────────────────────
export const permisoCreateSchema = z.object({
  tipo: z.enum(TIPO_PERMISO),
  fecha_inicio: z.string(),
  fecha_fin: z.string(),
  horas_solicitadas: z.number().optional().nullable(),
  motivo: z.string().min(5, 'Motivo requerido'),
}).refine(
  (data) => data.fecha_fin >= data.fecha_inicio,
  { message: 'La fecha fin debe ser posterior a la fecha inicio', path: ['fecha_fin'] }
);

export const permisoAprobarSchema = z.object({
  permiso_id: z.string().uuid(),
  aprobado: z.boolean(),
  motivo_rechazo: z.string().optional().nullable(),
}).refine(
  (data) => data.aprobado || (data.motivo_rechazo && data.motivo_rechazo.length >= 5),
  { message: 'Motivo requerido al rechazar', path: ['motivo_rechazo'] }
);

// ─── Usuarios RRHH ─────────────────────────────────────────────────────────
export const usuarioRRHHCreateSchema = z.object({
  id: z.string().uuid(),  // = usuarios.id
  fecha_ingreso: z.string(),
  tipo_contrato_actual: z.enum(TIPO_CONTRATO).default('PLAZO_FIJO'),
  area_funcional: z.enum(AREA_FUNCIONAL).default('COMERCIAL'),
  cargo_formal: z.string().optional().nullable(),
  jefe_directo_id: uuidOptional,
  remuneracion_actual: z.number().positive().optional().nullable(),
  status: z.enum(USUARIO_STATUS).default('ACTIVO'),
  // Datos personales opcionales (se pueden completar después)
  fecha_nacimiento: z.string().optional().nullable(),
  genero: z.enum(GENERO).optional().nullable(),
  estado_civil: z.enum(ESTADO_CIVIL).optional().nullable(),
  telefono_personal: z.string().optional().nullable(),
  direccion_domiciliaria: z.string().optional().nullable(),
  distrito_residencia: z.string().optional().nullable(),
  // Contacto emergencia
  contacto_emergencia_nombre: z.string().optional().nullable(),
  contacto_emergencia_telefono: z.string().optional().nullable(),
  contacto_emergencia_parentesco: z.string().optional().nullable(),
  // Bancarios
  banco: z.string().optional().nullable(),
  numero_cuenta: z.string().optional().nullable(),
  cci: z.string().optional().nullable(),
  // Operativo
  talla_uniforme: z.string().optional().nullable(),
});
export type UsuarioRRHHCreateData = z.infer<typeof usuarioRRHHCreateSchema>;

// ─── Movimiento de Personal ────────────────────────────────────────────────
export const movimientoCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo_movimiento: z.enum(TIPO_MOVIMIENTO),
  fecha_efectiva: z.string(),
  motivo: z.string().optional().nullable(),
  tienda_destino_id: uuidOptional,
  notas: z.string().optional().nullable(),
});
```

---

## 4. ESTRUCTURA DE RUTAS

### 4.1 App Router (Next.js 14)

```
src/app/dashboard/rrhh/
├── layout.tsx                      ← Layout del módulo RRHH (sidebar + breadcrumbs)
├── page.tsx                        ← Dashboard principal RRHH (resumen + alertas)
│
├── colaboradores/
│   ├── page.tsx                    ← Lista de colaboradores activos
│   └── [id]/
│       ├── page.tsx                ← Ficha completa del colaborador
│       ├── contratos/page.tsx      ← Historial de contratos
│       ├── asistencia/page.tsx     ← Historial de asistencia
│       ├── incidencias/page.tsx    ← Historial de incidencias
│       └── documentos/page.tsx     ← Documentos del colaborador
│
├── reclutamiento/
│   ├── page.tsx                    ← Pipeline Kanban
│   ├── nuevo/page.tsx              ← Formulario nueva captación
│   └── [id]/
│       ├── page.tsx                ← Detalle del candidato
│       └── entrevista/page.tsx     ← Registrar/evaluar entrevista
│
├── contratos/
│   ├── page.tsx                    ← Lista de contratos (filtros por estado)
│   ├── renovacion/
│   │   ├── page.tsx                ← Lista de lotes de renovación
│   │   └── [loteId]/
│   │       ├── page.tsx            ← Detalle del lote (vista RRHH)
│   │       ├── visado-jv/page.tsx  ← Vista para Jefe de Ventas
│   │       └── visado-kam/page.tsx ← Vista para KAM
│   └── firma/[id]/page.tsx         ← Firma electrónica del colaborador
│
├── asistencia/
│   ├── page.tsx                    ← Vista consolidada por tienda/fecha
│   ├── marcar/page.tsx             ← Pantalla de marcación (mobile)
│   └── apertura-cierre/page.tsx    ← Registro de apertura/cierre
│
├── horarios/
│   └── page.tsx                    ← Programación de turnos
│
├── incidencias/
│   ├── page.tsx                    ← Lista de incidencias
│   └── nueva/page.tsx              ← Registrar incidencia
│
├── permisos/
│   ├── page.tsx                    ← Lista de solicitudes
│   └── nueva/page.tsx              ← Nueva solicitud de permiso
│
├── movimientos/
│   └── page.tsx                    ← Historial de movimientos
│
├── offboarding/
│   ├── page.tsx                    ← Checklist de salidas activas
│   └── [id]/page.tsx               ← Detalle checklist
│
├── alertas/
│   └── page.tsx                    ← Centro de alertas RRHH
│
└── reportes/
    └── page.tsx                    ← Dashboard métricas y reportes
```

### 4.2 Estructura de Archivos de Lógica

```
src/lib/rrhh/
├── types.ts                        ← Enums y constantes (sección 3.1)
├── interfaces.ts                   ← Interfaces de datos (sección 3.2)
├── schemas.ts                      ← Schemas Zod (sección 3.3)
├── queries/
│   ├── candidatos.ts               ← Queries Supabase para candidatos
│   ├── contratos.ts                ← Queries para contratos y renovación
│   ├── usuarios-rrhh.ts            ← Queries para ficha del colaborador
│   ├── asistencia.ts               ← Queries para asistencia
│   ├── incidencias.ts              ← Queries para incidencias
│   ├── permisos.ts                 ← Queries para permisos
│   ├── movimientos.ts              ← Queries para movimientos
│   ├── offboarding.ts              ← Queries para offboarding
│   ├── alertas.ts                  ← Queries para alertas
│   └── ai-tasks.ts                 ← Queries para tareas AI
├── hooks/
│   ├── useCandidatos.ts            ← Hook para pipeline de reclutamiento
│   ├── useContratos.ts             ← Hook para gestión de contratos
│   ├── useRenovacion.ts            ← Hook para flujo de renovación
│   ├── useAsistencia.ts            ← Hook para asistencia
│   ├── useAlertasRRHH.ts           ← Hook para alertas
│   └── useUsuarioRRHH.ts           ← Hook para ficha del colaborador
└── utils/
    ├── gps.ts                      ← Utilidades GPS (distancia haversine, validación radio)
    ├── pipeline.ts                 ← Helpers de pipeline (transiciones válidas, colores)
    └── permisos-rrhh.ts            ← Helpers de permisos por rol
```

---

## 5. HELPERS Y UTILIDADES

### 5.1 GPS — Cálculo de Distancia

```typescript
// src/lib/rrhh/utils/gps.ts

/**
 * Calcula la distancia en metros entre dos puntos GPS usando la fórmula de Haversine.
 */
export function calcularDistanciaMetros(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Valida si un punto GPS está dentro del radio de una tienda.
 */
export function validarDentroRadio(
  userLat: number, userLng: number,
  tiendaLat: number, tiendaLng: number,
  radioMetros: number
): { dentro: boolean; distancia: number } {
  const distancia = calcularDistanciaMetros(userLat, userLng, tiendaLat, tiendaLng);
  return {
    dentro: distancia <= radioMetros,
    distancia: Math.round(distancia),
  };
}
```

### 5.2 Pipeline — Transiciones Válidas

```typescript
// src/lib/rrhh/utils/pipeline.ts
import type { EtapaPipeline } from '../types';

export const TRANSICIONES_VALIDAS: Record<EtapaPipeline, EtapaPipeline[]> = {
  CAPTACION: ['FILTRO_CV', 'DESCARTADO'],
  FILTRO_CV: ['ENTREVISTAS', 'DESCARTADO'],
  ENTREVISTAS: ['CONSULTA_ENTEL', 'DESCARTADO'],
  CONSULTA_ENTEL: ['USUARIO_ENTEL', 'DESCARTADO'],
  USUARIO_ENTEL: ['INDUCCION', 'DESCARTADO'],
  INDUCCION: ['SOMBRA', 'DESCARTADO'],
  SOMBRA: ['ALTA', 'INDUCCION', 'DESCARTADO'],  // INDUCCION = extender
  ALTA: [],       // Estado terminal positivo
  DESCARTADO: [], // Estado terminal negativo (banco de talento)
};

export function puedeAvanzar(desde: EtapaPipeline, hacia: EtapaPipeline): boolean {
  return TRANSICIONES_VALIDAS[desde]?.includes(hacia) ?? false;
}

export const ETAPA_COLORES: Record<EtapaPipeline, string> = {
  CAPTACION: 'bg-blue-100 text-blue-800',
  FILTRO_CV: 'bg-indigo-100 text-indigo-800',
  ENTREVISTAS: 'bg-purple-100 text-purple-800',
  CONSULTA_ENTEL: 'bg-yellow-100 text-yellow-800',
  USUARIO_ENTEL: 'bg-orange-100 text-orange-800',
  INDUCCION: 'bg-cyan-100 text-cyan-800',
  SOMBRA: 'bg-teal-100 text-teal-800',
  ALTA: 'bg-green-100 text-green-800',
  DESCARTADO: 'bg-red-100 text-red-800',
};

export const ETAPA_LABELS: Record<EtapaPipeline, string> = {
  CAPTACION: 'Captación',
  FILTRO_CV: 'Filtro CV',
  ENTREVISTAS: 'Entrevistas',
  CONSULTA_ENTEL: 'Consulta Entel',
  USUARIO_ENTEL: 'Usuario Entel',
  INDUCCION: 'Inducción',
  SOMBRA: 'Sombra',
  ALTA: 'Alta',
  DESCARTADO: 'Descartado',
};
```

### 5.3 Permisos por Rol

```typescript
// src/lib/rrhh/utils/permisos-rrhh.ts

export const ROLES_GESTION_RRHH = ['BACKOFFICE_RRHH', 'ADMIN'] as const;
export const ROLES_JEFATURA = ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'] as const;
export const ROLES_SUPERVISION = ['COORDINADOR', 'SUPERVISOR'] as const;

export function puedeGestionarRRHH(rol: string): boolean {
  return (ROLES_GESTION_RRHH as readonly string[]).includes(rol);
}

export function puedeVerDashboardRRHH(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_JEFATURA as readonly string[]).includes(rol);
}

export function puedeRegistrarIncidencia(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_SUPERVISION as readonly string[]).includes(rol) ||
    rol === 'JEFE_VENTAS';
}

export function puedeVisarRenovacion(rol: string): boolean {
  return rol === 'JEFE_VENTAS' || rol === 'GERENTE_COMERCIAL' || rol === 'ADMIN';
}

export function puedeAprobarPermisos(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_JEFATURA as readonly string[]).includes(rol) ||
    rol === 'SUPERVISOR';
}

export function puedeAsignarTurnos(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_SUPERVISION as readonly string[]).includes(rol) ||
    rol === 'JEFE_VENTAS';
}
```

---

## 6. SUPABASE STORAGE BUCKETS

Crear los siguientes buckets en Supabase Storage para el módulo RRHH:

| Bucket | Propósito | Acceso |
|--------|-----------|--------|
| `rrhh-fotos` | Fotos de candidatos y colaboradores | RRHH + propio usuario |
| `rrhh-cvs` | CVs de candidatos | RRHH |
| `rrhh-contratos` | Contratos generados y firmados | RRHH + propio usuario |
| `rrhh-documentos` | Documentos generales del colaborador | RRHH |
| `rrhh-entrevistas` | Grabaciones de entrevistas (video/audio) | RRHH |
| `rrhh-asistencia` | Selfies de marcación de asistencia | RRHH + Supervisores |
| `rrhh-incidencias` | Documentos de incidencias (amonestaciones) | RRHH |

**Patrón de nombrado de archivos:**
```
{bucket}/{entidad_id}/{tipo}_{timestamp}.{ext}

Ejemplo: rrhh-fotos/abc123/foto_20260213T140000.jpg
Ejemplo: rrhh-cvs/def456/cv_20260213T140000.pdf
Ejemplo: rrhh-asistencia/usr789/entrada_20260213T090000.jpg
```

---

## 7. ORDEN DE IMPLEMENTACIÓN SUGERIDO

Una vez ejecutadas las 5 migraciones, Claude Code debería implementar en este orden:

### Fase 1: Fundación
1. Crear archivos `types.ts`, `interfaces.ts`, `schemas.ts`
2. Crear utilidades (`gps.ts`, `pipeline.ts`, `permisos-rrhh.ts`)
3. Crear layout del módulo RRHH (`/dashboard/rrhh/layout.tsx`)
4. Crear página de dashboard vacía (`/dashboard/rrhh/page.tsx`)

### Fase 2: Ficha del Colaborador
5. Query `usuarios-rrhh.ts` (CRUD de fichas)
6. Hook `useUsuarioRRHH.ts`
7. Página lista de colaboradores
8. Página ficha individual del colaborador

### Fase 3: Reclutamiento
9. Query `candidatos.ts`
10. Hook `useCandidatos.ts`
11. Pipeline Kanban (vista principal)
12. Formulario de nueva captación
13. Detalle del candidato
14. Formulario de entrevista con scorecard

### Fase 4: Contratos
15. Query `contratos.ts`
16. Hook `useContratos.ts` y `useRenovacion.ts`
17. Lista de contratos
18. Flujo de renovación (lotes + visado JV + visado KAM)

### Fase 5: Operativo
19. Asistencia (marcación + vista consolidada)
20. Horarios y turnos
21. Incidencias laborales
22. Permisos y vacaciones

### Fase 6: Gestión
23. Movimientos de personal
24. Offboarding
25. Alertas
26. Dashboard con métricas

---

## 8. NOTAS PARA CLAUDE CODE

### 8.1 Reglas Importantes

1. **NO crear nuevos roles.** Usar los 12 roles existentes del constraint de `usuarios`.
2. **NO hardcodear IDs** de tiendas ni usuarios. Siempre consultar de BD.
3. **Reutilizar componentes shadcn/ui** existentes en el proyecto.
4. **Validar con Zod** en el cliente antes de enviar al servidor.
5. **Todas las fechas en ISO 8601** (`YYYY-MM-DD` para dates, ISO string para timestamps).
6. **Los queries a Supabase** deben usar el cliente existente del proyecto.
7. **RLS ya está configurado** — los queries automáticamente filtran por rol.

### 8.2 Patrones del Proyecto Existente

Revisar cómo están implementados los módulos de Ventas y Comisiones para mantener consistencia en:
- Cómo se importa y usa el cliente Supabase
- Cómo se estructuran los hooks de datos
- Cómo se manejan los formularios con react-hook-form + Zod
- Cómo se implementan las tablas de datos (DataTable patterns)
- Cómo se manejan los roles y permisos en el frontend

### 8.3 Campos JSONB — Estructuras Esperadas

**`candidatos.cv_datos_extraidos`:**
```json
{
  "nombre": "...",
  "experiencia": [{"empresa": "...", "cargo": "...", "periodo": "..."}],
  "educacion": [{"institucion": "...", "titulo": "...", "año": "..."}],
  "habilidades": ["..."],
  "telecom_experiencia": true,
  "resumen": "..."
}
```

**`candidatos.induccion_checklist`:**
```json
{
  "modulos": [
    {"id": "m1", "nombre": "Conocimiento de productos", "completado": true, "fecha": "..."},
    {"id": "m2", "nombre": "Sistemas (OneTouch/Siebel)", "completado": false, "fecha": null}
  ]
}
```

**`candidatos_entrevistas.scorecard`:**
```json
{
  "criterios": [
    {"nombre": "Comunicación", "puntaje": 4, "peso": 25, "observacion": "Buena fluidez"},
    {"nombre": "Actitud de servicio", "puntaje": 5, "peso": 25, "observacion": "Excelente"}
  ],
  "observaciones_generales": "Candidato con potencial..."
}
```

**`renovacion_decisiones.indicadores_snapshot`:**
```json
{
  "ventas_mes": 35,
  "comision_mes": 1850.00,
  "cuota_cumplimiento": 87.5,
  "tardanzas_mes": 1,
  "faltas_mes": 0,
  "incidencias_activas": 0,
  "antiguedad_meses": 6,
  "ranking_tienda": 2,
  "total_hc_tienda": 3
}
```

**`offboarding_checklist.tareas`:**
```json
[
  {"id": "t1", "titulo": "Carta de renuncia recibida", "completada": true, "completada_por": "uuid", "completada_fecha": "2026-02-13", "orden": 1},
  {"id": "t2", "titulo": "Liquidación calculada", "completada": false, "orden": 2}
]
```

---

*Fin del SPEC de Migración Fundacional del Módulo RRHH*
