# GridRetail — Login y Modo Tienda

## Especificación de Autenticación en Dispositivos Compartidos

**Versión:** 1.0
**Fecha:** 2026-06-24
**Alcance:** Autenticación, sesiones y atribución de ventas del personal comercial (HC)
**Dependencias:** Tablas `usuarios`, `usuarios_tiendas`, `usuarios_rrhh`, `tiendas`, `ventas`; middleware y `lib/auth-*`
**Prerrequisito:** Proveedor de WhatsApp/SMS para OTP (Twilio en MVP → Meta Cloud API)

---

## 1. PROBLEMA Y VISIÓN

Las tiendas TEX operan con **1-2 laptops compartidas** entre hasta **5 personas** (4 asesores + supervisor en hora pico). El login tradicional (usuario + password + selección de tienda) es lento y propenso a errores de atribución cuando varias personas rotan en el mismo equipo durante el día.

**Riesgo central:** que una venta se acredite al usuario equivocado. Todo el cálculo de comisiones depende de la correcta atribución del `usuario_id` vendedor.

**Visión:** GridRetail se "abre en una tienda" (el dispositivo queda enrolado a esa tienda) y permite que **solo los usuarios asignados a esa tienda** se autentiquen de forma **rápida y segura**, con la **identidad del usuario activo siempre visible** para evitar errores.

**Principio rector:** *dispositivo de larga duración atado a la tienda + sesión de usuario corta y rápida*, el patrón estándar de POS retail (Square, Toast, Clover) y de estaciones clínicas compartidas (Epic/Cerner + tap-and-go).

### 1.1 Decisiones tomadas (2026-06-24)

| Decisión | Elección |
|----------|----------|
| Factor principal de cambio de usuario | **PIN de 6 dígitos** |
| Hardware disponible en tienda | Lector huella/Windows Hello, webcam, smartphone+WhatsApp (todos) |
| Vínculo dispositivo↔tienda | **Enrolamiento por supervisor/admin** (persistente) |
| Política de re-bloqueo | **Auto-bloqueo por inactividad (2-3 min)** + botón manual |

---

## 2. MODELO DE DOS NIVELES

```
┌─ NIVEL 1: SESIÓN DE DISPOSITIVO (larga, atada a una tienda) ────────┐
│  • Enrolamiento único por supervisor/admin (password completo)       │
│  • Cookie httpOnly `device_token` (firmada) + fila en `dispositivos` │
│  • Mientras dure, GridRetail "vive" en esa tienda                    │
└──────────────────────────────────────────────────────────────────────┘
            ↓ pantalla de roster con los asignados a la tienda
┌─ NIVEL 2: SESIÓN DE USUARIO (corta, identifica a la persona) ────────┐
│  • Tap al avatar → PIN (6 díg.) → sesión de venta (cookie `session`)  │
│  • Banner permanente: FOTO + NOMBRE + ROL (color por rol)            │
│  • Auto-bloqueo por inactividad (config. 2-3 min) + botón "Cambiar"  │
│  • Re-entrar = solo PIN                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Roles de cada factor de autenticación

| Factor | Cuándo se usa | Frecuencia |
|--------|---------------|------------|
| **PIN 6 dígitos** | Login y cambio de usuario en el equipo enrolado | Constante |
| **WhatsApp OTP** | Enrolar/resetear PIN (alta, "olvidé mi PIN") y *step-up* en acciones sensibles | Esporádico |
| **Biometría (Windows Hello/huella)** | *Opcional* — desbloqueo acelerado alternativo al PIN (Fase 4) | Conveniencia |
| **Password completo** | Enrolamiento del dispositivo (supervisor) y login tradicional de backoffice | Raro |

> El PIN se **activa con OTP de WhatsApp** en su primer uso: un PIN robado no sirve hasta que el dueño lo enrole desde su propio celular.

---

## 3. COEXISTENCIA CON EL LOGIN TRADICIONAL

El login tradicional **no se elimina**. Se decide por el rol y por si el equipo está enrolado:

| Caso | Flujo |
|------|-------|
| Equipo **enrolado** + rol HC (`ASESOR`, `ASESOR_REFERENTE`, `COORDINADOR`, `SUPERVISOR`) | **Modo Tienda** (roster + PIN) |
| Equipo **enrolado** + rol backoffice/admin | Puede usar login tradicional desde el roster ("Otro usuario / acceso administrativo") |
| Equipo **NO enrolado** | Login tradicional + selección de tienda (flujo actual, intacto) |

Roles sin tienda (login tradicional siempre): `ADMIN`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL`, `BACKOFFICE_OPERACIONES`, `BACKOFFICE_RRHH`, `BACKOFFICE_AUDITORIA`, `VALIDADOR_ARRIBOS`.

---

## 4. ESQUEMA DE BASE DE DATOS

### 4.1 Tabla nueva: `dispositivos`

Equipos enrolados a una tienda.

```sql
CREATE TABLE IF NOT EXISTS dispositivos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tienda_id       UUID NOT NULL REFERENCES tiendas(id),
    nombre          VARCHAR(100) NOT NULL,          -- ej: "Laptop Caja 1 - El Agustino"
    token_hash      VARCHAR(255) NOT NULL,          -- hash del device_token (bcrypt/sha256)
    enrolado_por    UUID NOT NULL REFERENCES usuarios(id),
    activo          BOOLEAN NOT NULL DEFAULT true,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_tienda ON dispositivos(tienda_id) WHERE activo;

DROP TRIGGER IF EXISTS set_updated_at ON dispositivos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON dispositivos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE dispositivos DISABLE ROW LEVEL SECURITY;  -- auth propio, no Supabase Auth
```

### 4.2 ALTER: credenciales de acceso rápido

PIN y datos de contacto/avatar para el roster y el OTP. Se ubican en `usuarios_rrhh` cuando el dato es de RRHH; el PIN va en `usuarios` por ser credencial de acceso del sistema.

```sql
-- Credencial de acceso rápido (sistema)
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS pin_hash             VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pin_actualizado_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pin_intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pin_bloqueado_hasta   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS foto_url             TEXT;       -- avatar del roster

-- Teléfono móvil para OTP (si no existe ya en usuarios_rrhh)
ALTER TABLE usuarios_rrhh
    ADD COLUMN IF NOT EXISTS telefono_movil       VARCHAR(20);
```

> **Nota:** verificar si `usuarios_rrhh` ya tiene un campo de teléfono antes de agregar `telefono_movil`. Reusar el existente si lo hay.

### 4.3 Tabla nueva (opcional): `otp_codes`

Códigos OTP de un solo uso. Alternativa: reusar `system_config`/`ai_tasks` no aplica bien aquí; se recomienda tabla dedicada efímera.

```sql
CREATE TABLE IF NOT EXISTS otp_codes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL REFERENCES usuarios(id),
    code_hash    VARCHAR(255) NOT NULL,
    proposito    VARCHAR(30) NOT NULL,   -- 'ENROLAR_PIN' | 'RESET_PIN' | 'STEP_UP'
    canal        VARCHAR(10) NOT NULL DEFAULT 'WHATSAPP',  -- 'WHATSAPP' | 'SMS'
    vence_at     TIMESTAMPTZ NOT NULL,
    usado_at     TIMESTAMPTZ,
    intentos     SMALLINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT otp_codes_proposito_check
        CHECK (proposito IN ('ENROLAR_PIN', 'RESET_PIN', 'STEP_UP'))
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_usuario ON otp_codes(usuario_id, proposito) WHERE usado_at IS NULL;

ALTER TABLE otp_codes DISABLE ROW LEVEL SECURITY;
```

---

## 5. SESIONES Y COOKIES

| Cookie | Tipo | Contenido | Duración | Se setea en |
|--------|------|-----------|----------|-------------|
| `device_token` | httpOnly, secure | id de dispositivo + firma | Larga (90 días, renovable) | Enrolamiento |
| `session` | httpOnly, secure | `{ id, codigo_asesor, nombre_completo, rol, zona }` | Corta (turno; ~12 h) | Login por PIN o tradicional |
| `tienda_activa` | legible | `{ id, codigo, nombre, zona }` | Igual que `session` | **Derivada del dispositivo** en modo tienda |

**Cambios clave respecto a hoy:**
- En modo tienda, `tienda_activa` **ya no se elige a mano**: se deriva de `dispositivos.tienda_id`. Esto elimina la pantalla `/seleccionar-tienda` para HC en equipos enrolados.
- La sesión de usuario es **corta** y se renueva con el PIN; el dispositivo persiste.

---

## 6. FLUJOS

### 6.1 Enrolamiento del dispositivo (una vez)

```
1. Supervisor/admin abre /enrolar-dispositivo en la laptop nueva.
2. Ingresa su codigo_asesor + password (validación bcrypt) + elige tienda
   (entre las que tiene asignadas) + nombre del dispositivo.
3. POST /api/dispositivos/enrolar:
   - Verifica credenciales y que puedeAccederTienda(supervisor, tienda).
   - Genera device_token aleatorio, guarda token_hash en `dispositivos`.
   - Setea cookie httpOnly `device_token` (90 días).
4. El equipo queda "abierto en la tienda". Redirige a /modo-tienda.
```

### 6.2 Login diario del HC (equipo enrolado)

```
1. Middleware detecta device_token válido → ruta a /modo-tienda.
2. /modo-tienda lee dispositivos.tienda_id → carga roster
   (usuarios_tiendas JOIN usuarios) con foto_url + nombre + rol.
3. Asesor toca su avatar → teclado numérico → PIN (6 díg.).
4. POST /api/auth/pin-login { usuario_id, pin, device_token }:
   - Valida que el usuario pertenece a la tienda del dispositivo.
   - bcrypt.compare(pin, pin_hash); maneja intentos/bloqueo.
   - Setea cookie `session` corta + deriva `tienda_activa` del dispositivo.
5. Redirige al dashboard con el banner de identidad activo.
```

### 6.3 Cambio de usuario / auto-bloqueo

```
- Botón "Cambiar usuario" siempre visible en el banner → limpia `session`
  (NO el device_token) → vuelve al roster.
- Inactividad > umbral (config. 2-3 min) → bloqueo automático → roster.
- Re-entrar = solo PIN. El dispositivo sigue enrolado.
```

### 6.4 Enrolar / resetear PIN (con WhatsApp OTP)

```
1. Primer login del usuario sin pin_hash, o "Olvidé mi PIN".
2. POST /api/auth/pin/solicitar-otp { usuario_id } →
   genera OTP, lo envía por WhatsApp a usuarios_rrhh.telefono_movil.
3. Usuario ingresa OTP + nuevo PIN (x2).
4. POST /api/auth/pin/establecer { usuario_id, otp, pin } →
   valida OTP vigente/no usado, guarda pin_hash, limpia intentos.
```

### 6.5 Step-up para acciones sensibles

Anular venta, des-enrolar dispositivo, cambiar de tienda el dispositivo → exigen OTP WhatsApp además de la sesión activa.

---

## 7. ATRIBUCIÓN DE VENTAS E IDENTIDAD VISIBLE

- **Vendedor fijado a la sesión:** en el alta de venta, `ventas.usuario_id` = usuario de `session` (no editable libremente por HC). `ventas.registrado_por` = mismo usuario (o el supervisor si registra por otro, con permiso).
- **Banner de identidad permanente** (refuerzo en `components/layout/navbar.tsx`): foto + nombre + rol con color por rol; visible en todas las pantallas operativas.
- **Reloj de inactividad** visible cerca del banner.
- **Auditoría:** registrar en `logs_auditoria` cada login/cambio de usuario/bloqueo con `dispositivo_id`, `tienda_id`, `usuario_id`, timestamp.

---

## 8. SEGURIDAD

| Amenaza | Mitigación |
|---------|------------|
| PIN débil/adivinado | Dispositivo atado a tienda física + 6 díg. + bloqueo a 5 intentos → OTP para reabrir |
| PIN robado | No funciona hasta enrolarlo vía OTP del celular del dueño |
| Venta mal atribuida | Vendedor fijo a sesión + banner + auto-bloqueo + auditoría |
| Equipo robado/sacado de tienda | Des-enrolar remoto (admin) invalida `device_token`; `last_seen_at` para detectar |
| Sesión olvidada abierta | Auto-bloqueo por inactividad (2-3 min) |
| Acciones sensibles | Step-up OTP WhatsApp |

Parámetros configurables en `system_config`: umbral de inactividad, longitud de PIN, máx. intentos, duración de `device_token`/`session`, proveedor OTP.

---

## 9. CONTRATOS DE API (nuevos)

| Método | Ruta | Propósito |
|--------|------|-----------|
| `POST` | `/api/dispositivos/enrolar` | Enrolar equipo a una tienda (password supervisor) |
| `POST` | `/api/dispositivos/des-enrolar` | Invalidar enrolamiento (step-up) |
| `GET`  | `/api/dispositivos/roster` | Roster de la tienda del dispositivo (avatares) |
| `POST` | `/api/auth/pin-login` | Login por PIN sobre equipo enrolado |
| `POST` | `/api/auth/pin/solicitar-otp` | Enviar OTP WhatsApp para enrolar/resetear PIN |
| `POST` | `/api/auth/pin/establecer` | Fijar nuevo PIN con OTP |
| `POST` | `/api/auth/bloquear` | Cerrar sesión de usuario manteniendo el dispositivo |

Rutas existentes intactas: `/api/auth/login`, `/api/auth/logout`, `/api/usuarios/[id]/tiendas`.

---

## 10. PLAN DE IMPLEMENTACIÓN POR FASES

| Fase | Alcance | Entregables |
|------|---------|-------------|
| **0 — Backend auth** | Migración + endpoints | Tablas `dispositivos`/`otp_codes`, ALTER `usuarios`/`usuarios_rrhh`, endpoints enrolar/des-enrolar/pin-login, middleware device-aware |
| **1 — Modo tienda UI** | Pantallas | `/enrolar-dispositivo` (supervisor) + `/modo-tienda` (roster + teclado PIN) |
| **2 — Sesión corta + bloqueo** | UX seguridad | Banner de identidad, auto-bloqueo por inactividad, botón "Cambiar usuario", vendedor fijo en alta de venta |
| **3 — WhatsApp OTP** | Integración | Proveedor (Twilio MVP), enrolar/resetear PIN, step-up |
| **4 — Biometría (opcional)** | Conveniencia | WebAuthn/Windows Hello como desbloqueo alternativo |

---

## 11. PUNTOS ABIERTOS (defaults propuestos)

| Punto | Default propuesto |
|-------|-------------------|
| Proveedor OTP | **Twilio** en MVP → migrar a **Meta Cloud API** (más barato/oficial) |
| Longitud de PIN | **6 dígitos** |
| Bloqueo por intentos | **5 fallidos** → requiere OTP WhatsApp |
| Umbral de inactividad | **3 minutos** (configurable por tienda) |
| Duración `device_token` | **90 días** renovables en cada uso |

---

## 12. ARCHIVOS IMPACTADOS

**Nuevos:**
- `supabase/migrations/0XX_login_modo_tienda.sql`
- `app/(auth)/enrolar-dispositivo/page.tsx`
- `app/(auth)/modo-tienda/page.tsx`
- `app/api/dispositivos/enrolar/route.ts`, `.../des-enrolar/route.ts`, `.../roster/route.ts`
- `app/api/auth/pin-login/route.ts`, `app/api/auth/pin/solicitar-otp/route.ts`, `app/api/auth/pin/establecer/route.ts`, `app/api/auth/bloquear/route.ts`
- `lib/auth/device.ts` (helpers de device_token), `lib/auth/pin.ts`, `lib/otp/` (proveedor)
- `components/auth/RosterTienda.tsx`, `components/auth/PinPad.tsx`, `components/layout/ActiveUserBanner.tsx`

**Modificados:**
- `middleware.ts` — detección de `device_token` y ruteo a `/modo-tienda`
- `lib/auth-client.ts` / `lib/auth-server.ts` — helpers de sesión corta y dispositivo
- `components/layout/navbar.tsx` — banner de identidad reforzado
- `app/(dashboard)/dashboard/ventas/nuevo/page.tsx` — fijar vendedor a la sesión

---

**Estado:** Diseño aprobado (2026-06-24). **Fase 0 (backend) IMPLEMENTADA** — migración `032_login_modo_tienda.sql` (ejecutada en Supabase 2026-06-24), helpers `lib/auth/{device,pin,session,roles}.ts` + `lib/otp/`, 7 endpoints (`/api/dispositivos/{enrolar,des-enrolar,roster}`, `/api/auth/{pin-login,bloquear}`, `/api/auth/pin/{solicitar-otp,establecer}`) y middleware device-aware. OTP con sender STUB (consola) hasta Fase 3.

**Fase 1 (UI) IMPLEMENTADA (2026-06-24):** `app/(auth)/enrolar-dispositivo/page.tsx` (supervisor ata el equipo), `app/(auth)/modo-tienda/page.tsx` (roster → PIN → configurar/restablecer PIN con OTP), componentes `components/auth/PinPad.tsx` y `components/auth/RosterTienda.tsx`, cliente `lib/auth/modo-tienda-client.ts` (sincroniza localStorage), endpoint catálogo `GET /api/tiendas`. tsc: 0 errores nuevos.

**Fase 2 (seguridad/atribución) IMPLEMENTADA (2026-06-24):** flag `localStorage.modo_tienda` (set en pin-login; clear en `bloquearSesion`/`logout`). `lib/auth/use-inactivity-lock.ts` (auto-bloqueo 3 min → `bloquearSesion` → `/modo-tienda`). `components/layout/navbar.tsx` device-aware: banner de identidad prominente (avatar+nombre+rol con color), contador de inactividad, botón "Cambiar usuario"; en modo tienda se oculta el selector de tienda (la fija el dispositivo). Vendedor reforzado con badge "Vendedor: {nombre}" en `ventas/nuevo` (ya se atribuía a la sesión: `usuario_id: user.id`, el server lo deriva). tsc: 0 errores nuevos.

**Fases 0-2 COMPLETADAS.** Pendiente opcional: Fase 3 (WhatsApp OTP real, hoy STUB) y Fase 4 (biometría/Windows Hello).
