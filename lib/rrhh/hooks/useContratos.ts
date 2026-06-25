'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Contrato } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de contratos ──────────────────────────────────────────

interface FiltrosContratos {
  estado?: string[]
  tipo_contrato?: string
  usuario_id?: string
  search?: string
  proximos_a_vencer?: number
}

interface UseContratosResult {
  data: Contrato[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useContratos(filtros: FiltrosContratos): UseContratosResult {
  const [data, setData] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.estado && filtros.estado.length > 0) {
        params.set('estado', filtros.estado.join(','))
      }
      if (filtros.tipo_contrato) {
        params.set('tipo_contrato', filtros.tipo_contrato)
      }
      if (filtros.usuario_id) {
        params.set('usuario_id', filtros.usuario_id)
      }
      if (filtros.search) {
        params.set('search', filtros.search)
      }
      if (filtros.proximos_a_vencer) {
        params.set('proximos_a_vencer', String(filtros.proximos_a_vencer))
      }

      const response = await fetch(`/api/rrhh/contratos?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar contratos')
      }

      setData(json.contratos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.estado, filtros.tipo_contrato, filtros.usuario_id, filtros.search, filtros.proximos_a_vencer])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}

// ─── Hook para detalle de contrato ─────────────────────────────────────────

interface UseContratoResult {
  data: Contrato | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useContrato(id: string | null): UseContratoResult {
  const [data, setData] = useState<Contrato | null>(null)
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
      const response = await fetch(`/api/rrhh/contratos/${id}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar contrato')
      }

      setData(json.contrato || null)
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
