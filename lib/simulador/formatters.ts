// ============================================================================
// FORMATEADORES - Simulador de Ingresos
// ============================================================================

/**
 * Formatea un número como moneda peruana (Soles)
 * @param amount Monto a formatear
 * @param options Opciones de formateo
 */
export function formatCurrency(
  amount: number,
  options: {
    showDecimals?: boolean
    showSymbol?: boolean
    compact?: boolean
  } = {}
): string {
  const {
    showDecimals = true,
    showSymbol = true,
    compact = false
  } = options

  const symbol = showSymbol ? 'S/. ' : ''
  const decimals = showDecimals ? 2 : 0

  if (compact && Math.abs(amount) >= 1000) {
    const compactAmount = amount / 1000
    return `${symbol}${compactAmount.toFixed(1)}k`
  }

  return `${symbol}${amount.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Formatea un número como porcentaje
 * @param value Valor decimal (0.75 = 75%)
 * @param decimals Decimales a mostrar
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Formatea un número con separadores de miles
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Formatea una cantidad de ventas (con decimales si es necesario)
 */
export function formatSalesQuantity(value: number): string {
  // Si es entero, mostrar sin decimales
  if (Number.isInteger(value)) {
    return value.toString()
  }
  // Si tiene decimales, mostrar máximo 1
  return value.toFixed(1)
}

/**
 * Formatea la diferencia entre dos valores (con signo)
 */
export function formatDifference(
  difference: number,
  type: 'currency' | 'percentage' | 'number' = 'currency'
): string {
  const sign = difference > 0 ? '+' : ''

  switch (type) {
    case 'currency':
      return `${sign}${formatCurrency(difference)}`
    case 'percentage':
      return `${sign}${formatPercentage(difference)}`
    case 'number':
      return `${sign}${formatNumber(difference)}`
    default:
      return `${sign}${difference}`
  }
}

/**
 * Formatea el indicador de cambio entre escenarios
 */
export function formatChangeIndicator(
  valueA: number,
  valueB: number,
  type: 'currency' | 'percentage' | 'number' = 'currency'
): { text: string; direction: 'up' | 'down' | 'neutral' } {
  const difference = valueB - valueA

  if (Math.abs(difference) < 0.01) {
    return { text: '-', direction: 'neutral' }
  }

  const text = formatDifference(difference, type)
  const direction = difference > 0 ? 'up' : 'down'

  return { text, direction }
}

/**
 * Calcula el porcentaje de cambio entre dos valores
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 1 : 0
  return (newValue - oldValue) / Math.abs(oldValue)
}

/**
 * Formatea un período (año/mes) como texto legible
 */
export function formatPeriod(year: number, month: number): string {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return `${monthNames[month - 1]} ${year}`
}

/**
 * Formatea una fecha como texto corto
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  })
}

/**
 * Calcula los días restantes en el mes actual
 */
export function getRemainingDaysInMonth(): number {
  const today = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return lastDay.getDate() - today.getDate()
}

/**
 * Calcula ventas necesarias por día para alcanzar meta
 */
export function calculateNeededPerDay(
  quota: number,
  currentSales: number,
  remainingDays: number
): number {
  if (remainingDays <= 0) return 0
  const remaining = quota - currentSales
  if (remaining <= 0) return 0
  return remaining / remainingDays
}

/**
 * Genera texto descriptivo del cumplimiento
 */
export function getFulfillmentDescription(fulfillment: number): string {
  if (fulfillment >= 1.2) return 'Excelente - Supera la meta'
  if (fulfillment >= 1) return 'Meta alcanzada'
  if (fulfillment >= 0.8) return 'Buen avance'
  if (fulfillment >= 0.5) return 'Por mejorar'
  return 'Requiere atención'
}

/**
 * Genera el label de una escala PxQ
 */
export function formatPxqScaleRange(
  minFulfillment: number,
  maxFulfillment: number | null
): string {
  const min = formatPercentage(minFulfillment)
  if (maxFulfillment === null || maxFulfillment >= 2) {
    return `${min}+`
  }
  return `${min} - ${formatPercentage(maxFulfillment)}`
}

/**
 * Formatea el monto de PxQ por unidad
 */
export function formatPxqAmount(amount: number): string {
  return `${formatCurrency(amount)} / unidad`
}

/**
 * Trunca un texto largo con elipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Formatea un nivel de confianza como texto
 */
export function formatConfidence(confidence: number): string {
  if (confidence >= 0.8) return 'Alta'
  if (confidence >= 0.5) return 'Media'
  return 'Baja'
}

/**
 * Obtiene el color CSS para un nivel de confianza
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.5) return 'text-yellow-600'
  return 'text-red-600'
}
