// ============================================================================
// GENERADORES DE PERFILES DE VENTA - Simulador de Ingresos
// v1.2 - Integración con Módulo de Cuotas
// ============================================================================

import type {
  SalesProfile,
  SalesData,
  SchemeItemWithMapping,
  HCEffectiveQuota,
  QuotaBreakdown,
} from './types'
import { PROFILE_MULTIPLIERS } from './types'

/**
 * Genera datos de venta basados en un perfil predefinido
 * Aplica el multiplicador del perfil a cada meta de partida
 * v1.2: Prioriza cuota de hc_quotas sobre la del esquema
 */
export function generateSalesProfile(
  schemeItems: SchemeItemWithMapping[],
  profile: SalesProfile,
  hcQuota?: HCEffectiveQuota      // v1.2: Cuota del HC si disponible
): SalesData {
  const multiplier = PROFILE_MULTIPLIERS[profile]
  const salesData: SalesData = {}

  for (const item of schemeItems) {
    if (!item.is_active) continue

    const itemName = getEffectiveItemName(item)

    // v1.2: Obtener cuota efectiva (priorizar hc_quotas)
    let effectiveQuota: number
    if (hcQuota?.has_quota && hcQuota.effective_breakdown[itemName]) {
      // Usar cuota del módulo Cuotas (ya incluye prorrateo)
      effectiveQuota = hcQuota.effective_breakdown[itemName]
    } else if (hcQuota?.has_quota && hcQuota.quota_breakdown[itemName]) {
      // Usar cuota nominal con prorrateo aplicado
      effectiveQuota = hcQuota.quota_breakdown[itemName] * (hcQuota.proration_factor || 1)
    } else if (item.quota !== null && item.quota > 0) {
      // Fallback: usar cuota del esquema
      effectiveQuota = item.quota
    } else {
      continue // Sin cuota definida
    }

    // Aplicar multiplicador del perfil
    const rawValue = effectiveQuota * multiplier
    // Redondear a entero o a 1 decimal según el tamaño de la cuota
    salesData[itemName] = effectiveQuota >= 10
      ? Math.round(rawValue)
      : Math.round(rawValue * 10) / 10
  }

  return salesData
}

/**
 * Obtiene el nombre efectivo (clave) de una partida
 * Prioridad: custom_name > item_type.code > preset.code > id
 * Esta es la clave usada en SalesData
 */
export function getEffectiveItemName(item: SchemeItemWithMapping): string {
  return item.custom_name
    || item.item_type?.code
    || item.preset?.code
    || item.id
}

/**
 * Obtiene el nombre para mostrar en UI
 * Prioridad: custom_name > item_type.name > preset.name > "Partida sin nombre"
 */
export function getDisplayName(item: SchemeItemWithMapping): string {
  return item.custom_name
    || item.item_type?.name
    || item.preset?.name
    || 'Partida sin nombre'
}

/**
 * Obtiene el nombre corto para mostrar en UI (tablas compactas)
 * Prioridad: preset.short_name > custom_name (truncado) > item_type.code
 */
export function getShortName(item: SchemeItemWithMapping): string {
  if (item.preset?.short_name) return item.preset.short_name
  if (item.custom_name) return truncate(item.custom_name, 15)
  if (item.item_type?.code) return item.item_type.code
  return getDisplayName(item).substring(0, 15)
}

/**
 * Obtiene la categoría efectiva de la partida
 */
export function getEffectiveCategory(item: SchemeItemWithMapping): string {
  return item.item_type?.category
    || item.preset?.default_category
    || 'adicional'
}

/**
 * Obtiene el tipo de cálculo efectivo de la partida
 */
export function getEffectiveCalculationType(item: SchemeItemWithMapping): string {
  return item.item_type?.calculation_type
    || item.preset?.default_calculation_type
    || 'percentage'
}

/**
 * Obtiene descripción de los tipos de venta mapeados
 */
export function getTiposVentaDescripcion(item: SchemeItemWithMapping): string {
  if (!item.mapped_tipos_venta?.length) {
    return 'Sin mapeo definido'
  }
  return item.mapped_tipos_venta
    .map(m => m.codigo)
    .join(', ')
}

/**
 * Obtiene descripción detallada de los tipos de venta
 * Incluye si cuenta como línea y/o equipo
 */
export function getTiposVentaDetallado(item: SchemeItemWithMapping): string {
  if (!item.mapped_tipos_venta?.length) {
    return 'Sin mapeo definido'
  }
  return item.mapped_tipos_venta
    .map(m => {
      const flags = []
      if (m.cuentaLinea) flags.push('L')
      if (m.cuentaEquipo) flags.push('E')
      return `${m.codigo}(${flags.join('+')})`
    })
    .join(', ')
}

/**
 * Agrupa partidas por categoría
 */
export function groupItemsByCategory(
  items: SchemeItemWithMapping[]
): Record<string, SchemeItemWithMapping[]> {
  const grouped: Record<string, SchemeItemWithMapping[]> = {
    principal: [],
    adicional: [],
    pxq: [],
    postventa: [],
    bono: [],
  }

  for (const item of items) {
    if (!item.is_active) continue
    const category = getEffectiveCategory(item)
    if (grouped[category]) {
      grouped[category].push(item)
    } else {
      grouped['adicional'].push(item)
    }
  }

  // Ordenar cada grupo por display_order
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => a.display_order - b.display_order)
  }

  return grouped
}

/**
 * Calcula el total de cuota SS de un esquema
 * Solo cuenta partidas principales activas
 */
export function calculateTotalSSQuota(items: SchemeItemWithMapping[]): number {
  return items
    .filter(item =>
      item.is_active &&
      getEffectiveCategory(item) === 'principal' &&
      item.quota !== null
    )
    .reduce((sum, item) => sum + (item.quota || 0), 0)
}

/**
 * Valida que los datos de venta tengan todas las partidas requeridas
 */
export function validateSalesData(
  salesData: SalesData,
  schemeItems: SchemeItemWithMapping[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const item of schemeItems) {
    if (!item.is_active) continue
    if (item.quota === null || item.quota === 0) continue

    const itemName = getEffectiveItemName(item)
    if (salesData[itemName] === undefined) {
      missing.push(getDisplayName(item))
    }
  }

  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Convierte datos de venta del formato snake_case (DB) a camelCase (frontend)
 */
export function normalizeSalesDataFromDB(data: Record<string, number>): SalesData {
  // Por ahora es una copia directa, pero permite futuras transformaciones
  return { ...data }
}

/**
 * Prepara datos de venta para enviar a RPC (formato DB)
 */
export function prepareSalesDataForRPC(salesData: SalesData): Record<string, number> {
  // Por ahora es una copia directa, pero permite futuras transformaciones
  const cleaned: Record<string, number> = {}

  for (const [key, value] of Object.entries(salesData)) {
    // Solo incluir valores numéricos válidos
    if (typeof value === 'number' && !isNaN(value)) {
      cleaned[key] = value
    }
  }

  return cleaned
}

/**
 * Ajusta datos de venta para un escenario "¿Qué pasa si?"
 */
export function adjustSalesForWhatIf(
  baseSalesData: SalesData,
  itemName: string,
  additionalSales: number
): SalesData {
  return {
    ...baseSalesData,
    [itemName]: (baseSalesData[itemName] || 0) + additionalSales
  }
}

/**
 * Calcula el cumplimiento para una partida
 */
export function calculateFulfillment(sales: number, quota: number | null): number {
  if (quota === null || quota === 0) return 0
  return sales / quota
}

/**
 * Calcula el cumplimiento global (total ventas / total cuota SS)
 */
export function calculateGlobalFulfillment(
  salesData: SalesData,
  schemeItems: SchemeItemWithMapping[]
): number {
  let totalSales = 0
  let totalQuota = 0

  for (const item of schemeItems) {
    if (!item.is_active) continue
    if (getEffectiveCategory(item) !== 'principal') continue
    if (item.quota === null || item.quota === 0) continue

    const itemName = getEffectiveItemName(item)
    totalSales += salesData[itemName] || 0
    totalQuota += item.quota
  }

  if (totalQuota === 0) return 0
  return totalSales / totalQuota
}

// ============================================================================
// FUNCIONES DE PRORRATEO v1.2
// ============================================================================

/**
 * Calcula el factor de prorrateo basado en fecha de inicio
 * @param startDate Fecha de inicio del HC (null = mes completo)
 * @param year Año del período
 * @param month Mes del período (1-12)
 * @returns Factor entre 0 y 1
 */
export function calculateProrationFactor(
  startDate: string | null,
  year: number,
  month: number
): number {
  if (!startDate) return 1

  const start = new Date(startDate)
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0) // Último día del mes

  // Si empezó antes del período, factor = 1
  if (start <= periodStart) return 1

  // Si empezó después del período, factor = 0
  if (start > periodEnd) return 0

  // Calcular días trabajados
  const totalDays = periodEnd.getDate()
  const daysWorked = totalDays - start.getDate() + 1

  return Math.round((daysWorked / totalDays) * 100) / 100
}

/**
 * Calcula la cuota efectiva con prorrateo aplicado
 */
export function calculateEffectiveQuota(
  nominalQuota: number,
  prorationFactor: number
): number {
  return Math.round(nominalQuota * prorationFactor * 10) / 10
}

/**
 * Aplica prorrateo a un desglose de cuotas
 */
export function applyProrationToBreakdown(
  breakdown: QuotaBreakdown,
  prorationFactor: number
): QuotaBreakdown {
  const prorated: QuotaBreakdown = {}

  for (const [key, value] of Object.entries(breakdown)) {
    prorated[key] = calculateEffectiveQuota(value, prorationFactor)
  }

  return prorated
}

/**
 * Formatea información de prorrateo para UI
 */
export function formatProrationInfo(
  startDate: string | null,
  prorationFactor: number
): string {
  if (!startDate || prorationFactor >= 1) {
    return 'Mes completo'
  }

  const date = new Date(startDate)
  const day = date.getDate()
  const pct = Math.round(prorationFactor * 100)

  return `Desde día ${day} (${pct}% del mes)`
}

/**
 * Genera texto descriptivo del prorrateo
 */
export function getProrationDescription(
  startDate: string | null,
  prorationFactor: number,
  year: number,
  month: number
): string {
  if (!startDate || prorationFactor >= 1) {
    return 'Tu meta corresponde al mes completo'
  }

  const date = new Date(startDate)
  const day = date.getDate()
  const periodEnd = new Date(year, month, 0)
  const totalDays = periodEnd.getDate()
  const daysWorked = totalDays - day + 1

  return `Tu meta está ajustada porque ingresaste el día ${day} del mes (${daysWorked} de ${totalDays} días)`
}

/**
 * Calcula cumplimiento global usando cuotas efectivas (con prorrateo)
 */
export function calculateGlobalFulfillmentWithProration(
  salesData: SalesData,
  schemeItems: SchemeItemWithMapping[],
  hcQuota?: HCEffectiveQuota
): number {
  let totalSales = 0
  let totalEffectiveQuota = 0

  const prorationFactor = hcQuota?.proration_factor ?? 1

  for (const item of schemeItems) {
    if (!item.is_active) continue
    if (getEffectiveCategory(item) !== 'principal') continue

    const itemName = getEffectiveItemName(item)
    const sales = salesData[itemName] || 0

    // Obtener cuota nominal
    let nominalQuota = 0
    if (hcQuota?.has_quota && hcQuota.quota_breakdown[itemName]) {
      nominalQuota = hcQuota.quota_breakdown[itemName]
    } else if (item.quota) {
      nominalQuota = item.quota
    }

    if (nominalQuota === 0) continue

    // Aplicar prorrateo
    const effectiveQuota = calculateEffectiveQuota(nominalQuota, prorationFactor)

    totalSales += sales
    totalEffectiveQuota += effectiveQuota
  }

  if (totalEffectiveQuota === 0) return 0
  return totalSales / totalEffectiveQuota
}

/**
 * Calcula cuántas ventas faltan para llegar a un porcentaje de cumplimiento
 */
export function calculateSalesNeeded(
  currentSales: number,
  effectiveQuota: number,
  targetFulfillment: number = 1
): number {
  const targetSales = effectiveQuota * targetFulfillment
  const needed = targetSales - currentSales
  return Math.max(0, Math.ceil(needed))
}

/**
 * Calcula ventas por día necesarias para alcanzar la meta
 */
export function calculateSalesPerDayNeeded(
  currentSales: number,
  effectiveQuota: number,
  remainingDays: number
): number {
  if (remainingDays <= 0) return 0

  const salesNeeded = calculateSalesNeeded(currentSales, effectiveQuota, 1)
  if (salesNeeded <= 0) return 0

  return Math.ceil(salesNeeded / remainingDays * 10) / 10
}

/**
 * Calcula días restantes en el período
 */
export function calculateRemainingDays(year: number, month: number): number {
  const now = new Date()
  const periodEnd = new Date(year, month, 0) // Último día del mes

  // Si ya pasó el período, 0 días
  if (now > periodEnd) return 0

  // Si estamos antes del período, todos los días
  const periodStart = new Date(year, month - 1, 1)
  if (now < periodStart) return periodEnd.getDate()

  // Estamos dentro del período
  const remaining = periodEnd.getDate() - now.getDate()
  return Math.max(0, remaining)
}

// ============================================================================
// HELPERS INTERNOS
// ============================================================================

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}
