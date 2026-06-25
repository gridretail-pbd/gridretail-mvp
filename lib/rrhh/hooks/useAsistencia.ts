'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Asistencia } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de asistencia ──────────────────────────────────────────

interface FiltrosAsistencia {
  usuario_id?: string
  tienda_id?: string
  fecha_desde?: string
  fecha_hasta?: string
  fecha?: string
  estado?: string
  tipo?: string
  search?: string
}

interface UseAsistenciaResult {
  data: Asistencia[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useAsistencia(filtros: FiltrosAsistencia): UseAsistenciaResult {
  const [data, setData] = useState<Asistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.usuario_id) params.set('usuario_id', filtros.usuario_id)
      if (filtros.tienda_id) params.set('tienda_id', filtros.tienda_id)
      if (filtros.fecha) params.set('fecha', filtros.fecha)
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.search) params.set('search', filtros.search)

      const response = await fetch(`/api/rrhh/asistencia?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar asistencia')
      }

      setData(json.asistencia || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [
    filtros.usuario_id, filtros.tienda_id, filtros.fecha,
    filtros.fecha_desde, filtros.fecha_hasta, filtros.estado,
    filtros.tipo, filtros.search,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}
