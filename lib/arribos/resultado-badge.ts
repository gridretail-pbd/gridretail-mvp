import { AlertTriangle, Clock, CheckCircle2, Ban, Circle, type LucideIcon } from 'lucide-react'

/**
 * Mapeo central `resultado` → look del badge. Única fuente del color/label/icono
 * de cada estado de arribo; reutilizar en tabla y reporte (no duplicar).
 *
 * shadcn `Badge` solo trae default|secondary|destructive|outline, por eso para
 * ámbar/azul/verde se usan clases Tailwind directamente.
 */

export type Resultado =
  | 'NO_VENDIO'
  | 'VENTA_DECLARADA_PENDIENTE'
  | 'VENTA_PENDIENTE_APROBACION'
  | 'VENDIDO_CONFIRMADO'
  | 'VENTA_ANULADA'
  | null

interface ResultadoMeta {
  label: string
  className: string
  Icon: LucideIcon
  resaltarFila?: boolean
}

export const RESULTADO_META: Record<string, ResultadoMeta> = {
  _SIN: { label: 'Sin venta', className: 'bg-slate-100 text-slate-600', Icon: Circle },
  NO_VENDIO: { label: 'No vendió', className: 'bg-slate-100 text-slate-600', Icon: Circle },
  VENTA_DECLARADA_PENDIENTE: {
    label: 'Declarada pendiente',
    className: 'bg-amber-100 text-amber-800',
    Icon: AlertTriangle,
  },
  VENTA_PENDIENTE_APROBACION: {
    label: 'Pendiente aprobación',
    className: 'bg-blue-100 text-blue-800',
    Icon: Clock,
  },
  VENDIDO_CONFIRMADO: {
    label: 'Vendido',
    className: 'bg-green-100 text-green-800',
    Icon: CheckCircle2,
    resaltarFila: true,
  },
  VENTA_ANULADA: {
    label: 'Venta anulada',
    className: 'bg-red-100 text-red-700',
    Icon: Ban,
  },
}

export function metaResultado(r: Resultado): ResultadoMeta {
  return RESULTADO_META[r ?? '_SIN'] ?? RESULTADO_META._SIN
}
