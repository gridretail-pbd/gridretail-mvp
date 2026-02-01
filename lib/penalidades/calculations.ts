// ============================================================================
// CÁLCULOS DEL MÓDULO DE PENALIDADES - GridRetail
// ============================================================================

import type {
  PenaltyEquivalence,
  HCPenalty,
  PenaltySummary,
  MonthlyPenaltySummary,
} from './types'

/**
 * Calcula el monto trasladado al HC según la equivalencia vigente
 */
export function calculateTransferredAmount(
  originalAmount: number,
  quantity: number,
  equivalence: PenaltyEquivalence
): number {
  const {
    transfer_type,
    transfer_percentage,
    transfer_fixed_amount,
    max_incidents
  } = equivalence

  // Aplicar límite de incidencias si existe
  const applicableQuantity = max_incidents
    ? Math.min(quantity, max_incidents)
    : quantity

  switch (transfer_type) {
    case 'none':
      return 0

    case 'full':
      // Si hay límite de incidencias, calcular proporcionalmente
      if (max_incidents && quantity > max_incidents) {
        return (originalAmount * applicableQuantity) / quantity
      }
      return originalAmount

    case 'percentage':
      const percentage = transfer_percentage || 0
      let baseAmount = originalAmount
      if (max_incidents && quantity > max_incidents) {
        baseAmount = (originalAmount * applicableQuantity) / quantity
      }
      return Math.round(baseAmount * (percentage / 100) * 100) / 100

    case 'fixed':
      const fixedAmount = transfer_fixed_amount || 0
      return fixedAmount * applicableQuantity

    case 'partial_count':
      const amountPerIncident = transfer_fixed_amount || 0
      return amountPerIncident * applicableQuantity

    default:
      return 0
  }
}

/**
 * Calcula el resumen mensual de penalidades
 */
export function calculateMonthlySummary(
  penalties: HCPenalty[],
  year: number,
  month: number
): MonthlyPenaltySummary {
  const filtered = penalties.filter(p => p.year === year && p.month === month)

  // Totales generales
  const total_penalties = filtered.length
  const total_original_amount = filtered.reduce(
    (sum, p) => sum + (p.original_amount || 0),
    0
  )
  const total_transferred_amount = filtered.reduce(
    (sum, p) => sum + (p.transferred_amount || 0),
    0
  )

  // Por origen
  const entelPenalties = filtered.filter(p => p.source === 'entel')
  const manualPenalties = filtered.filter(p => p.source === 'manual')

  const by_source = {
    entel: {
      count: entelPenalties.length,
      amount: entelPenalties.reduce((sum, p) => sum + (p.transferred_amount || 0), 0)
    },
    internal: {
      count: manualPenalties.length,
      amount: manualPenalties.reduce((sum, p) => sum + (p.transferred_amount || 0), 0)
    }
  }

  // Por estado
  const by_status = {
    pending: calculateStatusTotal(filtered, 'pending'),
    applied: calculateStatusTotal(filtered, 'applied'),
    waived: calculateStatusTotal(filtered, 'waived'),
    disputed: calculateStatusTotal(filtered, 'disputed')
  }

  // Por tipo
  const typeMap = new Map<string, {
    penalty_type_id: string
    penalty_code: string
    penalty_name: string
    count: number
    quantity: number
    original_amount: number
    transferred_amount: number
  }>()

  filtered.forEach(p => {
    const typeId = p.penalty_type_id
    const existing = typeMap.get(typeId)
    if (existing) {
      existing.count++
      existing.quantity += p.quantity
      existing.original_amount += p.original_amount || 0
      existing.transferred_amount += p.transferred_amount || 0
    } else {
      typeMap.set(typeId, {
        penalty_type_id: typeId,
        penalty_code: p.penalty_type?.code || '',
        penalty_name: p.penalty_type?.name || '',
        count: 1,
        quantity: p.quantity,
        original_amount: p.original_amount || 0,
        transferred_amount: p.transferred_amount || 0
      })
    }
  })

  const by_type = Array.from(typeMap.values())
    .sort((a, b) => b.transferred_amount - a.transferred_amount)

  // Por tienda
  const storeMap = new Map<string, {
    store_id: string
    store_name: string
    store_code: string
    hc_set: Set<string>
    penalty_count: number
    total_amount: number
  }>()

  filtered.forEach(p => {
    if (!p.store_id) return
    const existing = storeMap.get(p.store_id)
    if (existing) {
      existing.hc_set.add(p.user_id)
      existing.penalty_count++
      existing.total_amount += p.transferred_amount || 0
    } else {
      const hcSet = new Set<string>()
      hcSet.add(p.user_id)
      storeMap.set(p.store_id, {
        store_id: p.store_id,
        store_name: p.store?.nombre || '',
        store_code: p.store?.codigo || '',
        hc_set: hcSet,
        penalty_count: 1,
        total_amount: p.transferred_amount || 0
      })
    }
  })

  const by_store = Array.from(storeMap.values())
    .map(s => ({
      store_id: s.store_id,
      store_name: s.store_name,
      store_code: s.store_code,
      hc_count: s.hc_set.size,
      penalty_count: s.penalty_count,
      total_amount: s.total_amount
    }))
    .sort((a, b) => b.total_amount - a.total_amount)

  // Top HC
  const hcMap = new Map<string, {
    user_id: string
    nombre_completo: string
    codigo_asesor: string
    store_name: string
    penalty_count: number
    total_amount: number
  }>()

  filtered.forEach(p => {
    const existing = hcMap.get(p.user_id)
    if (existing) {
      existing.penalty_count++
      existing.total_amount += p.transferred_amount || 0
    } else {
      hcMap.set(p.user_id, {
        user_id: p.user_id,
        nombre_completo: p.user?.nombre_completo || '',
        codigo_asesor: p.user?.codigo_asesor || '',
        store_name: p.store?.nombre || '',
        penalty_count: 1,
        total_amount: p.transferred_amount || 0
      })
    }
  })

  const top_hc = Array.from(hcMap.values())
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 10)

  return {
    year,
    month,
    total_penalties,
    total_original_amount,
    total_transferred_amount,
    by_source,
    by_status,
    by_type,
    by_store,
    top_hc
  }
}

function calculateStatusTotal(
  penalties: HCPenalty[],
  status: 'pending' | 'applied' | 'waived' | 'disputed'
): { count: number; amount: number } {
  const filtered = penalties.filter(p => p.status === status)
  return {
    count: filtered.length,
    amount: filtered.reduce((sum, p) => sum + (p.transferred_amount || 0), 0)
  }
}

/**
 * Calcula predicción de penalidades basada en historial
 */
export function predictPenalties(
  historicalPenalties: HCPenalty[],
  userId: string,
  monthsToAnalyze: number = 6
): Array<{
  penalty_type_id: string
  penalty_code: string
  predicted_quantity: number
  predicted_amount: number
  confidence: number
}> {
  // Filtrar penalidades del usuario
  const userPenalties = historicalPenalties.filter(p => p.user_id === userId)

  if (userPenalties.length === 0) {
    return []
  }

  // Agrupar por tipo
  const byType = new Map<string, {
    penalty_type_id: string
    penalty_code: string
    monthly_quantities: number[]
    monthly_amounts: number[]
  }>()

  // Obtener los últimos N meses
  const now = new Date()
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsToAnalyze, 1)

  userPenalties.forEach(p => {
    const penaltyDate = new Date(p.year, p.month - 1, 1)
    if (penaltyDate < cutoffDate) return

    const typeId = p.penalty_type_id
    const existing = byType.get(typeId)

    if (existing) {
      existing.monthly_quantities.push(p.quantity)
      existing.monthly_amounts.push(p.transferred_amount || 0)
    } else {
      byType.set(typeId, {
        penalty_type_id: typeId,
        penalty_code: p.penalty_type?.code || '',
        monthly_quantities: [p.quantity],
        monthly_amounts: [p.transferred_amount || 0]
      })
    }
  })

  // Calcular predicciones
  return Array.from(byType.values()).map(data => {
    const avgQuantity = average(data.monthly_quantities)
    const avgAmount = average(data.monthly_amounts)
    const stdDevQuantity = standardDeviation(data.monthly_quantities)

    // Confianza basada en variabilidad
    const confidence = avgQuantity > 0
      ? Math.max(0, Math.min(1, 1 - (stdDevQuantity / avgQuantity)))
      : 0

    return {
      penalty_type_id: data.penalty_type_id,
      penalty_code: data.penalty_code,
      predicted_quantity: Math.round(avgQuantity),
      predicted_amount: Math.round(avgAmount * 100) / 100,
      confidence: Math.round(confidence * 100) / 100
    }
  }).filter(p => p.predicted_quantity > 0)
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

function standardDeviation(numbers: number[]): number {
  if (numbers.length < 2) return 0
  const avg = average(numbers)
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2))
  return Math.sqrt(average(squaredDiffs))
}

/**
 * Valida si una penalidad puede ser condonada
 */
export function canWaivePenalty(penalty: HCPenalty): {
  canWaive: boolean
  reason?: string
} {
  if (penalty.status === 'waived') {
    return { canWaive: false, reason: 'La penalidad ya está condonada' }
  }

  if (penalty.status === 'disputed') {
    return { canWaive: false, reason: 'La penalidad está en disputa' }
  }

  return { canWaive: true }
}

/**
 * Valida datos de importación
 */
export function validateImportRow(
  row: {
    userCode: string
    penaltyCode: string
    quantity: number
    originalAmount: number
  },
  validUserCodes: string[],
  validPenaltyCodes: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!row.userCode || row.userCode.trim() === '') {
    errors.push('Código de usuario vacío')
  } else if (!validUserCodes.includes(row.userCode)) {
    errors.push(`Usuario "${row.userCode}" no encontrado`)
  }

  if (!row.penaltyCode || row.penaltyCode.trim() === '') {
    errors.push('Tipo de penalidad vacío')
  } else if (!validPenaltyCodes.includes(row.penaltyCode)) {
    errors.push(`Tipo de penalidad "${row.penaltyCode}" no reconocido`)
  }

  if (row.quantity < 1) {
    errors.push('Cantidad debe ser al menos 1')
  }

  if (row.originalAmount < 0) {
    errors.push('Monto no puede ser negativo')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Detecta posibles duplicados en importación
 */
export function detectDuplicates(
  newPenalty: {
    user_id: string
    penalty_type_id: string
    year: number
    month: number
    quantity: number
  },
  existingPenalties: HCPenalty[]
): HCPenalty | null {
  return existingPenalties.find(p =>
    p.user_id === newPenalty.user_id &&
    p.penalty_type_id === newPenalty.penalty_type_id &&
    p.year === newPenalty.year &&
    p.month === newPenalty.month &&
    p.quantity === newPenalty.quantity
  ) || null
}

/**
 * Calcula estadísticas de distribución de penalidades
 */
export function calculateDistributionStats(penalties: HCPenalty[]): {
  totalCount: number
  totalAmount: number
  avgPerHC: number
  maxPerHC: { userId: string; userName: string; amount: number }
  minPerHC: { userId: string; userName: string; amount: number }
  affectedHCCount: number
} {
  if (penalties.length === 0) {
    return {
      totalCount: 0,
      totalAmount: 0,
      avgPerHC: 0,
      maxPerHC: { userId: '', userName: '', amount: 0 },
      minPerHC: { userId: '', userName: '', amount: 0 },
      affectedHCCount: 0
    }
  }

  // Agrupar por HC
  const byHC = new Map<string, {
    userId: string
    userName: string
    totalAmount: number
  }>()

  penalties.forEach(p => {
    const existing = byHC.get(p.user_id)
    if (existing) {
      existing.totalAmount += p.transferred_amount || 0
    } else {
      byHC.set(p.user_id, {
        userId: p.user_id,
        userName: p.user?.nombre_completo || '',
        totalAmount: p.transferred_amount || 0
      })
    }
  })

  const hcTotals = Array.from(byHC.values())
  const totalAmount = hcTotals.reduce((sum, hc) => sum + hc.totalAmount, 0)
  const sortedByAmount = [...hcTotals].sort((a, b) => b.totalAmount - a.totalAmount)

  return {
    totalCount: penalties.length,
    totalAmount,
    avgPerHC: totalAmount / hcTotals.length,
    maxPerHC: sortedByAmount[0] ? { userId: sortedByAmount[0].userId, userName: sortedByAmount[0].userName, amount: sortedByAmount[0].totalAmount } : { userId: '', userName: '', amount: 0 },
    minPerHC: sortedByAmount.length > 0 ? { userId: sortedByAmount[sortedByAmount.length - 1].userId, userName: sortedByAmount[sortedByAmount.length - 1].userName, amount: sortedByAmount[sortedByAmount.length - 1].totalAmount } : { userId: '', userName: '', amount: 0 },
    affectedHCCount: hcTotals.length
  }
}
