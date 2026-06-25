# DATA_DICTIONARY.md — Actualización Módulo RRHH
## Instrucciones de aplicación

Este archivo contiene los cambios a aplicar al `DATA_DICTIONARY.md` del proyecto.
Se documenta en el mismo formato y nivel de detalle que las secciones existentes.

---

## CAMBIO 1: Header — Actualizar versión

**Línea 3-4 del archivo original:**
```
Versión: 2.6
Última actualización: 2026-01-28
```

**Reemplazar por:**
```
Versión: 3.0
Última actualización: 2026-02-13
```

---

## CAMBIO 2: Resumen de Objetos — Agregar fila RRHH y actualizar total

**Tabla original (líneas 11-22):**

Agregar fila antes del TOTAL:

```
| RRHH (v3.0) | 21 | - | - |
```

**Nuevo TOTAL:**
```
| **TOTAL** | **51** | **10** | **14** |
```

La tabla completa queda:

| Módulo | Tablas | Vistas | Funciones |
|--------|--------|--------|-----------|
| Core | 5 | 1 | 1 |
| Operaciones | 2 | - | - |
| INAR | 3 | 3 | - |
| Control | 2 | 1 | - |
| Comisiones | 7 | - | 5 |
| Penalidades | 4 | 1 | 1 |
| Presets Partidas (v2.1) | 3 | 2 | 2 |
| Cuotas (v2.3) | 3 | 2 | 4 |
| Configuración (v2.6) | 1 | - | - |
| RRHH (v3.0) | 21 | - | - |
| **TOTAL** | **51** | **10** | **14** |

---

## CAMBIO 3: Sección 1.2 tiendas — Agregar columnas nuevas

**Insertar las siguientes filas en la tabla de `tiendas` (después de `created_at`):**

| Columna | Tipo | Nullable | Default | Descripción | Versión |
|---------|------|----------|---------|-------------|---------|
| `gps_lat` | DECIMAL(10,7) | YES | - | Latitud GPS de la tienda | v3.0 |
| `gps_lng` | DECIMAL(10,7) | YES | - | Longitud GPS de la tienda | v3.0 |
| `radio_validacion_metros` | INTEGER | YES | 100 | Radio en metros para validar marcación GPS asistencia | v3.0 |
| `zona` | VARCHAR(50) | YES | - | Zona geográfica (NORTE, SUR, ESTE, CENTRO) | v3.0 |
| `hora_apertura` | TIME | YES | '09:00' | Hora estándar de apertura | v3.0 |
| `hora_cierre` | TIME | YES | '21:00' | Hora estándar de cierre | v3.0 |
| `hc_minimo` | INTEGER | YES | 2 | Headcount mínimo requerido para operar | v3.0 |
| `hc_ideal` | INTEGER | YES | 3 | Headcount ideal de operación | v3.0 |

---

## CAMBIO 4: Nueva sección — Insertar antes de "HISTORIAL DE CAMBIOS"

Insertar la siguiente sección completa como **sección 13** (renumerar el Historial de Cambios actual a sección 14).

---

# ↓ CONTENIDO A INSERTAR ↓

---

## 13. MÓDULO RRHH (v3.0)

21 tablas nuevas organizadas en 5 grupos de migración.

| Grupo | Tablas | Descripción |
|-------|--------|-------------|
| Core (020) | 3 | Extensión usuarios, status log, AI tasks |
| Reclutamiento (021) | 4 | Pipeline de candidatos |
| Contratos (022) | 3 | Contratos y ciclo de renovación |
| Operativo (023) | 7 | Asistencia, turnos, incidencias, permisos |
| Gestión (024) | 4 | Movimientos, offboarding, documentos, alertas |

**Tablas existentes referenciadas:** `usuarios`, `tiendas`, `usuarios_tiendas`

---

### 13.1 usuarios_rrhh

Extensión 1:1 de `usuarios` con datos laborales, personales y bancarios. El `id` es FK directa a `usuarios.id`.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | - | PK + FK → usuarios.id (CASCADE) |
| `fecha_nacimiento` | DATE | YES | - | Fecha de nacimiento |
| `genero` | VARCHAR(20) | YES | - | Género (ver constraint) |
| `estado_civil` | VARCHAR(20) | YES | - | Estado civil (ver constraint) |
| `telefono_personal` | VARCHAR(20) | YES | - | Teléfono personal |
| `direccion_domiciliaria` | TEXT | YES | - | Dirección completa |
| `distrito_residencia` | VARCHAR(100) | YES | - | Distrito de residencia |
| `gps_domicilio_lat` | DECIMAL(10,7) | YES | - | Latitud GPS domicilio |
| `gps_domicilio_lng` | DECIMAL(10,7) | YES | - | Longitud GPS domicilio |
| `contacto_emergencia_nombre` | VARCHAR(200) | YES | - | Nombre contacto emergencia |
| `contacto_emergencia_telefono` | VARCHAR(20) | YES | - | Teléfono contacto emergencia |
| `contacto_emergencia_parentesco` | VARCHAR(50) | YES | - | Parentesco contacto emergencia |
| `banco` | VARCHAR(100) | YES | - | Entidad bancaria |
| `numero_cuenta` | VARCHAR(50) | YES | - | Número de cuenta |
| `cci` | VARCHAR(25) | YES | - | Código de cuenta interbancario |
| `fecha_ingreso` | DATE | NO | - | Fecha de ingreso a la empresa |
| `fecha_fin_contrato` | DATE | YES | - | Fecha fin de contrato vigente |
| `tipo_contrato_actual` | VARCHAR(20) | YES | 'PLAZO_FIJO' | Tipo de contrato (ver constraint) |
| `regimen_laboral` | VARCHAR(50) | YES | - | Régimen laboral |
| `cargo_formal` | VARCHAR(100) | YES | - | Cargo formal en contrato |
| `area_funcional` | VARCHAR(30) | YES | 'COMERCIAL' | Área funcional (ver constraint) |
| `jefe_directo_id` | UUID | YES | - | FK → usuarios.id |
| `remuneracion_actual` | DECIMAL(10,2) | YES | - | Remuneración mensual actual |
| `status` | VARCHAR(20) | NO | 'ACTIVO' | Estado RRHH del colaborador (ver 13.1.1) |
| `talla_uniforme` | VARCHAR(10) | YES | - | Talla de uniforme |
| `tiene_equipo_corporativo` | BOOLEAN | YES | false | Si tiene equipo asignado |
| `equipo_corporativo_detalle` | TEXT | YES | - | Detalle del equipo (marca, modelo, IMEI) |
| `foto_url` | TEXT | YES | - | URL foto del colaborador |
| `notas` | TEXT | YES | - | Notas internas RRHH |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
```sql
CHECK (genero IS NULL OR genero IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'))
CHECK (estado_civil IS NULL OR estado_civil IN ('SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'))
CHECK (tipo_contrato_actual IN ('PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA'))
CHECK (area_funcional IN ('COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION'))
CHECK (status IN ('CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA', 'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'))
```

**Índices:** `idx_usuarios_rrhh_status`, `idx_usuarios_rrhh_fecha_ingreso`, `idx_usuarios_rrhh_fecha_fin_contrato`, `idx_usuarios_rrhh_jefe_directo`, `idx_usuarios_rrhh_area`

**RLS:**
- SELECT: propia ficha (id = auth.uid()) + gestión (BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, SUPERVISOR)
- INSERT: BACKOFFICE_RRHH, ADMIN
- UPDATE: propia ficha + gestión (BACKOFFICE_RRHH, ADMIN)

---

#### 13.1.1 Estados del Colaborador (`status`)

| Estado | Descripción | Transiciones posibles |
|--------|-------------|----------------------|
| `CANDIDATO` | En pipeline de reclutamiento | → EN_INDUCCION, CESADO |
| `EN_INDUCCION` | En proceso de inducción | → EN_SOMBRA, CESADO |
| `EN_SOMBRA` | En período de sombra en tienda | → PERIODO_PRUEBA, EN_INDUCCION, CESADO |
| `PERIODO_PRUEBA` | Contratado, en evaluación inicial | → ACTIVO, CESADO |
| `ACTIVO` | Colaborador activo operando | → SUSPENDIDO, LICENCIA, PRE_CESE, CESADO |
| `SUSPENDIDO` | Suspendido temporalmente | → ACTIVO, PRE_CESE, CESADO |
| `LICENCIA` | En licencia (médica, maternidad, etc.) | → ACTIVO |
| `PRE_CESE` | En proceso de salida (offboarding) | → CESADO |
| `CESADO` | Ya no labora (estado terminal) | — |

---

#### 13.1.2 Tipos de Contrato (`tipo_contrato_actual`)

| Valor | Descripción |
|-------|-------------|
| `PLAZO_FIJO` | Contrato a plazo fijo (mensual, típico en TEX) |
| `INDETERMINADO` | Contrato a plazo indeterminado |
| `RXH` | Recibo por honorarios |
| `PERIODO_PRUEBA` | En período de prueba (3 meses legales) |

---

#### 13.1.3 Áreas Funcionales (`area_funcional`)

| Valor | Personal típico |
|-------|-----------------|
| `COMERCIAL` | Asesores, coordinadores, supervisores, JV |
| `OPERACIONES` | Backoffice operaciones, repartidores |
| `RRHH` | Backoffice RRHH, capacitador |
| `MANTENIMIENTO` | Operarios de mantenimiento |
| `ADMINISTRACION` | Gerencia, KAM |

---

### 13.2 usuarios_status_log

Historial de cambios de estado del colaborador. Cada cambio en `usuarios_rrhh.status` genera un registro.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (CASCADE) |
| `status_anterior` | VARCHAR(20) | YES | - | Estado anterior (NULL si es primer registro) |
| `status_nuevo` | VARCHAR(20) | NO | - | Nuevo estado |
| `motivo` | TEXT | YES | - | Motivo del cambio |
| `fecha_efectiva` | DATE | NO | CURRENT_DATE | Fecha efectiva del cambio |
| `registrado_por` | UUID | YES | - | FK → usuarios.id (quien registró) |
| `metadata` | JSONB | YES | - | Datos adicionales del contexto |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:** Mismos CHECK de status que `usuarios_rrhh`

**Índices:** `idx_status_log_usuario`, `idx_status_log_fecha`, `idx_status_log_status_nuevo`

**RLS:** SELECT para propio usuario + gestión; INSERT solo BACKOFFICE_RRHH, ADMIN

---

### 13.3 ai_tasks

Log centralizado de todas las tareas AI ejecutadas. Permite auditoría, mejora de prompts, monitoreo de costos y medición de calidad. Aunque nace en RRHH, es **compartida** por todos los módulos que usen AI.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tipo` | VARCHAR(40) | NO | - | Tipo de tarea AI (ver 13.3.1) |
| `modulo` | VARCHAR(30) | NO | 'RRHH' | Módulo que originó la tarea |
| `entidad_tipo` | VARCHAR(30) | YES | - | Tipo de entidad (CANDIDATO, USUARIO, CONTRATO) |
| `entidad_id` | UUID | YES | - | ID de la entidad relacionada |
| `modelo` | VARCHAR(50) | YES | - | Modelo Claude usado (claude-sonnet-4-5, etc.) |
| `prompt_version` | VARCHAR(20) | YES | - | Versión del prompt |
| `input_summary` | TEXT | YES | - | Resumen del input (no el input completo) |
| `output` | JSONB | YES | - | Resultado completo del AI |
| `ai_confidence` | DECIMAL(5,4) | YES | - | Nivel de confianza (0.0000-1.0000) |
| `tokens_input` | INTEGER | YES | - | Tokens consumidos (input) |
| `tokens_output` | INTEGER | YES | - | Tokens consumidos (output) |
| `costo_estimado_usd` | DECIMAL(8,6) | YES | - | Costo estimado en USD |
| `latency_ms` | INTEGER | YES | - | Tiempo de respuesta en ms |
| `status` | VARCHAR(20) | NO | 'PENDING' | Estado de la tarea (ver 13.3.2) |
| `error_message` | TEXT | YES | - | Mensaje de error si falló |
| `reintentos` | INTEGER | YES | 0 | Cantidad de reintentos |
| `solicitado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
```sql
CHECK (tipo IN ('CV_PARSING', 'ENTREVISTA_TRANSCRIPCION', 'ENTREVISTA_ANALISIS', 'CONTRATO_GENERACION', 'RENOVACION_RESUMEN', 'SCORING_CANDIDATO', 'RIESGO_FUGA', 'CHATBOT_QUERY', 'DOCUMENTO_OCR', 'EMAIL_DRAFT', 'ANOMALIA_DETECCION', 'INDUCCION_PLAN', 'OFFBOARDING_CHECKLIST'))
CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
```

**Índices:** `idx_ai_tasks_tipo`, `idx_ai_tasks_status`, `idx_ai_tasks_entidad`, `idx_ai_tasks_created`

**RLS:** SELECT para BACKOFFICE_RRHH, ADMIN, BACKOFFICE_OPERACIONES, GERENTE_COMERCIAL, GERENTE_GENERAL; ALL para BACKOFFICE_RRHH, ADMIN

---

#### 13.3.1 Tipos de Tarea AI (`tipo`)

| Tipo | Módulo | Modelo sugerido | Frecuencia |
|------|--------|-----------------|------------|
| `CV_PARSING` | Reclutamiento | Sonnet | Alta |
| `ENTREVISTA_TRANSCRIPCION` | Reclutamiento | Whisper + Sonnet | Media |
| `ENTREVISTA_ANALISIS` | Reclutamiento | Sonnet/Opus | Media |
| `SCORING_CANDIDATO` | Reclutamiento | Sonnet | Alta |
| `RENOVACION_RESUMEN` | Contratos | Sonnet | Mensual |
| `CONTRATO_GENERACION` | Contratos | Sonnet | Media |
| `RIESGO_FUGA` | Gestión | Sonnet | Periódico |
| `CHATBOT_QUERY` | Autoservicio | Sonnet | Alta |
| `DOCUMENTO_OCR` | Documentos | Sonnet | Media |
| `EMAIL_DRAFT` | Comunicaciones | Sonnet | Baja |
| `ANOMALIA_DETECCION` | Dashboard | Sonnet | Periódico |
| `INDUCCION_PLAN` | Reclutamiento | Sonnet | Media |
| `OFFBOARDING_CHECKLIST` | Offboarding | Sonnet | Media |

---

#### 13.3.2 Estados de Tarea AI (`status`)

| Estado | Descripción |
|--------|-------------|
| `PENDING` | Creada, esperando procesamiento |
| `PROCESSING` | En ejecución |
| `COMPLETED` | Completada exitosamente |
| `FAILED` | Falló (ver error_message) |
| `CANCELLED` | Cancelada por usuario o sistema |

---

### 13.4 candidatos

Registro central del pipeline de reclutamiento. Contiene datos del candidato y el estado de todas las etapas inline (Entel, inducción, sombra, descarte).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `dni` | VARCHAR(8) | NO | - | DNI del candidato |
| `nombre_completo` | VARCHAR(200) | NO | - | Nombre completo |
| `telefono` | VARCHAR(20) | NO | - | Teléfono de contacto |
| `email` | VARCHAR(200) | YES | - | Email |
| `fecha_nacimiento` | DATE | YES | - | Fecha de nacimiento |
| `genero` | VARCHAR(20) | YES | - | Género |
| `distrito_residencia` | VARCHAR(100) | YES | - | Distrito de residencia |
| `direccion` | TEXT | YES | - | Dirección completa |
| `gps_domicilio_lat` | DECIMAL(10,7) | YES | - | Latitud GPS domicilio |
| `gps_domicilio_lng` | DECIMAL(10,7) | YES | - | Longitud GPS domicilio |
| `experiencia_telecom` | BOOLEAN | NO | false | ¿Tiene experiencia en telecom? |
| `experiencia_detalle` | TEXT | YES | - | Detalle de experiencia |
| `disponibilidad_horario` | VARCHAR(50) | YES | - | Disponibilidad horaria |
| `disponibilidad_detalle` | TEXT | YES | - | Detalle de disponibilidad |
| `etapa_actual` | VARCHAR(30) | NO | 'CAPTACION' | Etapa actual del pipeline (ver 13.4.1) |
| `fecha_captacion` | DATE | NO | CURRENT_DATE | Fecha de captación |
| `fecha_ultima_actualizacion` | TIMESTAMPTZ | YES | NOW() | Última actualización de etapa |
| `fuente_captacion` | VARCHAR(30) | NO | 'CONVOCATORIA' | Fuente de captación (ver 13.4.2) |
| `referido_por` | UUID | YES | - | FK → usuarios.id (quien lo refirió) |
| `tienda_destino_id` | UUID | YES | - | FK → tiendas.id (tienda destino si ya se sabe) |
| `ai_score` | DECIMAL(5,2) | YES | - | Puntaje AI del candidato (0-100) |
| `ai_score_detalle` | JSONB | YES | - | Desglose del scoring AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `cv_url` | TEXT | YES | - | URL del CV en Storage |
| `cv_datos_extraidos` | JSONB | YES | - | Datos parseados del CV por AI |
| `foto_url` | TEXT | YES | - | URL de foto del candidato |
| `entel_fecha_envio` | DATE | YES | - | Fecha de envío a consulta Entel |
| `entel_estado` | VARCHAR(20) | YES | - | Estado consulta Entel |
| `entel_fecha_respuesta` | DATE | YES | - | Fecha respuesta de Entel |
| `entel_observaciones` | TEXT | YES | - | Observaciones de Entel |
| `entel_usuario_fecha_solicitud` | DATE | YES | - | Fecha solicitud de usuario Entel |
| `entel_usuario_estado` | VARCHAR(20) | YES | - | Estado del usuario Entel |
| `entel_usuario_confirmado` | BOOLEAN | YES | false | ¿Usuario Entel confirmado? |
| `induccion_fecha_inicio` | DATE | YES | - | Fecha inicio inducción |
| `induccion_fecha_fin` | DATE | YES | - | Fecha fin inducción |
| `induccion_capacitador_id` | UUID | YES | - | FK → usuarios.id |
| `induccion_checklist` | JSONB | YES | - | Checklist de inducción (ver SPEC §8.3) |
| `induccion_evaluacion` | VARCHAR(20) | YES | - | Resultado inducción |
| `sombra_tienda_id` | UUID | YES | - | FK → tiendas.id |
| `sombra_mentor_id` | UUID | YES | - | FK → usuarios.id |
| `sombra_fecha_inicio` | DATE | YES | - | Fecha inicio sombra |
| `sombra_fecha_fin` | DATE | YES | - | Fecha fin sombra |
| `sombra_evaluacion_mentor` | JSONB | YES | - | Evaluación del mentor |
| `sombra_evaluacion_supervisor` | JSONB | YES | - | Evaluación del supervisor |
| `sombra_resultado` | VARCHAR(20) | YES | - | Resultado sombra |
| `descartado` | BOOLEAN | NO | false | ¿Está descartado? |
| `descarte_etapa` | VARCHAR(30) | YES | - | Etapa en que fue descartado |
| `descarte_motivo` | TEXT | YES | - | Motivo del descarte |
| `descarte_fecha` | DATE | YES | - | Fecha de descarte |
| `descartado_por` | UUID | YES | - | FK → usuarios.id |
| `usuario_generado_id` | UUID | YES | - | FK → usuarios.id (si fue dado de alta) |
| `notas` | TEXT | YES | - | Notas generales |
| `registrado_por` | UUID | NO | - | FK → usuarios.id (quien lo registró) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints principales:**
```sql
CHECK (etapa_actual IN ('CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL', 'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA', 'ALTA', 'DESCARTADO'))
CHECK (fuente_captacion IN ('REFERIDO', 'PORTAL_EMPLEO', 'CONVOCATORIA', 'REINGRESO', 'BANCO_TALENTO'))
CHECK (entel_estado IS NULL OR entel_estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'OBSERVADO'))
CHECK (entel_usuario_estado IS NULL OR entel_usuario_estado IN ('SOLICITADO', 'EN_PROCESO', 'ENTREGADO'))
CHECK (induccion_evaluacion IS NULL OR induccion_evaluacion IN ('APROBADO', 'DESAPROBADO', 'EN_CURSO'))
CHECK (sombra_resultado IS NULL OR sombra_resultado IN ('APROBADO', 'DESAPROBADO', 'EXTENDER'))
```

**Índices:** `idx_candidatos_dni`, `idx_candidatos_etapa`, `idx_candidatos_descartado`, `idx_candidatos_fuente`, `idx_candidatos_fecha_captacion`, `idx_candidatos_referido_por`, `idx_candidatos_tienda_destino`

**RLS:**
- SELECT: BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS + propios referidos
- INSERT: cualquier usuario activo (para referir candidatos)
- UPDATE/DELETE: BACKOFFICE_RRHH, ADMIN (DELETE solo ADMIN)

---

#### 13.4.1 Etapas del Pipeline (`etapa_actual`)

| Etapa | Descripción | Transiciones válidas |
|-------|-------------|---------------------|
| `CAPTACION` | Candidato registrado | → FILTRO_CV, DESCARTADO |
| `FILTRO_CV` | CV en evaluación | → ENTREVISTAS, DESCARTADO |
| `ENTREVISTAS` | En proceso de entrevistas | → CONSULTA_ENTEL, DESCARTADO |
| `CONSULTA_ENTEL` | Esperando aprobación de Entel | → USUARIO_ENTEL, DESCARTADO |
| `USUARIO_ENTEL` | Esperando credenciales de Entel | → INDUCCION, DESCARTADO |
| `INDUCCION` | En proceso de inducción | → SOMBRA, DESCARTADO |
| `SOMBRA` | En período de sombra en tienda | → ALTA, INDUCCION, DESCARTADO |
| `ALTA` | Dado de alta como colaborador | — (terminal) |
| `DESCARTADO` | No continúa en proceso (banco de talento) | — (terminal) |

---

#### 13.4.2 Fuentes de Captación (`fuente_captacion`)

| Valor | Descripción |
|-------|-------------|
| `REFERIDO` | Referido por un colaborador activo |
| `PORTAL_EMPLEO` | Portal de empleo (Computrabajo, Bumeran, etc.) |
| `CONVOCATORIA` | Convocatoria directa (redes sociales, volantes) |
| `REINGRESO` | Ex-colaborador que regresa |
| `BANCO_TALENTO` | Candidato previamente descartado, re-evaluado |

---

### 13.5 candidatos_etapas

Historial de movimientos del candidato por el pipeline. Permite medir tiempos por etapa y tasas de conversión.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `candidato_id` | UUID | NO | - | FK → candidatos.id (CASCADE) |
| `etapa` | VARCHAR(30) | NO | - | Etapa (mismos valores que candidatos.etapa_actual) |
| `fecha_entrada` | TIMESTAMPTZ | NO | NOW() | Timestamp de entrada a la etapa |
| `fecha_salida` | TIMESTAMPTZ | YES | - | Timestamp de salida de la etapa |
| `resultado` | VARCHAR(20) | YES | - | APROBADO, RECHAZADO, EN_CURSO, PENDIENTE |
| `notas` | TEXT | YES | - | Notas |
| `registrado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_candidatos_etapas_candidato`, `idx_candidatos_etapas_etapa`

---

### 13.6 candidatos_entrevistas

Entrevistas multi-nivel con scorecard humana y análisis AI paralelo.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `candidato_id` | UUID | NO | - | FK → candidatos.id (CASCADE) |
| `nivel` | INTEGER | NO | 1 | Nivel de entrevista (1, 2, 3...) |
| `entrevistador_id` | UUID | NO | - | FK → usuarios.id |
| `fecha_programada` | TIMESTAMPTZ | YES | - | Fecha programada |
| `fecha_realizada` | TIMESTAMPTZ | YES | - | Fecha efectivamente realizada |
| `tipo_captura` | VARCHAR(10) | YES | - | VIDEO, AUDIO, TEXTO |
| `media_url` | TEXT | YES | - | URL de grabación en Storage |
| `duracion_segundos` | INTEGER | YES | - | Duración de la grabación |
| `transcripcion_texto` | TEXT | YES | - | Transcripción completa |
| `transcripcion_ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `ai_analisis` | JSONB | YES | - | Análisis AI de la entrevista |
| `ai_analisis_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `scorecard` | JSONB | YES | - | Evaluación humana estructurada |
| `observaciones` | TEXT | YES | - | Observaciones del entrevistador |
| `resultado` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, APROBADO, RECHAZADO |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Estructura `scorecard` (JSONB):**
```json
{
  "criterios": [
    {"nombre": "Comunicación", "puntaje": 4, "peso": 25, "observacion": "..."},
    {"nombre": "Actitud de servicio", "puntaje": 5, "peso": 25}
  ],
  "observaciones_generales": "..."
}
```

**Índices:** `idx_entrevistas_candidato`, `idx_entrevistas_entrevistador`, `idx_entrevistas_resultado`

---

### 13.7 candidatos_documentos

Repositorio de documentos del candidato en Supabase Storage.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `candidato_id` | UUID | NO | - | FK → candidatos.id (CASCADE) |
| `tipo` | VARCHAR(30) | NO | - | CV, FOTO, DNI, CERTIFICADO, ANTECEDENTES, OTRO |
| `nombre_archivo` | VARCHAR(200) | NO | - | Nombre del archivo |
| `url` | TEXT | NO | - | URL en Storage |
| `mime_type` | VARCHAR(100) | YES | - | Tipo MIME del archivo |
| `tamano_bytes` | INTEGER | YES | - | Tamaño en bytes |
| `ai_texto_extraido` | TEXT | YES | - | Texto extraído por OCR/AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `subido_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_candidatos_docs_candidato`, `idx_candidatos_docs_tipo`

---

### 13.8 contratos

Historial completo de contratos por colaborador con soporte de firma electrónica.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo_contrato` | VARCHAR(20) | NO | - | PLAZO_FIJO, INDETERMINADO, RXH, PERIODO_PRUEBA |
| `fecha_inicio` | DATE | NO | - | Fecha inicio vigencia |
| `fecha_fin` | DATE | YES | - | Fecha fin vigencia (NULL = indeterminado) |
| `cargo` | VARCHAR(100) | NO | - | Cargo en el contrato |
| `remuneracion` | DECIMAL(10,2) | NO | - | Remuneración mensual |
| `tienda_asignada_id` | UUID | YES | - | FK → tiendas.id |
| `estado` | VARCHAR(20) | NO | 'BORRADOR' | Estado del contrato (ver 13.8.1) |
| `documento_url` | TEXT | YES | - | URL del documento PDF |
| `documento_generado_por_ai` | BOOLEAN | YES | false | Si fue generado por AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `firma_colaborador_timestamp` | TIMESTAMPTZ | YES | - | Timestamp de firma electrónica |
| `firma_colaborador_ip` | VARCHAR(45) | YES | - | IP del dispositivo al firmar |
| `firma_colaborador_geo` | JSONB | YES | - | Coordenadas GPS al firmar |
| `firma_colaborador_user_agent` | TEXT | YES | - | User agent del dispositivo |
| `contrato_anterior_id` | UUID | YES | - | FK → contratos.id (self-reference) |
| `lote_renovacion_id` | UUID | YES | - | FK → renovacion_lotes.id |
| `motivo_no_renovacion` | TEXT | YES | - | Motivo si no se renovó |
| `notas` | TEXT | YES | - | Notas internas |
| `generado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Índices:** `idx_contratos_usuario`, `idx_contratos_estado`, `idx_contratos_fecha_fin`, `idx_contratos_tienda`, `idx_contratos_lote`

**RLS:** SELECT propio + gestión; ALL solo BACKOFFICE_RRHH, ADMIN

---

#### 13.8.1 Estados de Contrato (`estado`)

| Estado | Descripción |
|--------|-------------|
| `BORRADOR` | Generado, pendiente de envío |
| `ENVIADO` | Enviado al colaborador para firma |
| `FIRMADO` | Firmado electrónicamente |
| `VIGENTE` | Contrato activo en vigor |
| `VENCIDO` | Venció sin renovación |
| `CANCELADO` | Cancelado antes de firma |
| `NO_RENOVADO` | Decisión explícita de no renovar |

---

### 13.9 renovacion_lotes

Lotes mensuales de renovación con flujo de visado JV → KAM → RRHH.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `periodo` | VARCHAR(7) | NO | - | Período formato YYYY-MM (UNIQUE) |
| `fecha_generacion` | TIMESTAMPTZ | NO | NOW() | Cuándo se generó |
| `fecha_limite_visado` | DATE | YES | - | Fecha límite para visado |
| `estado` | VARCHAR(30) | NO | 'GENERADO' | Estado del lote (ver 13.9.1) |
| `total_colaboradores` | INTEGER | YES | 0 | Cantidad de colaboradores en el lote |
| `resumen` | JSONB | YES | - | Resumen agregado |
| `generado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** `periodo ~ '^\d{4}-\d{2}$'`

**Índice:** UNIQUE en `periodo`

---

#### 13.9.1 Estados del Lote (`estado`)

| Estado | Descripción | Siguiente |
|--------|-------------|-----------|
| `GENERADO` | AI generó resúmenes y lista | → EN_VISADO_JV |
| `EN_VISADO_JV` | JV revisando decisiones por zona | → EN_VISADO_KAM |
| `EN_VISADO_KAM` | KAM revisando todas las zonas | → LISTO_PARA_RRHH |
| `LISTO_PARA_RRHH` | Aprobado, RRHH puede ejecutar | → EJECUTADO |
| `EJECUTADO` | Contratos generados/no-renovados | — (terminal) |
| `CANCELADO` | Lote cancelado | — (terminal) |

---

### 13.10 renovacion_decisiones

Decisiones de renovación por colaborador con trazabilidad completa JV/KAM/RRHH.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `lote_id` | UUID | NO | - | FK → renovacion_lotes.id (CASCADE) |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `contrato_actual_id` | UUID | YES | - | FK → contratos.id |
| `ai_resumen` | TEXT | YES | - | Resumen ejecutivo generado por AI |
| `ai_recomendacion` | VARCHAR(20) | YES | - | RENOVAR, NO_RENOVAR, EVALUAR |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `indicadores_snapshot` | JSONB | YES | - | Indicadores congelados al generar |
| `decision_jv` | VARCHAR(20) | YES | - | RENOVAR, NO_RENOVAR, PENDIENTE_EVALUAR |
| `decision_jv_motivo` | TEXT | YES | - | Motivo (obligatorio si NO_RENOVAR) |
| `decision_jv_id` | UUID | YES | - | FK → usuarios.id (qué JV decidió) |
| `decision_jv_fecha` | TIMESTAMPTZ | YES | - | Cuándo decidió el JV |
| `decision_kam` | VARCHAR(20) | YES | - | CONFIRMAR, REVERTIR |
| `decision_kam_motivo` | TEXT | YES | - | Motivo (obligatorio si REVERTIR) |
| `decision_kam_id` | UUID | YES | - | FK → usuarios.id (qué KAM decidió) |
| `decision_kam_fecha` | TIMESTAMPTZ | YES | - | Cuándo decidió el KAM |
| `decision_final` | VARCHAR(20) | YES | - | RENOVAR, NO_RENOVAR |
| `ejecutado_por` | UUID | YES | - | FK → usuarios.id |
| `ejecutado_fecha` | TIMESTAMPTZ | YES | - | Cuándo se ejecutó |
| `contrato_nuevo_id` | UUID | YES | - | FK → contratos.id (contrato generado) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** UNIQUE (`lote_id`, `usuario_id`)

**Estructura `indicadores_snapshot` (JSONB):**
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

**Índices:** `idx_decisiones_lote`, `idx_decisiones_usuario`, `idx_decisiones_final`

**RLS:** SELECT para JV+; UPDATE_JV para JEFE_VENTAS; ALL para BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL

---

### 13.11 asistencia

Marcaciones de entrada/salida con selfie georeferenciada y sistema anti-fraude de 4 capas.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `tipo` | VARCHAR(10) | NO | - | ENTRADA, SALIDA |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha de la marcación |
| `hora_servidor` | TIMESTAMPTZ | NO | NOW() | Timestamp del servidor |
| `hora_dispositivo` | TIMESTAMPTZ | YES | - | Timestamp del dispositivo |
| `foto_url` | TEXT | YES | - | URL de selfie en Storage |
| `gps_lat` | DECIMAL(10,7) | YES | - | Latitud GPS capturada |
| `gps_lng` | DECIMAL(10,7) | YES | - | Longitud GPS capturada |
| `gps_accuracy` | DECIMAL(8,2) | YES | - | Precisión GPS en metros |
| `dentro_radio` | BOOLEAN | YES | - | ¿Dentro del radio de la tienda? |
| `distancia_tienda_metros` | DECIMAL(8,2) | YES | - | Distancia a la tienda en metros |
| `mock_location_detectado` | BOOLEAN | YES | false | ¿GPS falso detectado? |
| `estado` | VARCHAR(20) | NO | 'VALIDO' | VALIDO, OBSERVADO, JUSTIFICADO, RECHAZADO, EDITADO |
| `es_tardanza` | BOOLEAN | YES | false | ¿Llegó tarde? |
| `minutos_tardanza` | INTEGER | YES | 0 | Minutos de tardanza |
| `observaciones` | TEXT | YES | - | Observaciones |
| `editado_por` | UUID | YES | - | FK → usuarios.id |
| `editado_motivo` | TEXT | YES | - | Motivo de edición |
| `editado_at` | TIMESTAMPTZ | YES | - | Timestamp de edición |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraint:** UNIQUE (`usuario_id`, `tienda_id`, `fecha`, `tipo`)

**Índices:** `idx_asistencia_usuario_fecha`, `idx_asistencia_tienda_fecha`, `idx_asistencia_fecha`, `idx_asistencia_estado`

**RLS:** SELECT propio + supervisión+; INSERT propio o RRHH; UPDATE solo SUPERVISOR, BACKOFFICE_RRHH, ADMIN

---

### 13.12 apertura_cierre_tienda

Registro diario de apertura y cierre de tienda con foto y headcount.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `tipo` | VARCHAR(10) | NO | - | APERTURA, CIERRE |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha |
| `hora` | TIMESTAMPTZ | NO | NOW() | Hora del registro |
| `foto_url` | TEXT | YES | - | URL de foto evidencia |
| `gps_lat` | DECIMAL(10,7) | YES | - | Latitud GPS |
| `gps_lng` | DECIMAL(10,7) | YES | - | Longitud GPS |
| `cantidad_hc` | INTEGER | NO | 0 | Cantidad de HC presentes |
| `usuarios_presentes` | UUID[] | YES | - | Array de IDs de usuarios presentes |
| `novedades` | TEXT | YES | - | Novedades del día |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraint:** UNIQUE (`tienda_id`, `fecha`, `tipo`)

**Índice:** `idx_apertura_cierre_tienda_fecha`

---

### 13.13 horarios_tienda

Horarios base de operación por tienda y día de semana.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `dia_semana` | INTEGER | NO | - | 0=Lunes, 6=Domingo |
| `hora_apertura` | TIME | NO | '09:00' | Hora apertura |
| `hora_cierre` | TIME | NO | '21:00' | Hora cierre |
| `activo` | BOOLEAN | NO | true | Si opera ese día |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:** `dia_semana BETWEEN 0 AND 6`, UNIQUE (`tienda_id`, `dia_semana`)

**RLS:** SELECT público; ALL solo BACKOFFICE_RRHH, ADMIN

---

### 13.14 turnos

Catálogo de tipos de turno con horarios y tolerancia de tardanza.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(20) | NO | - | Código único (APERTURA, CIERRE, COMPLETO) |
| `nombre` | VARCHAR(50) | NO | - | Nombre descriptivo |
| `hora_inicio` | TIME | YES | - | Hora inicio del turno |
| `hora_fin` | TIME | YES | - | Hora fin del turno |
| `es_partido` | BOOLEAN | YES | false | Si es turno partido (con corte) |
| `hora_corte_inicio` | TIME | YES | - | Hora inicio del corte (si partido) |
| `hora_corte_fin` | TIME | YES | - | Hora fin del corte (si partido) |
| `tolerancia_tardanza_minutos` | INTEGER | YES | 5 | Minutos de tolerancia |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Seed inicial:** APERTURA (09:00-15:00), CIERRE (15:00-21:00), COMPLETO (09:00-21:00)

**RLS:** SELECT público; ALL solo BACKOFFICE_RRHH, ADMIN

---

### 13.15 asignacion_turnos

Programación de turnos por colaborador, día y tienda.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `turno_id` | UUID | NO | - | FK → turnos.id |
| `fecha` | DATE | NO | - | Fecha del turno |
| `es_dia_descanso` | BOOLEAN | NO | false | Si es día de descanso |
| `es_feriado` | BOOLEAN | YES | false | Si es feriado |
| `notas` | TEXT | YES | - | Notas |
| `asignado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** UNIQUE (`usuario_id`, `fecha`)

**Índices:** `idx_asignacion_usuario_fecha`, `idx_asignacion_tienda_fecha`

**RLS:** SELECT propio + supervisión+; ALL para COORDINADOR, SUPERVISOR, JEFE_VENTAS, BACKOFFICE_RRHH, ADMIN

---

### 13.16 incidencias_laborales

Registro disciplinario con flujo de notificación, descargo y resolución.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo` | VARCHAR(30) | NO | - | Tipo de incidencia (ver 13.16.1) |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha del evento |
| `descripcion` | TEXT | YES | - | Descripción del evento |
| `asistencia_id` | UUID | YES | - | FK → asistencia.id (si aplica) |
| `estado` | VARCHAR(20) | NO | 'REGISTRADA' | Estado del flujo (ver 13.16.2) |
| `descargo_colaborador` | TEXT | YES | - | Descargo del colaborador |
| `descargo_fecha` | TIMESTAMPTZ | YES | - | Cuándo se presentó descargo |
| `resolucion` | TEXT | YES | - | Resolución final |
| `resolucion_por` | UUID | YES | - | FK → usuarios.id |
| `resolucion_fecha` | TIMESTAMPTZ | YES | - | Fecha resolución |
| `documento_url` | TEXT | YES | - | URL del documento (acta, amonestación) |
| `generada_automaticamente` | BOOLEAN | YES | false | Si fue generada por el sistema |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Índices:** `idx_incidencias_usuario`, `idx_incidencias_tipo`, `idx_incidencias_fecha`, `idx_incidencias_estado`

**RLS:** SELECT propio + supervisión+; INSERT supervisión + RRHH; UPDATE propio (descargo) + RRHH

---

#### 13.16.1 Tipos de Incidencia (`tipo`)

| Tipo | Generación | Descripción |
|------|-----------|-------------|
| `TARDANZA` | Automática | Por marcación fuera de tolerancia |
| `FALTA_INJUSTIFICADA` | Automática | Sin marcación ni permiso aprobado |
| `FALTA_JUSTIFICADA` | Manual | Falta con justificación aceptada |
| `ABANDONO_PUESTO` | Manual | Abandonó el puesto sin autorización |
| `AMONESTACION_VERBAL` | Manual | Amonestación verbal registrada |
| `AMONESTACION_ESCRITA` | Manual | Amonestación con documento firmado |
| `SUSPENSION` | Manual | Suspensión temporal |
| `SALIDA_ANTICIPADA` | Manual/Auto | Salió antes de hora sin autorización |
| `OTRO` | Manual | Otro tipo de incidencia |

---

#### 13.16.2 Estados de Incidencia (`estado`)

| Estado | Descripción |
|--------|-------------|
| `REGISTRADA` | Incidencia creada |
| `NOTIFICADA` | Colaborador fue notificado |
| `EN_DESCARGO` | Esperando descargo del colaborador |
| `RESUELTA` | Resuelta con decisión final |
| `ESCALADA` | Escalada a nivel superior |
| `ANULADA` | Anulada (error o justificación posterior) |

---

### 13.17 solicitudes_permiso

Solicitudes de permisos, vacaciones y licencias con flujo de aprobación.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo` | VARCHAR(30) | NO | - | Tipo de permiso (ver 13.17.1) |
| `fecha_inicio` | DATE | NO | - | Fecha inicio del permiso |
| `fecha_fin` | DATE | NO | - | Fecha fin del permiso |
| `horas_solicitadas` | DECIMAL(4,1) | YES | - | Horas (para PERMISO_HORAS) |
| `motivo` | TEXT | NO | - | Motivo de la solicitud |
| `documento_adjunto_url` | TEXT | YES | - | URL documento justificatorio |
| `estado` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, APROBADO, RECHAZADO, CANCELADO |
| `aprobado_por` | UUID | YES | - | FK → usuarios.id |
| `aprobado_fecha` | TIMESTAMPTZ | YES | - | Fecha de aprobación/rechazo |
| `motivo_rechazo` | TEXT | YES | - | Motivo si fue rechazado |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** `fecha_fin >= fecha_inicio`

**Índices:** `idx_permisos_usuario`, `idx_permisos_estado`, `idx_permisos_fechas`

**RLS:** SELECT propio + supervisión+; INSERT solo propio; UPDATE propio (cancelar si pendiente) + aprobadores

---

#### 13.17.1 Tipos de Permiso (`tipo`)

| Tipo | Descripción | Requiere documento |
|------|-------------|-------------------|
| `PERMISO_HORAS` | Permiso por horas dentro del día | No |
| `PERMISO_DIA` | Permiso por día completo | No |
| `VACACIONES` | Vacaciones (según ley peruana) | No |
| `LICENCIA_MEDICA` | Licencia médica | Sí |
| `LICENCIA_MATERNIDAD` | Licencia por maternidad (98 días) | Sí |
| `LICENCIA_PATERNIDAD` | Licencia por paternidad (10 días) | Sí |
| `LICENCIA_FALLECIMIENTO` | Licencia por fallecimiento familiar (5 días) | Sí |
| `OTRO` | Otro tipo de permiso | Depende |

---

### 13.18 movimientos_personal

Historial de todos los movimientos de personal con datos antes/después.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo_movimiento` | VARCHAR(30) | NO | - | Tipo de movimiento (ver 13.18.1) |
| `fecha_efectiva` | DATE | NO | - | Fecha efectiva del movimiento |
| `motivo` | TEXT | YES | - | Motivo |
| `datos_anteriores` | JSONB | YES | - | Snapshot de datos antes del cambio |
| `datos_nuevos` | JSONB | YES | - | Snapshot de datos después del cambio |
| `contrato_id` | UUID | YES | - | FK → contratos.id |
| `tienda_origen_id` | UUID | YES | - | FK → tiendas.id |
| `tienda_destino_id` | UUID | YES | - | FK → tiendas.id |
| `autorizado_por` | UUID | NO | - | FK → usuarios.id |
| `documento_url` | TEXT | YES | - | URL de documento soporte |
| `notas` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_movimientos_usuario`, `idx_movimientos_tipo`, `idx_movimientos_fecha`

**RLS:** SELECT propio + jefatura+; ALL solo BACKOFFICE_RRHH, ADMIN

---

#### 13.18.1 Tipos de Movimiento (`tipo_movimiento`)

| Tipo | Descripción |
|------|-------------|
| `INGRESO` | Alta de nuevo colaborador |
| `TRANSFERENCIA` | Cambio de tienda |
| `CAMBIO_ROL` | Cambio de rol (ej: ASESOR → COORDINADOR) |
| `CAMBIO_ZONA` | Cambio de zona geográfica |
| `PROMOCION` | Promoción (implica cambio de rol/remuneración) |
| `CAMBIO_REMUNERACION` | Solo cambio de remuneración |
| `CESE_VOLUNTARIO` | Renuncia voluntaria |
| `CESE_DESPIDO` | Despido |
| `CESE_NO_RENOVACION` | No renovación de contrato |
| `CESE_ABANDONO` | Abandono de trabajo |
| `CESE_PERIODO_PRUEBA` | No pasó período de prueba |
| `REINGRESO` | Reingreso de ex-colaborador |

---

### 13.19 offboarding_checklist

Checklist adaptativo de offboarding generado según tipo de salida. AI genera tareas según el contexto.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo_salida` | VARCHAR(30) | NO | - | RENUNCIA, NO_RENOVACION, DESPIDO, ABANDONO, PERIODO_PRUEBA, MUTUO_ACUERDO |
| `fecha_inicio` | DATE | NO | CURRENT_DATE | Fecha inicio del proceso |
| `fecha_cierre` | DATE | YES | - | Fecha cierre del proceso |
| `estado` | VARCHAR(20) | NO | 'EN_PROCESO' | EN_PROCESO, COMPLETADO, CANCELADO |
| `tareas` | JSONB | NO | '[]' | Array de tareas del checklist |
| `generado_por_ai` | BOOLEAN | YES | false | Si fue generado por AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `responsable_id` | UUID | NO | - | FK → usuarios.id |
| `notas` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Estructura `tareas` (JSONB):**
```json
[
  {"id": "t1", "titulo": "Carta de renuncia recibida", "completada": true, "completada_por": "uuid", "completada_fecha": "2026-02-13", "orden": 1},
  {"id": "t2", "titulo": "Liquidación calculada", "completada": false, "orden": 2}
]
```

**Índices:** `idx_offboarding_usuario`, `idx_offboarding_estado`

**RLS:** SELECT/ALL para jefatura + RRHH

---

### 13.20 documentos_colaborador

Repositorio digital de documentos por colaborador con soporte OCR/AI.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo` | VARCHAR(30) | NO | - | Tipo de documento (ver 13.20.1) |
| `nombre_archivo` | VARCHAR(200) | NO | - | Nombre del archivo |
| `descripcion` | TEXT | YES | - | Descripción |
| `url` | TEXT | NO | - | URL en Supabase Storage |
| `mime_type` | VARCHAR(100) | YES | - | Tipo MIME |
| `tamano_bytes` | INTEGER | YES | - | Tamaño en bytes |
| `ai_texto_extraido` | TEXT | YES | - | Texto extraído por OCR |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `fecha_documento` | DATE | YES | - | Fecha del documento |
| `es_confidencial` | BOOLEAN | YES | false | Si es confidencial |
| `subido_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_docs_usuario`, `idx_docs_tipo`

**RLS:** SELECT propio (no confidencial) + gestión (todo); ALL solo BACKOFFICE_RRHH, ADMIN

---

#### 13.20.1 Tipos de Documento (`tipo`)

| Tipo | Descripción |
|------|-------------|
| `CV` | Currículum vitae |
| `FOTO` | Foto del colaborador |
| `DNI` | Copia de DNI |
| `CONTRATO` | Contrato firmado |
| `AMONESTACION` | Amonestación escrita |
| `CERTIFICADO` | Certificado de capacitación |
| `CARTA_NOTARIAL` | Carta notarial |
| `LIQUIDACION` | Liquidación de beneficios |
| `EVALUACION` | Evaluación de desempeño |
| `ENTREVISTA_GRABACION` | Grabación de entrevista |
| `ENTREVISTA_TRANSCRIPCION` | Transcripción de entrevista |
| `LICENCIA_MEDICA` | Certificado médico |
| `OTRO` | Otro documento |

---

### 13.21 alertas_rrhh

Alertas contextuales automáticas del módulo RRHH con priorización.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tipo` | VARCHAR(40) | NO | - | Tipo de alerta (ver 13.21.1) |
| `titulo` | VARCHAR(200) | NO | - | Título de la alerta |
| `mensaje` | TEXT | NO | - | Mensaje descriptivo |
| `nivel` | VARCHAR(10) | NO | 'INFO' | INFO, WARNING, CRITICAL |
| `entidad_tipo` | VARCHAR(30) | YES | - | Tipo de entidad relacionada |
| `entidad_id` | UUID | YES | - | ID de la entidad |
| `modulo` | VARCHAR(30) | YES | - | Módulo que genera la alerta |
| `datos_contexto` | JSONB | YES | - | Datos de contexto para la alerta |
| `destinatario_id` | UUID | YES | - | FK → usuarios.id (destinatario específico) |
| `destinatario_rol` | VARCHAR(30) | YES | - | Rol destinatario (si es broadcast) |
| `estado` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, LEIDA, ACCIONADA, DESCARTADA |
| `leida_at` | TIMESTAMPTZ | YES | - | Cuándo se leyó |
| `accion_tomada` | TEXT | YES | - | Qué acción se tomó |
| `accion_por` | UUID | YES | - | FK → usuarios.id |
| `accion_at` | TIMESTAMPTZ | YES | - | Cuándo se accionó |
| `generada_por` | VARCHAR(20) | NO | 'SISTEMA' | SISTEMA, AI, MANUAL |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_alertas_destinatario`, `idx_alertas_tipo`, `idx_alertas_estado`, `idx_alertas_nivel`, `idx_alertas_created`

**RLS:** SELECT propia + gestión; UPDATE propia (marcar leída) + RRHH; INSERT solo BACKOFFICE_RRHH, ADMIN

---

#### 13.21.1 Tipos de Alerta (`tipo`)

| Tipo | Nivel típico | Descripción |
|------|-------------|-------------|
| `CONTRATO_POR_VENCER` | WARNING | Contrato vence en los próximos X días |
| `VISADO_PENDIENTE` | CRITICAL | Lote de renovación esperando visado |
| `PERIODO_PRUEBA_VENCER` | WARNING | Período de prueba por terminar |
| `CANDIDATO_ESTANCADO` | INFO | Candidato más de X días en una etapa |
| `AUSENCIA_SIN_JUSTIFICAR` | WARNING | Falta sin permiso aprobado |
| `ABANDONO_POTENCIAL` | CRITICAL | Patrón de ausencias consecutivas |
| `RIESGO_FUGA` | WARNING | AI detecta alto riesgo de rotación |
| `INCIDENCIA_REINCIDENTE` | WARNING | Más de N incidencias en período |
| `COBERTURA_BAJA` | CRITICAL | Tienda con HC menor al mínimo |
| `CUMPLEANOS` | INFO | Cumpleaños de colaborador |
| `TURNO_SIN_ASIGNAR` | WARNING | Día sin turno asignado |
| `PERMISO_PENDIENTE` | INFO | Solicitud de permiso sin resolver |
| `OFFBOARDING_PENDIENTE` | WARNING | Checklist de salida incompleto |
| `GENERAL` | INFO | Alerta general |

---

### 13.22 Diagrama de Relaciones — Módulo RRHH

```
                                    ┌──────────────┐
                                    │   usuarios   │ (existente)
                                    └──────┬───────┘
                         ┌─────────────────┼─────────────────────────────┐
                         │                 │                             │
                         ▼                 ▼                             ▼
               ┌─────────────────┐ ┌──────────────┐           ┌─────────────────┐
               │ usuarios_rrhh   │ │  candidatos  │           │    contratos    │
               │ (1:1 extensión) │ │  (pipeline)  │           │  (historial)   │
               └────────┬────────┘ └──────┬───────┘           └────────┬────────┘
                        │                 │                            │
          ┌─────────────┤           ┌─────┼─────────┐          ┌──────┴──────┐
          ▼             ▼           ▼     ▼         ▼          ▼             ▼
  ┌───────────┐ ┌────────────┐ ┌──────┐┌──────┐┌──────┐ ┌──────────┐ ┌──────────┐
  │status_log │ │asistencia  │ │etapas││entrev││ docs │ │renov_    │ │renov_    │
  └───────────┘ └────────────┘ └──────┘└──────┘└──────┘ │lotes    │ │decisiones│
                      │                                  └──────────┘ └──────────┘
                      ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │incidencias   │ │solicitudes   │ │movimientos   │ │offboarding   │
  │_laborales    │ │_permiso      │ │_personal     │ │_checklist    │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │documentos    │ │alertas_rrhh  │ │ai_tasks      │ │  tiendas     │
  │_colaborador  │ │              │ │(compartida)  │ │(+8 columnas) │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

  Tablas de soporte:
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
  │horarios      │ │turnos        │ │asignacion    │ │apertura_cierre   │
  │_tienda       │ │(catálogo)    │ │_turnos       │ │_tienda           │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘
```

# ↑ FIN DEL CONTENIDO A INSERTAR ↑

---

## CAMBIO 5: Renumerar "Historial de Cambios" a sección 14

La sección actual "13. HISTORIAL DE CAMBIOS" pasa a ser **"14. HISTORIAL DE CAMBIOS"**.

---

## CAMBIO 6: Agregar entrada al Historial de Cambios

Agregar al final de la tabla:

```
| 2026-02-13 | **3.0** | **Módulo RRHH:** 21 tablas nuevas (usuarios_rrhh, usuarios_status_log, ai_tasks, candidatos, candidatos_etapas, candidatos_entrevistas, candidatos_documentos, contratos, renovacion_lotes, renovacion_decisiones, asistencia, apertura_cierre_tienda, horarios_tienda, turnos, asignacion_turnos, incidencias_laborales, solicitudes_permiso, movimientos_personal, offboarding_checklist, documentos_colaborador, alertas_rrhh). ALTER tiendas (+8 columnas GPS/zona/HC). 61 índices, 12 triggers, 61 RLS policies. |
```

---

## CAMBIO 7: Actualizar "Resumen de Objetos por Versión" (sección de Comisiones)

Agregar fila:

```
| v3.0 (RRHH) | +21 tablas | +8 cols en tiendas | 2026-02-13 |
```

---

*Fin de instrucciones de actualización del DATA_DICTIONARY*
