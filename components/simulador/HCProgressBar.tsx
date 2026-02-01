'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Target, TrendingUp, Calendar } from 'lucide-react'
import {
  formatSalesQuantity,
  formatPercentage,
  getRemainingDaysInMonth,
  calculateNeededPerDay,
} from '@/lib/simulador/formatters'
import { getProgressBarColor, getFulfillmentColor } from '@/lib/simulador/types'

interface HCProgressBarProps {
  totalQuota: number
  currentSales: number
  label?: string
  showDetails?: boolean
}

/**
 * Barra de progreso del HC hacia su meta
 * Muestra avance, días restantes y ventas necesarias por día
 */
export function HCProgressBar({
  totalQuota,
  currentSales,
  label = 'Cuota SS',
  showDetails = true,
}: HCProgressBarProps) {
  const fulfillment = totalQuota > 0 ? currentSales / totalQuota : 0
  const fulfillmentPercent = Math.min(fulfillment * 100, 100)
  const remaining = Math.max(totalQuota - currentSales, 0)
  const remainingDays = getRemainingDaysInMonth()
  const neededPerDay = calculateNeededPerDay(totalQuota, currentSales, remainingDays)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Tu Avance del Mes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info principal */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatSalesQuantity(currentSales)}{' '}
              <span className="text-lg font-normal text-muted-foreground">
                / {formatSalesQuantity(totalQuota)}
              </span>
            </p>
          </div>
          <Badge
            variant="outline"
            className={`text-lg px-3 py-1 ${getFulfillmentColor(fulfillment)}`}
          >
            {formatPercentage(fulfillment)}
          </Badge>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1">
          <Progress
            value={fulfillmentPercent}
            className="h-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>0</span>
            <span>{formatSalesQuantity(totalQuota / 2)}</span>
            <span>{formatSalesQuantity(totalQuota)}</span>
          </div>
        </div>

        {/* Detalles */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Días restantes</p>
                <p className="font-medium">{remainingDays}</p>
              </div>
            </div>

            {remaining > 0 && remainingDays > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Para llegar a 100%</p>
                  <p className="font-medium">
                    {formatSalesQuantity(neededPerDay)} líneas/día
                  </p>
                </div>
              </div>
            )}

            {remaining <= 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <div>
                  <p className="text-xs">Meta alcanzada</p>
                  <p className="font-medium">
                    +{formatSalesQuantity(Math.abs(remaining))} sobre meta
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Versión compacta para mostrar en línea
 */
export function HCProgressBarCompact({
  totalQuota,
  currentSales,
  label,
}: {
  totalQuota: number
  currentSales: number
  label?: string
}) {
  const fulfillment = totalQuota > 0 ? currentSales / totalQuota : 0
  const fulfillmentPercent = Math.min(fulfillment * 100, 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatSalesQuantity(currentSales)} / {formatSalesQuantity(totalQuota)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={fulfillmentPercent} className="h-2 flex-1" />
        <Badge
          variant="outline"
          className={`text-xs ${getFulfillmentColor(fulfillment)}`}
        >
          {formatPercentage(fulfillment)}
        </Badge>
      </div>
    </div>
  )
}

/**
 * Grid de múltiples partidas con progreso
 */
export function HCProgressGrid({
  items,
}: {
  items: Array<{
    name: string
    quota: number
    sales: number
  }>
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <HCProgressBarCompact
          key={item.name}
          label={item.name}
          totalQuota={item.quota}
          currentSales={item.sales}
        />
      ))}
    </div>
  )
}
