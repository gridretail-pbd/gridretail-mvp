'use client'

import { useState, useEffect, useCallback } from 'react'
import type { OffboardingChecklist } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de offboardings ────────────────────────────────────────

interface FiltrosOffboarding {
  estado?: string
  tipo_salida?: string
  search?: string
}

interface UseOffboardingsResult {
  data: OffboardingChecklist[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useOffboardings(filtros: FiltrosOffboarding): UseOffboardingsResult {
  const [data, setData] = useState<OffboardingChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.tipo_salida) params.set('tipo_salida', filtros.tipo_salida)
      if (filtros.search) params.set('search', filtros.search)

      const response = await fetch(`/api/rrhh/offboarding?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar procesos de offboarding')
      }

      setData(json.offboardings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.estado, filtros.tipo_salida, filtros.search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}
