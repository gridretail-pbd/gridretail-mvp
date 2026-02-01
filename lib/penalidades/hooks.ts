// ============================================================================
// HOOKS DEL MÓDULO DE PENALIDADES - GridRetail
// ============================================================================

'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  HCPenalty,
  PenaltyType,
  PenaltyEquivalence,
  PenaltyImport,
  PenaltyFilters,
  MonthlyPenaltySummary,
  CreatePenaltyInput,
  WaivePenaltyInput,
  CreateEquivalenceInput,
} from './types'
import { calculateMonthlySummary } from './calculations'

// ============================================================================
// HOOK: usePenalties
// ============================================================================

/**
 * Hook para obtener y gestionar penalidades
 */
export function usePenalties(filters: PenaltyFilters = {}) {
  const [loading, setLoading] = useState(false)
  const [penalties, setPenalties] = useState<HCPenalty[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadPenalties = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('hc_penalties')
        .select(`
          *,
          penalty_type:penalty_types(*),
          user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
          store:tiendas(id, nombre, codigo),
          waived_by_user:usuarios!hc_penalties_waived_by_fkey(nombre_completo),
          created_by_user:usuarios!hc_penalties_created_by_fkey(nombre_completo)
        `)
        .order('created_at', { ascending: false })

      if (filters.year) query = query.eq('year', filters.year)
      if (filters.month) query = query.eq('month', filters.month)
      if (filters.user_id) query = query.eq('user_id', filters.user_id)
      if (filters.store_id) query = query.eq('store_id', filters.store_id)
      if (filters.penalty_type_id) query = query.eq('penalty_type_id', filters.penalty_type_id)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.source) query = query.eq('source', filters.source)

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setPenalties(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando penalidades'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase, filters])

  // Estadísticas calculadas
  const stats = useMemo(() => {
    const total = penalties.length
    const totalAmount = penalties.reduce((sum, p) => sum + (p.transferred_amount || 0), 0)
    const byStatus = {
      pending: penalties.filter(p => p.status === 'pending').length,
      applied: penalties.filter(p => p.status === 'applied').length,
      waived: penalties.filter(p => p.status === 'waived').length,
      disputed: penalties.filter(p => p.status === 'disputed').length,
    }
    const bySource = {
      entel: penalties.filter(p => p.source === 'entel').length,
      manual: penalties.filter(p => p.source === 'manual').length,
    }

    return {
      total,
      totalAmount,
      byStatus,
      bySource,
    }
  }, [penalties])

  return {
    loading,
    penalties,
    error,
    stats,
    loadPenalties,
    refresh: loadPenalties,
  }
}

// ============================================================================
// HOOK: usePenaltyTypes
// ============================================================================

/**
 * Hook para obtener tipos de penalidad
 */
export function usePenaltyTypes() {
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<PenaltyType[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadTypes = useCallback(async (activeOnly: boolean = true) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('penalty_types')
        .select('*')
        .order('display_order')

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setTypes(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando tipos'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Tipos por origen
  const typesBySource = useMemo(() => ({
    entel: types.filter(t => t.source === 'entel'),
    internal: types.filter(t => t.source === 'internal'),
  }), [types])

  return {
    loading,
    types,
    typesBySource,
    error,
    loadTypes,
  }
}

// ============================================================================
// HOOK: usePenaltyEquivalences
// ============================================================================

/**
 * Hook para obtener equivalencias de penalidades
 */
export function usePenaltyEquivalences() {
  const [loading, setLoading] = useState(false)
  const [equivalences, setEquivalences] = useState<PenaltyEquivalence[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadEquivalences = useCallback(async (validDate?: string) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('penalty_equivalences')
        .select(`
          *,
          penalty_type:penalty_types(*),
          created_by_user:usuarios!penalty_equivalences_created_by_fkey(nombre_completo)
        `)
        .order('valid_from', { ascending: false })

      // Si se especifica fecha, filtrar vigentes
      if (validDate) {
        query = query
          .lte('valid_from', validDate)
          .or(`valid_to.is.null,valid_to.gte.${validDate}`)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setEquivalences(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando equivalencias'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const createEquivalence = useCallback(async (
    input: CreateEquivalenceInput,
    userId: string
  ) => {
    setLoading(true)
    setError(null)

    try {
      // Cerrar equivalencia anterior si existe
      await supabase
        .from('penalty_equivalences')
        .update({ valid_to: input.valid_from })
        .eq('penalty_type_id', input.penalty_type_id)
        .is('valid_to', null)

      // Crear nueva equivalencia
      const { data, error: insertError } = await supabase
        .from('penalty_equivalences')
        .insert({
          ...input,
          created_by: userId,
        })
        .select(`
          *,
          penalty_type:penalty_types(*)
        `)
        .single()

      if (insertError) throw insertError

      await loadEquivalences()
      return { success: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error creando equivalencia'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase, loadEquivalences])

  return {
    loading,
    equivalences,
    error,
    loadEquivalences,
    createEquivalence,
    refresh: loadEquivalences,
  }
}

// ============================================================================
// HOOK: useCreatePenalty
// ============================================================================

/**
 * Hook para crear penalidades manualmente
 */
export function useCreatePenalty() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const createPenalty = useCallback(async (
    input: CreatePenaltyInput,
    userId: string
  ): Promise<{ success: boolean; data?: HCPenalty; error?: string }> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('hc_penalties')
        .insert({
          ...input,
          source: 'manual',
          status: 'pending',
          created_by: userId,
        })
        .select(`
          *,
          penalty_type:penalty_types(*),
          user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
          store:tiendas(id, nombre, codigo)
        `)
        .single()

      if (insertError) throw insertError

      return { success: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error creando penalidad'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    error,
    createPenalty,
  }
}

// ============================================================================
// HOOK: useWaivePenalty
// ============================================================================

/**
 * Hook para condonar penalidades
 */
export function useWaivePenalty() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const waivePenalty = useCallback(async (
    penaltyId: string,
    input: WaivePenaltyInput,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('hc_penalties')
        .update({
          status: 'waived',
          waived_reason: input.waived_reason,
          waived_by: userId,
          waived_at: new Date().toISOString(),
        })
        .eq('id', penaltyId)

      if (updateError) throw updateError

      // Si se reasigna a otro usuario, crear nueva penalidad
      if (input.reassign_to_user_id) {
        // Obtener penalidad original
        const { data: original } = await supabase
          .from('hc_penalties')
          .select('*')
          .eq('id', penaltyId)
          .single()

        if (original) {
          await supabase
            .from('hc_penalties')
            .insert({
              user_id: input.reassign_to_user_id,
              store_id: original.store_id,
              penalty_type_id: original.penalty_type_id,
              year: original.year,
              month: original.month,
              incident_date: original.incident_date,
              quantity: original.quantity,
              original_amount: original.original_amount,
              transferred_amount: original.transferred_amount,
              source: original.source,
              import_reference: original.import_reference,
              status: 'pending',
              notes: `Reasignada desde ${penaltyId}`,
              created_by: userId,
            })
        }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error condonando penalidad'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const revertWaive = useCallback(async (
    penaltyId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('hc_penalties')
        .update({
          status: 'applied',
          waived_reason: null,
          waived_by: null,
          waived_at: null,
        })
        .eq('id', penaltyId)

      if (updateError) throw updateError

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error revirtiendo condonación'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    error,
    waivePenalty,
    revertWaive,
  }
}

// ============================================================================
// HOOK: usePenaltyImports
// ============================================================================

/**
 * Hook para gestionar importaciones de penalidades
 */
export function usePenaltyImports() {
  const [loading, setLoading] = useState(false)
  const [imports, setImports] = useState<PenaltyImport[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadImports = useCallback(async (options?: {
    year?: number
    month?: number
    limit?: number
  }) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('penalty_imports')
        .select(`
          *,
          imported_by_user:usuarios!penalty_imports_imported_by_fkey(nombre_completo)
        `)
        .order('created_at', { ascending: false })

      if (options?.year) {
        query = query.eq('year', options.year)
      }
      if (options?.month) {
        query = query.eq('month', options.month)
      }
      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setImports(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando importaciones'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    imports,
    error,
    loadImports,
    refresh: loadImports,
  }
}

// ============================================================================
// HOOK: usePenaltySummary
// ============================================================================

/**
 * Hook para obtener resumen mensual de penalidades
 */
export function usePenaltySummary(year: number, month: number) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<MonthlyPenaltySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Cargar todas las penalidades del período con joins
      const { data: penalties, error: queryError } = await supabase
        .from('hc_penalties')
        .select(`
          *,
          penalty_type:penalty_types(*),
          user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
          store:tiendas(id, nombre, codigo)
        `)
        .eq('year', year)
        .eq('month', month)

      if (queryError) throw queryError

      // Calcular resumen
      const calculatedSummary = calculateMonthlySummary(penalties || [], year, month)
      setSummary(calculatedSummary)

      return calculatedSummary
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando resumen'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase, year, month])

  return {
    loading,
    summary,
    error,
    loadSummary,
    refresh: loadSummary,
  }
}

// ============================================================================
// HOOK: useUpdatePenaltyStatus
// ============================================================================

/**
 * Hook para actualizar estado de penalidades en lote
 */
export function useUpdatePenaltyStatus() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const updateStatus = useCallback(async (
    penaltyIds: string[],
    newStatus: 'pending' | 'applied' | 'waived' | 'disputed'
  ): Promise<{ success: boolean; updatedCount: number; error?: string }> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: updateError } = await supabase
        .from('hc_penalties')
        .update({ status: newStatus })
        .in('id', penaltyIds)
        .select('id')

      if (updateError) throw updateError

      return { success: true, updatedCount: data?.length || 0 }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error actualizando estado'
      setError(message)
      return { success: false, updatedCount: 0, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    error,
    updateStatus,
  }
}
