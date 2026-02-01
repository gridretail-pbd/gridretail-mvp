// ============================================================================
// TIPOS DEL MÓDULO DE CUOTAS - GridRetail
// ============================================================================

// ============================================================================
// TIPOS DE ESTADO
// ============================================================================

export type QuotaImportStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type QuotaStatus = 'draft' | 'pending_approval' | 'approved' | 'archived'
export type QuotaSource = 'entel' | 'manual'

// ============================================================================
// INTERFACES PRINCIPALES
// ============================================================================

/**
 * Importación de archivo de cuotas
 * Tabla: quota_imports
 */
export interface QuotaImport {
  id: string
  file_name: string
  file_url?: string | null
  file_size?: number | null
  year: number
  month: number
  total_rows: number
  imported_rows: number
  error_rows: number
  errors?: Record<string, unknown> | null
  ai_interpretation_log?: AIInterpretationLog | null
  column_mapping?: ColumnMapping | null
  status: QuotaImportStatus
  imported_by?: string | null
  imported_at?: string | null
  created_at: string
}

/**
 * Log de interpretación AI
 */
export interface AIInterpretationLog {
  model: string
  prompt_tokens: number
  completion_tokens: number
  confidence: number
  warnings: string[]
  raw_response?: string
}

/**
 * Mapeo de columnas del Excel
 */
export interface ColumnMapping {
  [excelColumn: string]: string // "PDVS" → "store_name"
}

/**
 * Cuota de tienda
 * Tabla: store_quotas
 */
export interface StoreQuota {
  id: string
  store_id: string
  year: number
  month: number
  ss_quota: number
  quota_breakdown: QuotaBreakdown
  source: QuotaSource
  import_id?: string | null
  original_store_name?: string | null
  status: QuotaStatus
  approved_by?: string | null
  approved_at?: string | null
  approval_notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Joins
  store?: Store
  hc_quotas?: HCQuota[]
  // Computed from view
  hc_count?: number
  total_distributed?: number
  remaining_quota?: number
  distribution_pct?: number
  prorated_hc_count?: number
}

/**
 * Cuota individual de HC
 * Tabla: hc_quotas
 */
export interface HCQuota {
  id: string
  user_id: string
  store_quota_id: string
  store_id: string
  year: number
  month: number
  ss_quota: number
  quota_breakdown: QuotaBreakdown
  start_date?: string | null
  proration_factor: number
  prorated_ss_quota?: number | null
  status: QuotaStatus
  distributed_by?: string | null
  distributed_at?: string | null
  approved_by?: string | null
  approved_at?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  // Joins
  user?: User
  store?: Store
  store_quota?: StoreQuota
}

/**
 * Desglose de cuota por partida
 * Flexible para variabilidad mensual
 */
export interface QuotaBreakdown {
  VR?: number
  VR_CAPTURA?: number
  VR_BASE?: number
  OSS?: number
  OSS_CAPTURA?: number
  OSS_BASE?: number
  OPP?: number
  OPP_CAPTURA?: number
  OPP_BASE?: number
  PACKS?: number
  RENO?: number
  PREPAGO?: number
  MISS_IN?: number
  ACCESORIOS?: number
  [key: string]: number | undefined // Para nuevas partidas
}

// ============================================================================
// TIPOS DE REFERENCIA (de otras tablas)
// ============================================================================

interface Store {
  id: string
  codigo: string
  nombre: string
  zona?: string
}

interface User {
  id: string
  codigo_asesor?: string
  nombre_completo: string
  rol: string
  zona?: string
}

// ============================================================================
// TIPOS PARA FORMULARIOS Y OPERACIONES
// ============================================================================

/**
 * Input para distribución de cuota
 */
export interface QuotaDistributionInput {
  store_quota_id: string
  distributions: DistributionItem[]
}

/**
 * Item individual de distribución
 */
export interface DistributionItem {
  user_id: string
  ss_quota: number
  start_date?: string | null // Para prorrateo (formato YYYY-MM-DD)
}

/**
 * Resultado de distribución
 */
export interface DistributionResult {
  success: boolean
  error?: string
  inserted_count?: number
  total_distributed?: number
  store_quota?: number
  difference?: number
}

/**
 * Input para aprobar cuotas
 */
export interface ApprovalInput {
  store_quota_ids: string[]
  approval_notes?: string
}

/**
 * Resultado de aprobación
 */
export interface ApprovalResult {
  success: boolean
  error?: string
  approved_count?: number
}

/**
 * Preview de importación (antes de confirmar)
 */
export interface ImportPreview {
  file_name: string
  year: number
  month: number
  column_mapping: ColumnMapping
  stores: ImportPreviewStore[]
  warnings: string[]
  confidence: number
  unmatched_stores: UnmatchedStore[]
}

/**
 * Tienda en preview de importación
 */
export interface ImportPreviewStore {
  original_name: string
  matched_store_id?: string
  matched_store_name?: string
  match_method: 'exact' | 'code' | 'fuzzy' | 'manual_required'
  match_confidence: number
  ss_quota: number
  quota_breakdown: QuotaBreakdown
}

/**
 * Tienda no reconocida
 */
export interface UnmatchedStore {
  original_name: string
  ss_quota: number
  suggested_matches: Array<{
    store_id: string
    store_name: string
    similarity: number
  }>
}

// ============================================================================
// TIPOS PARA VISTAS Y RESÚMENES
// ============================================================================

/**
 * Resumen de cuota de tienda (desde vw_store_quotas_summary)
 */
export interface StoreQuotaSummary {
  store_quota_id: string
  store_id: string
  store_code: string
  store_name: string
  year: number
  month: number
  ss_quota: number
  quota_breakdown: QuotaBreakdown
  status: QuotaStatus
  source: QuotaSource
  approved_at?: string | null
  hc_count: number
  total_distributed: number
  remaining_quota: number
  distribution_pct: number
  prorated_hc_count: number
}

/**
 * Cuota vigente de HC (desde vw_quotas_vigentes)
 */
export interface HCQuotaVigente {
  hc_quota_id: string
  user_id: string
  codigo_asesor?: string
  nombre_completo: string
  rol: string
  store_id: string
  store_code: string
  store_name: string
  year: number
  month: number
  hc_ss_quota: number
  prorated_ss_quota?: number | null
  proration_factor: number
  start_date?: string | null
  hc_quota_breakdown: QuotaBreakdown
  store_ss_quota: number
  store_quota_breakdown: QuotaBreakdown
  store_quota_status: QuotaStatus
  hc_quota_status: QuotaStatus
  pct_of_store: number
}

/**
 * Resumen de período
 */
export interface PeriodSummary {
  year: number
  month: number
  total_ss_quota: number
  total_stores: number
  stores_with_distribution: number
  total_hc: number
  hc_with_quotas: number
  status: 'not_started' | 'importing' | 'distributing' | 'pending_approval' | 'approved'
  import_date?: string
  distribution_date?: string
  approval_date?: string
}

// ============================================================================
// CONSTANTES Y LABELS
// ============================================================================

export const QUOTA_STATUS_LABELS: Record<QuotaStatus, string> = {
  draft: 'Borrador',
  pending_approval: 'Pendiente de Aprobación',
  approved: 'Aprobado',
  archived: 'Archivado',
}

export const QUOTA_STATUS_COLORS: Record<QuotaStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-600',
}

export const IMPORT_STATUS_LABELS: Record<QuotaImportStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Error',
}

export const IMPORT_STATUS_COLORS: Record<QuotaImportStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

/**
 * Partidas estándar de cuota
 */
export const STANDARD_QUOTA_PARTITIONS = [
  'VR', 'VR_CAPTURA', 'VR_BASE',
  'OSS', 'OSS_CAPTURA', 'OSS_BASE',
  'OPP', 'OPP_CAPTURA', 'OPP_BASE',
  'PACKS', 'RENO', 'PREPAGO', 'MISS_IN', 'ACCESORIOS'
] as const

/**
 * Labels de partidas principales
 */
export const PARTITION_LABELS: Record<string, string> = {
  VR: 'VR Total',
  VR_CAPTURA: 'VR Captura',
  VR_BASE: 'VR Base',
  OSS: 'OSS Total',
  OSS_CAPTURA: 'OSS Captura',
  OSS_BASE: 'OSS Base',
  OPP: 'OPP Total',
  OPP_CAPTURA: 'OPP Captura',
  OPP_BASE: 'OPP Base',
  PACKS: 'Packs',
  RENO: 'Renovaciones',
  PREPAGO: 'Prepago',
  MISS_IN: 'Miss In',
  ACCESORIOS: 'Accesorios',
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Formatea el período como texto
 */
export function formatQuotaPeriod(year: number, month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return `${months[month - 1]} ${year}`
}

/**
 * Calcula el factor de prorrateo para una fecha de inicio
 */
export function calculateProrationFactor(
  year: number,
  month: number,
  startDate: string
): number {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  const start = new Date(startDate)

  if (start <= monthStart) return 1.0

  const daysInMonth = monthEnd.getDate()
  const daysWorked = daysInMonth - start.getDate() + 1

  return Math.round((daysWorked / daysInMonth) * 10000) / 10000
}

/**
 * Calcula cuota prorrateada
 */
export function calculateProratedQuota(
  ssQuota: number,
  prorationFactor: number
): number {
  return Math.round(ssQuota * prorationFactor * 100) / 100
}

/**
 * Distribuye cuota equitativamente entre asesores
 */
export function distributeEqually(
  storeQuota: number,
  advisorCount: number
): number {
  if (advisorCount === 0) return 0
  return Math.round(storeQuota / advisorCount)
}

/**
 * Valida que la distribución suma correctamente
 */
export function validateDistribution(
  storeQuota: number,
  distributions: DistributionItem[]
): { valid: boolean; total: number; difference: number } {
  const total = distributions.reduce((sum, d) => sum + d.ss_quota, 0)
  const difference = storeQuota - total

  return {
    valid: difference === 0,
    total,
    difference
  }
}

/**
 * Obtiene el estado general de distribución
 */
export function getDistributionStatus(
  summary: StoreQuotaSummary
): 'complete' | 'partial' | 'empty' | 'no_hc' {
  if (summary.hc_count === 0) return 'no_hc'
  if (summary.total_distributed === 0) return 'empty'
  if (summary.remaining_quota === 0) return 'complete'
  return 'partial'
}
