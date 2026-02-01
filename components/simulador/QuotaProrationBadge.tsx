// ============================================================================
// QUOTA PRORATION BADGE - v1.2
// Badge que muestra el factor de prorrateo de cuota de un HC
// ============================================================================

'use client'

import { Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatProrationInfo, getProrationDescription } from '@/lib/simulador/profiles'

interface QuotaProrationBadgeProps {
  /**
   * Fecha de inicio del HC (null = mes completo)
   */
  startDate: string | null
  /**
   * Factor de prorrateo (0-1)
   */
  prorationFactor: number
  /**
   * Año del período (para descripción)
   */
  year?: number
  /**
   * Mes del período (1-12, para descripción)
   */
  month?: number
  /**
   * Variante de tamaño
   */
  size?: 'sm' | 'default' | 'lg'
  /**
   * Mostrar solo el badge sin tooltip
   */
  noTooltip?: boolean
  /**
   * Clase CSS adicional
   */
  className?: string
}

/**
 * Badge que muestra si un HC tiene cuota prorrateada
 * - Verde: Mes completo (100%)
 * - Azul: Cuota prorrateada (< 100%)
 */
export function QuotaProrationBadge({
  startDate,
  prorationFactor,
  year,
  month,
  size = 'default',
  noTooltip = false,
  className = '',
}: QuotaProrationBadgeProps) {
  const isFullMonth = !startDate || prorationFactor >= 1
  const percentage = Math.round(prorationFactor * 100)

  const sizeClasses = {
    sm: 'text-xs py-0 px-1.5',
    default: 'text-xs py-0.5 px-2',
    lg: 'text-sm py-1 px-2.5',
  }

  const iconSize = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  const badge = (
    <Badge
      variant={isFullMonth ? 'outline' : 'secondary'}
      className={`
        inline-flex items-center gap-1 font-normal
        ${sizeClasses[size]}
        ${isFullMonth
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
        }
        ${className}
      `}
    >
      {isFullMonth ? (
        <>
          <CheckCircle className={iconSize[size]} />
          <span>Mes completo</span>
        </>
      ) : (
        <>
          <Calendar className={iconSize[size]} />
          <span>{percentage}% del mes</span>
        </>
      )}
    </Badge>
  )

  if (noTooltip) {
    return badge
  }

  const infoText = formatProrationInfo(startDate, prorationFactor)
  const description = year && month
    ? getProrationDescription(startDate, prorationFactor, year, month)
    : infoText

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Badge compacto que solo muestra el porcentaje
 */
export function QuotaProrationBadgeCompact({
  prorationFactor,
  className = '',
}: Pick<QuotaProrationBadgeProps, 'prorationFactor' | 'className'>) {
  const isFullMonth = prorationFactor >= 1
  const percentage = Math.round(prorationFactor * 100)

  if (isFullMonth) {
    return null // No mostrar badge si es mes completo
  }

  return (
    <span
      className={`
        inline-flex items-center text-xs text-blue-600 font-medium
        ${className}
      `}
    >
      ({percentage}%)
    </span>
  )
}

/**
 * Indicador inline para usar en textos
 * Ejemplo: "Meta: 70 (61 efectiva)"
 */
export function QuotaProrationInline({
  nominalQuota,
  effectiveQuota,
  prorationFactor,
  showTooltip = true,
}: {
  nominalQuota: number
  effectiveQuota: number
  prorationFactor: number
  showTooltip?: boolean
}) {
  const isFullMonth = prorationFactor >= 1

  if (isFullMonth) {
    return <span>{nominalQuota}</span>
  }

  const content = (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-muted-foreground line-through text-sm">{nominalQuota}</span>
      <span className="font-medium">{effectiveQuota}</span>
    </span>
  )

  if (!showTooltip) {
    return content
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p>Meta ajustada por prorrateo ({Math.round(prorationFactor * 100)}%)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
