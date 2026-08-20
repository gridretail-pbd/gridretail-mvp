# Fase 0 — Asistencia vía WhatsApp: puesta en marcha

Entregables de esta fase y cómo desplegarlos. Referencia: `SPEC_ASISTENCIA_WHATSAPP.md` v1.1 §7, §8, §10.1.

> **Nota de numeración:** el número `031` estaba libre — el repo saltó de la `030` a la
> `032`. Esta migración rellena ese hueco, por lo que **se aplica después de la 032
> (login/modo tienda) y de la 033 (desacople `usuarios_rrhh`), aunque su número sea
> menor**. La siguiente migración libre del proyecto es la **034**.
>
> Verificado contra el repo: la 032 no toca `asistencia` ni `alertas_rrhh` (crea
> `dispositivos`, `otp_codes` y columnas de PIN en `usuarios`), así que no hay conflicto
> con el `ALTER COLUMN tipo` ni con el CHECK recreado. La 033 **sí** afecta el modelo de
> identidad: ver la nota siguiente.

> **Nota de identidad (post-033):** la migración 033 convierte `usuarios_rrhh` en el
> maestro de personal y repunta `asistencia.usuario_id` a `usuarios_rrhh(id)` — la
> persona, no la cuenta. Por eso `usuarios_whatsapp.usuario_id` y
> `marcaciones_raw.usuario_id_resuelto` referencian `usuarios_rrhh(id)`: el personal
> solo-RRHH (limpieza, seguridad) no tiene fila en `usuarios` y es justamente quien
> marcaría por WhatsApp sin poder entrar a la app. Solo `verificado_por` apunta a
> `usuarios` (columna de auditoría).
>
> Consecuencia para Fase 1 (§4.4 del spec): el DNI y el teléfono se buscan en
> `usuarios_rrhh` (`dni`, `telefono_personal`), y la regla `USUARIO_INACTIVO` evalúa
> `usuarios_rrhh.status`, no `usuarios.activo`.

## Archivos

Rutas reales del repo (App Router en la raíz, sin `src/`; el alias `@/*` apunta a `./*`):

```
supabase/migrations/031_asistencia_whatsapp.sql
lib/whatsapp/config.ts
lib/whatsapp/evolution.ts
app/api/whatsapp/webhook/route.ts
app/api/whatsapp/registrar-webhook/route.ts
scripts/registrar-webhook-evolution.mjs
```

Verificado con `tsc --noEmit` contra el `tsconfig.json` del repo (strict, ES2017,
moduleResolution bundler) con Next 16.1.1 y React 19 instalados.

`lib/whatsapp/config.ts` crea un cliente Supabase con **service role**, a diferencia del
resto de rutas del proyecto que usan `createClient()` de `@/lib/supabase/server` (anon +
cookies SSR). Es deliberado: un webhook no tiene sesión ni cookies, y la subida a Storage
necesita permisos plenos. `SUPABASE_SERVICE_ROLE_KEY` ya está en `.env.example`.

## 1. Migración

Ejecutar en el SQL Editor de Supabase (es idempotente y va en una transacción):

```
supabase/migrations/031_asistencia_whatsapp.sql
```

Puntos a revisar antes de correrla:

- **`asistencia.tipo` pasa de VARCHAR(10) a VARCHAR(20).** Necesario para que quepan
  `REFRIGERIO_INICIO` / `REFRIGERIO_FIN`. Si la columna tiene vistas dependientes,
  Postgres avisará; recréalas después.
- **`alertas_rrhh.tipo`**: la migración detecta y elimina cualquier CHECK previo sobre
  esa columna y lo recrea con los 20 tipos (14 previos + 6 nuevos). Si tu BD tiene
  alertas con tipos fuera de esa lista, el ADD CONSTRAINT fallará: revísalas primero con
  `SELECT DISTINCT tipo FROM alertas_rrhh;`.
- **RLS**: se deshabilita en las tres tablas nuevas, coherente con
  `008_disable_rls_for_mvp` y con la 032 (GridRetail no usa Supabase Auth, así que
  `auth.uid()` es siempre NULL y cualquier política lo bloquearía todo). Las políticas
  equivalentes quedan escritas y comentadas al final del archivo por si algún día se
  migra a Supabase Auth.
- **Storage**: se crea el bucket privado `asistencia`. Si prefieres reusar
  `rrhh-asistencia`, omite ese bloque y ajusta
  `system_config['asistencia.wa.storage_bucket']` y la env var `WHATSAPP_STORAGE_BUCKET`.

Verificación rápida:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('marcaciones_raw','usuarios_whatsapp','wa_conversaciones_dm');

SELECT key, value FROM system_config WHERE category = 'asistencia' ORDER BY key;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'asistencia' AND column_name IN ('origen','tipo','motivos_observacion');
```

## 2. Variables de entorno

Ya cargadas en Vercel (§10.1). Añadir si faltan:

| Variable | Uso |
|----------|-----|
| `EVOLUTION_API_URL` | `https://evolution-api-production-5177.up.railway.app` |
| `EVOLUTION_API_KEY` | `AUTHENTICATION_API_KEY` de Railway |
| `EVOLUTION_INSTANCE` | `pbd-asistencia` |
| `WHATSAPP_GRUPO_JID` | `120363159136433081@g.us` |
| `WHATSAPP_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `WHATSAPP_STORAGE_BUCKET` | opcional; default `asistencia` |
| `NEXT_PUBLIC_APP_URL` | dominio público de GridRetail (para derivar la URL del webhook) |
| `CRON_SECRET` | protege `/api/whatsapp/registrar-webhook` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (ya existente) |

## 3. Registrar el webhook en Evolution

Desde tu máquina, con el repo y `.env.local`:

```bash
node scripts/registrar-webhook-evolution.mjs --check      # ver estado actual
node scripts/registrar-webhook-evolution.mjs              # registrar
```

O ya desplegado, desde la app:

```bash
curl -X POST https://<gridretail>/api/whatsapp/registrar-webhook \
  -H "x-cron-secret: $CRON_SECRET"

curl https://<gridretail>/api/whatsapp/registrar-webhook \
  -H "x-cron-secret: $CRON_SECRET"
```

Registra `MESSAGES_UPSERT` + `CONNECTION_UPDATE` con `webhook_base64 = true`, apuntando a
`https://<gridretail>/api/whatsapp/webhook?token=<WHATSAPP_WEBHOOK_SECRET>`.

## 4. Prueba de humo

1. Enviar una foto con caption "Ingreso" al grupo desde un teléfono del personal.
2. Verificar que llega:

```sql
SELECT wa_message_id, wa_push_name, tipo_mensaje, caption,
       media_url, media_hash, estado_proceso, wa_timestamp
FROM marcaciones_raw
ORDER BY created_at DESC
LIMIT 5;
```

3. Confirmar que `media_url` no es NULL y que el objeto existe en el bucket `asistencia`.
   Si `media_url` es NULL y `error_detalle` menciona base64, el webhook quedó registrado
   sin `webhook_base64=true`: volver a correr el paso 3.
4. Enviar un texto suelto al grupo → debe quedar con `estado_proceso = 'IGNORADO'`.
5. Enviar el mismo mensaje dos veces (o forzar un reintento de Evolution) → debe seguir
   existiendo una sola fila (`DUPLICADO` en la respuesta del webhook).

## 5. Comportamiento en Fase 0

- El webhook **solo persiste**. No llama a Claude Vision, no resuelve identidad, no
  escribe en `asistencia` y **no envía DMs** (`asistencia.dm_habilitado = false`).
- Siempre responde 200, incluso ante errores de procesamiento, para que Evolution no
  reintente y duplique trabajo. Los fallos quedan en logs y en
  `marcaciones_raw.error_detalle`.
- `connection.update` con estado `close` crea una alerta `WHATSAPP_DESCONECTADO`
  (CRITICAL, destinatario ADMIN), con antirrebote: una sola alerta pendiente a la vez.
- Los chats que no son el grupo configurado ni un DM se descartan sin persistir (§10).

## 6. Qué sigue (Fase 1)

- `/api/asistencia/procesar`: extracción con Claude Vision, clasificación del caption,
  resolución de identidad, motor de reglas §4.5 y escritura en `asistencia`.
- Registrar cada llamada al AI en `ai_tasks` (tipo `ASISTENCIA_EXTRACCION` — falta
  añadirlo al CHECK de `ai_tasks.tipo`, en la **034**). Reusar `lib/ai/task-runner.ts`
  y `lib/ai/config.ts`, que ya implementan el patrón.
- `lib/otp/index.ts` tiene `enviarOtp` como stub esperando proveedor real de WhatsApp
  (Fase 3 de `SPEC_LOGIN_MODO_TIENDA`). Cuando Evolution esté estable, `enviarDM()` de
  `lib/whatsapp/evolution.ts` puede ser ese proveedor y se ahorra la integración con
  Twilio / Meta Cloud API.
- Activar DMs tras 2–3 días de modo sombra: `UPDATE system_config SET value = 'true'
  WHERE key = 'asistencia.dm_habilitado';`

## Pendientes heredados del spec §11

- Coordenadas GPS de las 21 TEX (`tiendas.gps_lat/gps_lng`) y validación del radio.
- Importación del cuadro de horarios a `asignacion_turnos`.
- Pre-vinculación de teléfonos desde `usuarios_rrhh` (método `TELEFONO_RRHH`).
