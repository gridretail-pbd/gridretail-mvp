'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AlertaRRHH } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de alertas ────────────────────────────────────────────

interface FiltrosAlertas {
  tipo?: string
  nivel?: string
  estado?: string
  search?: string
}

interface UseAlertasResult {
  data: AlertaRRHH[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useAlertas(filtros: FiltrosAlertas): UseAlertasResult {
  const [data, setData] = useState<AlertaRRHH[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.nivel) params.set('nivel', filtros.nivel)
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.search) params.set('search', filtros.search)

      const response = await fetch(`/api/rrhh/alertas?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar alertas')
      }

      setData(json.alertas || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.tipo, filtros.nivel, filtros.estado, filtros.search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}
