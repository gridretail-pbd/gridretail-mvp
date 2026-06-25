'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UsuarioRRHH } from '@/lib/rrhh/interfaces'

// ─── Hook para lista de colaboradores ────────────────────────────────────────

interface FiltrosColaboradores {
  status?: string[]
  area_funcional?: string
  search?: string
}

interface UseUsuariosRRHHResult {
  data: UsuarioRRHH[]
  loading: boolean
  error: string | null
  total: number
  refetch: () => void
}

export function useUsuariosRRHH(filtros: FiltrosColaboradores): UseUsuariosRRHHResult {
  const [data, setData] = useState<UsuarioRRHH[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.status && filtros.status.length > 0) {
        params.set('status', filtros.status.join(','))
      }
      if (filtros.area_funcional) {
        params.set('area_funcional', filtros.area_funcional)
      }
      if (filtros.search) {
        params.set('search', filtros.search)
      }

      const response = await fetch(`/api/rrhh/usuarios-rrhh?${params}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar colaboradores')
      }

      setData(json.colaboradores || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filtros.status, filtros.area_funcional, filtros.search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, total: data.length, refetch: fetchData }
}

// ─── Hook para ficha individual ──────────────────────────────────────────────

interface UseUsuarioRRHHResult {
  data: UsuarioRRHH | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useUsuarioRRHH(id: string | null): UseUsuarioRRHHResult {
  const [data, setData] = useState<UsuarioRRHH | null>(null)
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
      const response = await fetch(`/api/rrhh/usuarios-rrhh/${id}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al cargar ficha del colaborador')
      }

      setData(json.colaborador || null)
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
