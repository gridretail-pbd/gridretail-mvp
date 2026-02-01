// ============================================================================
// HOOKS DEL SIMULADOR DE INGRESOS - GridRetail
// ============================================================================

'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  SimulationInput,
  SimulationResult,
  ItemDetail,
  SchemeForSimulation,
  SchemeItemWithMapping,
  SalesData,
  Scenario,
  SalesProfile,
  PenaltyPrediction,
  TipoVentaMapping,
  HCEffectiveQuota,
  QuotaBreakdown,
} from './types'
import {
  generateSalesProfile,
  getEffectiveItemName,
  getDisplayName,
  getEffectiveCategory,
  getEffectiveCalculationType,
  prepareSalesDataForRPC,
} from './profiles'

// ============================================================================
// HOOK: useSimulation
// ============================================================================

/**
 * Hook principal para ejecutar simulaciones de comisiones
 */
export function useSimulation() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  /**
   * Ejecuta la simulación llamando al RPC de Supabase
   */
  const simulate = useCallback(async (input: SimulationInput) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('simulate_hc_commission', {
          p_scheme_id: input.schemeId,
          p_sales_data: prepareSalesDataForRPC(input.salesData),
          p_plan_breakdown: input.planBreakdown || null,
          p_user_id: input.userId || null
        })

      if (rpcError) throw rpcError

      const transformedResult = transformResult(data)
      setResult(transformedResult)
      return transformedResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en simulación'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Simula usando cálculo local (fallback si RPC no está disponible)
   * v1.2: Acepta cuota del HC para prorrateo
   */
  const simulateLocal = useCallback(async (
    scheme: SchemeForSimulation,
    salesData: SalesData,
    hcQuota?: HCEffectiveQuota
  ): Promise<SimulationResult> => {
    setLoading(true)
    setError(null)

    try {
      const result = calculateCommissionLocally(scheme, salesData, hcQuota)
      setResult(result)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en cálculo local'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Reinicia el estado
   */
  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    simulate,
    simulateLocal,
    result,
    loading,
    error,
    reset
  }
}

// ============================================================================
// HOOK: useSchemeData
// ============================================================================

/**
 * Hook para cargar datos de esquemas para el simulador
 */
export function useSchemeData() {
  const [loading, setLoading] = useState(false)
  const [schemes, setSchemes] = useState<SchemeForSimulation[]>([])
  const [selectedScheme, setSelectedScheme] = useState<SchemeForSimulation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  /**
   * Carga lista de esquemas disponibles para simulación
   */
  const loadSchemes = useCallback(async (options?: {
    status?: string[]
    schemeType?: string
    year?: number
  }) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('commission_schemes')
        .select('id, name, code, scheme_type, year, month, status, fixed_salary, variable_salary, total_ss_quota, default_min_fulfillment')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (options?.status?.length) {
        query = query.in('status', options.status)
      } else {
        query = query.in('status', ['aprobado', 'draft'])
      }

      if (options?.schemeType) {
        query = query.eq('scheme_type', options.schemeType)
      }

      if (options?.year) {
        query = query.eq('year', options.year)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      // Mapear a SchemeForSimulation (sin items aún)
      const mappedSchemes: SchemeForSimulation[] = (data || []).map(s => ({
        ...s,
        items: []
      }))

      setSchemes(mappedSchemes)
      return mappedSchemes
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando esquemas'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Carga un esquema completo con sus partidas
   */
  const loadSchemeWithItems = useCallback(async (schemeId: string) => {
    setLoading(true)
    setError(null)

    try {
      // Cargar esquema
      const { data: schemeData, error: schemeError } = await supabase
        .from('commission_schemes')
        .select('*')
        .eq('id', schemeId)
        .single()

      if (schemeError) throw schemeError

      // Cargar partidas con todos los joins necesarios
      const { data: itemsData, error: itemsError } = await supabase
        .from('commission_scheme_items')
        .select(`
          *,
          item_type:commission_item_types(code, name, category, calculation_type),
          preset:partition_presets(code, name, short_name, default_category, default_calculation_type),
          locks:commission_item_locks(*),
          pxq_scales:commission_pxq_scales(*)
        `)
        .eq('scheme_id', schemeId)
        .eq('is_active', true)
        .order('display_order')

      if (itemsError) throw itemsError

      // Cargar mapeos de tipos de venta para cada partida
      const itemIds = itemsData?.map(i => i.id) || []
      let ventasMappings: Record<string, TipoVentaMapping[]> = {}

      if (itemIds.length > 0) {
        const { data: ventasData } = await supabase
          .from('commission_item_ventas')
          .select(`
            scheme_item_id,
            tipo_venta_id,
            cuenta_linea,
            cuenta_equipo,
            tipo_venta:tipos_venta(id, codigo, nombre, categoria)
          `)
          .in('scheme_item_id', itemIds)

        // Agrupar por scheme_item_id
        ventasMappings = (ventasData || []).reduce((acc, v) => {
          const itemId = v.scheme_item_id
          if (!acc[itemId]) acc[itemId] = []
          // El join puede retornar un objeto o array dependiendo de la cardinalidad
          const tipoVenta = Array.isArray(v.tipo_venta) ? v.tipo_venta[0] : v.tipo_venta
          acc[itemId].push({
            tipoVentaId: v.tipo_venta_id,
            codigo: tipoVenta?.codigo || '',
            nombre: tipoVenta?.nombre || '',
            categoria: tipoVenta?.categoria || '',
            cuentaLinea: v.cuenta_linea,
            cuentaEquipo: v.cuenta_equipo,
          })
          return acc
        }, {} as Record<string, TipoVentaMapping[]>)
      }

      // Mapear partidas con sus tipos de venta
      const itemsWithMapping: SchemeItemWithMapping[] = (itemsData || []).map(item => ({
        ...item,
        mapped_tipos_venta: ventasMappings[item.id] || []
      }))

      const scheme: SchemeForSimulation = {
        ...schemeData,
        items: itemsWithMapping
      }

      setSelectedScheme(scheme)
      return scheme
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando esquema'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    schemes,
    selectedScheme,
    error,
    loadSchemes,
    loadSchemeWithItems,
    setSelectedScheme
  }
}

// ============================================================================
// HOOK: useScenarios
// ============================================================================

/**
 * Hook para manejar escenarios de comparación
 */
export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])

  /**
   * Agrega un nuevo escenario
   */
  const addScenario = useCallback((
    scheme: SchemeForSimulation,
    profile: SalesProfile,
    salesData: SalesData,
    result: SimulationResult | null
  ) => {
    const newScenario: Scenario = {
      id: crypto.randomUUID(),
      name: `Escenario ${scenarios.length + 1}`,
      schemeId: scheme.id,
      schemeName: scheme.name,
      profile,
      salesData,
      result,
      createdAt: new Date()
    }

    setScenarios(prev => [...prev, newScenario])
    return newScenario
  }, [scenarios.length])

  /**
   * Actualiza un escenario existente
   */
  const updateScenario = useCallback((
    scenarioId: string,
    updates: Partial<Scenario>
  ) => {
    setScenarios(prev =>
      prev.map(s => s.id === scenarioId ? { ...s, ...updates } : s)
    )
  }, [])

  /**
   * Elimina un escenario
   */
  const removeScenario = useCallback((scenarioId: string) => {
    setScenarios(prev => prev.filter(s => s.id !== scenarioId))
  }, [])

  /**
   * Limpia todos los escenarios
   */
  const clearScenarios = useCallback(() => {
    setScenarios([])
  }, [])

  /**
   * Intercambia posiciones de dos escenarios
   */
  const swapScenarios = useCallback((indexA: number, indexB: number) => {
    setScenarios(prev => {
      const newScenarios = [...prev]
      const temp = newScenarios[indexA]
      newScenarios[indexA] = newScenarios[indexB]
      newScenarios[indexB] = temp
      return newScenarios
    })
  }, [])

  return {
    scenarios,
    addScenario,
    updateScenario,
    removeScenario,
    clearScenarios,
    swapScenarios
  }
}

// ============================================================================
// HOOK: usePenaltyPrediction
// ============================================================================

/**
 * Hook para predicción de penalidades
 */
export function usePenaltyPrediction() {
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<PenaltyPrediction[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  /**
   * Predice penalidades para un usuario
   */
  const predictPenalties = useCallback(async (
    userId: string,
    monthsLookback: number = 6
  ) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('predict_hc_penalties', {
          p_user_id: userId,
          p_months_lookback: monthsLookback
        })

      if (rpcError) throw rpcError

      const transformedPredictions: PenaltyPrediction[] = (data || []).map((p: {
        penalty_code: string
        penalty_name: string
        predicted_quantity: number
        predicted_amount: number
        confidence: number
      }) => ({
        penaltyCode: p.penalty_code,
        penaltyName: p.penalty_name,
        predictedQuantity: p.predicted_quantity,
        predictedAmount: p.predicted_amount,
        confidence: p.confidence
      }))

      setPredictions(transformedPredictions)
      return transformedPredictions
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error prediciendo penalidades'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Calcula el total de penalidades predichas
   */
  const totalPredictedPenalties = useMemo(() => {
    return predictions.reduce((sum, p) => sum + p.predictedAmount, 0)
  }, [predictions])

  return {
    loading,
    predictions,
    error,
    predictPenalties,
    totalPredictedPenalties
  }
}

// ============================================================================
// HOOK: useHCQuota (v1.2 NUEVO)
// ============================================================================

/**
 * Opciones para el hook useHCQuota
 */
interface UseHCQuotaOptions {
  userId: string
  year: number
  month: number
  enabled?: boolean
}

/**
 * Hook para obtener la cuota efectiva de un HC con prorrateo
 * Llama al RPC get_hc_effective_quota
 */
export function useHCQuota({ userId, year, month, enabled = true }: UseHCQuotaOptions) {
  const [quota, setQuota] = useState<HCEffectiveQuota | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchQuota = useCallback(async () => {
    if (!userId || !enabled) return null

    setLoading(true)
    setError(null)

    try {
      // Intentar obtener cuota del RPC
      const { data, error: rpcError } = await supabase
        .rpc('get_hc_effective_quota', {
          p_user_id: userId,
          p_year: year,
          p_month: month
        })

      if (rpcError) {
        // Si el RPC no existe, hacer fallback a query directa
        if (rpcError.message?.includes('function') || rpcError.code === '42883') {
          return await fetchQuotaFallback(userId, year, month)
        }
        throw rpcError
      }

      if (data) {
        const effectiveQuota: HCEffectiveQuota = {
          ss_quota: data.ss_quota || 0,
          effective_quota: data.effective_quota || data.ss_quota || 0,
          proration_factor: data.proration_factor || 1,
          quota_breakdown: data.quota_breakdown || {},
          effective_breakdown: data.effective_breakdown || data.quota_breakdown || {},
          start_date: data.start_date || null,
          store_id: data.store_id || '',
          store_name: data.store_name || '',
          user_name: data.user_name || '',
          has_quota: true
        }
        setQuota(effectiveQuota)
        return effectiveQuota
      } else {
        // No hay cuota asignada
        const emptyQuota: HCEffectiveQuota = {
          ss_quota: 0,
          effective_quota: 0,
          proration_factor: 1,
          quota_breakdown: {},
          effective_breakdown: {},
          start_date: null,
          store_id: '',
          store_name: '',
          user_name: '',
          has_quota: false
        }
        setQuota(emptyQuota)
        return emptyQuota
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error obteniendo cuota'
      setError(message)
      setQuota(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase, userId, year, month, enabled])

  /**
   * Fallback: obtener cuota directamente de hc_quotas si el RPC no existe
   */
  const fetchQuotaFallback = async (
    userId: string,
    year: number,
    month: number
  ): Promise<HCEffectiveQuota | null> => {
    try {
      const { data, error: queryError } = await supabase
        .from('hc_quotas')
        .select(`
          id,
          user_id,
          store_quota_id,
          store_id,
          ss_quota,
          quota_breakdown,
          start_date,
          proration_factor,
          prorated_ss_quota,
          status,
          store:tiendas(id, nombre),
          user:usuarios!hc_quotas_user_id_fkey(id, nombre_completo)
        `)
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (queryError && queryError.code !== 'PGRST116') {
        throw queryError
      }

      if (data) {
        const factor = data.proration_factor || 1
        const breakdown = (data.quota_breakdown || {}) as QuotaBreakdown

        // Calcular effective_breakdown aplicando el factor de prorrateo
        const effectiveBreakdown: QuotaBreakdown = {}
        for (const [key, value] of Object.entries(breakdown)) {
          effectiveBreakdown[key] = Math.round(value * factor * 10) / 10
        }

        const storeData = Array.isArray(data.store) ? data.store[0] : data.store
        const userData = Array.isArray(data.user) ? data.user[0] : data.user

        const effectiveQuota: HCEffectiveQuota = {
          ss_quota: data.ss_quota,
          effective_quota: data.prorated_ss_quota || Math.round(data.ss_quota * factor * 10) / 10,
          proration_factor: factor,
          quota_breakdown: breakdown,
          effective_breakdown: effectiveBreakdown,
          start_date: data.start_date,
          store_id: data.store_id,
          store_name: storeData?.nombre || '',
          user_name: userData?.nombre_completo || '',
          has_quota: true
        }

        setQuota(effectiveQuota)
        return effectiveQuota
      }

      // No hay cuota
      const emptyQuota: HCEffectiveQuota = {
        ss_quota: 0,
        effective_quota: 0,
        proration_factor: 1,
        quota_breakdown: {},
        effective_breakdown: {},
        start_date: null,
        store_id: '',
        store_name: '',
        user_name: '',
        has_quota: false
      }
      setQuota(emptyQuota)
      return emptyQuota
    } catch (err) {
      console.error('Error in fetchQuotaFallback:', err)
      return null
    }
  }

  return {
    quota,
    loading,
    error,
    fetchQuota,
    refetch: fetchQuota
  }
}

// ============================================================================
// HOOK: useHCSalesData (v1.2 NUEVO)
// ============================================================================

/**
 * Hook para cargar ventas reales de un HC específico
 */
export function useHCSalesData() {
  const [loading, setLoading] = useState(false)
  const [salesData, setSalesData] = useState<SalesData | null>(null)
  const [dataSource, setDataSource] = useState<'inar' | 'bu' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadSalesData = useCallback(async (
    userDni: string,
    schemeItems: SchemeItemWithMapping[],
    year: number,
    month: number
  ) => {
    setLoading(true)
    setError(null)
    setSalesData(null)
    setDataSource(null)

    try {
      const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

      // Intentar cargar de INAR primero
      const { data: inarData } = await supabase
        .from('lineas_inar')
        .select('vchtipo_venta, intnumlineas')
        .eq('vchvendedordni', userDni)
        .gte('dtefecha_alta', startOfMonth)
        .lte('dtefecha_alta', endOfMonth)

      if (inarData && inarData.length > 0) {
        // Agrupar ventas por tipo
        const salesByType: Record<string, number> = {}
        inarData.forEach((row) => {
          const tipo = row.vchtipo_venta
          salesByType[tipo] = (salesByType[tipo] || 0) + (row.intnumlineas || 1)
        })

        // Mapear a partidas del esquema
        const mappedSales: SalesData = {}
        schemeItems.forEach((item) => {
          const itemName = getEffectiveItemName(item)
          let count = 0

          item.mapped_tipos_venta?.forEach((mapping) => {
            if (salesByType[mapping.codigo]) {
              if (mapping.cuentaLinea) {
                count += salesByType[mapping.codigo]
              }
            }
          })

          mappedSales[itemName] = count
        })

        setSalesData(mappedSales)
        setDataSource('inar')
        return { salesData: mappedSales, source: 'inar' as const }
      }

      // Fallback: datos inicializados en cero
      const emptyData: SalesData = {}
      schemeItems.forEach((item) => {
        const itemName = getEffectiveItemName(item)
        emptyData[itemName] = 0
      })

      setSalesData(emptyData)
      setDataSource(null)
      return { salesData: emptyData, source: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando ventas'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    loading,
    salesData,
    dataSource,
    error,
    loadSalesData
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Transforma el resultado del RPC al formato del frontend
 */
function transformResult(data: Record<string, unknown>): SimulationResult {
  return {
    fixedSalary: Number(data.fixed_salary) || 0,
    variableCommission: Number(data.variable_commission) || 0,
    pxqCommission: Number(data.pxq_commission) || 0,
    bonusCommission: Number(data.bonus_commission) || 0,
    additionalCommission: Number(data.additional_commission) || 0,
    totalGross: Number(data.total_gross) || 0,
    predictedPenalties: Number(data.predicted_penalties) || 0,
    totalNet: Number(data.total_net) || 0,
    globalFulfillment: Number(data.global_fulfillment) || 0,
    details: Array.isArray(data.details)
      ? data.details.map(transformItemDetail)
      : []
  }
}

/**
 * Transforma un detalle de partida del RPC
 */
function transformItemDetail(d: Record<string, unknown>): ItemDetail {
  const quota = d.quota as number | null
  const effectiveQuota = d.effective_quota as number | null

  return {
    id: String(d.id || ''),
    name: String(d.name || ''),
    itemTypeCode: d.item_type_code as string | null,
    presetCode: d.preset_code as string | null,
    customName: d.custom_name as string | null,
    category: (d.category as ItemDetail['category']) || 'adicional',
    calculationType: (d.calculation_type as ItemDetail['calculationType']) || 'percentage',
    tiposVentaMapeados: Array.isArray(d.tipos_venta_mapeados)
      ? d.tipos_venta_mapeados
      : [],
    quota,
    effectiveQuota: effectiveQuota ?? quota,  // v1.2: cuota con prorrateo
    weight: d.weight as number | null,
    variableAmount: Number(d.variable_amount) || 0,
    sales: Number(d.sales) || 0,
    fulfillment: Number(d.fulfillment) || 0,
    effectiveFulfillment: Number(d.effective_fulfillment) || 0,
    meetsMinimum: Boolean(d.meets_minimum),
    minFulfillment: Number(d.min_fulfillment) || 0,
    lockUnlocked: Boolean(d.lock_unlocked),
    lockPending: Array.isArray(d.lock_pending) ? d.lock_pending : [],
    restrictionApplied: Boolean(d.restriction_applied),
    restrictionDetail: d.restriction_detail as string | null,
    effectiveSales: Number(d.effective_sales) || 0,
    hasCap: Boolean(d.has_cap),
    capPercentage: d.cap_percentage as number | null,
    commission: Number(d.commission) || 0
  }
}

/**
 * Calcula comisiones localmente (fallback cuando RPC no está disponible)
 * v1.2: Soporta cuota del HC con prorrateo
 */
function calculateCommissionLocally(
  scheme: SchemeForSimulation,
  salesData: SalesData,
  hcQuota?: HCEffectiveQuota
): SimulationResult {
  const details: ItemDetail[] = []
  let variableCommission = 0
  let pxqCommission = 0
  let bonusCommission = 0
  let additionalCommission = 0
  let totalQuota = 0
  let totalEffectiveQuota = 0
  let totalSales = 0

  // Factor de prorrateo (v1.2)
  const prorationFactor = hcQuota?.proration_factor ?? 1

  for (const item of scheme.items) {
    if (!item.is_active) continue

    const itemName = getEffectiveItemName(item)
    const displayName = getDisplayName(item)
    const category = getEffectiveCategory(item)
    const calcType = getEffectiveCalculationType(item)
    const sales = salesData[itemName] || 0

    // v1.2: Obtener cuota de hc_quotas o del esquema
    let quota = item.quota || 0
    if (hcQuota?.has_quota && hcQuota.quota_breakdown[itemName]) {
      quota = hcQuota.quota_breakdown[itemName]
    }

    // v1.2: Calcular cuota efectiva con prorrateo
    const effectiveQuota = Math.round(quota * prorationFactor * 10) / 10

    // v1.2: El cumplimiento se calcula sobre la cuota efectiva (prorrateada)
    const fulfillment = effectiveQuota > 0 ? sales / effectiveQuota : 0
    const minFulfillment = item.min_fulfillment || scheme.default_min_fulfillment || 0
    const meetsMinimum = fulfillment >= minFulfillment

    // Por ahora asumimos candados liberados (cálculo simplificado)
    const lockUnlocked = true

    // Cumplimiento efectivo (con tope si aplica)
    let effectiveFulfillment = fulfillment
    if (item.has_cap && item.cap_percentage && fulfillment > item.cap_percentage) {
      effectiveFulfillment = item.cap_percentage
    }

    // Calcular comisión
    let commission = 0
    if (meetsMinimum && lockUnlocked) {
      if (calcType === 'percentage') {
        commission = item.variable_amount * effectiveFulfillment
      } else if (calcType === 'pxq' && item.pxq_scales?.length) {
        // Buscar escala aplicable
        const applicableScale = item.pxq_scales.find(s =>
          fulfillment >= s.min_fulfillment &&
          (s.max_fulfillment === null || fulfillment <= s.max_fulfillment)
        )
        if (applicableScale) {
          commission = sales * applicableScale.amount_per_unit
        }
      } else if (calcType === 'binary') {
        commission = fulfillment >= 1 ? item.variable_amount : 0
      }
    }

    // Acumular por categoría
    if (category === 'principal') {
      variableCommission += commission
      totalQuota += quota
      totalEffectiveQuota += effectiveQuota
      totalSales += sales
    } else if (category === 'pxq') {
      pxqCommission += commission
    } else if (category === 'bono') {
      bonusCommission += commission
    } else {
      additionalCommission += commission
    }

    details.push({
      id: item.id,
      name: displayName,
      itemTypeCode: item.item_type?.code || null,
      presetCode: item.preset?.code || null,
      customName: item.custom_name,
      category: category as ItemDetail['category'],
      calculationType: calcType as ItemDetail['calculationType'],
      tiposVentaMapeados: item.mapped_tipos_venta || [],
      quota,
      effectiveQuota,  // v1.2: cuota con prorrateo
      weight: item.weight,
      variableAmount: item.variable_amount,
      sales,
      fulfillment,
      effectiveFulfillment,
      meetsMinimum,
      minFulfillment,
      lockUnlocked,
      lockPending: [],
      restrictionApplied: false,
      restrictionDetail: null,
      effectiveSales: sales,
      hasCap: item.has_cap,
      capPercentage: item.cap_percentage,
      commission
    })
  }

  // v1.2: El cumplimiento global usa la cuota efectiva
  const globalFulfillment = totalEffectiveQuota > 0 ? totalSales / totalEffectiveQuota : 0
  const totalGross = scheme.fixed_salary + variableCommission + additionalCommission + pxqCommission + bonusCommission

  const result: SimulationResult = {
    fixedSalary: scheme.fixed_salary,
    variableCommission,
    pxqCommission,
    bonusCommission,
    additionalCommission,
    totalGross,
    predictedPenalties: 0, // No disponible en cálculo local
    totalNet: totalGross,
    globalFulfillment,
    details
  }

  // v1.2: Agregar info de cuota si fue proporcionada
  if (hcQuota) {
    result.quotaInfo = {
      source: hcQuota.has_quota ? 'hc_quotas' : 'scheme_fallback',
      proration_factor: prorationFactor,
      effective_quota: hcQuota.effective_quota,
      start_date: hcQuota.start_date
    }
  }

  return result
}
