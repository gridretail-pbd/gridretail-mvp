// ============================================================================
// TIPOS DEL SIMULADOR DE INGRESOS - GridRetail
// v1.2 - Integración con Módulo de Cuotas
// ============================================================================

import type {
  ItemCategory,
  CalculationType,
  CommissionSchemeItem,
  CommissionItemType,
  PartitionPreset,
  TipoVenta,
} from '@/lib/comisiones/types'

// ============================================================================
// TIPOS DE CUOTAS HC (v1.2 NUEVO)
// ============================================================================

/**
 * Desglose de cuota por partida
 * Clave: código de partida (ej: "OSS", "VR_BASE")
 */
export interface QuotaBreakdown {
  [partitionCode: string]: number
}

/**
 * Cuota de un HC (datos de hc_quotas)
 */
export interface HCQuota {
  id: string
  user_id: string
  store_quota_id: string
  store_id: string
  year: number
  month: number
  ss_quota: number                      // Cuota nominal
  quota_breakdown: QuotaBreakdown       // Desglose por partida
  start_date: string | null             // Para prorrateo
  proration_factor: number              // 0-1
  prorated_ss_quota: number | null      // Cuota prorrateada
  status: 'draft' | 'pending_approval' | 'approved' | 'archived'
}

/**
 * Cuota efectiva del HC (resultado de get_hc_effective_quota RPC)
 * Incluye prorrateo calculado
 */
export interface HCEffectiveQuota {
  ss_quota: number                      // Cuota nominal asignada
  effective_quota: number               // Cuota con prorrateo aplicado
  proration_factor: number              // Factor 0-1
  quota_breakdown: QuotaBreakdown       // Desglose por partida
  effective_breakdown: QuotaBreakdown   // Desglose con prorrateo aplicado
  start_date: string | null             // Fecha inicio si hay prorrateo
  store_id: string
  store_name: string
  user_name: string
  has_quota: boolean                    // false si usa fallback del esquema
}

/**
 * Info de cuota en resultado de simulación
 */
export interface QuotaInfo {
  source: 'hc_quotas' | 'scheme_fallback'
  proration_factor: number
  effective_quota: number
  start_date: string | null
}

// ============================================================================
// TIPOS DE PERFIL DE VENTAS
// ============================================================================

/**
 * Perfiles de venta predefinidos
 */
export type SalesProfile = 'average' | 'top20' | 'new' | 'quota100' | 'custom'

/**
 * Multiplicadores por perfil
 */
export const PROFILE_MULTIPLIERS: Record<SalesProfile, number> = {
  average: 0.75,   // HC promedio - 75% de cuota
  top20: 1.15,     // Top 20% performers - 115% de cuota
  new: 0.50,       // Nuevo ingreso - 50% de cuota
  quota100: 1.00,  // Cumple exacto - 100% de cuota
  custom: 1.00,    // Personalizado (se ajusta manualmente)
}

/**
 * Labels de perfiles para UI
 */
export const PROFILE_LABELS: Record<SalesProfile, string> = {
  average: 'Promedio (75%)',
  top20: 'Top 20% (115%)',
  new: 'Nuevo ingreso (50%)',
  quota100: 'Cuota 100%',
  custom: 'Personalizado',
}

/**
 * Descripciones de perfiles
 */
export const PROFILE_DESCRIPTIONS: Record<SalesProfile, string> = {
  average: 'Simula un HC con desempeño promedio, alcanzando el 75% de cada meta',
  top20: 'Simula un HC top performer, superando las metas en 115%',
  new: 'Simula un HC nuevo con curva de aprendizaje, 50% de metas',
  quota100: 'Simula cumplimiento exacto de todas las metas',
  custom: 'Ingresa las cantidades manualmente para cada partida',
}

// ============================================================================
// TIPOS DE DATOS DE ENTRADA
// ============================================================================

/**
 * Datos de venta por partida
 * Clave: nombre efectivo de la partida (custom_name || item_type.code || preset.code)
 */
export interface SalesData {
  [partitionName: string]: number
}

/**
 * Desglose de ventas por plan (para restricciones)
 */
export interface PlanBreakdown {
  [planCode: string]: number
}

/**
 * Input completo para simulación
 */
export interface SimulationInput {
  schemeId: string
  salesData: SalesData
  planBreakdown?: PlanBreakdown
  userId?: string                       // Para predicción de penalidades
  includePenalties?: boolean
  hcQuota?: HCEffectiveQuota            // v1.2: Cuota del HC con prorrateo
}

// ============================================================================
// TIPOS DE RESULTADO DE SIMULACIÓN
// ============================================================================

/**
 * Resultado principal de simulación
 */
export interface SimulationResult {
  fixedSalary: number
  variableCommission: number
  pxqCommission: number
  bonusCommission: number
  additionalCommission: number
  totalGross: number
  predictedPenalties: number
  totalNet: number
  globalFulfillment: number
  details: ItemDetail[]
  quotaInfo?: QuotaInfo                 // v1.2: Info de cuota usada en simulación
}

/**
 * Mapeo de tipo de venta a partida (v2.1)
 */
export interface TipoVentaMapping {
  tipoVentaId: string
  codigo: string
  nombre: string
  categoria: string
  cuentaLinea: boolean
  cuentaEquipo: boolean
}

/**
 * Detalle de una partida en la simulación
 */
export interface ItemDetail {
  id: string                                        // scheme_item_id
  name: string                                       // custom_name || item_type.name || preset.name
  itemTypeCode: string | null                        // Puede ser null si es partida custom
  presetCode: string | null                          // Código del preset usado
  customName: string | null                          // Nombre personalizado
  category: ItemCategory
  calculationType: CalculationType
  tiposVentaMapeados: TipoVentaMapping[]            // Tipos de venta que suman a esta partida
  quota: number | null                              // Meta nominal (del esquema o hc_quotas)
  effectiveQuota: number | null                     // v1.2: Meta con prorrateo aplicado
  weight: number | null
  variableAmount: number
  sales: number
  fulfillment: number
  effectiveFulfillment: number
  meetsMinimum: boolean
  minFulfillment: number
  lockUnlocked: boolean
  lockPending: LockStatus[]
  restrictionApplied: boolean
  restrictionDetail: string | null
  effectiveSales: number
  hasCap: boolean
  capPercentage: number | null
  commission: number
}

/**
 * Estado de un candado
 */
export interface LockStatus {
  lockType: string
  requiredValue: number
  currentValue: number
  description: string
  isUnlocked: boolean
}

/**
 * Predicción de penalidad
 */
export interface PenaltyPrediction {
  penaltyCode: string
  penaltyName: string
  predictedQuantity: number
  predictedAmount: number
  confidence: number // 0.00 - 1.00
}

// ============================================================================
// TIPOS PARA ESCENARIOS (COMPARACIÓN)
// ============================================================================

/**
 * Escenario de simulación (para comparaciones)
 */
export interface Scenario {
  id: string
  name: string
  schemeId: string
  schemeName: string
  profile: SalesProfile
  salesData: SalesData
  result: SimulationResult | null
  createdAt: Date
}

/**
 * Comparación entre dos escenarios
 */
export interface ScenarioComparison {
  scenarioA: Scenario
  scenarioB: Scenario
  differences: ScenarioDifference[]
  totalDifference: number
  percentageDifference: number
}

/**
 * Diferencia entre escenarios por concepto
 */
export interface ScenarioDifference {
  concept: string
  amountA: number
  amountB: number
  difference: number
  percentageChange: number
}

// ============================================================================
// TIPOS PARA PARTIDAS CON MAPEO (v2.1)
// ============================================================================

/**
 * Partida con toda la información de mapeo
 * Usado en queries y componentes
 */
export interface SchemeItemWithMapping {
  id: string
  scheme_id: string
  item_type_id: string | null
  preset_id: string | null
  custom_name: string | null
  custom_description: string | null
  quota: number | null
  quota_amount: number | null
  weight: number | null
  mix_factor: number | null
  variable_amount: number
  min_fulfillment: number | null
  has_cap: boolean
  cap_percentage: number | null
  cap_amount: number | null
  is_active: boolean
  display_order: number
  notes: string | null
  // Datos joinados
  item_type?: {
    code: string
    name: string
    category: ItemCategory
    calculation_type: CalculationType
  } | null
  preset?: {
    code: string
    name: string
    short_name: string | null
    default_category: ItemCategory
    default_calculation_type: CalculationType
  } | null
  mapped_tipos_venta: TipoVentaMapping[]
  // Candados
  locks?: Array<{
    id: string
    lock_type: string
    required_item_type_id: string | null
    required_value: number
    description: string | null
    is_active: boolean
    required_item_type?: { code: string; name: string } | null
  }>
  // Escalas PxQ
  pxq_scales?: Array<{
    id: string
    min_fulfillment: number
    max_fulfillment: number | null
    amount_per_unit: number
    display_order: number
  }>
}

/**
 * Esquema con partidas para simulación
 */
export interface SchemeForSimulation {
  id: string
  name: string
  code: string
  scheme_type: 'asesor' | 'supervisor' | 'encargado'
  year: number
  month: number
  status: string
  fixed_salary: number
  variable_salary: number
  total_ss_quota: number
  default_min_fulfillment: number | null
  items: SchemeItemWithMapping[]
}

// ============================================================================
// TIPOS PARA ENTRADA DE DATOS DE VENTA
// ============================================================================

/**
 * Fila de la tabla de entrada de ventas
 */
export interface SalesInputRow {
  itemId: string
  itemName: string
  itemCode: string | null
  category: ItemCategory
  quota: number | null
  currentSales: number
  fulfillment: number
  tiposVenta: string[] // Códigos de tipos de venta mapeados
}

/**
 * Fuente de datos de venta
 */
export type SalesDataSource = 'inar' | 'bu' | 'manual'

/**
 * Información de carga de datos reales
 */
export interface RealSalesInfo {
  source: SalesDataSource
  loadedAt: Date
  period: {
    year: number
    month: number
  }
  userId?: string
  userName?: string
}

// ============================================================================
// TIPOS PARA PROYECCIÓN DE COSTOS
// ============================================================================

/**
 * Proyección de costos para el SSNN
 */
export interface CostProjection {
  schemeId: string
  schemeName: string
  totalHC: number
  profile: SalesProfile
  totals: {
    fixedSalary: number
    variableCommission: number
    pxqCommission: number
    bonusCommission: number
    totalGross: number
    socialCharges: number // Cargas sociales estimadas
    totalCost: number
  }
  averages: {
    fixedSalary: number
    variableCommission: number
    pxqCommission: number
    bonusCommission: number
    totalGross: number
    totalCost: number
  }
  byStore?: StoreProjection[]
}

/**
 * Proyección por tienda
 */
export interface StoreProjection {
  storeId: string
  storeName: string
  hcCount: number
  fixedCost: number
  variableCost: number
  totalCost: number
  percentageOfTotal: number
}

// ============================================================================
// TIPOS PARA "MI COMISIÓN" (HC PERSONAL)
// ============================================================================

/**
 * Progreso del HC en el mes
 */
export interface HCProgress {
  totalQuota: number                    // Cuota nominal
  effectiveQuota: number                // v1.2: Cuota con prorrateo
  currentSales: number
  fulfillment: number
  remainingDays: number
  neededPerDay: number
  prorationFactor: number               // v1.2: Factor de prorrateo
  startDate: string | null              // v1.2: Fecha de inicio (si hay prorrateo)
}

/**
 * Simulación "¿Qué pasa si?"
 */
export interface WhatIfResult {
  additionalSales: number
  itemName: string
  currentProjection: number
  newProjection: number
  difference: number
}

// ============================================================================
// CONSTANTES DE UI
// ============================================================================

/**
 * Colores de indicador de cumplimiento
 */
export const FULFILLMENT_COLORS = {
  critical: 'text-red-600 bg-red-50',      // 0-49%
  warning: 'text-yellow-600 bg-yellow-50', // 50-79%
  good: 'text-green-600 bg-green-50',      // 80-99%
  excellent: 'text-emerald-700 bg-emerald-50', // 100%+
} as const

/**
 * Obtiene el color según el porcentaje de cumplimiento
 */
export function getFulfillmentColor(fulfillment: number): string {
  if (fulfillment < 0.5) return FULFILLMENT_COLORS.critical
  if (fulfillment < 0.8) return FULFILLMENT_COLORS.warning
  if (fulfillment < 1) return FULFILLMENT_COLORS.good
  return FULFILLMENT_COLORS.excellent
}

/**
 * Colores para barra de progreso
 */
export const PROGRESS_BAR_COLORS = {
  critical: 'bg-red-500',
  warning: 'bg-yellow-500',
  good: 'bg-green-500',
  excellent: 'bg-emerald-500',
} as const

/**
 * Obtiene color de barra según cumplimiento
 */
export function getProgressBarColor(fulfillment: number): string {
  if (fulfillment < 0.5) return PROGRESS_BAR_COLORS.critical
  if (fulfillment < 0.8) return PROGRESS_BAR_COLORS.warning
  if (fulfillment < 1) return PROGRESS_BAR_COLORS.good
  return PROGRESS_BAR_COLORS.excellent
}
