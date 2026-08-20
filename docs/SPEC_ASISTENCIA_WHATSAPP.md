# GridRetail — Control de Asistencia vía Agente WhatsApp

**Versión:** 1.1
**Fecha:** 2026-08-17
**Módulo padre:** RRHH → Submódulo Control de Asistencia (SPEC_MODULO_RRHH.md §6)
**Estado:** Diseño aprobado, pendiente inicio Fase 0
**Dependencias:** `usuarios`, `usuarios_rrhh`, `usuarios_tiendas`, `tiendas`, `asistencia`, `turnos`, `asignacion_turnos`, `horarios_tienda`, `alertas_rrhh`, `ai_tasks`, `system_config`
**Migración propuesta:** `031_asistencia_whatsapp.sql`

---

## 1. CONTEXTO Y DECISIONES

### 1.1 Problema

El personal de PBD (~100 colaboradores, 21 TEX) marca asistencia hoy enviando un selfie fedateado (TimeMark o GPS Map Camera) al grupo de WhatsApp **"Asistencia Tiendas Express"**, con un caption libre ("Ingreso", "Ingreso refrigerio", "Retorno refrigerio", "Termino break", "Salida"). El control es 100% manual, no se cruza con horarios y no alimenta planilla. Con la salida de la jefa de RRHH, se necesita automatizar en producción con la mínima intervención humana y sin cambiar el hábito del personal.

### 1.2 Decisiones tomadas (2026-08-17)

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Canal de entrada | **Camino A**: bot como miembro del grupo vía **Evolution API** (Baileys) con **número dedicado** | Única forma de leer un grupo existente. Cloud API oficial no permite grupos. Cero fricción para el personal. |
| Apps de selfie aceptadas | **TimeMark** y **GPS Map Camera** | Son las dos que ya usa el personal (evidencia en el grupo). |
| Hosting | Vercel + Supabase existentes **+ Evolution API en Railway** (plantilla `self-host-evolution-api`: Evolution + Postgres + Redis, región US-East) | Evolution mantiene sesión WebSocket con WhatsApp; no corre en serverless. Plan Hobby, ~USD 5–10/mes. |
| Procesamiento | API route en Next.js (Vercel) recibe el webhook, procesa con Claude Vision e inserta en Supabase | Reusa stack y auth existentes. |
| Fuente de verdad de hora | `hora_servidor` = timestamp del mensaje WhatsApp (`messageTimestamp`) | Coherente con SPEC_MODULO_RRHH §6.1. La hora del watermark es referencia (`hora_dispositivo`). |
| Plan de contingencia | Diseño agnóstico del proveedor: la capa de mensajería es un adaptador. Si el número es bloqueado, se migra a chat 1:1 con Meta Cloud API sin tocar el procesador. | Riesgo de ToS con API no oficial. |

### 1.3 Riesgo del Camino A y mitigaciones

- Chip exclusivo, nunca usado para otra cosa; sesión Evolution estable (no re-escanear QR seguido).
- El bot **no publica en el grupo** en régimen normal: solo lee. Escribe DMs 1:1 y como máximo un resumen diario en el grupo (opcional, desactivado por defecto).
- Ritmo de DMs bajo (< 1 msg/seg, colas con jitter). Sin plantillas idénticas masivas.
- Número de respaldo pre-registrado; procedimiento de recuperación documentado.

---

## 2. ARQUITECTURA

```
┌──────────────────────┐   webhook (HTTPS)   ┌───────────────────────────────┐
│ Evolution API        │ ──────────────────► │ Vercel: /api/whatsapp/webhook │
│ (Docker persistente) │ ◄────────────────── │  · verifica firma/token       │
│ · sesión número bot  │   REST sendText /   │  · guarda marcacion_raw       │
│ · miembro del grupo  │   sendMedia (DMs)   │  · encola procesamiento       │
└──────────────────────┘                     └───────────────┬───────────────┘
                                                             │
                                                             ▼
                              ┌────────────────────────────────────────────────┐
                              │ Procesador de marcación (misma API route o     │
                              │ /api/asistencia/procesar, idempotente por      │
                              │ wa_message_id)                                 │
                              │ 1. Descarga media → Supabase Storage           │
                              │ 2. Claude Vision: extrae watermark + valida foto│
                              │ 3. Clasifica caption → tipo de marcación       │
                              │ 4. Resuelve identidad (usuarios_whatsapp)      │
                              │ 5. Valida turno, radio GPS, secuencia, tiempo  │
                              │ 6. INSERT/UPDATE asistencia (VALIDO/OBSERVADO) │
                              │ 7. Notifica (DM colaborador / supervisor)      │
                              └────────────────────────────────────────────────┘
                                                             │
                                                             ▼
                              ┌────────────────────────────────────────────────┐
                              │ Supabase: asistencia, marcaciones_raw,         │
                              │ usuarios_whatsapp, alertas_rrhh, ai_tasks      │
                              └────────────────────────────────────────────────┘
                                                             │
                     Vercel Cron ────────────────────────────┤
                     · alerta no apertura (por tienda)       │
                     · refrigerio sin retorno                ▼
                     · salida no marcada           ┌────────────────────┐
                     · cierre de día (faltas)      │ UI GridRetail      │
                                                   │ · Bandeja OBSERVADO│
                                                   │ · Vinculación WA   │
                                                   │ · Reporte mensual  │
                                                   └────────────────────┘
```

---

## 3. MODELO DE DATOS

### 3.1 ALTER `asistencia` (existente, DATA_DICTIONARY §13.11)

```sql
-- Nuevos tipos de marcación
ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_tipo_check;
ALTER TABLE asistencia ADD CONSTRAINT asistencia_tipo_check
  CHECK (tipo IN ('ENTRADA','SALIDA','REFRIGERIO_INICIO','REFRIGERIO_FIN'));

-- Origen y trazabilidad WhatsApp
ALTER TABLE asistencia
  ADD COLUMN IF NOT EXISTS origen            VARCHAR(20) NOT NULL DEFAULT 'APP',   -- APP | WHATSAPP_GRUPO | WHATSAPP_DM | MANUAL
  ADD COLUMN IF NOT EXISTS marcacion_raw_id  UUID REFERENCES marcaciones_raw(id),
  ADD COLUMN IF NOT EXISTS wa_message_id     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS wa_remitente_jid  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS caption_original  TEXT,
  ADD COLUMN IF NOT EXISTS app_detectada     VARCHAR(30),   -- TIMEMARK | GPS_MAP_CAMERA | NINGUNA | OTRA
  ADD COLUMN IF NOT EXISTS ai_extraccion     JSONB,         -- salida completa de Claude Vision
  ADD COLUMN IF NOT EXISTS ai_confianza      DECIMAL(4,3),  -- 0..1
  ADD COLUMN IF NOT EXISTS motivos_observacion TEXT[],      -- códigos de regla incumplida
  ADD COLUMN IF NOT EXISTS notificado_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reenvio_de_id     UUID REFERENCES asistencia(id);  -- si reemplaza una marcación observada

CREATE UNIQUE INDEX IF NOT EXISTS idx_asistencia_wa_message ON asistencia(wa_message_id) WHERE wa_message_id IS NOT NULL;
```

**Nota sobre el UNIQUE existente** `(usuario_id, tienda_id, fecha, tipo)`: se mantiene. Un reenvío corrige la fila existente (UPDATE, guardando la anterior en `marcaciones_raw`) en vez de insertar una segunda. Excepción: turnos partidos con dos refrigerios no aplican en TEX hoy; si aparecen, se relaja a UNIQUE parcial por `estado <> 'RECHAZADO'`.

**Estructura `ai_extraccion` (JSONB):**
```json
{
  "app": "GPS_MAP_CAMERA",
  "watermark_presente": true,
  "direccion_texto": "Av San Juan Mz.xi - Lt.21, San Juan De Miraflores, Provincia De Lima 15801, Perú",
  "distrito": "San Juan De Miraflores",
  "gps_lat": -12.156202,
  "gps_lng": -76.972591,
  "fecha_hora_watermark": "2026-08-17T14:30:00-05:00",
  "rostro_visible": true,
  "rostro_unico": true,
  "calidad_foto": "BUENA",
  "uniforme_visible": true,
  "confianza": 0.94,
  "observaciones_ai": []
}
```

### 3.2 Tabla nueva `marcaciones_raw` (bandeja de entrada cruda + auditoría)

Todo lo que llega del grupo se guarda **antes** de intentar procesarlo. Es la red de seguridad: nada se pierde aunque falle el AI o la identidad.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `wa_message_id` | VARCHAR(100) | NO | - | ID del mensaje WhatsApp (UNIQUE) |
| `wa_grupo_jid` | VARCHAR(100) | NO | - | JID del grupo origen |
| `wa_remitente_jid` | VARCHAR(100) | NO | - | JID/LID del remitente |
| `wa_remitente_telefono` | VARCHAR(20) | YES | - | Teléfono si el JID lo expone |
| `wa_push_name` | VARCHAR(100) | YES | - | Nombre de perfil (NO confiable) |
| `wa_timestamp` | TIMESTAMPTZ | NO | - | messageTimestamp (fuente de verdad de hora) |
| `tipo_mensaje` | VARCHAR(20) | NO | - | IMAGE, TEXT, VIDEO, OTRO |
| `caption` | TEXT | YES | - | Caption o texto |
| `media_url` | TEXT | YES | - | Ruta en Storage `asistencia/YYYY/MM/DD/<id>.jpg` |
| `media_hash` | VARCHAR(64) | YES | - | SHA-256 del binario (detección de foto repetida) |
| `payload` | JSONB | NO | - | Webhook completo |
| `estado_proceso` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, PROCESADO, NO_IDENTIFICADO, IGNORADO, ERROR |
| `error_detalle` | TEXT | YES | - | Stack/motivo si ERROR |
| `asistencia_id` | UUID | YES | - | FK → asistencia.id (cuando se convirtió en marcación) |
| `usuario_id_resuelto` | UUID | YES | - | FK → usuarios.id |
| `procesado_at` | TIMESTAMPTZ | YES | - | |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**Índices:** `wa_message_id` UNIQUE, `(estado_proceso, created_at)`, `(wa_remitente_jid, wa_timestamp)`, `media_hash`.
**RLS:** SELECT/UPDATE solo SUPERVISOR+, BACKOFFICE_RRHH, ADMIN. INSERT solo service role.

### 3.3 Tabla nueva `usuarios_whatsapp` (resolución de identidad)

Mapea identificadores técnicos de WhatsApp a `usuarios`. WhatsApp expone hoy JIDs con teléfono (`51947367258@s.whatsapp.net`) o LIDs opacos (`123456789@lid`) según la privacidad del contacto; ambos son estables por cuenta y se registran aquí.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `wa_jid` | VARCHAR(100) | YES | - | JID con teléfono (UNIQUE) |
| `wa_lid` | VARCHAR(100) | YES | - | LID (UNIQUE) |
| `telefono` | VARCHAR(20) | YES | - | E.164 sin '+' (ej. 51947367258) |
| `metodo_vinculacion` | VARCHAR(20) | NO | - | TELEFONO_RRHH, DNI_DM, MANUAL, IMPORTACION |
| `verificado` | BOOLEAN | NO | false | Confirmado por DNI o por RRHH |
| `verificado_por` | UUID | YES | - | FK → usuarios.id |
| `verificado_at` | TIMESTAMPTZ | YES | - | |
| `activo` | BOOLEAN | NO | true | |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | |

**Constraint:** CHECK (`wa_jid IS NOT NULL OR wa_lid IS NOT NULL`).
**RLS:** SELECT propio + BACKOFFICE_RRHH/ADMIN; ALL BACKOFFICE_RRHH/ADMIN.

### 3.4 Tabla nueva `wa_conversaciones_dm` (estado de diálogo 1:1 del bot)

Para el onboarding por DNI y los reenvíos: el bot necesita saber "qué le pregunté a este remitente".

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `wa_remitente_jid` | VARCHAR(100) UNIQUE | |
| `estado` | VARCHAR(30) | ESPERANDO_DNI, ESPERANDO_REENVIO, IDLE |
| `contexto` | JSONB | ej. `{ "asistencia_id": "...", "intentos": 1 }` |
| `ultimo_mensaje_bot_at` | TIMESTAMPTZ | |
| `ultimo_mensaje_usuario_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 3.5 Nuevos tipos en `alertas_rrhh.tipo` (DATA_DICTIONARY §13.21.1)

| Tipo | Nivel | Descripción |
|------|-------|-------------|
| `TIENDA_SIN_APERTURA` | CRITICAL | Pasada la tolerancia, ningún asignado marcó ENTRADA |
| `MARCACION_OBSERVADA` | WARNING | Marcación que no pasó validaciones y no fue corregida |
| `REFRIGERIO_SIN_RETORNO` | WARNING | REFRIGERIO_INICIO sin REFRIGERIO_FIN pasado el límite |
| `SALIDA_NO_MARCADA` | INFO | Día cerrado sin SALIDA |
| `REMITENTE_NO_IDENTIFICADO` | WARNING | Mensaje del grupo de un JID no vinculado |
| `WHATSAPP_DESCONECTADO` | CRITICAL | Evolution reporta sesión caída |

### 3.6 `system_config` — parámetros nuevos

| Clave | Default | Descripción |
|-------|---------|-------------|
| `asistencia.wa.grupo_jid` | `120363159136433081@g.us` | JID del grupo "Asistencia Tiendas Express" (no sensible) |
| `asistencia.wa.instance` | `pbd-asistencia` | Nombre de instancia Evolution |
| *(credenciales)* | env vars Vercel | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_WEBHOOK_SECRET` **no** van en `system_config` ni en el repo |
| `asistencia.apps_validas` | `["TIMEMARK","GPS_MAP_CAMERA"]` | |
| `asistencia.tolerancia_tardanza_min` | 5 | Fallback si el turno no define |
| `asistencia.tolerancia_watermark_min` | 10 | Máx. diferencia hora watermark vs hora mensaje |
| `asistencia.radio_default_m` | 150 | Si la tienda no tiene `radio_validacion_metros` |
| `asistencia.refrigerio_max_min` | 60 | Duración máxima refrigerio |
| `asistencia.alerta_apertura_delay_min` | 15 | Minutos después de apertura para alertar |
| `asistencia.dm_habilitado` | true | Kill switch de DMs |
| `asistencia.resumen_grupo_habilitado` | false | Publicar resumen diario en el grupo |

---

## 4. PIPELINE DE PROCESAMIENTO

### 4.1 Recepción (webhook)

1. Evolution envía evento `messages.upsert`. Se acepta solo si `remoteJid == grupo_jid` **o** es DM al bot.
2. Validar `webhook_secret`. Insertar en `marcaciones_raw` (idempotente por `wa_message_id`; duplicado → 200 OK y fin).
3. Si `tipo_mensaje != IMAGE` en el grupo → `IGNORADO` (texto suelto, stickers, audios). Excepción: texto que responde (quote) a una imagen propia → se guarda como caption tardío y re-procesa esa imagen.
4. Responder 200 rápido; procesar en la misma invocación pero después del ACK (o vía `after()` de Next 15 / QStash si se necesita más de 60 s).

### 4.2 Extracción AI (Claude Vision, modelo Sonnet)

Prompt único con salida JSON estricta (esquema de `ai_extraccion` §3.1). Instrucciones clave:
- Identificar la app por su firma visual: TimeMark (reloj grande + barra amarilla + logo "Timemark") o GPS Map Camera (tarjeta negra con mini-mapa Google + "GPS Map Camera").
- Transcribir literal: dirección, distrito, `Lat`, `Long`, fecha-hora, zona horaria.
- Rostro: presente, único, no cubierto, no es foto de pantalla ni de otra foto.
- Devolver `confianza` global y lista de `observaciones_ai` con códigos (ver §4.4).

Registrar cada llamada en `ai_tasks` (tipo `ASISTENCIA_EXTRACCION`, costo, latencia, task ref).

### 4.3 Clasificación del caption → `tipo`

Reglas + fallback AI. Sinónimos observados en el grupo:

| `tipo` | Patrones |
|--------|----------|
| ENTRADA | ingreso, entrada, llegada, apertura, "buenos días" + primera foto del día |
| REFRIGERIO_INICIO | ingreso refrigerio, salida refrigerio, inicio break, break, refri, almuerzo, "voy a refrigerio" |
| REFRIGERIO_FIN | retorno refrigerio, retorno break, termino break, regreso, "de vuelta", "en atención" |
| SALIDA | salida, cierre, "me retiro", "fin de turno" |

Desambiguación por contexto: si el caption está vacío o es ambiguo ("Rrtorno (en atencion)"), se infiere por **secuencia del día**: sin ENTRADA → ENTRADA; con ENTRADA sin refrigerio y hora 12:00–17:00 → REFRIGERIO_INICIO; con REFRIGERIO_INICIO abierto → REFRIGERIO_FIN; después de 18:00 con todo cerrado → SALIDA. Si la confianza < 0.7 → OBSERVADO con código `TIPO_AMBIGUO` y DM pidiendo confirmar con botones (1 Ingreso / 2 Inicio refrigerio / 3 Fin refrigerio / 4 Salida).

### 4.4 Resolución de identidad

Orden de intentos:
1. `usuarios_whatsapp` por `wa_jid` o `wa_lid` (verificado o no).
2. Si el JID expone teléfono → buscar `usuarios_rrhh.telefono_personal` / `telefono_movil` normalizado E.164 → crear vínculo `TELEFONO_RRHH` (no verificado) y continuar.
3. Si no → `marcaciones_raw.estado_proceso = NO_IDENTIFICADO`, alerta `REMITENTE_NO_IDENTIFICADO`, y **DM de onboarding**: "Hola, soy el asistente de asistencia de PBD. Para registrar tus marcaciones responde con tu número de DNI." Al recibir DNI válido que exista en `usuarios.dni` y no esté vinculado a otro JID → crear vínculo `DNI_DM` verificado y reprocesar la(s) marcación(es) pendientes de ese JID.
4. Colisiones (DNI ya vinculado a otro JID, o JID que envía DNI de otra persona) → no vincular, alerta a RRHH/ADMIN, cola manual en UI.

### 4.5 Reglas de validación (códigos en `motivos_observacion`)

| Código | Regla | Efecto |
|--------|-------|--------|
| `APP_NO_VALIDA` | `app_detectada` ∉ apps_validas o watermark ausente | OBSERVADO + DM reenvío |
| `SIN_ROSTRO` | rostro no visible / no único / foto de foto | OBSERVADO + DM reenvío |
| `WATERMARK_DESFASADO` | |hora watermark − wa_timestamp| > tolerancia | OBSERVADO (posible foto vieja) |
| `FUERA_DE_RADIO` | distancia(GPS foto, tienda del turno) > radio | OBSERVADO + copia supervisor |
| `SIN_GPS_LEGIBLE` | AI no pudo leer coordenadas pero sí app válida | VALIDO con nota, se intenta geocodificar la dirección; si tienda coincide por distrito → OK |
| `SIN_TURNO_ASIGNADO` | no hay fila en `asignacion_turnos` para hoy | OBSERVADO + alerta supervisor (se registra igual, con `tienda_id` = tienda principal en `usuarios_tiendas`) |
| `DIA_DESCANSO` | turno marca `es_dia_descanso` | OBSERVADO + alerta supervisor |
| `TIENDA_DISTINTA` | GPS coincide con **otra** tienda de la red | OBSERVADO; se registra en la tienda real y se alerta (posible apoyo no programado) |
| `TARDANZA` | ENTRADA > hora_inicio turno + tolerancia | VALIDO, `es_tardanza=true`, `minutos_tardanza` |
| `SECUENCIA_INVALIDA` | ej. REFRIGERIO_FIN sin INICIO, SALIDA sin ENTRADA, ENTRADA duplicada | OBSERVADO + DM aclaratorio |
| `REFRIGERIO_EXCEDIDO` | FIN − INICIO > refrigerio_max_min | VALIDO con flag; incidencia informativa |
| `FOTO_REPETIDA` | `media_hash` ya usado en otra marcación | RECHAZADO + alerta supervisor |
| `USUARIO_INACTIVO` | `usuarios.activo=false` o status CESADO | RECHAZADO + alerta RRHH |
| `TIPO_AMBIGUO` | ver §4.3 | OBSERVADO + DM con opciones |

Estado final: sin códigos bloqueantes → `VALIDO`; con códigos que requieren acción → `OBSERVADO`; fraude claro → `RECHAZADO`. Todo queda en `asistencia` con `origen='WHATSAPP_GRUPO'`.

### 4.6 Notificaciones (DM 1:1, nunca en el grupo)

Plantillas cortas, en tono neutro. Ejemplos:
- Reenvío: "Hola {nombre}. Tu marcación de {tipo} de las {hora} no pudo validarse: {motivo legible}. Por favor vuelve a enviar la foto al grupo usando TimeMark o GPS Map Camera, con tu rostro visible."
- Fuera de radio: "Tu foto de {tipo} figura en {direccion}, a {distancia} m de {tienda}. Si estás en apoyo en otra tienda responde APOYO {código tienda}; si fue error, reenvía la foto."
- Confirmación (solo si el usuario la pide con "estado" o "mi asistencia"): resumen del día.

Al supervisor de la tienda (`usuarios_tiendas` + rol SUPERVISOR/COORDINADOR) y al JEFE_VENTAS de zona: solo alertas CRITICAL/WARNING, agrupadas (máx. 1 DM cada 15 min por destinatario).

### 4.7 Reenvíos

Un reenvío del mismo `usuario_id`, `fecha`, `tipo` en estado OBSERVADO reemplaza la fila (UPDATE) y guarda `reenvio_de_id`. La foto anterior queda en Storage y en `marcaciones_raw`.

---

## 5. ALERTAS PROGRAMADAS (Vercel Cron)

| Cron | Frecuencia | Lógica |
|------|------------|--------|
| `/api/cron/asistencia/apertura` | cada 15 min 08:00–12:00 | Por tienda: si `now > hora_apertura + delay` y no hay ENTRADA VALIDO de ningún asignado del día → alerta `TIENDA_SIN_APERTURA` + DM supervisor/JV. Una sola vez por tienda/día. |
| `/api/cron/asistencia/refrigerio` | cada 15 min 12:00–18:00 | REFRIGERIO_INICIO sin FIN > `refrigerio_max_min` + 15 → alerta + DM al colaborador. |
| `/api/cron/asistencia/observadas` | cada hora | OBSERVADO sin reenvío > 60 min → alerta supervisor. |
| `/api/cron/asistencia/cierre_dia` | 23:30 | Genera `FALTA_INJUSTIFICADA` en `incidencias_laborales` para asignados sin ENTRADA y sin permiso aprobado; `SALIDA_NO_MARCADA` para ENTRADA sin SALIDA; recalcula resumen diario. |
| `/api/cron/asistencia/salud_wa` | cada 5 min | Consulta estado de instancia Evolution; si desconectada → alerta CRITICAL a ADMIN. |

Feriados: consultar `asignacion_turnos.es_feriado` y calendario en `system_config` (pendiente maestro de feriados, SPEC RRHH §20.2).

---

## 6. INTERFAZ EN GRIDRETAIL

### 6.1 Bandeja de asistencia (`/dashboard/rrhh/asistencia`)

- Vista día × tienda: semáforo por colaborador (ENTRADA / REF INI / REF FIN / SALIDA) con hora, tardanza y estado.
- Filtro OBSERVADO / NO_IDENTIFICADO; miniatura de la selfie con overlay del watermark leído; botones **Validar**, **Rechazar**, **Reasignar tipo**, **Vincular a usuario**.
- Cada acción manual actualiza `estado`, `editado_por`, `editado_motivo` (ya existen).

### 6.2 Vinculación WhatsApp (`/dashboard/rrhh/asistencia/whatsapp`)

- Lista de JIDs vistos en el grupo con push name, teléfono (si expuesto), última foto y estado de vínculo. Asignación manual a usuario con búsqueda por nombre/DNI.
- Estado de la instancia Evolution + botón "Reconectar" (muestra QR).

### 6.3 Reporte mensual para planilla (`/dashboard/rrhh/asistencia/resumen`)

Vista `vw_asistencia_resumen_mensual` (nueva): por `usuario_id` y periodo: días programados, días asistidos, tardanzas (n, minutos), faltas injustificadas/justificadas, permisos, refrigerios excedidos, horas efectivas aproximadas (SALIDA − ENTRADA − refrigerio). Exportable a XLSX. Es el insumo del cálculo de planilla (fase posterior).

---

## 7. ONBOARDING OPERATIVO (checklist de puesta en marcha)

1. Comprar chip dedicado; activar WhatsApp; **agregar el número al grupo** como miembro (no requiere admin).
2. Desplegar Evolution API (Docker) con Postgres/Redis propios o el bundle por defecto; conectar instancia por QR; configurar webhook → `https://<gridretail>/api/whatsapp/webhook`.
3. Cargar `tiendas.gps_lat/gps_lng` de las 21 TEX y validar `radio_validacion_metros` (100–150 m; ajustar en tiendas dentro de centros comerciales).
4. Importar el **cuadro de horarios por tienda/persona** a `asignacion_turnos` (wizard XLSX análogo al de `importaciones_rrhh`; mapear nombres a `usuarios` por DNI/código asesor).
5. Pre-vincular teléfonos desde `usuarios_rrhh` (`TELEFONO_RRHH`).
6. Modo sombra 2–3 días: el bot lee y registra, **sin enviar DMs** (`dm_habilitado=false`); RRHH/tú revisan la bandeja y ajustan reglas y prompt.
7. Activar DMs de onboarding por DNI para JIDs no resueltos; luego DMs de observación.
8. Activar crons de alertas y comunicar a supervisores.

---

## 8. PLAN DE IMPLEMENTACIÓN

| Fase | Duración | Entregables |
|------|----------|-------------|
| **0 — Infra y captura** | 2–3 días | Evolution en Docker; migración 031 (`marcaciones_raw`, `usuarios_whatsapp`, `wa_conversaciones_dm`, ALTER `asistencia`, tipos alerta, `system_config`); webhook que persiste todo + Storage. |
| **1 — Procesador** | 3–4 días | Extracción Claude Vision; clasificador de caption; resolución de identidad + onboarding DNI; motor de reglas §4.5; escritura en `asistencia`; DMs de observación (tras modo sombra). |
| **2 — Alertas y UI** | 2–3 días | Crons §5; bandeja OBSERVADO; pantalla vinculación WA; importador de turnos. |
| **3 — Reporte planilla** | 2 días | Vista mensual + export XLSX; incidencias automáticas de falta/tardanza. |
| **4 — Contingencia (opcional)** | — | Adaptador Meta Cloud API para marcación 1:1; app móvil GridRetail con captura nativa (SPEC RRHH §6.1) como reemplazo definitivo. |

Total estimado a producción con supervisión reducida: **~2 semanas**.

---

## 9. CONTRATOS DE API (nuevos)

| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/whatsapp/webhook` | Recepción Evolution (grupo y DMs) |
| POST | `/api/asistencia/procesar` | Reprocesar `marcaciones_raw` (por id o rango) — ADMIN/RRHH |
| GET | `/api/asistencia/dia?tienda_id&fecha` | Matriz del día para la bandeja |
| PATCH | `/api/asistencia/[id]` | Validar/rechazar/reasignar tipo (audita `editado_*`) |
| GET/POST | `/api/asistencia/whatsapp/vinculos` | Listar / vincular JID→usuario |
| GET | `/api/asistencia/whatsapp/estado` | Estado instancia Evolution, QR |
| POST | `/api/asistencia/turnos/importar` | Carga masiva `asignacion_turnos` desde XLSX |
| GET | `/api/asistencia/resumen?periodo` | Vista mensual para planilla |
| GET | `/api/cron/asistencia/*` | Ver §5 (protegidos por `CRON_SECRET`) |

---

## 10. SEGURIDAD Y PRIVACIDAD

- Fotos en bucket privado `asistencia/` con URLs firmadas de corta duración; retención configurable (sugerido 12 meses).
- El bot solo procesa mensajes del `grupo_jid` configurado y DMs; ignora cualquier otro chat.
- DMs nunca incluyen datos de terceros. Los DNIs recibidos por DM se comparan por hash y no se re-escriben en el chat.
- Webhook autenticado por token; service role solo en servidor.
- `logs_auditoria` para cada validación/rechazo manual.

---

## 10.1 CONFIGURACIÓN DESPLEGADA (2026-08-17)

| Ítem | Valor |
|------|-------|
| Hosting Evolution | Railway, proyecto con Evolution API + Postgres (volumen persistente) + Redis |
| Dominio Evolution | `https://evolution-api-production-5177.up.railway.app` |
| Instancia | `pbd-asistencia` (Baileys) |
| Número bot | Cuenta WhatsApp Business preexistente (sin uso comercial), vinculada por QR desde el teléfono del ADMIN |
| Grupo monitoreado | "Asistencia Tiendas Express" — JID `120363159136433081@g.us` — bot ya agregado |
| Webhook (a configurar en Fase 0) | `https://<gridretail>/api/whatsapp/webhook?token=<WHATSAPP_WEBHOOK_SECRET>`, eventos `MESSAGES_UPSERT` + `CONNECTION_UPDATE`, `webhook_base64=true` |

**Env vars Vercel (Fase 0):**
```
EVOLUTION_API_URL=https://evolution-api-production-5177.up.railway.app
EVOLUTION_API_KEY=<AUTHENTICATION_API_KEY de Railway>
EVOLUTION_INSTANCE=pbd-asistencia
WHATSAPP_GRUPO_JID=120363159136433081@g.us
WHATSAPP_WEBHOOK_SECRET=<openssl rand -hex 32>
```

## 11. PENDIENTES POR DEFINIR

- [ ] Recibir cuadro de horarios por tienda/persona (formato) para diseñar el importador.
- [ ] Coordenadas GPS de las 21 TEX (pendiente heredado de SPEC RRHH §20.2).
- [ ] ¿El refrigerio es obligatorio marcarlo en todos los turnos? ¿Duración pactada (45/60 min)?
- [ ] Política de tardanza para planilla (descuento por minuto vs. por bloque).
- [ ] Destinatarios exactos de alertas por tienda (¿supervisor + JV siempre, o solo supervisor?).
- [ ] Nombre visible y foto de perfil del número bot ("PBD Asistencia"); limpiar catálogo/respuestas automáticas heredadas del ecommerce.
- [x] Proveedor de hosting: Railway (desplegado 2026-08-17).
- [ ] Backup de la Postgres de Evolution (opcional; plantilla "Postgres Backup" a bucket R2/S3 más adelante).

---

## HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-08-17 | 1.0 | Spec inicial: arquitectura, modelo de datos, pipeline, alertas, UI, plan de fases. |
| 2026-08-17 | 1.1 | Railway desplegado; dominio, instancia y JID del grupo registrados (§10.1); credenciales movidas a env vars Vercel. |

**IMPORTANTE:** Adjuntar este documento a cada conversación de desarrollo del agente de asistencia. Al implementar la migración 031, actualizar DATA_DICTIONARY.md (§13.11, nueva §13.28+, §13.21.1) y GRIDRETAIL_QUICK_REFERENCE.md.
