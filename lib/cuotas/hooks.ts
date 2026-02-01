// ============================================================================
// HOOKS DEL MÓDULO DE CUOTAS - GridRetail
// ============================================================================

'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  StoreQuota,
  StoreQuotaSummary,
  HCQuota,
  HCQuotaVigente,
  QuotaImport,
  QuotaDistributionInput,
  DistributionResult,
  ApprovalResult,
  PeriodSummary,
  QuotaBreakdown,
} from './types'

// ============================================================================
// HOOK: useStoreQuotas
// ============================================================================

/**
 * Hook para obtener cuotas de tienda de un período
 */
export function useStoreQuotas(year: number, month: number) {
  const [loading, setLoading] = useState(false)
  const [quotas, setQuotas] = useState<StoreQuotaSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadQuotas = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('vw_store_quotas_summary')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .order('store_name')

      if (queryError) throw queryError

      setQuotas(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando cuotas'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase, year, month])

  // Estadísticas calculadas
  const stats = useMemo(() => {
    const total_ss_quota = quotas.reduce((sum, q) => sum + q.ss_quota, 0)
    const total_distributed = quotas.reduce((sum, q) => sum + q.total_distributed, 0)
    const stores_complete = quotas.filter(q => q.remaining_quota === 0).length
    const stores_pending = quotas.filter(q => q.remaining_quota > 0 && q.hc_count > 0).length
    const stores_no_hc = quotas.filter(q => q.hc_count === 0).length
    const total_hc = quotas.reduce((sum, q) => sum + q.hc_count, 0)

    return {
      total_ss_quota,
      total_distributed,
      total_stores: quotas.length,
      stores_complete,
      stores_pending,
      stores_no_hc,
      total_hc,
      distribution_pct: total_ss_quota > 0
        ? Math.round((total_distributed / total_ss_quota) * 100)
        : 0
    }
  }, [quotas])

  return {
    loading,
    quotas,
    error,
    stats,
    loadQuotas,
    refresh: loadQuotas
  }
}

// ============================================================================
// HOOK: useStoreQuotaDetail
// ============================================================================

/**
 * Hook para obtener detalle de cuota de una tienda específica
 */
export function useStoreQuotaDetail(storeQuotaId: string | null) {
  const [loading, setLoading] = useState(false)
  const [storeQuota, setStoreQuota] = useState<StoreQuota | null>(null)
  const [hcQuotas, setHcQuotas] = useState<HCQuota[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadDetail = useCallback(async () => {
    if (!storeQuotaId) return

    setLoading(true)
    setError(null)

    try {
      // Cargar cuota de tienda
      const { data: storeData, error: storeError } = await supabase
        .from('store_quotas')
        .select(`
          *,
          store:tiendas(id, codigo, nombre)
        `)
        .eq('id', storeQuotaId)
        .single()

      if (storeError) throw storeError

      setStoreQuota(storeData)

      // Cargar cuotas de HC
      const { data: hcData, error: hcError } = await supabase
        .from('hc_quotas')
        .select(`
          *,
          user:usuarios!hc_quotas_user_id_fkey(id, codigo_asesor, nombre_completo, rol, zona)
        `)
        .eq('store_quota_id', storeQuotaId)

      if (hcError) throw hcError

      setHcQuotas(hcData || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando detalle'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [supabase, storeQuotaId])

  return {
    loading,
    storeQuota,
    hcQuotas,
    error,
    loadDetail,
    refresh: loadDetail
  }
}

// ============================================================================
// HOOK: useHCQuotas
// ============================================================================

/**
 * Hook para obtener cuotas de HC de una tienda en un período
 */
export function useHCQuotas(storeId: string | null, year: number, month: number) {
  const [loading, setLoading] = useState(false)
  const [quotas, setQuotas] = useState<HCQuotaVigente[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadQuotas = useCallback(async () => {
    if (!storeId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('vw_quotas_vigentes')
        .select('*')
        .eq('store_id', storeId)
        .eq('year', year)
        .eq('month', month)

      if (queryError) throw queryError

      setQuotas(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando cuotas HC'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase, storeId, year, month])

  return {
    loading,
    quotas,
    error,
    loadQuotas,
    refresh: loadQuotas
  }
}

// ============================================================================
// HOOK: useMyQuota
// ============================================================================

/**
 * Hook para obtener la cuota del usuario actual
 */
export function useMyQuota(year: number, month: number) {
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<HCQuotaVigente | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadQuota = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('vw_quotas_vigentes')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (queryError && queryError.code !== 'PGRST116') throw queryError

      setQuota(data || null)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando mi cuota'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase, year, month])

  return {
    loading,
    quota,
    error,
    loadQuota
  }
}

// ============================================================================
// HOOK: useDistributeQuotas
// ============================================================================

/**
 * Hook para distribuir cuotas de tienda a asesores
 */
export function useDistributeQuotas() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const distribute = useCallback(async (
    input: QuotaDistributionInput
  ): Promise<DistributionResult> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('distribute_store_quota', {
          p_store_quota_id: input.store_quota_id,
          p_distributions: input.distributions
        })

      if (rpcError) throw rpcError

      return data as DistributionResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en distribución'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    error,
    distribute
  }
}

// ============================================================================
// HOOK: useApproveQuotas
// ============================================================================

/**
 * Hook para aprobar cuotas
 */
export function useApproveQuotas() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const approve = useCallback(async (
    storeQuotaIds: string[],
    approvalNotes?: string
  ): Promise<ApprovalResult> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('approve_store_quotas', {
          p_store_quota_ids: storeQuotaIds,
          p_approval_notes: approvalNotes || null
        })

      if (rpcError) throw rpcError

      return data as ApprovalResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en aprobación'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    error,
    approve
  }
}

// ============================================================================
// HOOK: useQuotaImports
// ============================================================================

/**
 * Hook para gestionar importaciones de cuotas
 */
export function useQuotaImports() {
  const [loading, setLoading] = useState(false)
  const [imports, setImports] = useState<QuotaImport[]>([])
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
        .from('quota_imports')
        .select('*')
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

  const checkExistingImport = useCallback(async (
    year: number,
    month: number
  ): Promise<QuotaImport | null> => {
    try {
      const { data } = await supabase
        .from('quota_imports')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .in('status', ['completed', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return data
    } catch {
      return null
    }
  }, [supabase])

  return {
    loading,
    imports,
    error,
    loadImports,
    checkExistingImport
  }
}

// ============================================================================
// HOOK: usePeriodSummary
// ============================================================================

/**
 * Hook para obtener resumen de un período
 */
export function usePeriodSummary(year: number, month: number) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Obtener estadísticas de store_quotas
      const { data: storeStats, error: storeError } = await supabase
        .from('store_quotas')
        .select('id, ss_quota, status, approved_at, created_at')
        .eq('year', year)
        .eq('month', month)

      if (storeError) throw storeError

      // Obtener estadísticas de hc_quotas
      const { data: hcStats, error: hcError } = await supabase
        .from('hc_quotas')
        .select('id, status, distributed_at')
        .eq('year', year)
        .eq('month', month)

      if (hcError) throw hcError

      // Obtener importaciones
      const { data: importData } = await supabase
        .from('quota_imports')
        .select('imported_at')
        .eq('year', year)
        .eq('month', month)
        .eq('status', 'completed')
        .order('imported_at', { ascending: false })
        .limit(1)
        .single()

      // Calcular estado
      let status: PeriodSummary['status'] = 'not_started'
      if (storeStats && storeStats.length > 0) {
        const allApproved = storeStats.every(s => s.status === 'approved')
        const anyDistributed = hcStats && hcStats.length > 0
        const anyPending = storeStats.some(s => s.status === 'pending_approval')

        if (allApproved) {
          status = 'approved'
        } else if (anyPending) {
          status = 'pending_approval'
        } else if (anyDistributed) {
          status = 'distributing'
        } else {
          status = 'importing'
        }
      }

      const periodSummary: PeriodSummary = {
        year,
        month,
        total_ss_quota: storeStats?.reduce((sum, s) => sum + s.ss_quota, 0) || 0,
        total_stores: storeStats?.length || 0,
        stores_with_distribution: new Set(hcStats?.map(h => h.id)).size,
        total_hc: hcStats?.length || 0,
        hc_with_quotas: hcStats?.filter(h => h.status === 'approved').length || 0,
        status,
        import_date: importData?.imported_at || undefined,
        distribution_date: hcStats?.[0]?.distributed_at || undefined,
        approval_date: storeStats?.find(s => s.approved_at)?.approved_at || undefined
      }

      setSummary(periodSummary)
      return periodSummary
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
    refresh: loadSummary
  }
}

// ============================================================================
// HOOK: useStoreAdvisors
// ============================================================================

/**
 * Hook para obtener asesores de una tienda (para distribución)
 */
export function useStoreAdvisors(storeId: string | null) {
  const [loading, setLoading] = useState(false)
  const [advisors, setAdvisors] = useState<Array<{
    id: string
    codigo_asesor: string
    nombre_completo: string
    rol: string
    zona?: string
  }>>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadAdvisors = useCallback(async () => {
    if (!storeId) return

    setLoading(true)
    setError(null)

    try {
      // Obtener usuarios asignados a la tienda via usuarios_tiendas
      const { data, error: queryError } = await supabase
        .from('usuarios_tiendas')
        .select('usuario:usuarios(id, codigo_asesor, nombre_completo, rol, zona)')
        .eq('tienda_id', storeId)
        .eq('usuario.activo', true)
        .in('usuario.rol', ['ASESOR', 'ASESOR_REFERENTE', 'SUPERVISOR', 'COORDINADOR'])

      if (queryError) throw queryError

      // Extraer usuarios del resultado del join y filtrar nulls
      const usuarios = (data || [])
        .map(item => item.usuario)
        .filter((u): u is NonNullable<typeof u> => u !== null)
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))

      setAdvisors(usuarios)
      return usuarios
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando asesores'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase, storeId])

  return {
    loading,
    advisors,
    error,
    loadAdvisors
  }
}
