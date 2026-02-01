// ============================================================================
// TIPOS DEL MÓDULO DE PENALIDADES - GridRetail
// ============================================================================

// ============================================================================
// TIPOS DE ESTADO Y ENUMS
// ============================================================================

export type PenaltySource = 'entel' | 'internal'
export type PenaltyStatus = 'pending' | 'applied' | 'waived' | 'disputed'
export type TransferType = 'none' | 'full' | 'percentage' | 'fixed' | 'partial_count'
export type IdentifiedBy = 'user' | 'store' | 'contract'
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ============================================================================
// INTERFACES PRINCIPALES
// ============================================================================

/**
 * Tipo de penalidad
 * Tabla: penalty_types
 */
export interface PenaltyType {
  id: string
  code: string
  name: string
  short_name?: string | null
  source: PenaltySource
  base_amount_ssnn?: number | null
  identified_by: IdentifiedBy
  description?: string | null
  is_predictable: boolean
  is_active: boolean
  display_order: number
  created_at?: string
  updated_at?: string
}

/**
 * Equivalencia de penalidad (cuánto se traslada al HC)
 * Tabla: penalty_equivalences
 */
export interface PenaltyEquivalence {
  id: string
  penalty_type_id: string
  valid_from: string
  valid_to?: string | null
  transfer_type: TransferType
  transfer_percentage?: number | null
  transfer_fixed_amount?: number | null
  max_incidents?: number | null
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  // Joins
  penalty_type?: PenaltyType
  created_by_user?: { nombre_completo: string }
}

/**
 * Penalidad individual de HC
 * Tabla: hc_penalties
 */
export interface HCPenalty {
  id: string
  user_id: string
  store_id?: string | null
  penalty_type_id: string
  year: number
  month: number
  incident_date?: string | null
  quantity: number
  original_amount?: number | null
  transferred_amount?: number | null
  source: 'entel' | 'manual'
  import_reference?: string | null
  status: PenaltyStatus
  notes?: string | null
  waived_reason?: string | null
  waived_by?: string | null
  waived_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Joins
  penalty_type?: PenaltyType
  user?: {
    id: string
    nombre_completo: string
    codigo_asesor: string
    rol: string
    zona?: string | null
  }
  store?: {
    id: string
    nombre: string
    codigo: string
  }
  waived_by_user?: { nombre_completo: string }
  created_by_user?: { nombre_completo: string }
}

/**
 * Importación de archivo de penalidades
 * Tabla: penalty_imports
 */
export interface PenaltyImport {
  id: string
  file_name: string
  file_url?: string | null
  year: number
  month: number
  total_rows: number
  imported_rows: number
  error_rows: number
  warning_rows: number
  errors?: ImportError[] | null
  warnings?: ImportWarning[] | null
  column_mapping?: ColumnMapping | null
  status: ImportStatus
  imported_by?: string | null
  imported_at?: string | null
  created_at: string
  // Joins
  imported_by_user?: { nombre_completo: string }
}

// ============================================================================
// TIPOS PARA IMPORTACIÓN
// ============================================================================

export interface ImportError {
  row: number
  field?: string
  message: string
  data?: Record<string, unknown>
}

export interface ImportWarning {
  row: number
  field?: string
  message: string
  suggestedAction?: string
  data?: Record<string, unknown>
}

export interface ColumnMapping {
  userCode: number      // Índice de columna para código de usuario
  penaltyCode: number   // Índice de columna para tipo de penalidad
  quantity: number      // Índice de columna para cantidad
  originalAmount: number // Índice de columna para monto original
  incidentDate?: number // Índice de columna para fecha (opcional)
  reference?: number    // Índice de columna para referencia (opcional)
}

export interface ParsedPenaltyRow {
  userCode: string
  penaltyCode: string
  quantity: number
  originalAmount: number
  incidentDate?: string
  reference?: string
  rowNumber: number
}

export interface ImportPreviewRow {
  rowNumber: number
  userCode: string
  userName?: string
  userId?: string
  penaltyCode: string
  penaltyName?: string
  penaltyTypeId?: string
  quantity: number
  originalAmount: number
  transferredAmount: number
  incidentDate?: string
  status: 'valid' | 'warning' | 'error'
  message?: string
}

export interface ImportPreview {
  file_name: string
  year: number
  month: number
  total_rows: number
  valid_rows: ImportPreviewRow[]
  warning_rows: ImportPreviewRow[]
  error_rows: ImportPreviewRow[]
  column_mapping: ColumnMapping
}

// ============================================================================
// TIPOS PARA FORMULARIOS
// ============================================================================

export interface CreatePenaltyInput {
  user_id: string
  store_id?: string
  penalty_type_id: string
  year: number
  month: number
  incident_date?: string
  quantity: number
  original_amount?: number
  transferred_amount?: number
  notes?: string
}

export interface UpdatePenaltyInput {
  quantity?: number
  original_amount?: number
  transferred_amount?: number
  notes?: string
  status?: PenaltyStatus
}

export interface WaivePenaltyInput {
  waived_reason: string
  reassign_to_user_id?: string
}

export interface CreateEquivalenceInput {
  penalty_type_id: string
  valid_from: string
  transfer_type: TransferType
  transfer_percentage?: number
  transfer_fixed_amount?: number
  max_incidents?: number
  notes?: string
}

// ============================================================================
// TIPOS PARA VISTAS Y RESÚMENES
// ============================================================================

/**
 * Resumen de penalidades por HC (desde vw_hc_penalties_summary)
 */
export interface HCPenaltySummary {
  user_id: string
  codigo_asesor: string
  nombre_completo: string
  year: number
  month: number
  penalty_code: string
  penalty_name: string
  penalty_source: PenaltySource
  incident_count: number
  total_quantity: number
  total_original_amount: number
  total_transferred_amount: number
  applied_amount: number
}

/**
 * Resumen del período (desde API /api/penalidades/summary)
 */
export interface PenaltySummary {
  period: {
    year: number
    month: number
  }
  totals: {
    total_penalties: number
    total_original_amount: number
    total_transferred_amount: number
    hc_affected: number
    avg_per_hc: number
    max_hc: {
      user_id: string
      nombre_completo: string
      codigo_asesor: string
      store_name: string
      penalty_count: number
      total_amount: number
    } | null
  }
  by_source: {
    entel: { count: number; original_amount: number; transferred_amount: number }
    internal: { count: number; original_amount: number; transferred_amount: number }
  }
  by_status: {
    pending: { count: number; amount: number }
    applied: { count: number; amount: number }
    waived: { count: number; amount: number }
    disputed: { count: number; amount: number }
  }
  by_type: Array<{
    penalty_type_id: string
    penalty_code: string
    penalty_name: string
    penalty_source: string
    count: number
    quantity: number
    original_amount: number
    transferred_amount: number
  }>
  by_store: Array<{
    store_id: string
    store_name: string
    store_code: string
    hc_count: number
    penalty_count: number
    total_amount: number
  }>
  top_hc: Array<{
    user_id: string
    nombre_completo: string
    codigo_asesor: string
    store_name: string
    penalty_count: number
    total_amount: number
  }>
  last_imports: Array<{
    id: string
    file_name: string
    imported_at: string
    imported_rows: number
    status: string
    imported_by_user?: { nombre_completo: string }
  }>
}

/**
 * Resumen mensual agregado
 */
export interface MonthlyPenaltySummary {
  year: number
  month: number
  total_penalties: number
  total_original_amount: number
  total_transferred_amount: number
  by_source: {
    entel: { count: number; amount: number }
    internal: { count: number; amount: number }
  }
  by_status: {
    pending: { count: number; amount: number }
    applied: { count: number; amount: number }
    waived: { count: number; amount: number }
    disputed: { count: number; amount: number }
  }
  by_type: Array<{
    penalty_type_id: string
    penalty_code: string
    penalty_name: string
    count: number
    quantity: number
    original_amount: number
    transferred_amount: number
  }>
  by_store: Array<{
    store_id: string
    store_name: string
    store_code: string
    hc_count: number
    penalty_count: number
    total_amount: number
  }>
  top_hc: Array<{
    user_id: string
    nombre_completo: string
    codigo_asesor: string
    store_name: string
    penalty_count: number
    total_amount: number
  }>
}

/**
 * Filtros para consulta de penalidades
 */
export interface PenaltyFilters {
  year?: number
  month?: number
  user_id?: string
  store_id?: string
  penalty_type_id?: string
  status?: PenaltyStatus
  source?: PenaltySource
}

// ============================================================================
// CONSTANTES Y LABELS
// ============================================================================

export const PENALTY_STATUS_LABELS: Record<PenaltyStatus, string> = {
  pending: 'Pendiente',
  applied: 'Aplicada',
  waived: 'Condonada',
  disputed: 'En Disputa',
}

export const PENALTY_STATUS_COLORS: Record<PenaltyStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  applied: 'bg-green-100 text-green-800',
  waived: 'bg-gray-100 text-gray-600',
  disputed: 'bg-orange-100 text-orange-800',
}

export const PENALTY_STATUS_ICONS: Record<PenaltyStatus, string> = {
  pending: '◐',
  applied: '●',
  waived: '○',
  disputed: '⚠',
}

export const PENALTY_SOURCE_LABELS: Record<PenaltySource, string> = {
  entel: 'Entel (FICHA)',
  internal: 'Interna (PBD)',
}

export const PENALTY_SOURCE_COLORS: Record<PenaltySource, string> = {
  entel: 'bg-blue-100 text-blue-800',
  internal: 'bg-purple-100 text-purple-800',
}

export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  none: 'No cobrar',
  full: '100%',
  percentage: 'Porcentaje',
  fixed: 'Monto fijo',
  partial_count: 'Máx. incidencias',
}

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Error',
}

export const IMPORT_STATUS_COLORS: Record<ImportStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

// Aliases for shorter imports
export const STATUS_LABELS = PENALTY_STATUS_LABELS
export const STATUS_COLORS = PENALTY_STATUS_COLORS
export const SOURCE_LABELS = PENALTY_SOURCE_LABELS

export const MONTH_NAMES: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
}

// ============================================================================
// ROLES Y PERMISOS
// ============================================================================

/** Roles que pueden ver el módulo de penalidades */
export const ROLES_VER_PENALIDADES = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'GERENTE_GENERAL',
  'JEFE_VENTAS',
  'BACKOFFICE_OPERACIONES',
  'BACKOFFICE_RRHH',
  'BACKOFFICE_AUDITORIA',
]

/** Roles que pueden importar FICHA */
export const ROLES_IMPORTAR = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'BACKOFFICE_OPERACIONES',
]

/** Roles que pueden registrar penalidades manualmente */
export const ROLES_REGISTRAR = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'BACKOFFICE_OPERACIONES',
]

/** Roles que pueden configurar equivalencias */
export const ROLES_CONFIGURAR = [
  'ADMIN',
  'GERENTE_COMERCIAL',
]

/** Roles que pueden condonar penalidades */
export const ROLES_CONDONAR = [
  'ADMIN',
  'GERENTE_COMERCIAL',
]

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Formatea el período como texto
 */
export function formatPenaltyPeriod(year: number, month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return `${months[month - 1]} ${year}`
}

/**
 * Formatea monto en soles
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount)
}

/**
 * Formatea fecha corta
 */
export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

/**
 * Genera ID de penalidad para display
 */
export function generatePenaltyDisplayId(
  year: number,
  month: number,
  index: number
): string {
  const monthStr = month.toString().padStart(2, '0')
  const indexStr = index.toString().padStart(4, '0')
  return `PEN-${year}-${monthStr}-${indexStr}`
}

/**
 * Calcula el monto trasladado según equivalencia
 */
export function calculateTransferredAmount(
  originalAmount: number,
  quantity: number,
  equivalence: PenaltyEquivalence
): number {
  const { transfer_type, transfer_percentage, transfer_fixed_amount, max_incidents } = equivalence

  // Aplicar límite de incidencias si existe
  const applicableQuantity = max_incidents
    ? Math.min(quantity, max_incidents)
    : quantity

  switch (transfer_type) {
    case 'none':
      return 0

    case 'full':
      // Si hay límite de incidencias, calcular proporcionalmente
      return max_incidents && quantity > max_incidents
        ? (originalAmount * applicableQuantity) / quantity
        : originalAmount

    case 'percentage':
      const percentage = transfer_percentage || 0
      const baseAmount = max_incidents && quantity > max_incidents
        ? (originalAmount * applicableQuantity) / quantity
        : originalAmount
      return baseAmount * (percentage / 100)

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
 * Verifica si el usuario tiene permiso según su rol
 */
export function hasPermission(
  userRole: string,
  allowedRoles: string[]
): boolean {
  return allowedRoles.includes(userRole)
}

/**
 * Obtiene el color del badge de estado
 */
export function getStatusBadgeVariant(
  status: PenaltyStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'applied':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'waived':
      return 'outline'
    case 'disputed':
      return 'destructive'
    default:
      return 'secondary'
  }
}
