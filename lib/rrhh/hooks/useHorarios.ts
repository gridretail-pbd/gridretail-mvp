'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Turno, AsignacionTurno } from '@/lib/rrhh/interfaces'

// ─── Hook para catálogo de turnos ────────────────────────────────────────────

interface UseTurnosResult {
  data: Turno[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useTurnos(): UseTurnosResult {
  const [data, setData] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/rrhh/horarios/turnos')
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar turnos')
      }

      setData(json.turnos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// ─── Hook para asignación de turnos ────────────────────────────────────────

interface FiltrosAsignacion {
  tienda_id?: string
  usuario_id?: string
  fecha_desde?: string
  fecha_hasta?: string
}

interface UseAsignacionTurnosResult {
  data: AsignacionTurno[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useAsignacionTurnos(filtros: FiltrosAsignacion): UseAsignacionTurnosResult {
  const [data, setData] = useState<AsignacionTurno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.tienda_id) params.set('tienda_id', filtros.tienda_id)
      if (filtros.usuario_id) params.set('usuario_id', filtros.usuario_id)
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)

      const response = await fetch(`/api/rrhh/horarios/asignacion?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar asignación de turnos')
      }

      setData(json.asignaciones || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.tienda_id, filtros.usuario_id, filtros.fecha_desde, filtros.fecha_hasta])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}
