'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, AlertTriangle, CheckCircle2, Bot, Wrench } from 'lucide-react'
import { CAMPOS_DESTINO } from '@/lib/rrhh/types'
import type { MapeoColumna, ColumnaDetectada } from '@/lib/rrhh/interfaces'
import { ColumnaMapper } from './ColumnaMapper'
import { cn } from '@/lib/utils'

interface StepMapeoProps {
  columnas: ColumnaDetectada[]
  mapeos: MapeoColumna[]
  columnasSinMapeo: string[]
  camposSinDato: string[]
  confianzaPromedio: number | null
  metodo: 'ai' | 'heuristica' | null
  onUpdateMapeo: (index: number, campoDestino: string | null) => void
  onPrev: () => void
  onNext: () => void
  loading: boolean
}

export function StepMapeo({
  columnas,
  mapeos,
  columnasSinMapeo,
  camposSinDato,
  confianzaPromedio,
  metodo,
  onUpdateMapeo,
  onPrev,
  onNext,
  loading,
}: StepMapeoProps) {
  // Build a map from columna_origen → MapeoColumna
  const mapeoMap = useMemo(() => {
    const m = new Map<string, { mapeo: MapeoColumna; index: number }>()
    mapeos.forEach((mapeo, index) => {
      m.set(mapeo.columna_origen, { mapeo, index })
    })
    return m
  }, [mapeos])

  // Set of already-used destination fields
  const camposUsados = useMemo(() => {
    return new Set(mapeos.map(m => m.campo_destino))
  }, [mapeos])

  // Required fields not mapped
  const camposRequeridosSinMapeo = useMemo(() => {
    return CAMPOS_DESTINO
      .filter(c => c.requerido && !camposUsados.has(c.campo))
      .map(c => c.label)
  }, [camposUsados])

  const totalMapeados = mapeos.length
  const totalColumnas = columnas.length
  const pctMapeado = totalColumnas > 0 ? Math.round((totalMapeados / totalColumnas) * 100) : 0

  const handleChange = (columnaOrigen: string, campoDestino: string | null) => {
    const existing = mapeoMap.get(columnaOrigen)
    if (existing) {
      if (campoDestino) {
        onUpdateMapeo(existing.index, campoDestino)
      } else {
        // Remove mapping: set to empty (handled by parent)
        onUpdateMapeo(existing.index, campoDestino)
      }
    } else if (campoDestino) {
      // Add new mapping
      onUpdateMapeo(-1, campoDestino)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Mapeo de Columnas</h2>
        <p className="text-sm text-gray-500">
          Revisa y ajusta la asignación de columnas del Excel a los campos de GridRetail.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalMapeados}</p>
            <p className="text-xs text-gray-500">Mapeados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{columnasSinMapeo.length}</p>
            <p className="text-xs text-gray-500">Sin mapear</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{camposSinDato.length}</p>
            <p className="text-xs text-gray-500">Campos vacíos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <p className="text-2xl font-bold">{confianzaPromedio ?? 0}%</p>
            </div>
            <p className="text-xs text-gray-500">Confianza</p>
            {metodo && (
              <Badge variant="outline" className={cn(
                'mt-1 text-[10px] gap-1',
                metodo === 'ai' ? 'border-purple-300 text-purple-700' : 'border-gray-300 text-gray-600',
              )}>
                {metodo === 'ai' ? <Bot className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                {metodo === 'ai' ? 'IA' : 'Heurística'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Required fields warning */}
      {camposRequeridosSinMapeo.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">Campos obligatorios sin mapear:</p>
            <p className="text-yellow-700">{camposRequeridosSinMapeo.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Mapped columns */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Columnas del Excel → Campos GridRetail</CardTitle>
            <Badge variant="secondary">{pctMapeado}% mapeado</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {columnas.map(col => {
            const entry = mapeoMap.get(col.nombre_original)
            return (
              <ColumnaMapper
                key={col.indice}
                columna={col}
                mapeo={entry?.mapeo || null}
                camposUsados={camposUsados}
                onChange={(campo) => handleChange(col.nombre_original, campo)}
              />
            )
          })}
        </CardContent>
      </Card>

      {/* Unmapped target fields */}
      {camposSinDato.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">Campos sin dato en el Excel ({camposSinDato.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {camposSinDato.map(campo => {
                const def = CAMPOS_DESTINO.find(c => c.campo === campo)
                return (
                  <Badge
                    key={campo}
                    variant="outline"
                    className={cn(
                      'text-xs',
                      def?.requerido ? 'border-red-300 text-red-600' : 'border-gray-200 text-gray-500',
                    )}
                  >
                    {def?.label || campo}
                    {def?.requerido && ' *'}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>Anterior</Button>
        <Button onClick={onNext} disabled={loading || camposRequeridosSinMapeo.length > 0}>
          {camposRequeridosSinMapeo.length > 0
            ? 'Mapea campos obligatorios'
            : loading
              ? 'Procesando...'
              : 'Confirmar Mapeo'
          }
        </Button>
      </div>
    </div>
  )
}
