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

// Tipo de candado (condición para comisionar)
export type LockType = 'min_quantity' | 'min_amount' | 'min_percentage' | 'min_fulfillment'

// Tipo de restricción
export type RestrictionType = 'max_percentage' | 'max_quantity' | 'min_percentage' | 'operator_origin'

// Origen del esquema
export type SchemeSource = 'entel' | 'socio'

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
  item_type_id?: string | null // Ahora opcional (puede ser null si es partida custom)
  item_type?: CommissionItemType // joined
  preset_id?: string | null // Referencia al preset usado
  preset?: PartitionPreset // joined
  custom_name?: string | null // Nombre personalizado para la partida
  custom_description?: string | null // Descripción personalizada
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
  is_active: boolean
  display_order: number
  notes?: string | null
  ai_confidence?: number | null
  ai_warnings?: string[] | null
  source_cell_ref?: string | null
  created_at: string
  updated_at: string
  // Populated from join with commission_item_ventas
  tipos_venta?: CommissionItemVenta[]
}

/**
 * Candado de una partida
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
}

/**
 * Datos del formulario de partida (v2.1 - con sistema de presets)
 */
export interface SchemeItemFormData {
  // Puede tener item_type_id O preset_id (o ambos para trazabilidad)
  item_type_id?: string | null
  preset_id?: string | null
  custom_name?: string | null
  custom_description?: string | null
  // Tipos de venta seleccionados manualmente
  tipos_venta_ids?: TipoVentaSelection[]
  // Configuración de la partida
  quota?: number | null
  weight?: number | null
  mix_factor?: number | null
  variable_amount: number
  min_fulfillment?: number | null
  has_cap: boolean
  cap_percentage?: number | null
  cap_amount?: number | null
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
 * Datos del formulario de candado
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
