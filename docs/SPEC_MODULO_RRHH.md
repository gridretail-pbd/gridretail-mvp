# GridRetail - Módulo de Gestión de RRHH
## Especificación y Lineamientos Generales
**Versión:** 1.0  
**Última actualización:** 2026-02-13  
**Propósito:** Documento de referencia para el desarrollo del módulo de Gestión de Recursos Humanos de GridRetail. Debe adjuntarse a cada conversación de desarrollo relacionada con RRHH.

---

## 1. VISIÓN GENERAL

### 1.1 Filosofía AI First

GridRetail es una plataforma **AI first** y **AI ready**. Esto significa que la inteligencia artificial no es un complemento cosmético sino un componente estructural de la operación. Cada funcionalidad del módulo RRHH se diseña considerando tres niveles de integración AI:

| Nivel | Descripción | Ejemplo |
|-------|-------------|---------|
| **Motor invisible** | El AI opera sin que el usuario lo perciba | Parsing de CV, validación de DNI, indexación de documentos |
| **Asistente activo** | El AI sugiere, alerta y analiza visiblemente | Scoring de candidatos, resúmenes ejecutivos, detección de anomalías |
| **Agente autónomo** | El AI ejecuta tareas delegadas | Generación de contratos, alertas de abandono, checklist adaptativos |

### 1.2 Alcance

- **Población inicial:** ~100 colaboradores
- **Tiendas:** 21 TEX en Lima
- **Composición:** 42-63 asesores/encargados, 6 supervisores, 2 jefes de venta, 2 repartidores, 1 operario de mantenimiento, 1 asistente de mantenimiento, 1 jefe de RRHH, 1 capacitador, 1 encargado de abastecimiento y soporte operativo, 1 KAM
- **Contexto:** Alta rotación típica de retail telecom, contratos mensuales, dependencia de aprobaciones externas de Entel

### 1.3 Submódulos

| Submódulo | Descripción | Prioridad |
|-----------|-------------|-----------|
| Reclutamiento | Pipeline completo desde referido hasta incorporación | 🔴 Alta |
| Gestión de Contratos | Ciclo de vida contractual con flujo de renovación | 🔴 Alta |
| Ficha del Colaborador | Datos laborales extendidos (extensión de `usuarios`) | 🔴 Alta |
| Control de Asistencia | Marcación con selfie georeferenciado + apertura/cierre | 🟡 Media |
| Gestión de Horarios y Turnos | Programación y asignación de turnos | 🟡 Media |
| Incidencias Laborales | Registro y seguimiento de faltas disciplinarias | 🟡 Media |
| Permisos y Vacaciones | Solicitudes con flujo de aprobación | 🟡 Media |
| Movimientos de Personal | Transferencias, promociones, ceses | 🟡 Media |
| Offboarding | Checklist adaptativo de salida | 🟡 Media |
| Portal de Autoservicio | Acceso del colaborador a su información | 🟢 Baja |
| Dashboard y Métricas RRHH | Indicadores y reportes consolidados | 🟢 Baja |

---

## 2. RECLUTAMIENTO AI-POWERED

### 2.1 Pipeline Kanban — Etapas

El proceso de reclutamiento se gestiona como un pipeline visual tipo Kanban con las siguientes etapas secuenciales:

```
CAPTACIÓN → FILTRO CV → ENTREVISTAS → CONSULTA ENTEL → USUARIO ENTEL → INDUCCIÓN → SOMBRA → ALTA
                                                                                              ↓
     ←←←←←←←←←←←←←←←←←←←←←←←←←← DESCARTADO (desde cualquier etapa) ←←←←←←←←←←←←←←←←←←←←←←
```

#### Etapa 1: Captación / Referido

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| nombre_completo | VARCHAR | Sí | Nombre del candidato |
| dni | VARCHAR(8) | Sí | DNI (validado con json.pe) |
| telefono | VARCHAR | Sí | Teléfono de contacto |
| email | VARCHAR | No | Email |
| distrito_residencia | VARCHAR | Sí | Distrito donde vive |
| disponibilidad_horario | VARCHAR | Sí | Disponibilidad declarada |
| experiencia_telecom | BOOLEAN | Sí | Si tiene experiencia en telecom |
| experiencia_detalle | TEXT | No | Dónde trabajó previamente |
| fuente_captacion | ENUM | Sí | REFERIDO, PORTAL_EMPLEO, CONVOCATORIA, REINGRESO |
| referido_por | UUID FK | Condicional | FK → usuarios.id (si fuente = REFERIDO) |
| foto_url | TEXT | No | Foto del postulante (Supabase Storage) |
| cv_url | TEXT | No | CV adjunto (Supabase Storage) |

**AI — Motor invisible:**
- Al ingresar DNI, consulta automática a json.pe para validar identidad y pre-llenar nombre
- Cruce contra base interna: si el DNI ya existe en `usuarios` (activo o cesado) o en `candidatos` previos, se alerta con historial completo (motivo de cese, desempeño, incidencias)

**AI — Asistente activo — Parsing de CV:**
- Al subir CV (PDF, imagen, foto de documento impreso): Supabase Storage → Edge Function → Claude API con prompt especializado en CVs peruanos → extracción de datos estructurados en JSON → pre-llenado de campos del formulario
- El reclutador revisa y confirma, no tipea manualmente

**AI — Asistente activo — Scoring de candidatos:**
- Score de compatibilidad automático basado en: proximidad geográfica del domicilio a tiendas con vacantes (coordenadas), experiencia previa en telecom/retail, si fue referido por un asesor de alto rendimiento (dato del módulo de comisiones)
- Score visible en la tarjeta del candidato, ayuda a priorizar sin reemplazar decisión humana

#### Etapa 2: Filtro CV / Evaluación Inicial

- Evaluador: BACKOFFICE_RRHH o Capacitador
- Calificación simple + notas
- Filtro por criterios: distancia a tiendas, experiencia, disponibilidad
- **Resultado:** Pasa a entrevista | Descartado (con motivo)

#### Etapa 3: Entrevistas Multi-nivel

Las entrevistas son escalonadas. El candidato avanza por niveles configurables:

| Nivel | Entrevistador | Propósito |
|-------|---------------|-----------|
| 1 | Reclutador (RRHH / Capacitador) | Filtro inicial: actitud, comunicación, disponibilidad |
| 2 | Jefe de Ventas (de la zona con vacante) | Evaluación comercial, fit con equipo |
| N | Configurable (KAM, Gerente) | Para roles de mayor jerarquía (supervisores, coordinadores) |

**Flujo por nivel:**
- Si Nivel 1 aprueba → sistema notifica automáticamente al entrevistador del Nivel 2
- Si cualquier nivel rechaza → candidato va a Descartado con motivo
- Si aprueba el último nivel → candidato avanza a Consulta Entel

**Captura de entrevistas:**

| Formato | Almacenamiento | Procesamiento AI |
|---------|----------------|------------------|
| Video | Supabase Storage (.webm/.mp4) | Extracción de audio → Whisper → Transcripción → Claude análisis |
| Audio | Supabase Storage (.webm/.mp3) | Whisper → Transcripción → Claude análisis |
| Texto (transcripción manual) | Campo en BD | Claude análisis directo |

**AI — Asistente activo — Análisis de entrevista:**
Pipeline: Audio/Video → Whisper API (transcripción en español) → Claude API con prompt especializado → Genera:
1. Resumen estructurado (puntos fuertes, áreas de preocupación, fit percibido)
2. Evaluación automática contra criterios del scorecard
3. Preguntas clave bien/mal respondidas

El análisis AI se almacena junto con la evaluación humana. El entrevistador siempre completa su propia evaluación.

**Scorecard estructurada (criterios por defecto para asesor TEX):**

| Criterio | Rango | Peso |
|----------|-------|------|
| Habilidades de comunicación | 1-5 | Configurable |
| Actitud de servicio | 1-5 | Configurable |
| Presentación personal | 1-5 | Configurable |
| Conocimiento básico de telecom | 1-5 | Configurable |
| Disponibilidad y compromiso | 1-5 | Configurable |

Campo libre de observaciones por cada evaluador/nivel.

#### Etapa 4: Consulta a Entel (Aprobación Externa)

| Campo | Descripción |
|-------|-------------|
| fecha_envio_entel | Fecha en que se envió a Entel |
| estado_consulta | PENDIENTE, APROBADO, RECHAZADO, OBSERVADO |
| fecha_respuesta_entel | Fecha de respuesta |
| observaciones_entel | Notas de Entel |

**AI — Asistente activo:**
- Si candidato lleva > X días (configurable): genera draft de email de seguimiento a Entel para que RRHH revise y envíe
- Alerta contextual: "Juan Pérez lleva 5 días sin respuesta de Entel. Promedio histórico: 3 días. Esto está fuera del rango normal."

#### Etapa 5: Pendiente de Usuario Entel

| Campo | Descripción |
|-------|-------------|
| fecha_solicitud_usuario | Fecha de solicitud de credenciales |
| estado_usuario | SOLICITADO, EN_PROCESO, ENTREGADO |
| usuario_confirmado | BOOLEAN — confirmación de recepción |

**AI:** Alertas por candidatos estancados. Dashboard muestra cuántos candidatos están bloqueados en esta etapa.

#### Etapa 6: Inducción

| Campo | Descripción |
|-------|-------------|
| fecha_inicio_induccion | Inicio de capacitación |
| fecha_fin_induccion | Fin de capacitación |
| capacitador_id | FK → usuarios.id |
| checklist_induccion | JSONB — módulos/temas cubiertos |
| evaluacion_induccion | ENUM: APROBADO, DESAPROBADO, EN_CURSO |

**AI — Asistente activo:**
- Genera plan de inducción personalizado según perfil del candidato (si tiene experiencia previa en telecom, plan más corto o salta módulos básicos)
- Checklist dinámico, no estático

#### Etapa 7: Sombra

| Campo | Descripción |
|-------|-------------|
| tienda_sombra_id | FK → tiendas.id |
| mentor_id | FK → usuarios.id (asesor experimentado) |
| fecha_inicio_sombra | Inicio del periodo |
| fecha_fin_sombra | Fin del periodo |
| evaluacion_mentor | JSONB (calificación + observaciones) |
| evaluacion_supervisor | JSONB (calificación + observaciones) |
| resultado | ENUM: APROBADO, DESAPROBADO, EXTENDER |

**AI — Asistente activo — Asignación inteligente:**
Sugiere tienda y mentor óptimos basándose en:
- Proximidad geográfica del candidato al tienda
- Desempeño del asesor mentor (asesores con mejor score de comisiones)
- Carga actual de la tienda (no asignar sombra donde ya hay otro candidato en sombra)

#### Etapa 8: Alta / Incorporación

Al aprobar esta etapa, el sistema ejecuta automáticamente:

1. Creación del registro en tabla `usuarios` (código_asesor, DNI, rol, zona)
2. Asignación a tienda(s) en `usuarios_tiendas`
3. Creación de ficha RRHH en `usuarios_rrhh`
4. Generación del primer contrato con datos pre-poblados
5. Notificación al equipo de la tienda destino
6. Cambio de status a `ACTIVO` (o `PERIODO_PRUEBA`)

**Este es el punto de conexión directa con el módulo de Gestión de Usuarios.**

#### Estado: Descartado

Desde cualquier etapa el candidato puede ser descartado:

| Campo | Descripción |
|-------|-------------|
| etapa_descarte | Etapa donde se descartó |
| motivo_descarte | Motivo (catálogo configurable + texto libre) |
| fecha_descarte | Fecha |
| descartado_por | FK → usuarios.id |

#### Banco de Talento

Candidatos descartados o incompletos se mantienen en banco consultable.

**AI — Asistente activo:**
Cuando se abre nueva vacante, sugiere candidatos del banco rankeados por compatibilidad con la nueva posición.

---

## 3. GESTIÓN DE CONTRATOS

### 3.1 Tipos de Contrato

| Tipo | Código | Descripción |
|------|--------|-------------|
| Plazo fijo | PLAZO_FIJO | La mayoría. Típicamente mensual |
| Indeterminado | INDETERMINADO | Casos excepcionales |
| Recibos por honorarios | RXH | Si aplica para algún rol |
| Periodo de prueba | PERIODO_PRUEBA | Primeros 30 días (subcategoría de plazo fijo) |

### 3.2 Ciclo de Vida del Contrato

```
GENERADO → ENVIADO → FIRMADO_COLABORADOR → VIGENTE → PRÓXIMO_A_VENCER → VENCIDO
                                                           ↓
                                                    RENOVACIÓN (nuevo ciclo)
                                                           ↓
                                                    NO_RENOVADO → OFFBOARDING
```

### 3.3 Datos del Contrato

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador único |
| usuario_id | UUID FK | FK → usuarios.id |
| tipo_contrato | ENUM | PLAZO_FIJO, INDETERMINADO, RXH |
| fecha_inicio | DATE | Inicio de vigencia |
| fecha_fin | DATE | Fin de vigencia (NULL si indeterminado) |
| cargo | VARCHAR | Cargo formal en contrato |
| remuneracion | DECIMAL | Remuneración mensual |
| tienda_asignada_id | UUID FK | FK → tiendas.id (tienda principal) |
| documento_url | TEXT | PDF del contrato en Supabase Storage |
| estado | ENUM | BORRADOR, ENVIADO, FIRMADO, VIGENTE, VENCIDO, CANCELADO |
| firma_colaborador_timestamp | TIMESTAMPTZ | Momento de la firma digital |
| firma_colaborador_ip | VARCHAR | IP del dispositivo al firmar |
| firma_colaborador_geo | JSONB | Geolocalización al firmar |
| contrato_anterior_id | UUID FK | FK → contratos.id (contrato que renueva) |
| lote_renovacion_id | UUID FK | FK → renovacion_lotes.id |
| created_at | TIMESTAMPTZ | Fecha creación |
| updated_at | TIMESTAMPTZ | Fecha actualización |

### 3.4 Flujo de Renovación Mensual (con visado obligatorio)

**PROBLEMA QUE RESUELVE:** Evitar que se renueve a gente que el JV o KAM ya no querían renovar (por falta de comunicación a RRHH), y evitar que NO se renueve a alguien por rumores o comentarios informales no confirmados. La decisión de renovación debe ser formal, trazable y visada.

#### Fase 1: Generación Automática de Lista

**Trigger:** Día configurable del mes (ej. día 20)
**Actor:** Sistema (AI como agente)

El sistema genera automáticamente la lista de contratos que vencen el mes siguiente. Para cada colaborador incluye:
- Datos básicos (nombre, tienda, cargo, fecha de ingreso, antigüedad)
- Indicadores de rendimiento del mes (ventas, comisiones — del módulo Comisiones)
- Indicadores de asistencia (tardanzas, faltas — del módulo Asistencia)
- Incidencias activas (del módulo Incidencias)
- **Resumen ejecutivo AI** por colaborador con recomendación fundamentada

**Ejemplo de resumen AI:**
> "María Pérez — TE Higuereta. 3 meses de antigüedad. Rendimiento: sobre el promedio de la tienda (120% de cuota). 1 tardanza este mes. Sin incidencias. **Recomendación AI: Renovar.**"

> "Carlos López — TE Agustino. 1 mes (periodo de prueba). Rendimiento: bajo el promedio (45% de cuota). 4 tardanzas. 1 amonestación verbal. **Recomendación AI: Evaluar con JV — indicadores por debajo del umbral.**"

#### Fase 2: Visado por Jefe de Ventas

**Actor:** JEFE_VENTAS (uno por zona)
**Alcance:** Solo colaboradores de su zona

| Decisión | Motivo | Obligatorio |
|----------|--------|-------------|
| RENOVAR | — | No |
| NO_RENOVAR | Texto libre | Sí |
| PENDIENTE_EVALUAR | Texto libre | Sí |

- Plazo configurable para completar visado (ej. 3 días hábiles)
- Si no completa en plazo → escalamiento automático al Gerente Comercial
- Cada decisión queda registrada con timestamp y usuario

#### Fase 3: Visado por KAM

**Actor:** KAM
**Alcance:** Lista consolidada de todas las zonas, ya con decisiones de los JV

| Acción | Descripción |
|--------|-------------|
| Confirmar decisión JV | Acepta lo que decidió el JV |
| Revertir decisión JV | Cambia la decisión (con justificación obligatoria) |
| Agregar observaciones | Comentarios adicionales |

**AI — Asistente activo — Detección de inconsistencias:**
- "El JV marcó 'no renovar' a Pedro Sánchez, pero Pedro tiene el 2do mejor rendimiento de su tienda. ¿Confirmar decisión?"
- "Si no se renuevan los 3 marcados en TE San Juan, la tienda quedará con 1 solo asesor."

#### Fase 4: Ejecución por RRHH

**Requisito previo:** Visados de JV y KAM completos. RRHH no puede proceder sin ambos visados.

**Actor:** BACKOFFICE_RRHH

Acciones por cada colaborador según decisión final:
- **RENOVAR:** Genera nuevo contrato automáticamente (AI como agente) con datos pre-poblados. Si hubo cambio de condiciones (aumento, cambio de tienda), se reflejan.
- **NO_RENOVAR:** Dispara flujo de offboarding con fecha de fin de contrato.
- **PENDIENTE:** Alerta a RRHH para resolución manual antes de fecha límite.

**AI — Motor invisible — Verificaciones pre-generación:**
- ¿Hay algún contrato anterior no firmado?
- ¿Datos inconsistentes (remuneración diferente a lo aprobado)?
- ¿Colaboradores en periodo de prueba que deberían pasar a contrato regular?

### 3.5 Firma Electrónica

**MVP:** Flujo pragmático
1. Sistema genera PDF del contrato
2. Envío al colaborador (email + notificación en app)
3. Colaborador revisa y acepta digitalmente desde la app
4. Registro de aceptación: timestamp + IP + geolocalización del dispositivo
5. Contrato firmado se almacena en Supabase Storage

**Fase posterior:** Integración con proveedor de firma electrónica certificada conforme a legislación peruana.

### 3.6 Datos del Lote de Renovación

**Tabla `renovacion_lotes`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador del lote |
| periodo | VARCHAR | Formato YYYY-MM del mes que se renueva |
| fecha_generacion | TIMESTAMPTZ | Cuándo se generó la lista |
| estado | ENUM | GENERADO, EN_VISADO_JV, EN_VISADO_KAM, LISTO_PARA_RRHH, EJECUTADO |
| fecha_limite_visado | DATE | Deadline para completar visados |
| created_at | TIMESTAMPTZ | Fecha creación |

**Tabla `renovacion_decisiones`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador |
| lote_id | UUID FK | FK → renovacion_lotes.id |
| usuario_id | UUID FK | FK → usuarios.id (colaborador evaluado) |
| contrato_actual_id | UUID FK | FK → contratos.id |
| ai_resumen | TEXT | Resumen ejecutivo generado por AI |
| ai_recomendacion | ENUM | RENOVAR, NO_RENOVAR, EVALUAR |
| decision_jv_id | UUID FK | FK → usuarios.id (JV que visó) |
| decision_jv | ENUM | RENOVAR, NO_RENOVAR, PENDIENTE_EVALUAR |
| decision_jv_motivo | TEXT | Motivo (obligatorio si NO_RENOVAR) |
| decision_jv_fecha | TIMESTAMPTZ | Timestamp del visado JV |
| decision_kam_id | UUID FK | FK → usuarios.id (KAM que visó) |
| decision_kam | ENUM | CONFIRMAR, REVERTIR |
| decision_kam_motivo | TEXT | Motivo (obligatorio si REVERTIR) |
| decision_kam_fecha | TIMESTAMPTZ | Timestamp del visado KAM |
| decision_final | ENUM | RENOVAR, NO_RENOVAR |
| ejecutado_por | UUID FK | FK → usuarios.id (RRHH que ejecutó) |
| ejecutado_fecha | TIMESTAMPTZ | Timestamp de ejecución |

---

## 4. FICHA DEL COLABORADOR

### 4.1 Extensión de `usuarios` → tabla `usuarios_rrhh`

Relación 1:1 con tabla `usuarios` existente. La tabla `usuarios` mantiene datos operativos del sistema; `usuarios_rrhh` agrega datos laborales y personales ampliados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | = usuarios.id (PK compartida) |
| fecha_nacimiento | DATE | Fecha de nacimiento |
| telefono_personal | VARCHAR | Teléfono personal |
| telefono_emergencia | VARCHAR | Teléfono de contacto de emergencia |
| contacto_emergencia_nombre | VARCHAR | Nombre del contacto de emergencia |
| contacto_emergencia_parentesco | VARCHAR | Parentesco |
| direccion_domiciliaria | TEXT | Dirección completa |
| distrito_residencia | VARCHAR | Distrito |
| banco | VARCHAR | Banco para pagos |
| numero_cuenta | VARCHAR | Número de cuenta bancaria |
| cci | VARCHAR | Código CCI interbancario |
| tipo_contrato_actual | ENUM | PLAZO_FIJO, INDETERMINADO, RXH |
| fecha_ingreso | DATE | Fecha de ingreso a la empresa |
| fecha_fin_contrato | DATE | Fecha fin del contrato vigente |
| regimen_laboral | VARCHAR | Régimen laboral |
| cargo_formal | VARCHAR | Cargo formal (puede diferir del rol en sistema) |
| area_funcional | ENUM | COMERCIAL, OPERACIONES, RRHH, MANTENIMIENTO, ADMINISTRACION |
| jefe_directo_id | UUID FK | FK → usuarios.id |
| talla_uniforme | VARCHAR | Talla de uniforme |
| equipo_corporativo | BOOLEAN | Si tiene equipo asignado |
| equipo_corporativo_detalle | TEXT | Detalle del equipo |
| foto_url | TEXT | Foto del colaborador |
| status | ENUM | Ver sección 5 — Status del Colaborador |
| created_at | TIMESTAMPTZ | Fecha creación |
| updated_at | TIMESTAMPTZ | Fecha actualización |

### 4.2 Relación con módulos existentes

```
usuarios (Core)          ←— 1:1 —→  usuarios_rrhh (RRHH)
    ↕                                     ↕
usuarios_tiendas (Core)            contratos (RRHH)
    ↕                                     ↕
tiendas (Core)                  renovacion_lotes (RRHH)
```

---

## 5. STATUS DEL COLABORADOR

### 5.1 Estados

| Estado | Código | Descripción |
|--------|--------|-------------|
| Candidato | CANDIDATO | En pipeline de reclutamiento |
| En inducción | EN_INDUCCION | Aprobado, en capacitación formal |
| En sombra | EN_SOMBRA | Practicando en tienda con mentor |
| Periodo de prueba | PERIODO_PRUEBA | Primeros 30 días como activo |
| Activo | ACTIVO | Operando normalmente |
| Suspendido | SUSPENDIDO | Suspensión disciplinaria temporal |
| Licencia | LICENCIA | Licencia médica u otra |
| Pre-cese | PRE_CESE | En proceso de salida |
| Cesado | CESADO | Ya no labora |

### 5.2 Transiciones Válidas

```
CANDIDATO → EN_INDUCCION → EN_SOMBRA → PERIODO_PRUEBA → ACTIVO
                                                            ↕
                                              SUSPENDIDO ←→ ACTIVO
                                              LICENCIA   ←→ ACTIVO
                                                            ↓
                                                        PRE_CESE → CESADO
```

**Restricciones:**
- No se puede saltar etapas de incorporación (CANDIDATO no va directo a ACTIVO)
- CESADO es estado terminal (para volver, se crea nuevo registro de candidato como REINGRESO)
- Cada cambio de estado genera registro en `usuarios_status_log` con fecha, motivo y responsable

### 5.3 AI — Detección Proactiva de Riesgo de Fuga

**Modelo predictivo de deserción** basado en datos que GridRetail ya captura:

| Señal | Fuente | Peso |
|-------|--------|------|
| Caída progresiva en ventas (2-3 semanas) | Módulo Ventas/INAR | Alto |
| Aumento de tardanzas o faltas esporádicas | Módulo Asistencia | Alto |
| Disminución en registro de arribos | Módulo Arribos | Medio |
| Incidencias recientes | Módulo Incidencias | Medio |
| Antigüedad baja (< 90 días) | usuarios_rrhh | Alto |
| Temporada del año (meses con más deserción) | Histórico | Bajo |

**Output:** Índice de riesgo de fuga por colaborador (BAJO, MEDIO, ALTO), visible para Supervisor y RRHH.

**Alerta ejemplo:**
> "⚠️ Riesgo de fuga ALTO para Ana Torres (TE Chimú). Sus ventas cayeron 40% en las últimas 2 semanas y tuvo 2 tardanzas atípicas. Considerar conversación preventiva."

---

## 6. CONTROL DE ASISTENCIA

### 6.1 Marcación Diaria (Entrada/Salida)

**Captura obligatoria desde app móvil:**
- Selfie en tiempo real (sin acceso a galería)
- Watermark visual: GPS + timestamp + código asesor + tienda + "VERIFICADO GridRetail"
- Timestamp del servidor como fuente de verdad (no del dispositivo)
- Validación de radio GPS (100m de la tienda asignada)

**Sistema anti-fraude (4 capas):**

| Capa | Mecanismo | Detección |
|------|-----------|-----------|
| 1. Captura en app | Solo cámara en tiempo real, sin galería | Fotos pre-grabadas |
| 2. Fedateo visual | Watermark + QR incrustado en imagen | Manipulación de foto |
| 3. Validación GPS multi-fuente | GPS + WiFi + Cell towers + detección mock locations | GPS spoofing |
| 4. Validación temporal | Timestamp servidor + detección "viaje imposible" | Manipulación de hora/ubicación |

**Datos de marcación:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador |
| usuario_id | UUID FK | FK → usuarios.id |
| tienda_id | UUID FK | FK → tiendas.id |
| tipo | ENUM | ENTRADA, SALIDA |
| fecha | DATE | Fecha |
| hora_servidor | TIMESTAMPTZ | Timestamp del servidor (fuente de verdad) |
| hora_dispositivo | TIMESTAMPTZ | Timestamp del dispositivo (referencia) |
| foto_url | TEXT | Selfie en Supabase Storage |
| gps_lat | DECIMAL | Latitud |
| gps_lng | DECIMAL | Longitud |
| gps_accuracy | DECIMAL | Precisión del GPS en metros |
| dentro_radio | BOOLEAN | Si está dentro del radio permitido de la tienda |
| mock_location_detectado | BOOLEAN | Si se detectó GPS falso |
| estado | ENUM | VALIDO, OBSERVADO, JUSTIFICADO, RECHAZADO |
| observaciones | TEXT | Notas |
| editado_por | UUID FK | FK → usuarios.id (si fue modificado) |
| created_at | TIMESTAMPTZ | Fecha creación |

### 6.2 Apertura y Cierre de Tienda

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador |
| tienda_id | UUID FK | FK → tiendas.id |
| tipo | ENUM | APERTURA, CIERRE |
| fecha | DATE | Fecha |
| hora | TIMESTAMPTZ | Hora real de apertura/cierre |
| foto_url | TEXT | Foto de la tienda con geolocalización |
| gps_lat | DECIMAL | Latitud |
| gps_lng | DECIMAL | Longitud |
| cantidad_hc | INTEGER | Cantidad de personal presente |
| usuarios_presentes | UUID[] | Array de usuarios presentes |
| registrado_por | UUID FK | FK → usuarios.id |
| created_at | TIMESTAMPTZ | Fecha creación |

**Quién registra:** Normalmente COORDINADOR, ASESOR_REFERENTE o SUPERVISOR.

### 6.3 Procesamiento de Asistencia

- Cálculo automático de tardanzas según horario asignado del turno
- Detección de marcaciones incompletas (entrada sin salida)
- Tolerancia de tardanza configurable por empresa (ej. 5 minutos)
- Justificación posterior por RRHH o Supervisor

---

## 7. GESTIÓN DE HORARIOS Y TURNOS

### 7.1 Horarios Base por Tienda

| Campo | Tipo | Descripción |
|-------|------|-------------|
| tienda_id | UUID FK | FK → tiendas.id |
| dia_semana | INTEGER | 0=Lunes ... 6=Domingo |
| hora_apertura | TIME | Hora de apertura |
| hora_cierre | TIME | Hora de cierre |
| activo | BOOLEAN | Si la tienda opera ese día |

### 7.2 Turnos Definidos

| Turno | Código | Descripción |
|-------|--------|-------------|
| Apertura | APERTURA | Desde apertura hasta hora media |
| Cierre | CIERRE | Desde hora media hasta cierre |
| Completo | COMPLETO | Jornada completa |
| Partido | PARTIDO | Con corte intermedio |

### 7.3 Asignación de Turnos

- Programación semanal o mensual por tienda
- Asignación de días de descanso (rotativos en retail)
- **Quién asigna:** COORDINADOR/SUPERVISOR con visto bueno de JEFE_VENTAS
- Días especiales: feriados (calendario peruano), permisos aprobados, licencias, suspensiones

---

## 8. INCIDENCIAS LABORALES

### 8.1 Tipos de Incidencia

| Tipo | Código | Generación |
|------|--------|------------|
| Tardanza | TARDANZA | Automática (desde asistencia) |
| Falta injustificada | FALTA_INJUSTIFICADA | Automática (sin marcación ni permiso) |
| Falta justificada | FALTA_JUSTIFICADA | Manual (RRHH reclasifica falta) |
| Abandono de puesto | ABANDONO_PUESTO | Manual (Supervisor/JV) |
| Amonestación verbal | AMONESTACION_VERBAL | Manual (Supervisor/RRHH) |
| Amonestación escrita | AMONESTACION_ESCRITA | Manual (RRHH) |
| Suspensión | SUSPENSION | Manual (RRHH) |
| Salida anticipada | SALIDA_ANTICIPADA | Automática/Manual |

### 8.2 Flujo de Incidencia

```
REGISTRO (automático o manual) → NOTIFICACIÓN AL COLABORADOR → DESCARGO (opcional)
                                                                        ↓
                                                              RESOLUCIÓN POR RRHH
                                                                        ↓
                                                              ESCALAMIENTO (si reincidente)
```

### 8.3 Historial Disciplinario

- Acumulado por colaborador
- Conteo de tardanzas/faltas por mes
- **AI — Alertas automáticas:** "3ra tardanza de Carlos López en el mes → notificación a RRHH"
- Vinculación con módulo de Penalidades de comisión (si aplica)

---

## 9. PERMISOS Y VACACIONES

### 9.1 Tipos de Solicitud

| Tipo | Código | Descripción |
|------|--------|-------------|
| Permiso por horas | PERMISO_HORAS | Ausencia parcial |
| Permiso día completo | PERMISO_DIA | Ausencia total |
| Vacaciones | VACACIONES | Periodo vacacional |
| Licencia médica | LICENCIA_MEDICA | Con certificado médico |
| Licencia maternidad/paternidad | LICENCIA_MATERNIDAD | Según ley peruana |
| Licencia por fallecimiento | LICENCIA_FALLECIMIENTO | Según ley peruana |

### 9.2 Flujo de Aprobación

```
COLABORADOR SOLICITA → JEFE DIRECTO APRUEBA/RECHAZA → RRHH REGISTRA
```

### 9.3 Integración con Asistencia

- Día con permiso aprobado NO genera falta ni tardanza
- Saldo de vacaciones visible para el colaborador
- Días de permiso consumidos por periodo

---

## 10. MOVIMIENTOS DE PERSONAL

### 10.1 Tipos de Movimiento

| Tipo | Código | Impacto en Sistema |
|------|--------|-------------------|
| Ingreso | INGRESO | Crea registro usuarios + usuarios_tiendas |
| Transferencia entre tiendas | TRANSFERENCIA | Actualiza usuarios_tiendas |
| Cambio de rol/cargo | CAMBIO_ROL | Actualiza usuarios.rol / usuarios_rrhh.cargo_formal |
| Cambio de zona | CAMBIO_ZONA | Actualiza usuarios.zona |
| Promoción | PROMOCION | Actualiza rol + cargo + posiblemente remuneración |
| Cese voluntario | CESE_VOLUNTARIO | Inicia offboarding |
| Cese por despido | CESE_DESPIDO | Inicia offboarding |
| Cese por no renovación | CESE_NO_RENOVACION | Inicia offboarding |
| Cese por abandono | CESE_ABANDONO | Inicia offboarding |
| Cese periodo prueba | CESE_PERIODO_PRUEBA | Inicia offboarding |

### 10.2 Registro de Movimiento

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador |
| usuario_id | UUID FK | FK → usuarios.id |
| tipo_movimiento | ENUM | Ver tipos arriba |
| fecha_efectiva | DATE | Cuándo se hace efectivo |
| motivo | TEXT | Motivo del movimiento |
| autorizado_por | UUID FK | FK → usuarios.id |
| datos_anteriores | JSONB | Snapshot de estado antes del cambio |
| datos_nuevos | JSONB | Estado después del cambio |
| created_at | TIMESTAMPTZ | Fecha creación |

**Clave:** Las transferencias actualizan automáticamente `usuarios_tiendas`. Los ceses actualizan `usuarios.activo` y `usuarios_rrhh.status`.

---

## 11. OFFBOARDING

### 11.1 Tipos de Salida y Checklist Adaptativo

**AI — Agente:** El checklist de offboarding se genera automáticamente según el tipo de salida.

**Renuncia formal:**
- [ ] Carta de renuncia recibida y registrada
- [ ] Carta de aceptación generada
- [ ] Liquidación de comisiones pendientes calculada
- [ ] Devolución de uniforme
- [ ] Devolución de equipo corporativo (si aplica)
- [ ] Solicitud de desactivación de usuario Entel
- [ ] Desactivación de usuario GridRetail
- [ ] Encuesta de salida completada
- [ ] Cierre de contrato vigente
- [ ] Documentación archivada

**No renovación de contrato:**
- [ ] Notificación anticipada al colaborador
- [ ] Liquidación calculada
- [ ] Devolución de bienes
- [ ] Desactivación de usuarios
- [ ] Documentación archivada

**Abandono:**
- [ ] Acta de constatación de ausencias
- [ ] Carta de requerimiento (día 1-2)
- [ ] Segunda comunicación (día 3)
- [ ] Carta notarial (día 5)
- [ ] Desactivación inmediata de accesos
- [ ] Informe de abandono
- [ ] Documentación legal archivada

### 11.2 Protocolo de Abandono Automatizado

**PROBLEMA QUE RESUELVE:** El supervisor o JV recibe la noticia de que un trabajador "no fue a trabajar" pero no escala rápidamente a RRHH. La detección y escalamiento deben ser automáticos.

**Día 1 — Detección automática:**
- Módulo de asistencia no registra marcación
- Sistema verifica si hay permiso o licencia aprobada
- Si no hay justificación → alerta automática al Supervisor y RRHH
- Supervisor recibe prompt en app: "Juan García no marcó asistencia hoy en TE Higuereta. ¿Tienes información?" con opciones: [Sí, está justificado] [No tengo contacto] [Ya renunció verbalmente]
- La respuesta queda documentada

**Día 2 — Escalamiento:**
- Si no hay respuesta del Supervisor o indicó "no tengo contacto" → alerta escala a JV
- AI sugiere a RRHH: "Considerar activar protocolo de abandono. Generar carta de requerimiento."

**Día 3+ — Acciones:**
- AI genera draft de carta notarial (plantilla pre-aprobada con datos del colaborador)
- Calcula impacto en la tienda y sugiere reasignaciones temporales
- Inicia checklist de offboarding preventivo

### 11.3 Encuesta de Salida Inteligente

**AI — Asistente activo:**
Para salidas voluntarias, cuestionario de salida donde AI analiza respuestas para identificar patrones.

Si 3 de los últimos 5 renunciantes mencionan "horarios" como motivo → alerta a Gerencia con análisis de tendencia.

### 11.4 Impacto Operativo

Cada baja dispara análisis automático:
- ¿La tienda queda con cobertura mínima?
- ¿Hay candidatos en el banco de talento que podrían cubrir?
- ¿Hay asesores en tiendas con exceso de HC que podrían transferirse?
- AI presenta opciones, RRHH decide.

---

## 12. PORTAL DE AUTOSERVICIO DEL COLABORADOR

Accesible desde la app móvil. Cada asesor ve solo su propia información.

| Sección | Funcionalidad |
|---------|---------------|
| Mi ficha | Ver datos personales, solicitar corrección (aprobada por RRHH) |
| Mis contratos | Ver historial, descargar firmados, aceptar/firmar pendientes |
| Mi asistencia | Historial de marcaciones, tardanzas, faltas, subir justificaciones |
| Mis solicitudes | Pedir permisos/vacaciones, ver estado (pendiente/aprobado/rechazado) |
| Referir candidato | Formulario rápido (nombre, teléfono, experiencia en telecom) |

### 12.1 Chatbot de Consultas RRHH

**AI — Asistente activo:**
Chatbot (Claude API) que responde preguntas frecuentes del colaborador accediendo a sus datos y a un knowledge base de políticas:
- "¿Cuántos días de vacaciones me quedan?"
- "¿Cuándo vence mi contrato?"
- "¿Cómo justifico una falta?"
- "¿Cuál es el horario de mi tienda mañana?"

Reduce carga de consultas repetitivas a RRHH.

---

## 13. DOCUMENTOS DEL COLABORADOR

Repositorio digital por persona en Supabase Storage.

| Tipo de Documento | Generado por |
|-------------------|-------------|
| CV original | Reclutamiento |
| Foto(s) del colaborador | Reclutamiento / RRHH |
| Contratos firmados (historial) | Gestión de Contratos |
| Amonestaciones y documentos disciplinarios | Incidencias |
| Certificados de capacitación | Inducción / Capacitador |
| Cartas notariales | Offboarding |
| Grabaciones/transcripciones de entrevistas | Reclutamiento |
| Evaluaciones de desempeño | Supervisores / AI |

**AI — Motor invisible — OCR e indexación:**
Documentos subidos como imagen o PDF escaneado son procesados con AI para extraer texto, haciéndolos buscables. Permite búsquedas tipo "¿quién tiene certificación en portabilidad?"

---

## 14. ALERTAS AUTOMATIZADAS Y DASHBOARD RRHH

### 14.1 Tipos de Alerta

| Alerta | Trigger | Destinatario |
|--------|---------|-------------|
| Contrato por vencer | X días antes de vencimiento | RRHH |
| Visado de renovación pendiente | Plazo acercándose | JV, KAM |
| Periodo de prueba por vencer | 7 días antes | RRHH, Supervisor |
| Candidato estancado en pipeline | > X días en misma etapa | RRHH |
| Ausencia sin justificación (día 1) | Sin marcación de asistencia | Supervisor, RRHH |
| Abandono potencial (día 2+) | Sin contacto con colaborador | JV, RRHH |
| Riesgo de fuga detectado | Índice AI alto | Supervisor, RRHH |
| Incidencia reincidente | 3ra tardanza/falta en el mes | RRHH |
| Tienda con cobertura baja | HC actual < HC mínimo | RRHH, JV |
| Cumpleaños de colaborador | Día del cumpleaños | Equipo de tienda |

**AI — Alertas contextuales (no solo notificaciones simples):**
No solo "tienes 3 contratos por vencer" sino:
> "Tienes 3 contratos por vencer y los JV aún no han completado su visado. Si no se completa para el viernes, no habrá tiempo de generar contratos antes del cierre de mes."

### 14.2 Dashboard RRHH

| Indicador | Fuente |
|-----------|--------|
| HC activo por tienda vs. HC necesario (semáforo) | usuarios_tiendas + usuarios_rrhh.status |
| Pipeline de reclutamiento (candidatos por etapa, cuellos de botella) | candidatos + candidatos_etapas |
| Contratos por vencer + estado de aprobación | contratos + renovacion_lotes |
| Alertas activas | alertas_rrhh |
| Tasa de puntualidad por tienda/zona | asistencia |
| Tasa de rotación mensual (comparativa histórica) | movimientos_personal |
| Costo de rotación estimado (AI) | Cálculo basado en tiempo reclutamiento + inducción + sombra + curva aprendizaje |

### 14.3 Métricas de Reclutamiento

| Métrica | Descripción |
|---------|-------------|
| Tiempo promedio de contratación | Desde captación hasta alta, por etapa |
| Tasa de conversión por etapa | % que avanza de cada etapa a la siguiente |
| Fuentes más efectivas | Referidos vs. portales, con dato de retención a 90 días |
| Tasa de rechazo por Entel | % de candidatos rechazados en etapa Consulta Entel |
| Retención a 30/60/90 días | Sobrevivencia de nuevos ingresos por cohorte |
| Costo estimado por contratación | Tiempo invertido en pipeline × costo hora RRHH |

---

## 15. ARQUITECTURA AI

### 15.1 Stack AI

| Componente | Tecnología | Uso |
|------------|------------|-----|
| LLM principal | Claude API (Anthropic) | Parsing CV, análisis entrevistas, resúmenes, scoring, chatbot, generación contratos, detección anomalías |
| Transcripción | Whisper API (OpenAI) | Audio/video de entrevistas → texto en español |
| Orquestación | Supabase Edge Functions | Reciben eventos, invocan APIs, almacenan resultados |
| Almacenamiento media | Supabase Storage | CVs, fotos, contratos, grabaciones de entrevistas |

### 15.2 Selección de Modelo Claude

| Tarea | Modelo | Justificación |
|-------|--------|---------------|
| Parsing de CV | Sonnet | Alta frecuencia, complejidad media |
| Análisis de entrevista | Sonnet / Opus | Complejidad alta, baja frecuencia |
| Resumen ejecutivo de renovación | Sonnet | Frecuencia mensual, datos estructurados |
| Scoring de candidatos | Sonnet | Alta frecuencia, datos estructurados |
| Chatbot del colaborador | Sonnet | Alta frecuencia, consultas simples |
| Detección de riesgo de fuga | Sonnet | Batch periódico, datos numéricos |
| Generación de contratos | Sonnet | Plantillas con variables |
| Detección de anomalías | Sonnet | Batch, reglas + análisis |

### 15.3 Patrón de Almacenamiento AI

Cada resultado de AI se registra en tabla `ai_tasks`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador |
| tipo | ENUM | CV_PARSING, ENTREVISTA_ANALISIS, CONTRATO_GENERACION, RENOVACION_RESUMEN, SCORING_CANDIDATO, RIESGO_FUGA, CHATBOT_QUERY |
| modulo | VARCHAR | Módulo que originó la tarea |
| entidad_id | UUID | ID de la entidad relacionada (candidato, usuario, contrato) |
| modelo | VARCHAR | Modelo usado (claude-sonnet-4-5, etc.) |
| prompt_version | VARCHAR | Versión del prompt usado |
| input_summary | TEXT | Resumen del input (no el input completo) |
| output | JSONB | Resultado completo |
| ai_confidence | DECIMAL | Nivel de confianza (si aplica) |
| tokens_input | INTEGER | Tokens consumidos (input) |
| tokens_output | INTEGER | Tokens consumidos (output) |
| latency_ms | INTEGER | Tiempo de respuesta |
| status | ENUM | PENDING, PROCESSING, COMPLETED, FAILED |
| error_message | TEXT | Mensaje de error si falló |
| created_at | TIMESTAMPTZ | Fecha creación |

Esto permite: auditar sugerencias del AI, mejorar prompts con el tiempo, monitorear costos y uso, medir calidad de las recomendaciones.

### 15.4 Procesamiento Asíncrono

Tareas AI pesadas (parsing CV, transcripción, análisis de entrevista) se ejecutan asíncronamente:
1. Usuario sube archivo → se crea registro en `ai_tasks` con status PENDING
2. Edge Function procesa en background
3. Usuario recibe notificación cuando el resultado está listo
4. Si falla, se registra error y se permite reintentar

---

## 16. PERMISOS POR ROL

### 16.1 Matriz de Acceso al Módulo RRHH

| Funcionalidad | ASESOR | COORD | SUPER | JV | KAM | GER_COM | GER_GEN | BO_RRHH | CAPACITADOR* | ADMIN |
|---|---|---|---|---|---|---|---|---|---|---|
| Ver su propia ficha | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Referir candidato | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gestionar pipeline reclutamiento | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Entrevistar candidatos (Nivel 1) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Entrevistar candidatos (Nivel 2+) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Visar renovación de contratos | ❌ | ❌ | ❌ | ✅ zona | ✅ todos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ejecutar renovación de contratos | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Gestionar fichas colaboradores | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Registrar incidencias | ❌ | ✅ tienda | ✅ zona | ✅ zona | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Reportar abandono | ❌ | ✅ tienda | ✅ zona | ✅ zona | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Ver asistencia equipo | propia | tienda | zona | zona | todos | todos | todos | todos | ❌ | todos |
| Asignar turnos | ❌ | ✅ tienda | ✅ zona | ✅ zona | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Solicitar permisos/vacaciones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aprobar permisos/vacaciones | ❌ | ❌ | ✅ zona | ✅ zona | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Gestionar inducción/sombra | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver dashboard RRHH | ❌ | ❌ | ❌ | ✅ zona | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Gestionar offboarding | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Portal autoservicio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chatbot consultas RRHH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*El Capacitador opera con rol BACKOFFICE_RRHH o con permisos específicos dentro del módulo.

### 16.2 Agrupación para RLS (consistente con GridRetail)

```sql
-- Grupo: Puede gestionar RRHH completo
rol IN ('BACKOFFICE_RRHH', 'ADMIN')

-- Grupo: Puede visar renovaciones
rol IN ('JEFE_VENTAS', 'ADMIN')
-- Nota: KAM no tiene rol propio actualmente. Se gestiona como GERENTE_COMERCIAL o rol a definir.

-- Grupo: Puede registrar incidencias
rol IN ('COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS', 'BACKOFFICE_RRHH', 'ADMIN')

-- Grupo: Puede ver dashboard RRHH
rol IN ('JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_RRHH', 'ADMIN')
```

---

## 17. ESTRUCTURA DE TABLAS (Resumen)

### Tablas Nuevas del Módulo RRHH

| Tabla | Descripción | FK principales |
|-------|-------------|----------------|
| `candidatos` | Registro central del pipeline de reclutamiento | referido_por → usuarios |
| `candidatos_etapas` | Historial de movimientos por el pipeline | candidato_id → candidatos |
| `candidatos_entrevistas` | Entrevistas multi-nivel con scorecards | candidato_id → candidatos, entrevistador_id → usuarios |
| `candidatos_documentos` | CV y adjuntos del candidato | candidato_id → candidatos |
| `usuarios_rrhh` | Extensión 1:1 de usuarios con datos laborales | id = usuarios.id, jefe_directo_id → usuarios |
| `usuarios_status_log` | Historial de cambios de estado | usuario_id → usuarios |
| `contratos` | Historial de contratos por colaborador | usuario_id → usuarios, tienda_asignada_id → tiendas |
| `renovacion_lotes` | Ciclos mensuales de renovación | — |
| `renovacion_decisiones` | Decisiones de renovación por colaborador | lote_id → renovacion_lotes, usuario_id → usuarios |
| `asistencia` | Marcaciones de entrada/salida | usuario_id → usuarios, tienda_id → tiendas |
| `apertura_cierre_tienda` | Registro de apertura/cierre | tienda_id → tiendas, registrado_por → usuarios |
| `horarios_tienda` | Horarios base por tienda y día | tienda_id → tiendas |
| `turnos` | Definición de tipos de turno | — |
| `asignacion_turnos` | Turnos asignados a colaboradores | usuario_id → usuarios, tienda_id → tiendas, turno_id → turnos |
| `incidencias_laborales` | Registro de faltas disciplinarias | usuario_id → usuarios |
| `solicitudes_permiso` | Solicitudes de permisos/vacaciones | usuario_id → usuarios, aprobado_por → usuarios |
| `movimientos_personal` | Historial de movimientos (transferencias, ceses, etc.) | usuario_id → usuarios |
| `offboarding_checklist` | Tareas de salida por colaborador | usuario_id → usuarios |
| `documentos_colaborador` | Repositorio de documentos por persona | usuario_id → usuarios |
| `alertas_rrhh` | Alertas automáticas del sistema | — |
| `ai_tasks` | Registro de todas las tareas AI ejecutadas | — |

### Tablas Existentes Referenciadas

| Tabla | Uso en módulo RRHH |
|-------|-------------------|
| `usuarios` | Base de todos los colaboradores. Se extiende con `usuarios_rrhh` |
| `tiendas` | Asignación de tiendas, ubicación para GPS |
| `usuarios_tiendas` | Actualizado por transferencias y altas |
| `ventas` | Datos de rendimiento para resúmenes de renovación y riesgo de fuga |
| `lineas_inar` | Datos confirmados de rendimiento |
| `asesor_incidencias` | Incidencias comerciales existentes (complementa las laborales) |

---

## 18. INTEGRACIÓN CON MÓDULOS EXISTENTES

| Módulo Existente | Dato que consume RRHH | Dato que produce RRHH |
|-----------------|----------------------|----------------------|
| **Gestión de Usuarios** | Lista de usuarios, roles, tiendas asignadas | Nuevos usuarios (alta), desactivación (cese), transferencias |
| **Ventas / INAR** | Rendimiento del colaborador (para renovación, riesgo de fuga) | — |
| **Comisiones** | Score de rendimiento, cuotas cumplidas | Fecha de ingreso (para prorrateo de cuotas) |
| **Penalidades** | Penalidades vigentes | Incidencias que pueden generar penalidades |
| **Arribos** | Registro de arribos (para riesgo de fuga) | Validación de que el asesor estaba en tienda (cruce con asistencia) |
| **Simulador HC** | — | Status actual del colaborador, antigüedad |

---

## 19. CONSIDERACIONES PARA MULTI-TENANT

Cuando GridRetail evolucione a SaaS multi-tenant, el módulo RRHH debe considerar:

- Cada tenant (SSNN) configura sus propias etapas del pipeline (puede agregar/quitar etapas)
- Plantillas de contrato por tenant
- Criterios de scorecard configurables por tenant
- Horarios y tolerancias configurables por tenant
- La etapa "Consulta a Entel" puede ser "Consulta al operador" genérica
- Los prompts de AI deben ser parametrizables por tenant

---

## 20. NOTAS DE IMPLEMENTACIÓN

### 20.1 Convenciones (consistentes con GridRetail)

- **Nomenclatura BD:** español, snake_case
- **Trigger updated_at:** Reutilizar `trigger_set_updated_at()` existente
- **RLS:** Usar grupos de roles definidos en GRIDRETAIL_ARCHITECTURE.md
- **FK:** Referencias a `usuarios(id)` y `tiendas(id)` existentes
- **12 roles existentes:** No crear nuevos roles. KAM y Capacitador operan con roles existentes + permisos granulares si es necesario
- **Patrón de migración:** Seguir template de GRIDRETAIL_ARCHITECTURE.md §9.3

### 20.2 Pendientes por Definir

- [ ] Definir si KAM requiere un rol propio o usa GERENTE_COMERCIAL con permiso especial
- [ ] Definir si Capacitador requiere un rol propio o usa BACKOFFICE_RRHH
- [ ] Definir coordenadas GPS de cada tienda para validación de radio de asistencia
- [ ] Definir proveedor de firma electrónica certificada (fase posterior)
- [ ] Definir política de retención de grabaciones de entrevistas
- [ ] Definir integración con sistema de nómina/planilla (externo a GridRetail)
- [ ] Validar plantillas de contrato con asesoría legal
- [ ] Definir calendario de feriados peruanos como datos maestros

---

## HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-13 | 1.0 | Documento inicial con especificación completa del módulo RRHH |

---

**IMPORTANTE:** Este documento debe mantenerse actualizado y adjuntarse a cada conversación de desarrollo relacionada con el módulo RRHH de GridRetail. Cada submódulo puede tener su propio CHANGELOG (ej: CHANGELOG_RECLUTAMIENTO.md, CHANGELOG_CONTRATOS.md, CHANGELOG_ASISTENCIA.md) para registrar cambios de implementación.
