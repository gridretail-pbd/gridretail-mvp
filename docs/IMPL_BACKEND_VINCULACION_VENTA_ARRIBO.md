# Implementación Backend: Vinculación de Venta a Arribo
## GridRetail — Fases 2 (API) y 3 (Validaciones) — Instrucciones para Claude Code

**Versión:** 1.0
**Fecha:** 2026-06-14
**Diseño:** `DISENO_VINCULACION_VENTA_ARRIBO.md` v1.1 (fuente de verdad)
**Plan general:** `PLAN_IMPLEMENTACION_VINCULACION_VENTA_ARRIBO.md`
**Estado BD:** migraciones `029` y `030` ya aplicadas (columna `arribos.resultado`, `ventas.arribo_id NOT NULL`, función + trigger `recompute_arribo_resultado`).

> El código TypeScript de abajo es **de referencia**: adaptar a los helpers, patrón de auth y estilo del repo existente (el módulo de arribos v1.3 ya tiene validación Zod server-side, lista blanca de columnas y fecha/hora autoritativa del servidor; **reusar esos patrones**).

---

## 0. Convenciones y helpers compartidos

### 0.1 Roles con "fecha libre"
Pueden registrar ventas de fecha anterior **sin** pasar por aprobación, y no requieren tienda asignada:
```ts
export const ROLES_FECHA_LIBRE = [
  'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
  'ADMIN', 'BACKOFFICE_OPERACIONES',
] as const;
```

### 0.2 Fecha autoritativa de Perú (ya existe en el repo, v1.3)
Reusar el helper que calcula la fecha local `America/Lima` en el servidor (`Intl.DateTimeFormat`). Referencia:
```ts
// lib/datetime/lima.ts (o el módulo equivalente existente)
export function hoyLima(): string {
  // → 'YYYY-MM-DD' en zona America/Lima
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
```

### 0.3 Usuario autenticado
Todas las rutas obtienen el usuario de sesión (patrón Supabase del repo) y su fila en `usuarios` (`id`, `rol`, `codigo_asesor`, `dni`, `nombre_completo`). Helper sugerido:
```ts
async function getUsuarioActual(supabase): Promise<{ id; rol; codigo_asesor; dni; nombre_completo }>
// 401 si no hay sesión.
```

### 0.4 Acceso a tienda
```ts
// true si el usuario puede operar sobre esa tienda
async function puedeAccederTienda(supabase, usuario, tiendaId): Promise<boolean> {
  if (ROLES_SIN_TIENDA.includes(usuario.rol)) return true; // admin/gerencias/backoffice
  const { data } = await supabase.from('usuarios_tiendas')
    .select('tienda_id').eq('usuario_id', usuario.id).eq('tienda_id', tiendaId).maybeSingle();
  return !!data;
}
// ROLES_SIN_TIENDA = ROLES_FECHA_LIBRE (mismos roles no requieren tienda)
```

### 0.5 Patrones de documento por tipo (espejo de los constraints de BD)
```ts
export const DOC_PATTERNS: Record<string, RegExp> = {
  DNI:       /^\d{8}$/,
  CE:        /^\d{9}$/,
  RUC:       /^(10|20)\d{9}$/,
  PASAPORTE: /^[A-Z0-9]{6,12}$/i,
  PTP:       /^[A-Z0-9]{6,15}$/i,
  // OTRO: cualquier string no vacío (solo válido en arribos, NO en ventas)
};
```

---

## 1. FASE 3 — Validaciones (Zod)

> Se documenta antes que la API porque los endpoints la consumen.

### 1.1 `lib/arribos/validations.ts` (modificar)

Ampliar tipos de documento y mantener el desenlace como **entrada declarativa** (`se_vendio` SÍ/NO); el `resultado` se deriva en el servidor, **no** se acepta del cliente.

```ts
import { z } from 'zod';

export const TIPOS_DOC_ARRIBO = ['DNI','CE','RUC','PASAPORTE','PTP','OTRO'] as const;
export const MOTIVOS_NO_VENTA = [
  'SIN_STOCK','PRECIO_ALTO','NO_CALIFICA','SOLO_CONSULTA',
  'DOCS_INCOMPLETOS','PROBLEMA_SISTEMA','OTRO',
] as const;

export const arriboInsertSchema = z.object({
  tienda_id: z.string().uuid(),
  tipo_documento_cliente: z.enum(TIPOS_DOC_ARRIBO).nullable().optional(),
  dni_cliente: z.string().trim().min(1).max(20).nullable().optional(),
  nombre_cliente: z.string().trim().max(200).nullable().optional(),
  es_cliente_entel: z.boolean().nullable().optional(),
  tipo_visita: z.enum(['VENTA','POSVENTA']),
  concreto_operacion: z.boolean(),
  // Declaración del asesor (solo aplica a VENTA). Se mapea a `resultado` en el servidor.
  se_vendio: z.boolean().nullable().optional(),
  motivo_no_venta: z.enum(MOTIVOS_NO_VENTA).nullable().optional(),
})
.superRefine((v, ctx) => {
  // Formato de documento por tipo (si hay documento)
  if (v.tipo_documento_cliente && v.dni_cliente) {
    const re = ({ DNI:/^\d{8}$/, CE:/^\d{9}$/, RUC:/^(10|20)\d{9}$/,
      PASAPORTE:/^[A-Z0-9]{6,12}$/i, PTP:/^[A-Z0-9]{6,15}$/i, OTRO:/^.+$/ } as any)[v.tipo_documento_cliente];
    if (re && !re.test(v.dni_cliente))
      ctx.addIssue({ code:'custom', path:['dni_cliente'], message:'Formato de documento inválido para el tipo' });
  }
  // motivo_no_venta solo válido si VENTA y se_vendio=false
  if (v.motivo_no_venta && !(v.tipo_visita === 'VENTA' && v.se_vendio === false))
    ctx.addIssue({ code:'custom', path:['motivo_no_venta'], message:'motivo_no_venta solo aplica a VENTA no concretada' });
  // POSVENTA no lleva se_vendio
  if (v.tipo_visita === 'POSVENTA' && v.se_vendio != null)
    ctx.addIssue({ code:'custom', path:['se_vendio'], message:'POSVENTA no admite se_vendio' });
});

export type ArriboInsert = z.infer<typeof arriboInsertSchema>;

// Mapeo declaración → resultado (única fuente del valor de `resultado`)
export function derivarResultado(tipo_visita: 'VENTA'|'POSVENTA', se_vendio: boolean|null|undefined): string|null {
  if (tipo_visita === 'POSVENTA') return null;
  if (se_vendio === true)  return 'VENTA_DECLARADA_PENDIENTE';
  if (se_vendio === false) return 'NO_VENDIO';
  return null; // VENTA sin declarar: queda sin resultado hasta que el asesor decida
}
```

### 1.2 Schema Zod del formulario de venta (modificar)

En el schema de la venta (el que usa `zodResolver` en el form y/o el server-side):
- **Agregar** `arribo_id: z.string().uuid()` (**requerido**).
- **Eliminar** los campos del flujo manual de fecha: `opcion_fecha`, y la `fecha` libre (la fecha sale del arribo).
- **Mantener** validación estricta de cliente con los **5 tipos** de venta (sin `OTRO`):
```ts
export const TIPOS_DOC_VENTA = ['DNI','CE','RUC','PASAPORTE','PTP'] as const;
// arribo_id requerido
arribo_id: z.string().uuid(),
tipo_documento_cliente: z.enum(TIPOS_DOC_VENTA),
numero_documento_cliente: z.string().trim(),
nombre_cliente: z.string().trim().min(3).max(100),
// motivo_rezago: requerido condicionalmente (lo exige el server si es rezagada sin fecha libre)
motivo_rezago: z.string().trim().min(1).optional().nullable(),
rango_horario: z.string().optional().nullable(), // requerido si rezagada
```
- Validación de `numero_documento_cliente` por `tipo_documento_cliente` con `DOC_PATTERNS` (sin `OTRO`).

> La obligatoriedad real de `motivo_rezago`/`rango_horario` se decide en el servidor según la fecha del arribo y el rol (ver §2.3), porque el cliente no es fuente de verdad de la fecha.

---

## 2. FASE 2 — Endpoints

### 2.1 `POST /api/arribos` (modificar) — `app/api/arribos/route.ts`

**Cambios respecto a v1.3:**
1. Validar el body con `arriboInsertSchema` (ya incluye los nuevos tipos de documento).
2. **Derivar `resultado`** con `derivarResultado(tipo_visita, se_vendio)`. **No** persistir `se_vendio` (la columna ya no existe).
3. Mantener fecha/hora autoritativas del servidor (`America/Lima`), lista blanca de columnas.
4. **Devolver el `id`** del arribo creado (necesario para el Camino A del frontend).

**Lista blanca de columnas a insertar:**
```
fecha (servidor), hora (servidor), tienda_id, usuario_id (=usuario actual),
registrado_por (=usuario actual), tipo_documento_cliente, dni_cliente,
nombre_cliente, es_cliente_entel, tipo_visita, concreto_operacion,
motivo_no_venta, resultado (derivado)
```

**Respuesta:**
```json
{ "success": true, "arribo": { "id": "uuid", "...": "..." } }
```

**Esqueleto:**
```ts
export async function POST(req: Request) {
  const supabase = createServerClient(/* ... */);
  const usuario = await getUsuarioActual(supabase); // 401 si no hay sesión

  const parsed = arriboInsertSchema.safeParse(await req.json());
  if (!parsed.success)
    return Response.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data;

  if (!(await puedeAccederTienda(supabase, usuario, v.tienda_id)))
    return Response.json({ error: 'Sin acceso a la tienda' }, { status: 403 });

  const resultado = derivarResultado(v.tipo_visita, v.se_vendio);

  const row = {
    fecha: hoyLima(),
    hora: horaLima(),                 // helper existente v1.3
    tienda_id: v.tienda_id,
    usuario_id: usuario.id,
    registrado_por: usuario.id,       // (ver nota inconsistencia VARCHAR en diseño; mantener patrón actual)
    tipo_documento_cliente: v.tipo_documento_cliente ?? null,
    dni_cliente: v.dni_cliente ?? null,
    nombre_cliente: v.nombre_cliente ?? null,
    es_cliente_entel: v.es_cliente_entel ?? null,
    tipo_visita: v.tipo_visita,
    concreto_operacion: v.concreto_operacion,
    motivo_no_venta: v.motivo_no_venta ?? null,
    resultado,
  };

  const { data, error } = await supabase.from('arribos').insert(row).select('*').single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true, arribo: data });
}
```

---

### 2.2 `GET /api/arribos/vendibles` (nuevo) — `app/api/arribos/vendibles/route.ts`

Lista los arribos para la tabla del formulario de venta (Camino B) y para badges/filtros.

**Query params:**
| Param | Tipo | Req | Default | Descripción |
|-------|------|-----|---------|-------------|
| `tienda_id` | uuid | Sí | - | Validar acceso del usuario |
| `fecha` | date | No | `hoyLima()` | Día a listar |
| `incluir_posventa` | bool | No | `false` | Por defecto excluye POSVENTA |
| `resultado` | string | No | - | Filtro por estado (opcional) |

**Lógica:**
1. Auth + `puedeAccederTienda`. El usuario ve **toda la tienda** (no solo sus arribos).
2. Traer arribos del día con el asesor que atendió (embed PostgREST por FK `arribos_usuario_id_fkey`).
3. Traer las ventas de esos arribos (solo `arribo_id, estado`) y agregar conteos en JS:
   - `ventas_activas` = estado ∈ {registrada, aprobada}
   - `ventas_anuladas` = estado ∈ {anulada, rechazada}
   - `ventas_pendientes` = estado = pendiente_aprobacion
4. Devolver el arreglo combinado.

**Esqueleto:**
```ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tienda_id = url.searchParams.get('tienda_id');
  const fecha = url.searchParams.get('fecha') ?? hoyLima();
  const incluirPosventa = url.searchParams.get('incluir_posventa') === 'true';
  const fResultado = url.searchParams.get('resultado');

  if (!tienda_id) return Response.json({ error: 'tienda_id requerido' }, { status: 400 });

  const supabase = createServerClient(/* ... */);
  const usuario = await getUsuarioActual(supabase);
  if (!(await puedeAccederTienda(supabase, usuario, tienda_id)))
    return Response.json({ error: 'Sin acceso a la tienda' }, { status: 403 });

  let q = supabase.from('arribos')
    .select('id, hora, tipo_visita, resultado, tipo_documento_cliente, dni_cliente, nombre_cliente, es_cliente_entel, usuario_id, usuarios:usuario_id(nombre_completo)')
    .eq('tienda_id', tienda_id)
    .eq('fecha', fecha)
    .order('hora', { ascending: true });
  if (!incluirPosventa) q = q.eq('tipo_visita', 'VENTA');
  if (fResultado) q = q.eq('resultado', fResultado);

  const { data: arribos, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const ids = (arribos ?? []).map(a => a.id);
  let conteos: Record<string, { activas: number; anuladas: number; pendientes: number }> = {};
  if (ids.length) {
    const { data: ventas } = await supabase.from('ventas').select('arribo_id, estado').in('arribo_id', ids);
    for (const v of ventas ?? []) {
      const c = (conteos[v.arribo_id] ??= { activas: 0, anuladas: 0, pendientes: 0 });
      if (['registrada','aprobada'].includes(v.estado)) c.activas++;
      else if (['anulada','rechazada'].includes(v.estado)) c.anuladas++;
      else if (v.estado === 'pendiente_aprobacion') c.pendientes++;
    }
  }

  const result = (arribos ?? []).map(a => ({
    ...a,
    asesor_nombre: (a as any).usuarios?.nombre_completo ?? null,
    ventas_activas: conteos[a.id]?.activas ?? 0,
    ventas_anuladas: conteos[a.id]?.anuladas ?? 0,
    ventas_pendientes: conteos[a.id]?.pendientes ?? 0,
  }));

  return Response.json({ fecha, tienda_id, arribos: result });
}
```

> **Alternativa (opcional, performance):** si el volumen por tienda/día creciera mucho, mover los conteos a una función SQL `get_arribos_vendibles(p_tienda_id, p_fecha, p_incluir_posventa)` (migración `031`). Para los volúmenes actuales (decenas/cientos por tienda) la agregación en JS es suficiente y evita otra migración.

---

### 2.3 `POST /api/ventas` (modificar) — `app/api/ventas/route.ts`

Reglas del diseño §6 y §7.4b. **Orden recomendado de operaciones:**

1. **Auth** → `usuario` actual.
2. **Validar body** con el schema de venta (incluye `arribo_id`).
3. **Cargar el arribo** (`select * from arribos where id = arribo_id`):
   - 404 si no existe.
   - 422 si `tipo_visita = 'POSVENTA'` (no se vende sobre posventa).
4. **Acceso a tienda:** `puedeAccederTienda(usuario, arribo.tienda_id)` → 403 si no.
5. **Heredar del arribo:** `tienda_id = arribo.tienda_id`, `fecha = arribo.fecha`.
6. **Vendedor = usuario actual** (7.4b): `usuario_id`, `codigo_asesor`, `dni_asesor`, `registrado_por` = usuario. **No** usar `arribo.usuario_id`.
7. **Rezago / estado** (§6):
   - `es_venta_rezagada = (arribo.fecha !== hoyLima())`.
   - Si rezagada y `rol ∉ ROLES_FECHA_LIBRE` → `estado = 'pendiente_aprobacion'`; **exigir** `motivo_rezago` (no vacío) y `rango_horario`. Si faltan → 400.
   - En otro caso → `estado = 'registrada'`.
8. **Validación estricta de cliente** (elevación, 7.1): `tipo_documento_cliente` ∈ 5 tipos; `numero_documento_cliente` cumple `DOC_PATTERNS[tipo]`; `nombre_cliente` ≥ 3. (Ya cubierto por el schema, revalidar server-side.)
9. **Insertar la venta** (lista blanca de columnas) con `arribo_id`, `estado_cruce='PENDIENTE'`, `monto_liquidado=0`. → el **trigger** actualiza `arribos.resultado` automáticamente (no setearlo a mano).
10. **Enriquecer el arribo** (best-effort) con los datos validados del cliente:
    ```ts
    await supabase.from('arribos').update({
      tipo_documento_cliente: v.tipo_documento_cliente,
      dni_cliente: v.numero_documento_cliente,
      nombre_cliente: v.nombre_cliente,
    }).eq('id', v.arribo_id);
    ```
11. **Responder** con la venta creada.

**Esqueleto (núcleo):**
```ts
export async function POST(req: Request) {
  const supabase = createServerClient(/* ... */);
  const usuario = await getUsuarioActual(supabase);

  const parsed = ventaInsertSchema.safeParse(await req.json());
  if (!parsed.success)
    return Response.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data;

  const { data: arribo, error: eA } = await supabase.from('arribos')
    .select('id, tienda_id, fecha, tipo_visita').eq('id', v.arribo_id).maybeSingle();
  if (eA) return Response.json({ error: eA.message }, { status: 400 });
  if (!arribo) return Response.json({ error: 'Arribo no encontrado' }, { status: 404 });
  if (arribo.tipo_visita !== 'VENTA')
    return Response.json({ error: 'No se puede registrar venta sobre un arribo de POSVENTA' }, { status: 422 });

  if (!(await puedeAccederTienda(supabase, usuario, arribo.tienda_id)))
    return Response.json({ error: 'Sin acceso a la tienda del arribo' }, { status: 403 });

  const esRezagada = arribo.fecha !== hoyLima();
  const tieneFechaLibre = ROLES_FECHA_LIBRE.includes(usuario.rol as any);
  let estado: 'registrada' | 'pendiente_aprobacion' = 'registrada';
  if (esRezagada && !tieneFechaLibre) {
    if (!v.motivo_rezago?.trim() || !v.rango_horario)
      return Response.json({ error: 'Venta de fecha anterior requiere motivo_rezago y rango_horario' }, { status: 400 });
    estado = 'pendiente_aprobacion';
  }

  const row = {
    arribo_id: arribo.id,
    tienda_id: arribo.tienda_id,
    fecha: arribo.fecha,
    usuario_id: usuario.id,
    codigo_asesor: usuario.codigo_asesor,
    dni_asesor: usuario.dni,
    registrado_por: usuario.id,
    es_venta_rezagada: esRezagada,
    motivo_rezago: esRezagada ? (v.motivo_rezago ?? null) : null,
    rango_horario: v.rango_horario ?? null,
    estado,
    estado_cruce: 'PENDIENTE',
    monto_liquidado: 0,
    // identificación y clasificación (lista blanca):
    orden_venta: v.orden_venta,
    telefono_linea: v.telefono_linea,
    tipo_documento_cliente: v.tipo_documento_cliente,
    numero_documento_cliente: v.numero_documento_cliente,
    nombre_cliente: v.nombre_cliente,
    tipo_venta: v.tipo_venta,
    categoria_venta: v.categoria_venta ?? null,
    operador_cedente: v.operador_cedente ?? null,
    imei_equipo: v.imei_equipo ?? null,
    modelo_equipo: v.modelo_equipo ?? null,
    iccid_chip: v.iccid_chip ?? null,
    incluye_seguro: v.incluye_seguro ?? false,
    incluye_accesorios: v.incluye_accesorios ?? false,
    descripcion_accesorios: v.descripcion_accesorios ?? null,
    notas: v.notas ?? null,
  };

  const { data: venta, error: eV } = await supabase.from('ventas').insert(row).select('*').single();
  if (eV) return Response.json({ error: eV.message }, { status: 400 }); // ver §3 (orden_venta única, etc.)

  // Enriquecer el arribo (best-effort; el resultado lo fija el trigger)
  await supabase.from('arribos').update({
    tipo_documento_cliente: v.tipo_documento_cliente,
    dni_cliente: v.numero_documento_cliente,
    nombre_cliente: v.nombre_cliente,
  }).eq('id', arribo.id);

  return Response.json({ success: true, venta });
}
```

> **Atomicidad:** el insert de venta y el enriquecimiento del arribo son **dos operaciones**. Si el `update` del arribo falla, la venta ya quedó registrada y enlazada (el `resultado` lo fijó el trigger); solo no se enriquecieron documento/nombre del arribo — inconsistencia menor y reintentable. Si se quiere atomicidad estricta, envolver ambos en una función SQL `registrar_venta(...)` (RPC) en una transacción; **no es bloqueante** para esta fase.

> **Eliminar** del handler toda la lógica antigua de `opcion_fecha` (HOY/AYER/OTRA): la fecha proviene del arribo.

---

## 3. Catálogo de errores (consistencia de respuestas)

| Situación | HTTP | `error` |
|-----------|------|---------|
| Sin sesión | 401 | `No autenticado` |
| Body inválido (Zod) | 400 | `Datos inválidos` (+ `detalles`) |
| Sin acceso a la tienda | 403 | `Sin acceso a la tienda` |
| Arribo inexistente (venta) | 404 | `Arribo no encontrado` |
| Arribo POSVENTA (venta) | 422 | `No se puede registrar venta sobre un arribo de POSVENTA` |
| Rezagada sin motivo/rango (rol sin fecha libre) | 400 | `Venta de fecha anterior requiere motivo_rezago y rango_horario` |
| `orden_venta` duplicada (constraint UNIQUE) | 409 | `La orden de venta ya existe` (mapear el error de Postgres) |
| Otro error de BD | 400/500 | mensaje del driver |

> Para `orden_venta` duplicada: detectar el código `23505` (unique_violation) del error de Supabase y devolver 409 con mensaje claro, en vez de un 400 genérico.

---

## 4. Checklist de la fase backend

- [ ] `lib/arribos/validations.ts`: nuevos tipos de documento, `derivarResultado`, refinamientos.
- [ ] Schema de venta: `arribo_id` requerido; eliminado `opcion_fecha`/`fecha` libre; doc estricto 5 tipos.
- [ ] `POST /api/arribos`: deriva `resultado`, no persiste `se_vendio`, devuelve `id`.
- [ ] `GET /api/arribos/vendibles`: nuevo, scope tienda completa, conteos de ventas.
- [ ] `POST /api/ventas`: `arribo_id` obligatorio; hereda fecha/tienda; vendedor=usuario; rezago derivado; enriquece arribo; no setea `resultado`.
- [ ] Errores mapeados según §3 (incluye 409 para orden duplicada).
- [ ] Probado manualmente: insertar venta sobre arribo de **otra** persona y confirmar que el trigger pone `VENDIDO_CONFIRMADO` (valida RLS + SECURITY DEFINER).

---

## 5. Notas para la Fase 4 (frontend) que dependen de estos contratos

- El form de arribos, en "se vendió = SÍ", hace `POST /api/arribos` y usa `arribo.id` de la respuesta para navegar a `/dashboard/ventas/nuevo?arribo_id=...`.
- El form de venta consume `GET /api/arribos/vendibles?tienda_id=...&fecha=...` para la tabla (Camino B) y, si llega `arribo_id` por query (Camino A), hace fetch puntual de ese arribo para el pre-llenado.
- Los conteos (`ventas_activas`, `ventas_anuladas`, `ventas_pendientes`) y `resultado` alimentan los badges/filtros de la tabla.
