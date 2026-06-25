'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Candidato } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de candidatos (pipeline) ───────────────────────────────

interface FiltrosCandidatos {
  etapa_actual?: string[]
  fuente_captacion?: string
  descartado?: boolean
  search?: string
}

interface UseCandidatosResult {
  data: Candidato[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useCandidatos(filtros: FiltrosCandidatos): UseCandidatosResult {
  const [data, setData] = useState<Candidato[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.etapa_actual && filtros.etapa_actual.length > 0) {
        params.set('etapa_actual', filtros.etapa_actual.join(','))
      }
      if (filtros.fuente_captacion) {
        params.set('fuente_captacion', filtros.fuente_captacion)
      }
      if (filtros.descartado !== undefined) {
        params.set('descartado', String(filtros.descartado))
      }
      if (filtros.search) {
        params.set('search', filtros.search)
      }

      const response = await fetch(`/api/rrhh/candidatos?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar candidatos')
      }

      setData(json.candidatos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.etapa_actual, filtros.fuente_captacion, filtros.descartado, filtros.search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}

// ─── Hook para detalle de candidato ─────────────────────────────────────────

interface UseCandidatoResult {
  data: Candidato | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useCandidato(id: string | null): UseCandidatoResult {
  const [data, setData] = useState<Candidato | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/rrhh/candidatos/${id}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar candidato')
      }

      setData(json.candidato || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
