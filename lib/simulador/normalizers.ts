// ============================================================================
// NORMALIZERS - Compatibilidad Legacy para Simulador v2.0
// ============================================================================

import type {
  SchemeItemWithMapping,
  SchemeItemV2,
  SchemeForSimulation,
  SchemeForSimulationV2,
} from './types'

import type {
  CommissionItemMultiplier,
  MultiplierType,
  ActivationCriteria,
  MeasurementType,
} from '@/lib/comisiones/types'

/**
 * Candado legacy (de commission_item_locks)
 */
interface LegacyLock {
  id: string
  lock_type: string
  required_item_type_id: string | null
  required_value: number
  description: string | null
  is_active: boolean
  required_item_type?: { code: string; name: string } | null
}

/**
 * Mapea lock_type legacy a ActivationCriteria
 */
function mapLockTypeToActivation(lockType: string): ActivationCriteria {
  switch (lockType) {
    case 'min_quantity':
      return 'MIN_QUANTITY'
    case 'min_fulfillment':
      return 'OWN_ATTAINMENT'
    case 'min_percentage':
      return 'OWN_ATTAINMENT'
    case 'min_amount':
      return 'MIN_QUANTITY' // Aproximación
    default:
      return 'MIN_QUANTITY'
  }
}

/**
 * Convierte candados legacy a formato de multiplicadores
 */
export function convertLocksToMultipliers(
  locks: LegacyLock[],
  itemId: string = ''
): CommissionItemMultiplier[] {
  return locks
    .filter(lock => lock.is_active)
    .map((lock, index) => ({
      id: lock.id,
      item_id: itemId,
      multiplier_type: 'LOCK' as MultiplierType,
      activation_criteria: mapLockTypeToActivation(lock.lock_type),
      source_description: lock.description || `Candado: ${lock.lock_type}`,
      source_item_id: lock.required_item_type_id,
      threshold_value: lock.required_value,
      factor_if_met: 1,
      factor_if_not_met: 0,
      tiered_ranges: null,
      operator_cedente: null,
      measurement_type: 'UNIT_COUNT' as MeasurementType,
      measurement_config: null,
      is_active: true,
      display_order: index,
      notes: null,
      created_at: '',
      updated_at: '',
    }))
}

/**
 * Normaliza una partida v1.x a formato v2.0 con defaults
 */
export function normalizeItemToV2(item: SchemeItemWithMapping): SchemeItemV2 {
  // Determinar overcompliance_mode basado en has_cap legacy
  let overcomplianceMode: 'none' | 'proportional' | 'pxq_bonus' = 'none'
  if ('overcompliance_mode' in item && item.overcompliance_mode) {
    overcomplianceMode = item.overcompliance_mode as 'none' | 'proportional' | 'pxq_bonus'
  } else if (!item.has_cap) {
    // Si no tiene cap, el sobrecumplimiento es proporcional
    overcomplianceMode = 'proportional'
  }

  return {
    ...item,
    // v3.2 defaults
    contribution_type: (item as any).contribution_type || 'PONDERADA',
    range_source: (item as any).range_source || 'CUOTA_PROPIA',
    uses_conversion_table: (item as any).uses_conversion_table || false,
    accelerator_ranges: (item as any).accelerator_ranges || null,

    // v3.3 defaults
    measurement_type: (item as any).measurement_type || 'UNIT_COUNT',
    fulfillment_method: (item as any).fulfillment_method || 'RATIO',
    measurement_config: (item as any).measurement_config || null,

    // v3.0.1 sobrecumplimiento
    overcompliance_mode: overcomplianceMode,
    cap_units: (item as any).cap_units || null,
    pxq_bonus_amount: (item as any).pxq_bonus_amount || null,
    overcap_max_units: (item as any).overcap_max_units || null,
    overcap_max_amount: (item as any).overcap_max_amount || null,

    // v3.4 variable source
    variable_source: (item as any).variable_source || 'FROM_MIX',

    // Convertir locks a multipliers
    multipliers: (item as any).multipliers || convertLocksToMultipliers(item.locks || [], item.id),
  }
}

/**
 * Normaliza un esquema completo a formato v2.0
 */
export function normalizeSchemeToV2(scheme: SchemeForSimulation): SchemeForSimulationV2 {
  return {
    ...scheme,
    accelerator_base: (scheme as any).accelerator_base || 'VARIABLE_TEORICO',
    conversion_table: (scheme as any).conversion_table || null,
    global_range_method: (scheme as any).global_range_method || null,
    items: scheme.items.map(normalizeItemToV2),
  }
}

/**
 * Verifica si un esquema tiene campos v2.0
 */
export function isV2Scheme(scheme: SchemeForSimulation | SchemeForSimulationV2): scheme is SchemeForSimulationV2 {
  return 'accelerator_base' in scheme || scheme.items.some(item => 'multipliers' in item)
}

/**
 * Verifica si una partida tiene campos v2.0
 */
export function isV2Item(item: SchemeItemWithMapping | SchemeItemV2): item is SchemeItemV2 {
  return 'multipliers' in item && Array.isArray(item.multipliers)
}
