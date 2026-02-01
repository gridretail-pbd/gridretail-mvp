// ============================================================================
// EFFECTIVE QUOTA CARD - v1.2
// Card que muestra la cuota efectiva del HC con desglose de prorrateo
// ============================================================================

'use client'

import { Info, Calendar, Target, Store } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { QuotaProrationBadge } from './QuotaProrationBadge'
import type { HCEffectiveQuota } from '@/lib/simulador/types'
import {
  formatProrationInfo,
  getProrationDescription,
} from '@/lib/simulador/profiles'

interface EffectiveQuotaCardProps {
  /**
   * Datos de cuota efectiva del HC
   */
  quota: HCEffectiveQuota | null
  /**
   * Estado de carga
   */
  loading?: boolean
  /**
   * Año del período
   */
  year: number
  /**
   * Mes del período (1-12)
   */
  month: number
  /**
   * Mostrar desglose por partida
   */
  showBreakdown?: boolean
  /**
   * Clase CSS adicional
   */
  className?: string
}

/**
 * Card que muestra la cuota efectiva del HC
 * Incluye información de prorrateo si aplica
 */
export function EffectiveQuotaCard({
  quota,
  loading = false,
  year,
  month,
  showBreakdown = false,
  className = '',
}: EffectiveQuotaCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
        </CardContent>
      </Card>
    )
  }

  if (!quota) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Tu Cuota
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No tienes una cuota asignada para este período.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const hasProration = quota.proration_factor < 1
  const startDate = quota.start_date
    ? new Date(quota.start_date).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  const breakdownEntries = Object.entries(quota.effective_breakdown || {})
  const nominalBreakdownEntries = Object.entries(quota.quota_breakdown || {})

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Tu Cuota y Prorrateo
          </CardTitle>
          <QuotaProrationBadge
            startDate={quota.start_date}
            prorationFactor={quota.proration_factor}
            year={year}
            month={month}
            size="sm"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen principal */}
        <div className="space-y-2">
          {/* Cuota SS asignada */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cuota SS asignada:</span>
            <span className="font-medium">{quota.ss_quota} unidades</span>
          </div>

          {/* Fecha de inicio (si hay prorrateo) */}
          {hasProration && startDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Tu fecha de inicio:
              </span>
              <span>{startDate}</span>
            </div>
          )}

          {/* Factor de prorrateo */}
          {hasProration && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Factor prorrateo:</span>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                {(quota.proration_factor * 100).toFixed(0)}%
              </Badge>
            </div>
          )}

          {/* Separador */}
          <div className="border-t my-2" />

          {/* Cuota efectiva */}
          <div className="flex items-center justify-between">
            <span className="font-medium">TU CUOTA EFECTIVA:</span>
            <span className="text-xl font-bold tabular-nums">
              {quota.effective_quota} unidades
            </span>
          </div>

          {/* Tienda */}
          {quota.store_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Store className="h-3 w-3" />
              {quota.store_name}
            </div>
          )}
        </div>

        {/* Mensaje explicativo */}
        {hasProration && (
          <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            {getProrationDescription(quota.start_date, quota.proration_factor, year, month)}
          </p>
        )}

        {/* Desglose por partida */}
        {showBreakdown && breakdownEntries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Desglose por partida</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partida</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  {hasProration && (
                    <TableHead className="text-right">Efectiva</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownEntries.map(([key, effectiveValue]) => {
                  const nominalValue = quota.quota_breakdown[key] || effectiveValue
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{key}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {hasProration ? (
                          <span className="text-muted-foreground">{nominalValue}</span>
                        ) : (
                          nominalValue
                        )}
                      </TableCell>
                      {hasProration && (
                        <TableCell className="text-right tabular-nums font-medium">
                          {effectiveValue}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Versión compacta del card de cuota efectiva
 * Para usar en layouts más reducidos
 */
export function EffectiveQuotaCardCompact({
  quota,
  loading = false,
  year,
  month,
  className = '',
}: Omit<EffectiveQuotaCardProps, 'showBreakdown'>) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
    )
  }

  if (!quota || !quota.has_quota) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        Sin cuota asignada
      </div>
    )
  }

  const hasProration = quota.proration_factor < 1

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold tabular-nums">{quota.effective_quota}</span>
        <span className="text-sm text-muted-foreground">unidades</span>
        {hasProration && (
          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
            {(quota.proration_factor * 100).toFixed(0)}%
          </Badge>
        )}
      </div>
      {hasProration && (
        <p className="text-xs text-muted-foreground">
          Meta ajustada (nominal: {quota.ss_quota})
        </p>
      )}
    </div>
  )
}
