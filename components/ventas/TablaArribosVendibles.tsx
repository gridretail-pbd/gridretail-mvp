'use client'

import { useState } from 'react'
import { metaResultado, type Resultado } from '@/lib/arribos/resultado-badge'
import { useArribosVendibles, type ArriboVendible } from '@/hooks/useArribosVendibles'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

const FILTROS: {
  key: string
  label: string
  test?: (a: ArriboVendible) => boolean
}[] = [
  { key: 'TODOS', label: 'Todos' },
  {
    key: 'DISPONIBLES',
    label: 'Disponibles',
    test: (a) => a.resultado == null || a.resultado === 'NO_VENDIO',
  },
  { key: 'VENTA_DECLARADA_PENDIENTE', label: 'Declaradas pendientes' },
  { key: 'VENTA_PENDIENTE_APROBACION', label: 'Pendientes aprobación' },
  { key: 'VENDIDO_CONFIRMADO', label: 'Vendidos' },
  { key: 'VENTA_ANULADA', label: 'Ventas anuladas' },
]

function SkeletonTabla() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function TablaArribosVendibles({
  tiendaId,
  fecha,
  usuarioId,
  onSelect,
}: {
  tiendaId: string
  fecha: string
  usuarioId: string
  onSelect: (a: ArriboVendible) => void
}) {
  const { arribos, loading, error, refetch } = useArribosVendibles(
    tiendaId,
    fecha,
    usuarioId
  )
  const [filtro, setFiltro] = useState('TODOS')

  const filtroActivo = FILTROS.find((x) => x.key === filtro)
  const filtrados =
    filtro === 'TODOS'
      ? arribos
      : filtroActivo?.test
        ? arribos.filter(filtroActivo.test)
        : arribos.filter((a) => a.resultado === filtro)

  if (loading) return <SkeletonTabla />
  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <p className="text-red-600">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!arribos.length) {
    return (
      <p className="text-sm text-slate-500">
        No hay arribos para esta tienda y fecha.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              filtro === f.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-2">Hora</th>
              <th className="p-2">Cliente</th>
              <th className="p-2">Asesor</th>
              <th className="p-2">Estado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const m = metaResultado(a.resultado as Resultado)
              const cliente = a.nombre_cliente
                ? `${a.nombre_cliente}${a.dni_cliente ? ` · ${a.dni_cliente}` : ''}`
                : a.dni_cliente ?? 'Sin documento'
              const Icon = m.Icon
              return (
                <tr
                  key={a.id}
                  className={`border-t ${m.resaltarFila ? 'bg-green-50/60' : ''}`}
                >
                  <td className="p-2 tabular-nums">{a.hora?.slice(0, 5)}</td>
                  <td className="p-2">{cliente}</td>
                  <td className="p-2 text-slate-600">{a.asesor_nombre ?? '—'}</td>
                  <td className="p-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${m.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {m.label}
                      {a.ventas_activas > 1 && (
                        <span className="ml-1 opacity-70">×{a.ventas_activas}</span>
                      )}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(a)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Seleccionar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
