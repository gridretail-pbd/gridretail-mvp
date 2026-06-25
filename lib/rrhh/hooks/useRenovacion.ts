'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RenovacionLote, RenovacionDecision } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de lotes de renovación ─────────────────────────────────

interface FiltrosLotes {
  estado?: string
}

interface UseLotesResult {
  data: RenovacionLote[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useLotesRenovacion(filtros: FiltrosLotes): UseLotesResult {
  const [data, setData] = useState<RenovacionLote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.estado) {
        params.set('estado', filtros.estado)
      }

      const response = await fetch(`/api/rrhh/renovacion?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar lotes')
      }

      setData(json.lotes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.estado])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}

// ─── Hook para detalle de lote (con decisiones) ────────────────────────────

interface UseLoteResult {
  data: RenovacionLote | null
  decisiones: RenovacionDecision[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useLoteRenovacion(id: string | null): UseLoteResult {
  const [data, setData] = useState<RenovacionLote | null>(null)
  const [decisiones, setDecisiones] = useState<RenovacionDecision[]>([])
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
      const response = await fetch(`/api/rrhh/renovacion/${id}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar lote')
      }

      const lote = json.lote || null
      setData(lote)
      setDecisiones(lote?.decisiones || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData(null)
      setDecisiones([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, decisiones, refetch: fetchData }
}
