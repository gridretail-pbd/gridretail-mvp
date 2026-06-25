'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MovimientoPersonal } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de movimientos ─────────────────────────────────────────

interface FiltrosMovimientos {
  usuario_id?: string
  tipo_movimiento?: string
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}

interface UseMovimientosResult {
  data: MovimientoPersonal[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useMovimientos(filtros: FiltrosMovimientos): UseMovimientosResult {
  const [data, setData] = useState<MovimientoPersonal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.usuario_id) params.set('usuario_id', filtros.usuario_id)
      if (filtros.tipo_movimiento) params.set('tipo_movimiento', filtros.tipo_movimiento)
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
      if (filtros.search) params.set('search', filtros.search)

      const response = await fetch(`/api/rrhh/movimientos?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar movimientos')
      }

      setData(json.movimientos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.usuario_id, filtros.tipo_movimiento, filtros.fecha_desde, filtros.fecha_hasta, filtros.search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}
