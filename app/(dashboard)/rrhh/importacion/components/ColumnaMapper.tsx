'use client'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CAMPOS_DESTINO } from '@/lib/rrhh/types'
import type { MapeoColumna, ColumnaDetectada } from '@/lib/rrhh/interfaces'
import { cn } from '@/lib/utils'

interface ColumnaMapperProps {
  columna: ColumnaDetectada
  mapeo: MapeoColumna | null
  camposUsados: Set<string>
  onChange: (campoDestino: string | null) => void
}

const CONFIANZA_COLOR = (confianza: number): string => {
  if (confianza >= 90) return 'bg-green-100 text-green-800'
  if (confianza >= 60) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

const TIPO_ICON: Record<string, string> = {
  texto: 'T',
  numero: '#',
  fecha: 'D',
  booleano: '?',
  email: '@',
  telefono: 'P',
}

// Group campos by table for the select
const CAMPOS_POR_TABLA = CAMPOS_DESTINO.reduce((acc, campo) => {
  const tabla = campo.tabla
  if (!acc[tabla]) acc[tabla] = []
  acc[tabla].push(campo)
  return acc
}, {} as Record<string, typeof CAMPOS_DESTINO>)

const TABLA_LABELS: Record<string, string> = {
  usuarios: 'Usuarios',
  usuarios_rrhh: 'Datos RRHH',
  usuarios_tiendas: 'Tienda',
  contratos: 'Contrato',
  cesado: 'Cesado',
}

export function ColumnaMapper({ columna, mapeo, camposUsados, onChange }: ColumnaMapperProps) {
  const handleChange = (value: string) => {
    onChange(value === '__none__' ? null : value)
  }

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
      mapeo ? 'bg-white' : 'bg-gray-50 border-dashed',
    )}>
      {/* Source column info */}
      <div className="flex items-center gap-2 min-w-[200px] max-w-[250px]">
        <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-mono">
          {TIPO_ICON[columna.tipo_inferido] || 'T'}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{columna.nombre_original}</p>
          <p className="text-xs text-gray-400">
            {columna.porcentaje_lleno}% lleno · {columna.valores_unicos} únicos
          </p>
        </div>
      </div>

      {/* Arrow */}
      <span className="text-gray-400 flex-shrink-0">→</span>

      {/* Destination field select */}
      <div className="flex-1 min-w-[200px]">
        <Select
          value={mapeo?.campo_destino || '__none__'}
          onValueChange={handleChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sin mapear" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sin mapear —</SelectItem>
            {Object.entries(CAMPOS_POR_TABLA).map(([tabla, campos]) => (
              <div key={tabla}>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                  {TABLA_LABELS[tabla] || tabla}
                </div>
                {campos.map(campo => {
                  const usado = camposUsados.has(campo.campo) && mapeo?.campo_destino !== campo.campo
                  return (
                    <SelectItem
                      key={campo.campo}
                      value={campo.campo}
                      disabled={usado}
                    >
                      <span className={cn(usado && 'text-gray-400')}>
                        {campo.label}
                        {campo.requerido && ' *'}
                        {usado && ' (ya asignado)'}
                      </span>
                    </SelectItem>
                  )
                })}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Confidence badge */}
      {mapeo && (
        <Badge className={cn('text-xs flex-shrink-0', CONFIANZA_COLOR(mapeo.confianza))}>
          {mapeo.confianza}%
        </Badge>
      )}

      {/* Sample values */}
      <div className="hidden lg:flex items-center gap-1 text-xs text-gray-400 max-w-[200px] truncate">
        {columna.valores_muestra.slice(0, 2).map((v, i) => (
          <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">{v}</span>
        ))}
      </div>
    </div>
  )
}
