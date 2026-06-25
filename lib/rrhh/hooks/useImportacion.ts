'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ImportacionRRHH } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de importaciones ─────────────────────────────────────

interface FiltrosImportaciones {
  estado?: string
  search?: string
}

interface UseImportacionesResult {
  data: ImportacionRRHH[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useImportaciones(filtros: FiltrosImportaciones): UseImportacionesResult {
  const [data, setData] = useState<ImportacionRRHH[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.search) params.set('search', filtros.search)

      const response = await fetch(`/api/rrhh/importacion?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar importaciones')
      }

      setData(json.importaciones || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.estado, filtros.search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}

// ─── Hook para importación individual ─────────────────────────────────────

interface UseImportacionResult {
  data: ImportacionRRHH | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useImportacion(id: string | null): UseImportacionResult {
  const [data, setData] = useState<ImportacionRRHH | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/rrhh/importacion?id=${id}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar importación')
      }

      setData(json.importacion || null)
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
