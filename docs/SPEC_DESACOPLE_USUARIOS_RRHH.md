# GridRetail — Desacople usuarios_rrhh / usuarios

## Especificación del refactor: persona (RRHH) vs cuenta (login)

**Versión:** 1.0
**Fecha:** 2026-06-24
**Migración:** `033_desacoplar_usuarios_rrhh.sql` (+ `033_rollback.sql`)
**Estado:** Implementado en rama `feature/desacople-usuarios-rrhh`. Migración pendiente de ejecutar a mano en Supabase.

---

## 1. Problema

Antes: `usuarios_rrhh.id` era PK **y** FK a `usuarios.id` con `ON DELETE CASCADE` (1:1 con PK compartida). Consecuencias:
- RRHH no podía mantener fichas de personal **sin** una cuenta de login.
- Borrar un usuario **borraba en cascada** su histórico de personal.

El negocio requiere: **personal solo-RRHH** (limpieza, seguridad) que tiene datos operativos (asistencia, turnos, contratos) pero **nunca** login; y **no perder histórico** (borrar solo sin dependencias).

## 2. Modelo nuevo

```
usuarios_rrhh (PERSONA, maestro)                 usuarios (CUENTA / login)
  id            UUID PK propia          ┌──0..1──  id  PK
  usuario_id    UUID NULL UNIQUE ───────┘          codigo_asesor, rol,
                FK→usuarios ON DELETE SET NULL      password_hash, pin_hash
  nombre_completo, dni, codigo_asesor  (identidad propia)
  status, fecha_ingreso, telefono_personal, ...
```

- `usuario_id` **NULL** = persona solo-RRHH. `UNIQUE` (SQL trata cada NULL como distinto → múltiples solo-RRHH permitidos; constraint, no índice parcial, para que el upsert `ON CONFLICT(usuario_id)` del importador funcione).
- **Identidad propia** (`nombre_completo/dni/codigo_asesor`) en la ficha: necesaria para que una persona sin cuenta tenga nombre, y para que los embeds resuelvan sin la cuenta. La cuenta es la fuente de verdad cuando existe; se sincroniza al conceder acceso. `dni` UNIQUE parcial.
- `usuarios_rrhh.id` **no se regenera**: conserva su valor (= viejo `usuarios.id`), lo que permite repuntar FKs sin reescribir datos.

## 3. Repunte de FKs

**A `usuarios_rrhh(id)` (`ON DELETE RESTRICT`)** — dominio persona (un solo-RRHH puede tener estas filas):
`contratos`, `movimientos_personal`, `usuarios_status_log` (antes CASCADE), `asistencia`, `asignacion_turnos`, `incidencias_laborales`, `solicitudes_permiso`, `offboarding_checklist`, `documentos_colaborador`, `renovacion_decisiones` — todas por su columna `usuario_id`.

**Se quedan en `usuarios(id)`** — cuenta / comercial / auditoría:
`ventas/arribos/lineas_inar/hc_quotas/commission_hc_assignments/hc_penalties/asesor_incidencias` y todas las `*_por`/`*_by`/`registrado_por`/`autorizado_por`/`aprobado_por`/`decision_jv_id`/`decision_kam_id`/`generado_por`/`enrolado_por`/`subido_por`/`entrevistador_id`; además `usuarios_rrhh.jefe_directo_id` y `candidatos.usuario_generado_id`.

**Convención de identificadores:** el **módulo RRHH opera con id de FICHA**; lo **comercial/app** con id de CUENTA. `asistencia` (marcada desde la sesión/cuenta) resuelve cuenta→ficha en su POST.

## 4. Migración (a mano en Supabase)

1. Ejecutar el SELECT informativo de fichas-a-crear (PASO 0, comentado).
2. Ejecutar la transacción `033` (snapshot/backup antes): añade `usuario_id` + identidad, backfill, suelta el FK viejo del PK, `id` con default `gen_random_uuid()`, FK `usuario_id` SET NULL, UNIQUE, backfill de fichas faltantes, y repunte de los 10 FKs.
3. Verificar orphans = 0 (bloque al pie de la migración).
4. Desplegar el código (esta rama) **inmediatamente después**.
5. Rollback disponible en `033_rollback.sql` (posible porque el id no se regeneró).

## 5. Cambios de código (esta rama)

- **Embeds de dominio** (`lib/rrhh/queries/{movimientos,asistencia,offboarding,horarios,permisos,incidencias,contratos}.ts`): `usuario:usuarios!<fk>` → `usuario:usuarios_rrhh!<fk>`. En `renovacion_decisiones` el `rol` se obtiene anidando la cuenta (`cuenta:usuarios!usuarios_rrhh_usuario_id_fkey(rol)`).
- **`lib/rrhh/queries/usuarios-rrhh.ts`**: embed de la cuenta por `usuario_id` (LEFT, ya no `!inner`); `search` sobre identidad de la ficha.
- **`lib/rrhh/interfaces.ts`**: `UsuarioRRHH` gana `usuario_id/nombre_completo/dni/codigo_asesor`; el `usuario` embebido de renovación pasa `rol` a `cuenta.rol`.
- **`lib/rrhh/schemas.ts`**: `usuarioRRHHCreateSchema` sin `id`, con `usuario_id?` + identidad.
- **Rutas**: `usuarios-rrhh/route.ts` (crea persona; valida cuenta solo si se enlaza), `[id]/route.ts` (PATCH permite identidad; `DELETE` ADMIN con guard), nuevo `[id]/conceder-acceso/route.ts` (crea cuenta + enlaza + tiendas), importador (`onConflict:'usuario_id'` + `fichaId` en contratos/movimientos/status_log), `auth/pin/solicitar-otp` (`eq('usuario_id')`), POST de movimientos/asistencia/contratos/offboarding/incidencias/permisos (verifican/usan id de ficha).
- **Guard**: `lib/rrhh/borrado.ts` — `dependenciasDeFicha` / `dependenciasDeCuenta`.
- **UI**: páginas de colaboradores muestran identidad de la ficha con fallback a la cuenta.

## 6. Onboarding nuevo

1. `candidatos` (pipeline) → sin cambios.
2. **ALTA** → crea la **ficha** (`usuarios_rrhh`) + contratos/movimientos. Sin cuenta.
3. **Conceder acceso** → `POST /api/rrhh/usuarios-rrhh/[id]/conceder-acceso` crea la cuenta, setea `usuario_id`, asigna tiendas; el PIN se configura por el flujo de Modo Tienda (OTP).
4. **Solo-RRHH** → se queda en el paso 2 (`usuario_id` NULL).

## 7. Verificación

`tsc --noEmit`: 0 errores nuevos (baseline 50 en comisiones). Pruebas end-to-end: orphans=0; crear persona solo-RRHH; asistencia/permiso para esa ficha; conceder-acceso + OTP + pin-login; importador; guard de borrado (409 con dependencias).

## 8. Follow-ups (fuera de alcance de 033)

- `candidatos.usuario_generado_id` y `usuarios_rrhh.jefe_directo_id` siguen en `usuarios` (un jefe/candidato solo-RRHH no es asignable hoy).
- `historial_bancario`/`historial_direcciones`/`historial_cambios_rrhh` (migr. 026) **no** se repuntaron; siguen en `usuarios(id)`. Evaluar repunte si el personal solo-RRHH los necesita.
- Actualizar `DATA_DICTIONARY.md` con el nuevo modelo de `usuarios_rrhh`.
- UI de "crear ficha" y "conceder acceso" (hoy la creación de fichas es solo por importador).
