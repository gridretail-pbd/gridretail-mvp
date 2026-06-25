'use client'

import { useState, useCallback } from 'react'
import type { ColumnaDetectada, MapeoColumna } from '@/lib/rrhh/interfaces'

interface MapeoResult {
  mapeos: MapeoColumna[]
  columnas_sin_mapeo: string[]
  campos_sin_dato: string[]
  confianza_promedio: number
  metodo: 'ai' | 'heuristica'
  ai_task_id: string | null
}

export function useMapeoAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ejecutarMapeo = useCallback(async (
    columnas: ColumnaDetectada[],
    importacionId?: string,
  ): Promise<MapeoResult | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/rrhh/importacion/mapear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnas,
          importacion_id: importacionId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al mapear columnas')
      }

      const data: MapeoResult = await res.json()
      return data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { ejecutarMapeo, loading, error }
}
