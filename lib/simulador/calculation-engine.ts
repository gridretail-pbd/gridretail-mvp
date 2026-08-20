// ============================================================================
// MOTOR DE CÁLCULO V2.0 - Simulador de Ingresos
// Algoritmo de 6 pasos para comisiones v3.4
// ============================================================================

import type {
  SchemeForSimulationV2,
  SchemeItemV2,
  SimulationResultV2,
  ItemDetailV2,
  MultiplierEvaluation,
  OvercomplianceResult,
  SalesData,
  HCEffectiveQuota,
  TipoVentaMapping,
} from './types'

import type {
  CommissionItemMultiplier,
  ItemCategory,
  CalculationType,
} from '@/lib/comisiones/types'

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface ItemMeasurement {
  item: SchemeItemV2
  measuredValue: number
  rawUnits: number
  quota: number
  effectiveQuota: number
}

interface ItemContribution {
  fulfillment: number
  effectiveFulfillment: number
  meetsMinimum: boolean
  baseCommission: number
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtiene el nombre efectivo de una partida (para usar como clave)
 */
export function getEffectiveItemName(item: SchemeItemV2): string {
  if (item.custom_name) return item.custom_name
  if (item.item_type?.code) return item.item_type.code
  if (item.preset?.code) return item.preset.code
  return item.id
}

/**
 * Obtiene el nombre para mostrar en UI
 */
export function getDisplayName(item: SchemeItemV2): string {
  if (item.custom_name) return item.custom_name
  if (item.item_type?.name) return item.item_type.name
  if (item.preset?.name) return item.preset.name
  return 'Partida sin nombre'
}

/**
 * Obtiene la categoría efectiva de una partida
 * Prioridad según DATA_DICTIONARY:
 * 1. Campo derivado (si ya se calculó en hooks.ts)
 * 2. preset.default_category
 * 3. item_type.category
 * 4. Default 'adicional'
 */
export function getEffectiveCategory(item: SchemeItemV2): ItemCategory {
  // Si ya tenemos el campo derivado, usarlo
  if ((item as any).category) return (item as any).category
  // Prioridad: preset > item_type > default
  if (item.preset?.default_category) return item.preset.default_category
  if (item.item_type?.category) return item.item_type.category
  return 'adicional'
}

/**
 * Obtiene el tipo de cálculo efectivo
 * Prioridad según DATA_DICTIONARY:
 * 1. Campo derivado (si ya se calculó en hooks.ts)
 * 2. preset.default_calculation_type
 * 3. item_type.calculation_type
 * 4. Default 'percentage'
 */
export function getEffectiveCalculationType(item: SchemeItemV2): CalculationType {
  // Si ya tenemos el campo derivado, usarlo
  if ((item as any).calculation_type) return (item as any).calculation_type
  // Prioridad: preset > item_type > default
  if (item.preset?.default_calculation_type) return item.preset.default_calculation_type
  if (item.item_type?.calculation_type) return item.item_type.calculation_type
  return 'percentage'
}

/**
 * Busca la escala PxQ aplicable según el cumplimiento
 */
function findApplicablePxQScale(
  scales: SchemeItemV2['pxq_scales'],
  fulfillmentPercent: number
): { amount_per_unit: number } | null {
  if (!scales || scales.length === 0) return null

  for (const scale of scales) {
    const min = scale.min_fulfillment * 100
    const max = scale.max_fulfillment ? scale.max_fulfillment * 100 : Infinity

    if (fulfillmentPercent >= min && fulfillmentPercent <= max) {
      return { amount_per_unit: scale.amount_per_unit }
    }
  }

  return null
}

// ============================================================================
// EVALUACIÓN DE MULTIPLICADORES
// ============================================================================

/**
 * Evalúa un multiplicador y retorna el factor a aplicar
 */
export function evaluateMultiplier(
  mult: CommissionItemMultiplier,
  measurement: ItemMeasurement,
  contribution: ItemContribution,
  allMeasurements: Map<string, ItemMeasurement>,
  allContributions: Map<string, ItemContribution>,
  globalFulfillment: number
): MultiplierEvaluation {
  let conditionMet = false
  let appliedFactor = mult.factor_if_not_met
  let currentValue = 0
  // threshold_value es opcional en el schema; el consumidor espera number | null
  const requiredValue = mult.threshold_value ?? null
  let description = mult.source_description

  switch (mult.activation_criteria) {
    case 'MIN_QUANTITY':
      // Cantidad mínima vendida
      currentValue = measurement.rawUnits
      conditionMet = currentValue >= (mult.threshold_value || 0)
      description = `Mín ${mult.threshold_value} unidades (actual: ${currentValue})`
      break

    case 'OWN_ATTAINMENT':
      // Cumplimiento de esta partida
      currentValue = contribution.fulfillment * 100
      conditionMet = currentValue >= (mult.threshold_value || 0)
      description = `Cumpl. ≥${mult.threshold_value}% (actual: ${currentValue.toFixed(1)}%)`
      break

    case 'OTHER_ATTAINMENT':
      // Cumplimiento de otra partida
      if (mult.source_item_id) {
        const otherContrib = allContributions.get(mult.source_item_id)
        if (otherContrib) {
          currentValue = otherContrib.fulfillment * 100
          conditionMet = currentValue >= (mult.threshold_value || 0)
          const otherMeasurement = allMeasurements.get(mult.source_item_id)
          const otherName = otherMeasurement ? getDisplayName(otherMeasurement.item) : 'Otra partida'
          description = `${otherName} ≥${mult.threshold_value}% (actual: ${currentValue.toFixed(1)}%)`
        }
      }
      break

    case 'GLOBAL_ATTAINMENT':
      // Cumplimiento global SS
      currentValue = globalFulfillment * 100
      conditionMet = currentValue >= (mult.threshold_value || 0)
      description = `SS Global ≥${mult.threshold_value}% (actual: ${currentValue.toFixed(1)}%)`
      break

    case 'ATTAINMENT_RANGE':
      // Buscar en rangos escalonados
      if (mult.tiered_ranges && mult.tiered_ranges.length > 0) {
        currentValue = contribution.fulfillment * 100
        const range = mult.tiered_ranges.find(
          r => currentValue >= r.min && (r.max === null || currentValue <= r.max)
        )
        if (range) {
          conditionMet = true
          appliedFactor = range.factor
          description = `${range.label || 'Rango'} (${currentValue.toFixed(1)}%)`
        }
      }
      break

    case 'OPERATOR_ORIGIN':
      // % de ventas de un operador específico
      // TODO: Requiere datos detallados de operador por venta
      conditionMet = false
      description = `Origen ${mult.operator_cedente || 'operador'} (no implementado)`
      break
  }

  // Aplicar factor si cumple condición (excepto ATTAINMENT_RANGE que ya lo asignó)
  if (mult.activation_criteria !== 'ATTAINMENT_RANGE') {
    appliedFactor = conditionMet ? mult.factor_if_met : mult.factor_if_not_met
  }

  return {
    multiplier: mult,
    conditionMet,
    appliedFactor,
    currentValue,
    requiredValue,
    description,
  }
}

// ============================================================================
// CÁLCULO DE SOBRECUMPLIMIENTO
// ============================================================================

/**
 * Calcula el bono por sobrecumplimiento
 */
export function calculateOvercompliance(
  item: SchemeItemV2,
  fulfillment: number,
  sales: number,
  quota: number,
  baseCommission: number
): OvercomplianceResult | null {
  // Solo aplica si hay sobrecumplimiento
  if (fulfillment <= 1 || item.overcompliance_mode === 'none') {
    return null
  }

  const unitsOverQuota = sales - quota

  switch (item.overcompliance_mode) {
    case 'proportional': {
      // Comisión continúa proporcional
      let bonusUnits = unitsOverQuota
      let bonusCommission = 0

      // Aplicar tope de unidades si existe
      if (item.cap_units && bonusUnits > item.cap_units) {
        bonusUnits = item.cap_units
      }

      // Calcular comisión adicional proporcional
      if (quota > 0) {
        bonusCommission = (bonusUnits / quota) * item.variable_amount
      }

      // Aplicar tope de monto si existe
      if (item.overcap_max_amount && bonusCommission > item.overcap_max_amount) {
        bonusCommission = item.overcap_max_amount
      }

      return {
        mode: 'proportional',
        baseCommission,
        bonusCommission,
        bonusUnits: unitsOverQuota,
        cappedUnits: bonusUnits,
        cappedAmount: bonusCommission,
        totalCommission: baseCommission + bonusCommission,
      }
    }

    case 'pxq_bonus': {
      // Pago por unidad extra
      if (!item.pxq_bonus_amount) return null

      let bonusUnits = unitsOverQuota

      // Aplicar tope de unidades
      if (item.overcap_max_units && bonusUnits > item.overcap_max_units) {
        bonusUnits = item.overcap_max_units
      }

      let bonusCommission = bonusUnits * item.pxq_bonus_amount

      // Aplicar tope de monto
      if (item.overcap_max_amount && bonusCommission > item.overcap_max_amount) {
        bonusCommission = item.overcap_max_amount
      }

      return {
        mode: 'pxq_bonus',
        baseCommission,
        bonusCommission,
        bonusUnits: unitsOverQuota,
        cappedUnits: bonusUnits,
        cappedAmount: bonusCommission,
        totalCommission: baseCommission + bonusCommission,
      }
    }

    default:
      return null
  }
}

// ============================================================================
// MOTOR PRINCIPAL DE CÁLCULO
// ============================================================================

/**
 * Motor de cálculo de comisiones v2.0
 * Sigue el algoritmo universal de 6 pasos
 */
export function calculateCommissionV2(
  scheme: SchemeForSimulationV2,
  salesData: SalesData,
  hcQuota?: HCEffectiveQuota
): SimulationResultV2 {
  const steps: string[] = []
  const details: ItemDetailV2[] = []

  // Factor de prorrateo
  const prorationFactor = hcQuota?.proration_factor ?? 1
  steps.push(`Prorrateo: ${(prorationFactor * 100).toFixed(1)}%`)

  // Acumuladores por tipo de contribución
  let variableCommission = 0
  let acceleratorAdjustment = 0
  let pxqCommission = 0
  let bonusCommission = 0
  let additionalCommission = 0
  let overcomplianceBonus = 0

  // Totales para cumplimiento global
  let totalSSQuota = 0
  let totalSSSales = 0

  // =========================================================================
  // PASO 1: Medir logro por partida
  // =========================================================================
  steps.push('Paso 1: Medir logro por partida')

  const itemMeasurements: Map<string, ItemMeasurement> = new Map()

  for (const item of scheme.items) {
    if (!item.is_active) continue

    const itemName = getEffectiveItemName(item)
    const rawUnits = salesData[itemName] || 0

    // Determinar cuota (de hc_quotas o del esquema)
    let quota = item.quota || 0
    if (hcQuota?.has_quota && hcQuota.quota_breakdown[itemName]) {
      quota = hcQuota.quota_breakdown[itemName]
    }
    const effectiveQuota = Math.round(quota * prorationFactor * 10) / 10

    // Medir según measurement_type
    let measuredValue = rawUnits // Default: UNIT_COUNT

    if (item.measurement_type === 'AVERAGE_VALUE' && item.measurement_config) {
      // TODO: Calcular promedio desde datos detallados
      measuredValue = rawUnits
    } else if (item.measurement_type === 'TOTAL_VALUE' && item.measurement_config) {
      // TODO: Calcular suma desde datos detallados
      measuredValue = rawUnits
    } else if (item.measurement_type === 'RATE' && item.measurement_config) {
      // TODO: Calcular ratio desde datos detallados
      measuredValue = rawUnits
    }

    itemMeasurements.set(item.id, {
      item,
      measuredValue,
      rawUnits,
      quota,
      effectiveQuota,
    })

    // Acumular para cumplimiento global SS (solo partidas principales)
    if (getEffectiveCategory(item) === 'principal') {
      totalSSQuota += effectiveQuota
      totalSSSales += measuredValue
    }
  }

  // =========================================================================
  // PASO 2: Calcular contribución según contribution_type
  // =========================================================================
  steps.push('Paso 2: Calcular contribución por tipo')

  const itemContributions: Map<string, ItemContribution> = new Map()

  for (const [itemId, measurement] of itemMeasurements) {
    const { item, measuredValue, effectiveQuota } = measurement

    // Calcular cumplimiento según fulfillment_method
    let fulfillment = 0
    if (item.fulfillment_method === 'RATIO' && effectiveQuota > 0) {
      fulfillment = measuredValue / effectiveQuota
    } else if (item.fulfillment_method === 'ABSOLUTE_RANGES') {
      // Valor directo busca en rangos, normalizar para compatibilidad
      fulfillment = measuredValue / 100
    }

    // Verificar mínimo
    const minFulfillment = item.min_fulfillment || scheme.default_min_fulfillment || 0
    const meetsMinimum = fulfillment >= minFulfillment

    // Efectivo fulfillment (capeado si no hay overcompliance)
    let effectiveFulfillment = fulfillment
    if (item.overcompliance_mode === 'none' && fulfillment > 1) {
      effectiveFulfillment = 1
    }

    // Calcular comisión base según contribution_type
    let baseCommission = 0

    if (meetsMinimum) {
      const calcType = getEffectiveCalculationType(item)

      switch (item.contribution_type) {
        case 'PONDERADA':
          // Comisión = variable_amount × cumplimiento efectivo (hasta 100% para base)
          const cappedFulfillment = Math.min(effectiveFulfillment, 1)
          baseCommission = item.variable_amount * cappedFulfillment
          break

        case 'PXQ_INDEPENDIENTE':
          // Buscar escala aplicable
          if (item.pxq_scales?.length) {
            const scale = findApplicablePxQScale(item.pxq_scales, fulfillment * 100)
            if (scale) {
              baseCommission = measurement.rawUnits * scale.amount_per_unit
            }
          }
          break

        case 'BONO':
          // Todo o nada
          baseCommission = fulfillment >= 1 ? item.variable_amount : 0
          break

        case 'ACELERADOR':
          // Se calcula después usando accelerator_ranges
          if (item.accelerator_ranges?.ranges) {
            const range = item.accelerator_ranges.ranges.find(
              r => fulfillment * 100 >= r.min && fulfillment * 100 <= r.max
            )
            if (range) {
              // El efecto se aplica sobre el variable base (se calcula en paso 4)
              baseCommission = 0 // Se asignará después
            }
          }
          break
      }
    }

    itemContributions.set(itemId, {
      fulfillment,
      effectiveFulfillment,
      meetsMinimum,
      baseCommission,
    })
  }

  // =========================================================================
  // PASO 3: Sumar ponderadas → variable base
  // =========================================================================
  steps.push('Paso 3: Sumar comisiones ponderadas')

  let variableBase = 0
  for (const [itemId, contribution] of itemContributions) {
    const measurement = itemMeasurements.get(itemId)
    if (measurement && measurement.item.contribution_type === 'PONDERADA') {
      variableBase += contribution.baseCommission
    }
  }

  // =========================================================================
  // PASO 4: Evaluar multiplicadores
  // =========================================================================
  steps.push('Paso 4: Evaluar multiplicadores')

  // Calcular cumplimiento global (necesario para GLOBAL_ATTAINMENT)
  const globalFulfillment = totalSSQuota > 0 ? totalSSSales / totalSSQuota : 0

  const itemMultiplierResults: Map<
    string,
    {
      evaluations: MultiplierEvaluation[]
      combinedFactor: number
      hasBlocking: boolean
      adjustedCommission: number
    }
  > = new Map()

  for (const [itemId, measurement] of itemMeasurements) {
    const { item } = measurement
    const contribution = itemContributions.get(itemId)!

    const evaluations: MultiplierEvaluation[] = []
    let combinedFactor = 1
    let hasBlocking = false

    for (const mult of item.multipliers) {
      if (!mult.is_active) continue

      const evaluation = evaluateMultiplier(
        mult,
        measurement,
        contribution,
        itemMeasurements,
        itemContributions,
        globalFulfillment
      )

      evaluations.push(evaluation)
      combinedFactor *= evaluation.appliedFactor

      if (evaluation.appliedFactor === 0) {
        hasBlocking = true
      }
    }

    // Aplicar factor combinado a la comisión base
    const adjustedCommission = contribution.baseCommission * combinedFactor

    itemMultiplierResults.set(itemId, {
      evaluations,
      combinedFactor,
      hasBlocking,
      adjustedCommission,
    })
  }

  // Calcular ajuste de aceleradores
  for (const [itemId, measurement] of itemMeasurements) {
    const { item } = measurement
    const contribution = itemContributions.get(itemId)!

    if (item.contribution_type === 'ACELERADOR' && item.accelerator_ranges?.ranges) {
      const range = item.accelerator_ranges.ranges.find(
        r => contribution.fulfillment * 100 >= r.min && contribution.fulfillment * 100 <= r.max
      )
      if (range) {
        // El efecto es sobre el variable base
        const baseForAccelerator =
          scheme.accelerator_base === 'VARIABLE_TEORICO' ? scheme.variable_salary : variableBase

        acceleratorAdjustment += baseForAccelerator * (range.pct_effect / 100)
      }
    }
  }

  // =========================================================================
  // PASO 5: Calcular sobrecumplimiento
  // =========================================================================
  steps.push('Paso 5: Calcular sobrecumplimiento')

  const itemOvercompliance: Map<string, OvercomplianceResult | null> = new Map()

  for (const [itemId, measurement] of itemMeasurements) {
    const { item, measuredValue, effectiveQuota } = measurement
    const contribution = itemContributions.get(itemId)!
    const multiplierResult = itemMultiplierResults.get(itemId)!

    let overcompResult: OvercomplianceResult | null = null

    // Solo si cumple mínimo y no está bloqueado
    if (contribution.meetsMinimum && !multiplierResult.hasBlocking) {
      overcompResult = calculateOvercompliance(
        item,
        contribution.fulfillment,
        measuredValue,
        effectiveQuota,
        multiplierResult.adjustedCommission
      )

      if (overcompResult && overcompResult.bonusCommission > 0) {
        overcomplianceBonus += overcompResult.bonusCommission
      }
    }

    itemOvercompliance.set(itemId, overcompResult)
  }

  // =========================================================================
  // PASO 6: Calcular neto
  // =========================================================================
  steps.push('Paso 6: Calcular totales')

  // Construir detalles y acumular totales
  for (const [itemId, measurement] of itemMeasurements) {
    const { item, measuredValue, rawUnits, quota, effectiveQuota } = measurement
    const contribution = itemContributions.get(itemId)!
    const multiplierResult = itemMultiplierResults.get(itemId)!
    const overcompResult = itemOvercompliance.get(itemId)

    const category = getEffectiveCategory(item)
    const bonusFromOvercomp = overcompResult?.bonusCommission || 0
    const finalCommission = multiplierResult.adjustedCommission + bonusFromOvercomp

    // Acumular por categoría Y tipo de contribución
    // La categoría (principal, adicional, pxq, bono) determina el bucket principal
    // El contribution_type modifica el comportamiento dentro del bucket
    if (item.variable_source === 'FIXED_EXTRA') {
      additionalCommission += finalCommission
    } else {
      // Usar categoría como criterio principal de agrupación
      switch (category) {
        case 'principal':
          // Partidas principales → Variable (Principales)
          if (item.contribution_type === 'ACELERADOR') {
            // Los aceleradores ya se calcularon en acceleratorAdjustment
          } else {
            variableCommission += finalCommission
          }
          break
        case 'adicional':
          // Partidas adicionales (RENO, PACK, etc.) → Adicionales
          additionalCommission += finalCommission
          break
        case 'pxq':
          // Partidas PxQ → PxQ
          pxqCommission += finalCommission
          break
        case 'bono':
          // Bonos → Bonos
          bonusCommission += finalCommission
          break
        case 'postventa':
          // Postventa se agrupa con adicionales
          additionalCommission += finalCommission
          break
        default:
          // Por defecto, usar el contribution_type como fallback
          switch (item.contribution_type) {
            case 'PONDERADA':
              variableCommission += finalCommission
              break
            case 'PXQ_INDEPENDIENTE':
              pxqCommission += finalCommission
              break
            case 'BONO':
              bonusCommission += finalCommission
              break
            default:
              additionalCommission += finalCommission
          }
      }
    }

    // Construir detalle
    details.push({
      id: itemId,
      name: getDisplayName(item),
      itemTypeCode: item.item_type?.code || null,
      presetCode: item.preset?.code || null,
      customName: item.custom_name,
      category,
      calculationType: getEffectiveCalculationType(item),
      contributionType: item.contribution_type,
      measurementType: item.measurement_type,
      variableSource: item.variable_source,
      quota,
      effectiveQuota,
      weight: item.weight,
      variableAmount: item.variable_amount,
      sales: measuredValue,
      salesRaw: rawUnits,
      fulfillment: contribution.fulfillment,
      effectiveFulfillment: contribution.effectiveFulfillment,
      meetsMinimum: contribution.meetsMinimum,
      minFulfillment: item.min_fulfillment || scheme.default_min_fulfillment || 0,
      multipliersEvaluated: multiplierResult.evaluations,
      combinedMultiplierFactor: multiplierResult.combinedFactor,
      hasBlockingMultiplier: multiplierResult.hasBlocking,
      overcomplianceResult: overcompResult ?? null,
      restrictionApplied: false,
      restrictionDetail: null,
      baseCommission: contribution.baseCommission,
      adjustedCommission: multiplierResult.adjustedCommission,
      bonusFromOvercompliance: bonusFromOvercomp,
      commission: finalCommission,
      tiposVentaMapeados: item.mapped_tipos_venta,
    })
  }

  // Calcular totales
  const totalGross =
    scheme.fixed_salary +
    variableCommission +
    acceleratorAdjustment +
    pxqCommission +
    bonusCommission +
    additionalCommission +
    overcomplianceBonus

  return {
    fixedSalary: scheme.fixed_salary,
    variableCommission,
    acceleratorAdjustment,
    pxqCommission,
    bonusCommission,
    additionalCommission,
    overcomplianceBonus,
    totalGross,
    predictedPenalties: 0, // Se calcula aparte
    totalNet: totalGross,
    globalFulfillment,
    globalSSQuota: totalSSQuota,
    globalSSSales: totalSSSales,
    details,
    quotaInfo: hcQuota
      ? {
          source: hcQuota.has_quota ? 'hc_quotas' : 'scheme_fallback',
          proration_factor: prorationFactor,
          effective_quota: hcQuota.effective_quota,
          start_date: hcQuota.start_date,
        }
      : undefined,
    calculationMetadata: {
      schemeType: scheme.scheme_type,
      acceleratorBase: scheme.accelerator_base || 'VARIABLE_TEORICO',
      totalMultiplierFactors:
        details.length > 0
          ? details.reduce((sum, d) => sum + d.combinedMultiplierFactor, 0) / details.length
          : 1,
      hasConversionTable: scheme.conversion_table !== null,
      calculationSteps: steps,
    },
  }
}
