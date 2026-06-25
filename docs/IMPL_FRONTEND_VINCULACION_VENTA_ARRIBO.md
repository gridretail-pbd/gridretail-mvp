# Implementación Frontend: Vinculación de Venta a Arribo
## GridRetail — Fase 4 (UI: dos flujos, tabla, pre-llenado) — Instrucciones para Claude Code

**Versión:** 1.0
**Fecha:** 2026-06-14
**Diseño:** `DISENO_VINCULACION_VENTA_ARRIBO.md` v1.1 (fuente de verdad)
**Backend:** `IMPL_BACKEND_VINCULACION_VENTA_ARRIBO.md` (contratos que esta fase consume)
**Stack:** Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, react-hook-form + Zod, lucide-react, date-fns.

> Los `.tsx` de abajo son **de referencia**: integrarlos al estilo y a los formularios existentes. **No reescribir** los formularios completos (el de ventas tiene 40+ campos); solo se modifican el inicio/flujo, el selector de documento y se agregan componentes nuevos.

---

## 0. Alcance y archivos

| Acción | Archivo |
|--------|---------|
| **Dependencia BD/API** (nuevo, mínimo) | `app/api/arribos/[id]/route.ts` — GET arribo por id (ver §1) |
| Nuevo | `lib/arribos/resultado-badge.ts` — mapeo `resultado` → badge |
| Nuevo | `hooks/useArribosVendibles.ts` — fetch de la lista |
| Nuevo | `components/ventas/TablaArribosVendibles.tsx` — tabla con filtros/badges |
| Modificar | `app/(dashboard)/dashboard/arribos/nuevo/page.tsx` — Camino A + tipos doc |
| Modificar | `app/(dashboard)/dashboard/ventas/nuevo/page.tsx` — Camino B + pre-llenado + rezago |

---

## 1. Dependencia de backend: `GET /api/arribos/[id]`

El Camino A navega a `/ventas/nuevo?arribo_id=...` (nueva página, se pierde el estado), así que el form de venta necesita **releer el arribo por id**. Endpoint mínimo:

**`app/api/arribos/[id]/route.ts`**
```ts
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient(/* ... */);
  const usuario = await getUsuarioActual(supabase);

  const { data: arribo, error } = await supabase.from('arribos')
    .select('id, tienda_id, fecha, hora, tipo_visita, resultado, tipo_documento_cliente, dni_cliente, nombre_cliente, es_cliente_entel, usuario_id')
    .eq('id', params.id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!arribo) return Response.json({ error: 'Arribo no encontrado' }, { status: 404 });

  if (!(await puedeAccederTienda(supabase, usuario, arribo.tienda_id)))
    return Response.json({ error: 'Sin acceso a la tienda del arribo' }, { status: 403 });

  return Response.json({ arribo });
}
```

---

## 2. Utilidades y componentes nuevos

### 2.1 `lib/arribos/resultado-badge.ts`

shadcn `Badge` solo trae `default | secondary | destructive | outline`. Para ámbar/azul/verde usar clases Tailwind. Mapa central (única fuente del look de cada estado):

```ts
import { AlertTriangle, Clock, CheckCircle2, Ban, Circle } from 'lucide-react';

export type Resultado =
  | 'NO_VENDIO' | 'VENTA_DECLARADA_PENDIENTE' | 'VENTA_PENDIENTE_APROBACION'
  | 'VENDIDO_CONFIRMADO' | 'VENTA_ANULADA' | null;

export const RESULTADO_META: Record<string, {
  label: string; className: string; Icon: any; resaltarFila?: boolean;
}> = {
  _SIN:                        { label: 'Sin venta',            className: 'bg-slate-100 text-slate-600',  Icon: Circle },
  NO_VENDIO:                   { label: 'No vendió',            className: 'bg-slate-100 text-slate-600',  Icon: Circle },
  VENTA_DECLARADA_PENDIENTE:   { label: 'Declarada pendiente',  className: 'bg-amber-100 text-amber-800',  Icon: AlertTriangle },
  VENTA_PENDIENTE_APROBACION:  { label: 'Pendiente aprobación', className: 'bg-blue-100 text-blue-800',    Icon: Clock },
  VENDIDO_CONFIRMADO:          { label: 'Vendido',              className: 'bg-green-100 text-green-800',  Icon: CheckCircle2, resaltarFila: true },
  VENTA_ANULADA:               { label: 'Venta anulada',        className: 'bg-red-100 text-red-700',      Icon: Ban },
};

export function metaResultado(r: Resultado) {
  return RESULTADO_META[r ?? '_SIN'] ?? RESULTADO_META._SIN;
}
```

### 2.2 `hooks/useArribosVendibles.ts`

```ts
import { useEffect, useState, useCallback } from 'react';

export type ArriboVendible = {
  id: string; hora: string; tipo_visita: 'VENTA'|'POSVENTA';
  resultado: string | null; tipo_documento_cliente: string | null;
  dni_cliente: string | null; nombre_cliente: string | null;
  es_cliente_entel: boolean | null; usuario_id: string | null;
  asesor_nombre: string | null;
  ventas_activas: number; ventas_anuladas: number; ventas_pendientes: number;
};

export function useArribosVendibles(tiendaId?: string, fecha?: string) {
  const [arribos, setArribos] = useState<ArriboVendible[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tiendaId) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ tienda_id: tiendaId, ...(fecha ? { fecha } : {}) });
      const res = await fetch(`/api/arribos/vendibles?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar arribos');
      setArribos(json.arribos ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tiendaId, fecha]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { arribos, loading, error, refetch: fetchData };
}
```

### 2.3 `components/ventas/TablaArribosVendibles.tsx`

Tabla con filtros y badges. Todas las filas son **seleccionables** (1 arribo : N ventas); POSVENTA no aparece (el endpoint la excluye por defecto). Resalta `VENDIDO_CONFIRMADO`.

```tsx
'use client';
import { useMemo, useState } from 'react';
import { metaResultado } from '@/lib/arribos/resultado-badge';
import { useArribosVendibles, type ArriboVendible } from '@/hooks/useArribosVendibles';

const FILTROS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'DISPONIBLES', label: 'Disponibles', test: (a: ArriboVendible) => a.resultado == null || a.resultado === 'NO_VENDIO' },
  { key: 'VENTA_DECLARADA_PENDIENTE', label: 'Declaradas pendientes' },
  { key: 'VENTA_PENDIENTE_APROBACION', label: 'Pendientes aprobación' },
  { key: 'VENDIDO_CONFIRMADO', label: 'Vendidos' },
  { key: 'VENTA_ANULADA', label: 'Ventas anuladas' },
];

export function TablaArribosVendibles({
  tiendaId, fecha, onSelect,
}: { tiendaId: string; fecha: string; onSelect: (a: ArriboVendible) => void }) {
  const { arribos, loading, error } = useArribosVendibles(tiendaId, fecha);
  const [filtro, setFiltro] = useState('TODOS');

  const filtrados = useMemo(() => {
    if (filtro === 'TODOS') return arribos;
    const f = FILTROS.find(x => x.key === filtro);
    if (f?.test) return arribos.filter(f.test);
    return arribos.filter(a => a.resultado === filtro);
  }, [arribos, filtro]);

  if (loading) return <SkeletonTabla />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!arribos.length) return <p className="text-sm text-slate-500">No hay arribos para esta tienda y fecha.</p>;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`rounded-full px-3 py-1 text-xs ${filtro === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="p-2">Hora</th><th className="p-2">Cliente</th><th className="p-2">Asesor</th><th className="p-2">Estado</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {filtrados.map(a => {
              const m = metaResultado(a.resultado as any);
              const cliente = a.nombre_cliente
                ? `${a.nombre_cliente}${a.dni_cliente ? ` · ${a.dni_cliente}` : ''}`
                : (a.dni_cliente ?? 'Sin documento');
              return (
                <tr key={a.id} className={`border-t ${m.resaltarFila ? 'bg-green-50/60' : ''}`}>
                  <td className="p-2 tabular-nums">{a.hora?.slice(0,5)}</td>
                  <td className="p-2">{cliente}</td>
                  <td className="p-2 text-slate-600">{a.asesor_nombre ?? '—'}</td>
                  <td className="p-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${m.className}`}>
                      <m.Icon className="h-3 w-3" />{m.label}
                      {a.ventas_activas > 1 && <span className="ml-1 opacity-70">×{a.ventas_activas}</span>}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => onSelect(a)} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50">
                      Seleccionar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 3. Camino A — `app/(dashboard)/dashboard/arribos/nuevo/page.tsx`

### 3.1 Selector de documento (ampliar)
- Agregar opciones: `DNI, CE, RUC, PASAPORTE, PTP, OTRO`.
- **Autocompletado json.pe solo para `DNI` y `CE`** (consulta a `/api/consulta-documento`). Para `RUC/PASAPORTE/PTP/OTRO`: ingreso **manual**, sin llamada a la API.
  - Ajustar el efecto/handler que dispara la consulta para que solo corra cuando `tipo_documento_cliente ∈ {DNI, CE}`.

### 3.2 Prompt "¿Registrar la venta ahora?"
Cuando `tipo_visita = 'VENTA'` y "¿Se vendió?" = SÍ, al enviar el formulario, **interceptar** antes de la redirección normal:

```tsx
// estado
const [pendingArribo, setPendingArribo] = useState<any | null>(null); // payload validado
const router = useRouter();

async function onSubmit(values) {
  // ...validación normal...
  if (values.tipo_visita === 'VENTA' && values.se_vendio === true) {
    setPendingArribo(values);   // abre el diálogo, NO guarda aún
    return;
  }
  await guardarArribo(values, { irAVenta: false });
}

async function guardarArribo(values, { irAVenta }: { irAVenta: boolean }) {
  const res = await fetch('/api/arribos', { method:'POST', body: JSON.stringify(values) });
  const json = await res.json();
  if (!res.ok) { toast.error(json.error ?? 'Error al registrar arribo'); return; }
  if (irAVenta) router.push(`/dashboard/ventas/nuevo?arribo_id=${json.arribo.id}`);
  else { toast.success('Arribo registrado'); router.push('/dashboard/arribos'); /* o reset */ }
}
```

```tsx
<AlertDialog open={!!pendingArribo} onOpenChange={(o) => !o && setPendingArribo(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Registrar la venta ahora?</AlertDialogTitle>
      <AlertDialogDescription>
        El arribo se guardará y podrás completar la venta vinculada de inmediato.
        Si eliges “Solo el arribo”, quedará marcado como venta declarada pendiente.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => { guardarArribo(pendingArribo, { irAVenta:false }); setPendingArribo(null); }}>
        Solo el arribo
      </AlertDialogCancel>
      <AlertDialogAction onClick={() => { guardarArribo(pendingArribo, { irAVenta:true }); setPendingArribo(null); }}>
        Sí, registrar venta
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

> El backend deriva `resultado = VENTA_DECLARADA_PENDIENTE` para ambos caminos; al guardar la venta, el trigger lo eleva a `VENDIDO_CONFIRMADO`. El frontend **no** envía `resultado`.

---

## 4. Camino B + pre-llenado — `app/(dashboard)/dashboard/ventas/nuevo/page.tsx`

### 4.1 Lógica de arranque (al montar)

```tsx
const searchParams = useSearchParams();
const arriboIdQuery = searchParams.get('arribo_id');

const [arribo, setArribo] = useState<ArriboLink | null>(null);   // arribo vinculado
const [mostrandoTabla, setMostrandoTabla] = useState(!arriboIdQuery);

useEffect(() => {
  if (!arriboIdQuery) return;
  (async () => {
    const res = await fetch(`/api/arribos/${arriboIdQuery}`);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? 'No se pudo cargar el arribo'); setMostrandoTabla(true); return; }
    vincularArribo(json.arribo);
  })();
}, [arriboIdQuery]);
```

### 4.2 Vincular arribo y pre-llenar (editable)

```tsx
const TIPOS_DOC_VENTA = ['DNI','CE','RUC','PASAPORTE','PTP'];

function vincularArribo(a: ArriboLink) {
  setArribo(a);
  setMostrandoTabla(false);
  form.setValue('arribo_id', a.id);

  // Pre-llenado HACIA ADELANTE (editable). "Elevación" 7.1:
  // si el doc del arribo es OTRO o nulo, dejar vacío para que el usuario complete uno válido.
  const tipoValido = a.tipo_documento_cliente && TIPOS_DOC_VENTA.includes(a.tipo_documento_cliente);
  form.setValue('tipo_documento_cliente', tipoValido ? a.tipo_documento_cliente : '');
  form.setValue('numero_documento_cliente', tipoValido ? (a.dni_cliente ?? '') : '');
  form.setValue('nombre_cliente', a.nombre_cliente ?? '');
  // tienda: contexto del arribo (no editable libre)
  form.setValue('tienda_id', a.tienda_id);
}
```

### 4.3 Selección desde la tabla (Camino B)
Requiere una **tienda activa** (la del contexto del form). Para roles con una sola tienda, usarla; para roles sin tienda (gerencias/admin), exigir que seleccionen tienda antes de mostrar la tabla.

```tsx
{mostrandoTabla && (
  tiendaActiva
    ? <TablaArribosVendibles tiendaId={tiendaActiva} fecha={fechaTabla} onSelect={(a) => vincularArribo(a)} />
    : <p className="text-sm text-slate-500">Selecciona una tienda para ver sus arribos.</p>
)}
```
- `fechaTabla`: por defecto hoy; permitir un date-picker para ver días anteriores (7.3).

### 4.4 Banner del arribo vinculado
```tsx
{arribo && (
  <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 text-sm">
    <span>
      Venta vinculada al arribo de <b>{arribo.nombre_cliente ?? arribo.dni_cliente ?? 'cliente sin documento'}</b>
      {' · '}{arribo.hora?.slice(0,5)} · {arribo.fecha}
    </span>
    <button type="button" onClick={() => { setArribo(null); setMostrandoTabla(true); form.setValue('arribo_id',''); }}
      className="text-xs text-slate-500 underline">Cambiar arribo</button>
  </div>
)}
```

### 4.5 Eliminar el bloque de fecha manual
- **Quitar** el control `opcion_fecha` (HOY/AYER/OTRA) y el input de fecha libre.
- La fecha de la venta = `arribo.fecha` (mostrar como dato, no editable).

### 4.6 Venta rezagada (UX, 7.3)
Cuando `arribo.fecha !== hoyLima()`:
```tsx
const esRezagada = arribo && arribo.fecha !== hoyLimaClient(); // helper cliente equivalente
const requiereAutorizacion = esRezagada && !ROLES_FECHA_LIBRE.includes(rolUsuario);
```
- Mostrar aviso: *"Esta venta es de una fecha anterior (`{arribo.fecha}`). {requiereAutorizacion ? 'Quedará pendiente de aprobación.' : ''}"*.
- Si `requiereAutorizacion`: mostrar y **exigir** `motivo_rezago` (textarea) y `rango_horario` (select de rangos, el catálogo existente). El server los exige igualmente (defensa en profundidad); el frontend los muestra para evitar el 400.

### 4.7 Envío
- Incluir `arribo_id` en el `POST /api/ventas`.
- No enviar `fecha`, `opcion_fecha`, ni `usuario_id` del arribo (el server deriva todo).
- Tras éxito: toast y redirección a la lista/detalle de ventas.
- Manejar 409 (orden duplicada), 403, 404, 422 con mensajes claros (ver catálogo del backend §3).

---

## 5. Estados de carga, error y accesibilidad

- **Loading:** skeleton en la tabla; spinner en submit (deshabilitar el botón).
- **Vacío:** mensaje "No hay arribos para esta tienda y fecha" + acceso directo a “Registrar arribo”.
- **Error de fetch:** mensaje inline + botón "Reintentar" (usar `refetch` del hook).
- **Foco/teclado:** las filas seleccionables deben ser accesibles (botón “Seleccionar”, no solo click en la fila); el diálogo de Camino A usa el `AlertDialog` de shadcn (foco gestionado).
- **Mobile:** la tabla con scroll horizontal; el diálogo a pantalla completa si aplica (ya lo maneja shadcn).

---

## 6. Checklist QA frontend

- [ ] Arribos: el selector muestra los 6 tipos; json.pe solo consulta DNI/CE.
- [ ] Camino A: "se vendió = SÍ" abre el diálogo; "Sí, registrar venta" guarda el arribo y navega a `/ventas/nuevo?arribo_id=...` con el form pre-cargado.
- [ ] Camino A "Solo el arribo": guarda y el arribo queda `VENTA_DECLARADA_PENDIENTE` (verificable en la tabla).
- [ ] Camino B: la tabla lista los arribos de **toda la tienda**; filtros y badges correctos; `VENDIDO_CONFIRMADO` resaltado y aún seleccionable.
- [ ] Pre-llenado: arribo con DNI → campos cargados y editables; arribo con OTRO/sin doc → campos de documento vacíos exigiendo uno válido (elevación 7.1).
- [ ] Banner "venta vinculada" visible; "Cambiar arribo" reabre la tabla.
- [ ] Bloque `opcion_fecha` eliminado; la fecha viene del arribo.
- [ ] Arribo de día anterior: aviso de autorización; `motivo_rezago` + `rango_horario` exigidos para rol sin fecha libre.
- [ ] Venta enviada con `arribo_id`; éxito redirige; errores 409/403/404/422 muestran mensaje claro.
- [ ] No se puede llegar a registrar venta sin `arribo_id` (ni por Camino A ni B).

---

## 7. Notas finales

- **No reescribir** el resto del formulario de venta (verificación de orden INAR, tipos de venta, equipo/IMEI, seguro, etc.): se conservan tal cual; solo cambia el arranque (selección/pre-llenado), la fuente de la fecha y el envío de `arribo_id`.
- El `ROLES_FECHA_LIBRE` del cliente debe coincidir con el del backend; idealmente compartir la constante desde un módulo común (`lib/auth/roles.ts`).
- Mantener consistencia visual de los badges usando **solo** `lib/arribos/resultado-badge.ts` (no duplicar colores/labels en la tabla ni en el reporte).
