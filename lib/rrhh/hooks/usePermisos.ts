'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SolicitudPermiso } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de permisos ────────────────────────────────────────────

interface FiltrosPermisos {
  usuario_id?: string
  tipo?: string
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
}

interface UsePermisosResult {
  data: SolicitudPermiso[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function usePermisos(filtros: FiltrosPermisos): UsePermisosResult {
  const [data, setData] = useState<SolicitudPermiso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.usuario_id) params.set('usuario_id', filtros.usuario_id)
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)

      const response = await fetch(`/api/rrhh/permisos?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar permisos')
      }

      setData(json.permisos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.usuario_id, filtros.tipo, filtros.estado, filtros.fecha_desde, filtros.fecha_hasta])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}
