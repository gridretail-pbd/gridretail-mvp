// ============================================================================
// TIPOS DEL MÓDULO DE COMISIONES - GridRetail
// ============================================================================

// Estados de esquema
export type SchemeStatus = 'oficial' | 'draft' | 'aprobado' | 'archivado'

// Tipo de esquema (para quién aplica)
export type SchemeType = 'asesor' | 'supervisor' | 'encargado'

// Categoría de partida
export type ItemCategory = 'principal' | 'adicional' | 'pxq' | 'postventa' | 'bono'

// Tipo de cálculo de comisión
export type CalculationType = 'percentage' | 'pxq' | 'binary' | 'fixed'

// Grupo de preset (para UI)
export type PresetGroup = 'agrupacion' | 'individual'

// Tipo de candado (condición para comisionar) — legacy
export type LockType = 'min_quantity' | 'min_amount' | 'min_percentage' | 'min_fulfillment'

// Tipo de restricción
export type RestrictionType = 'max_percentage' | 'max_quantity' | 'min_percentage' | 'operator_origin'

// Origen del esquema
export type SchemeSource = 'entel' | 'socio'

// v3.2: Tipo de contribución de partida
export type ContributionType = 'PONDERADA' | 'ACELERADOR' | 'PXQ_INDEPENDIENTE' | 'BONO'

// v3.2: Fuente de rango
export type RangeSource = 'CUOTA_PROPIA' | 'VOLUMEN_GLOBAL' | 'CUOTA_GLOBAL_SS'

// v3.0.1: Modo de sobrecumplimiento
export type OvercomplianceMode = 'none' | 'proportional' | 'pxq_bonus'

// v3.3: Tipo de medición
export type MeasurementType = 'UNIT_COUNT' | 'AVERAGE_VALUE' | 'TOTAL_VALUE' | 'RATE' | 'MANUAL'

// v3.3: Método de cumplimiento
export type FulfillmentMethod = 'RATIO' | 'ABSOLUTE_RANGES'

// v3.2: Tipo de multiplicador
export type MultiplierType = 'LOCK' | 'ACCELERATOR' | 'DECELERATOR' | 'PROPORTIONAL' | 'CROSS_PRODUCT' | 'TIERED'

// v3.2: Criterio de activación de multiplicador
export type ActivationCriteria = 'MIN_QUANTITY' | 'OWN_ATTAINMENT' | 'OTHER_ATTAINMENT' | 'GLOBAL_ATTAINMENT' | 'ATTAINMENT_RANGE' | 'OPERATOR_ORIGIN'

// v3.3: Tipo de medición para multiplicadores (subconjunto)
export type MultiplierMeasurementType = 'UNIT_COUNT' | 'RATE' | 'AVERAGE_VALUE' | 'MANUAL'

// v3.2: Método de rango global
export type GlobalRangeMethod = 'VOLUMEN_TOTAL' | null

// v3.3: Base de aceleradores
export type AcceleratorBase = 'VARIABLE_TEORICO' | 'VARIABLE_CALCULADO'

// v3.4: Fuente del monto variable (para partidas Adicional)
export type VariableSource = 'FROM_MIX' | 'FIXED_EXTRA'

// ============================================================================
// INTERFACES v3.2/v3.3
// ============================================================================

export interface ConversionTableRange {
  min: number
  max: number
  effective: number | string // number o "+10" para sin tope
  label?: string
}

export interface ConversionTable {
  description?: string
  ranges: ConversionTableRange[]
}

export interface AcceleratorRange {
  min: number
  max: number
  pct_effect: number
  label?: string
}

export interface AcceleratorRanges {
  source_item_name?: string
  ranges: AcceleratorRange[]
}

export interface MeasurementConfig {
  value_field?: string
  condition_field?: string
  condition_value?: boolean | string | number
  scope_tipos_venta?: string[]
  description?: string
}

export interface TieredRange {
  min: number
  max: number
  factor: number
  label?: string
}

// ============================================================================
// INTERFACES PRINCIPALES
// ============================================================================

/**
 * Esquema de comisiones
 * Tabla: commission_schemes
 */
export interface CommissionScheme {
  id: string
  name: string
  code: string
  description?: string | null
  scheme_type: SchemeType
  year: number
  month: number
  status: SchemeStatus
  source: SchemeSource
  parent_scheme_id?: string | null
  fixed_salary: number
  variable_salary: number
  total_ss_quota: number
  default_min_fulfillment?: number | null
  source_file_name?: string | null
  source_file_url?: string | null
  ai_interpretation_log?: Record<string, unknown> | null
  // v3.2
  conversion_table?: ConversionTable | null
  global_range_method?: GlobalRangeMethod
  // v3.3
  accelerator_base?: AcceleratorBase
  approved_by?: string | null
  approved_at?: string | null
  approval_notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

/**
 * Tipo de partida (catálogo)
 * Tabla: commission_item_types
 */
export interface CommissionItemType {
  id: string
  code: string
  name: string
  short_name?: string | null
  category: ItemCategory
  calculation_type: CalculationType
  group_code?: string | null
  parent_type_id?: string | null
  tipos_venta_codigos?: string[] | null
  counts_to_ss_quota: boolean
  allows_overcap: boolean
  also_counts_as?: string[] | null
  description?: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Tipo de venta (catálogo)
 * Tabla: tipos_venta
 */
export interface TipoVenta {
  id: string
  codigo: string
  nombre: string
  categoria: string
  fuente_validacion?: string
  requiere_cedente: boolean
  requiere_imei: boolean
  requiere_iccid: boolean
  permite_seguro: boolean
  descripcion_ayuda?: string | null
  activo: boolean
  orden: number
  created_at: string
}

/**
 * Preset de partida (catálogo de configuraciones predefinidas)
 * Tabla: partition_presets
 */
export interface PartitionPreset {
  id: string
  code: string
  name: string
  short_name?: string | null
  description?: string | null
  default_category: ItemCategory
  default_calculation_type: CalculationType
  preset_group: PresetGroup
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Populated from join
  tipos_venta?: PresetTipoVenta[]
}

/**
 * Mapeo preset → tipo_venta
 * Tabla: partition_preset_ventas
 */
export interface PresetTipoVenta {
  tipo_venta_id: string
  codigo: string
  nombre: string
  categoria: string
  cuenta_linea: boolean
  cuenta_equipo: boolean
}

/**
 * Mapeo partida → tipo_venta
 * Tabla: commission_item_ventas
 */
export interface CommissionItemVenta {
  id: string
  scheme_item_id: string
  tipo_venta_id: string
  cuenta_linea: boolean
  cuenta_equipo: boolean
  created_at: string
  // Populated from join
  tipo_venta?: TipoVenta
}

/**
 * Partida de un esquema
 * Tabla: commission_scheme_items
 */
export interface CommissionSchemeItem {
  id: string
  scheme_id: string
  item_type_id?: string | null
  item_type?: CommissionItemType // joined
  preset_id?: string | null
  preset?: PartitionPreset // joined
  custom_name?: string | null
  custom_description?: string | null
  original_label?: string | null
  quota?: number | null
  quota_amount?: number | null
  weight?: number | null
  mix_factor?: number | null
  variable_amount: number
  min_fulfillment?: number | null
  has_cap: boolean
  cap_percentage?: number | null
  cap_amount?: number | null
  // v3.2
  contribution_type?: ContributionType
  range_source?: RangeSource
  uses_conversion_table?: boolean
  accelerator_ranges?: AcceleratorRanges | null
  // v3.3
  measurement_type?: MeasurementType
  fulfillment_method?: FulfillmentMethod
  measurement_config?: MeasurementConfig | null
  // v3.0.1: Sobrecumplimiento
  overcompliance_mode?: OvercomplianceMode
  cap_units?: number | null
  pxq_bonus_amount?: number | null
  overcap_max_units?: number | null
  overcap_max_amount?: number | null
  // v3.4: Fuente del variable para Adicionales
  variable_source?: VariableSource
  is_active: boolean
  display_order: number
  notes?: string | null
  ai_confidence?: number | null
  ai_warnings?: string[] | null
  source_cell_ref?: string | null
  created_at: string
  updated_at: string
  // Populated from joins
  tipos_venta?: CommissionItemVenta[]
}

/**
 * Multiplicador unificado (v3.2)
 * Tabla: commission_item_multipliers
 */
export interface CommissionItemMultiplier {
  id: string
  item_id: string
  multiplier_type: MultiplierType
  activation_criteria: ActivationCriteria
  source_description: string
  source_item_id?: string | null
  threshold_value?: number | null
  factor_if_met: number
  factor_if_not_met: number
  tiered_ranges?: TieredRange[] | null
  operator_cedente?: string | null
  // v3.3
  measurement_type?: MultiplierMeasurementType
  measurement_config?: MeasurementConfig | null
  is_active: boolean
  display_order: number
  notes?: string | null
  created_at: string
  updated_at: string
}

/**
 * Candado de una partida — legacy, usar CommissionItemMultiplier
 * Tabla: commission_item_locks
 */
export interface CommissionItemLock {
  id: string
  scheme_item_id: string
  lock_type: LockType
  required_item_type_id?: string | null
  required_item_type?: CommissionItemType // joined
  required_value: number
  is_active: boolean
  description?: string | null
  created_at: string
  updated_at: string
}

/**
 * Restricción de un esquema
 * Tabla: commission_item_restrictions
 */
export interface CommissionItemRestriction {
  id: string
  scheme_id: string
  scheme_item_id?: string | null
  restriction_type: RestrictionType
  plan_code?: string | null
  operator_code?: string | null
  max_percentage?: number | null
  max_quantity?: number | null
  min_percentage?: number | null
  scope: 'hc' | 'tex' | 'global'
  is_active: boolean
  description?: string | null
  created_at: string
  updated_at: string
}

/**
 * Escala PxQ para partidas tipo PxQ
 * Tabla: commission_pxq_scales
 */
export interface CommissionPxqScale {
  id: string
  scheme_item_id: string
  min_fulfillment: number
  max_fulfillment?: number | null
  amount_per_unit: number
  display_order: number
  created_at: string
}

/**
 * Asignación de esquema a usuario HC
 * Tabla: commission_hc_assignments
 */
export interface CommissionHcAssignment {
  id: string
  user_id: string
  scheme_id: string
  valid_from: string
  valid_to?: string | null
  custom_quota?: number | null
  custom_fixed_salary?: number | null
  custom_variable_salary?: number | null
  custom_min_fulfillment?: number | null
  is_active: boolean
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// TIPOS PARA FORMULARIOS Y UI
// ============================================================================

/**
 * Datos del formulario de esquema (sin IDs)
 */
export interface SchemeFormData {
  name: string
  code: string
  description?: string
  scheme_type: SchemeType
  year: number
  month: number
  fixed_salary: number
  variable_salary: number
  total_ss_quota: number
  default_min_fulfillment: number
  // v3.2
  conversion_table?: ConversionTable | null
  global_range_method?: GlobalRangeMethod
  // v3.3
  accelerator_base?: AcceleratorBase
}

/**
 * Datos del formulario de partida (v3.3)
 */
export interface SchemeItemFormData {
  item_type_id?: string | null
  preset_id?: string | null
  custom_name?: string | null
  custom_description?: string | null
  tipos_venta_ids?: TipoVentaSelection[]
  quota?: number | null
  weight?: number | null
  mix_factor?: number | null
  variable_amount: number
  min_fulfillment?: number | null
  has_cap: boolean
  cap_percentage?: number | null
  cap_amount?: number | null
  // v3.2
  contribution_type: ContributionType
  range_source: RangeSource
  uses_conversion_table: boolean
  accelerator_ranges?: AcceleratorRanges | null
  // v3.3
  measurement_type: MeasurementType
  fulfillment_method: FulfillmentMethod
  measurement_config?: MeasurementConfig | null
  // v3.0.1: Sobrecumplimiento
  overcompliance_mode: OvercomplianceMode
  cap_units?: number | null
  pxq_bonus_amount?: number | null
  overcap_max_units?: number | null
  overcap_max_amount?: number | null
  // v3.4: Fuente del variable
  variable_source: VariableSource
  is_active: boolean
}

/**
 * Selección de tipo de venta con flags de cuenta
 */
export interface TipoVentaSelection {
  tipo_venta_id: string
  cuenta_linea: boolean
  cuenta_equipo: boolean
}

/**
 * Datos del formulario de multiplicador (v3.2)
 */
export interface MultiplierFormData {
  multiplier_type: MultiplierType
  activation_criteria: ActivationCriteria
  source_description: string
  source_item_id?: string | null
  threshold_value?: number | null
  factor_if_met: number
  factor_if_not_met: number
  tiered_ranges?: TieredRange[] | null
  operator_cedente?: string | null
  measurement_type?: MultiplierMeasurementType
  measurement_config?: MeasurementConfig | null
  is_active: boolean
}

/**
 * Datos del formulario de candado — legacy
 */
export interface LockFormData {
  lock_type: LockType
  required_item_type_id?: string | null
  required_value: number
  description?: string
  is_active: boolean
}

/**
 * Datos del formulario de restricción
 */
export interface RestrictionFormData {
  restriction_type: RestrictionType
  plan_code?: string
  max_percentage?: number
  max_quantity?: number
  min_percentage?: number
  scope: 'hc' | 'tex' | 'global'
  affected_item_type_id?: string
  description?: string
  is_active: boolean
}

// ============================================================================
// TIPOS PARA LISTA Y FILTROS
// ============================================================================

export interface SchemeFilters {
  status?: SchemeStatus[]
  scheme_type?: SchemeType
  year?: number
  month?: number
  search?: string
}

/**
 * Esquema con datos relacionados para la lista
 */
export interface SchemeWithMeta extends CommissionScheme {
  items_count?: number
  restrictions_count?: number
  created_by_name?: string
}

// ============================================================================
// CONSTANTES PARA UI
// ============================================================================

export const SCHEME_STATUS_LABELS: Record<SchemeStatus, string> = {
  oficial: 'Oficial',
  draft: 'Borrador',
  aprobado: 'Aprobado',
  archivado: 'Archivado',
}

export const SCHEME_STATUS_COLORS: Record<SchemeStatus, string> = {
  oficial: 'bg-blue-100 text-blue-800',
  draft: 'bg-yellow-100 text-yellow-800',
  aprobado: 'bg-green-100 text-green-800',
  archivado: 'bg-gray-100 text-gray-800',
}

export const SCHEME_TYPE_LABELS: Record<SchemeType, string> = {
  asesor: 'Asesor',
  supervisor: 'Supervisor',
  encargado: 'Encargado',
}

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  principal: 'Principal',
  adicional: 'Adicional',
  pxq: 'PxQ',
  postventa: 'Post Venta',
  bono: 'Bono',
}

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  PONDERADA: 'Ponderada',
  ACELERADOR: 'Acelerador',
  PXQ_INDEPENDIENTE: 'PxQ Independiente',
  BONO: 'Bono',
}

export const CONTRIBUTION_TYPE_DESCRIPTIONS: Record<ContributionType, string> = {
  PONDERADA: 'Peso % del variable',
  ACELERADOR: 'Suma/resta % al total',
  PXQ_INDEPENDIENTE: 'Monto aparte (precio x qty)',
  BONO: 'Todo o nada',
}

export const RANGE_SOURCE_LABELS: Record<RangeSource, string> = {
  CUOTA_PROPIA: 'Cuota propia (Real/Meta)',
  VOLUMEN_GLOBAL: 'Volumen global (total absoluto)',
  CUOTA_GLOBAL_SS: '% Cuota SS total',
}

export const OVERCOMPLIANCE_MODE_LABELS: Record<OvercomplianceMode, string> = {
  none: 'Sin sobrecumplimiento',
  proportional: 'Proporcional',
  pxq_bonus: 'Bono por unidad adicional',
}

export const OVERCOMPLIANCE_MODE_DESCRIPTIONS: Record<OvercomplianceMode, string> = {
  none: 'Se paga máximo el Variable S/. al alcanzar 100%.',
  proportional: 'Cada unidad adicional se paga al mismo valor unitario.',
  pxq_bonus: 'Monto fijo por cada unidad vendida sobre la meta.',
}

export const MULTIPLIER_TYPE_LABELS: Record<MultiplierType, string> = {
  LOCK: 'Candado',
  ACCELERATOR: 'Acelerador',
  DECELERATOR: 'Desacelerador',
  PROPORTIONAL: 'Proporcional',
  CROSS_PRODUCT: 'Cruzado',
  TIERED: 'Escalonado',
}

export const MULTIPLIER_TYPE_ICONS: Record<MultiplierType, string> = {
  LOCK: '🔒',
  ACCELERATOR: '📈',
  DECELERATOR: '📉',
  PROPORTIONAL: '📊',
  CROSS_PRODUCT: '🔗',
  TIERED: '📊',
}

export const ACTIVATION_CRITERIA_LABELS: Record<ActivationCriteria, string> = {
  MIN_QUANTITY: 'Cantidad mínima de producto',
  OWN_ATTAINMENT: '% cumplimiento propio',
  OTHER_ATTAINMENT: '% cumplimiento de otra partida',
  GLOBAL_ATTAINMENT: '% cumplimiento global SS',
  ATTAINMENT_RANGE: 'Rango de cumplimiento',
  OPERATOR_ORIGIN: '% origen operador',
}

export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  UNIT_COUNT: 'Conteo de unidades',
  AVERAGE_VALUE: 'Valor promedio',
  TOTAL_VALUE: 'Valor total',
  RATE: 'Tasa / Ratio',
  MANUAL: 'Valor manual',
}

export const FULFILLMENT_METHOD_LABELS: Record<FulfillmentMethod, string> = {
  RATIO: 'Ratio (logro / meta)',
  ABSOLUTE_RANGES: 'Rangos absolutos',
}

export const ACCELERATOR_BASE_LABELS: Record<'VARIABLE_TEORICO' | 'VARIABLE_CALCULADO', string> = {
  VARIABLE_TEORICO: 'Variable teórico (fijo)',
  VARIABLE_CALCULADO: 'Variable calculado (rendimiento)',
}

export const VARIABLE_SOURCE_LABELS: Record<VariableSource, string> = {
  FROM_MIX: 'Parte del variable teórico',
  FIXED_EXTRA: 'Monto adicional (extra)',
}

export const VARIABLE_SOURCE_DESCRIPTIONS: Record<VariableSource, string> = {
  FROM_MIX: 'Contribuye al 100% del Mix',
  FIXED_EXTRA: 'No cuenta en el Mix',
}

export const LOCK_TYPE_LABELS: Record<LockType, string> = {
  min_quantity: 'Cantidad mínima',
  min_amount: 'Monto mínimo',
  min_percentage: 'Porcentaje mínimo',
  min_fulfillment: 'Cumplimiento mínimo global',
}

export const RESTRICTION_TYPE_LABELS: Record<RestrictionType, string> = {
  max_percentage: 'Máximo porcentaje de plan',
  max_quantity: 'Máxima cantidad de plan',
  min_percentage: 'Mínimo porcentaje',
  operator_origin: 'Origen de portabilidad',
}

export const SCOPE_LABELS: Record<'hc' | 'tex' | 'global', string> = {
  hc: 'Por HC individual',
  tex: 'Por TEX (tienda)',
  global: 'Global',
}

export const PRESET_GROUP_LABELS: Record<PresetGroup, string> = {
  agrupacion: 'Agrupaciones',
  individual: 'Tipos Individuales',
}

export const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
] as const

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Formatea el período para mostrar (ej: "Enero 2026")
 */
export function formatPeriod(year: number, month: number): string {
  const monthLabel = MONTHS.find(m => m.value === month)?.label || ''
  return `${monthLabel} ${year}`
}

/**
 * Genera código de esquema automático
 */
export function generateSchemeCode(type: SchemeType, year: number, month: number): string {
  const typePrefix = type === 'asesor' ? 'ASE' : type === 'supervisor' ? 'SUP' : 'ENC'
  const monthStr = month.toString().padStart(2, '0')
  return `ESQ_${typePrefix}_${year}${monthStr}`
}
