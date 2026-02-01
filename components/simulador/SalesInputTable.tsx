'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SchemeItemWithMapping, SalesData } from '@/lib/simulador/types'
import {
  getDisplayName,
  getEffectiveItemName,
  getEffectiveCategory,
  groupItemsByCategory,
  getTiposVentaDescripcion,
} from '@/lib/simulador/profiles'
import {
  formatSalesQuantity,
  formatPercentage,
} from '@/lib/simulador/formatters'
import { getFulfillmentColor, getProgressBarColor } from '@/lib/simulador/types'

interface SalesInputTableProps {
  schemeItems: SchemeItemWithMapping[]
  salesData: SalesData
  onSalesChange: (itemName: string, value: number) => void
  readOnly?: boolean
  showTiposVenta?: boolean
}

/**
 * Tabla de entrada de ventas para el simulador
 * Permite ingresar cantidades por partida y muestra el cumplimiento
 */
export function SalesInputTable({
  schemeItems,
  salesData,
  onSalesChange,
  readOnly = false,
  showTiposVenta = false,
}: SalesInputTableProps) {
  // Agrupar partidas por categoría
  const groupedItems = useMemo(
    () => groupItemsByCategory(schemeItems),
    [schemeItems]
  )

  // Orden de categorías para mostrar
  const categoryOrder = ['principal', 'adicional', 'pxq', 'bono', 'postventa']
  const categoryLabels: Record<string, string> = {
    principal: 'Principales',
    adicional: 'Adicionales',
    pxq: 'PxQ',
    bono: 'Bonos',
    postventa: 'Post Venta',
  }

  // Calcular totales para partidas principales
  const principalTotals = useMemo(() => {
    const items = groupedItems['principal'] || []
    const totalQuota = items.reduce((sum, item) => sum + (item.quota || 0), 0)
    const totalSales = items.reduce((sum, item) => {
      const itemName = getEffectiveItemName(item)
      return sum + (salesData[itemName] || 0)
    }, 0)
    const fulfillment = totalQuota > 0 ? totalSales / totalQuota : 0
    return { totalQuota, totalSales, fulfillment }
  }, [groupedItems, salesData])

  return (
    <div className="space-y-6">
      {categoryOrder.map((category) => {
        const items = groupedItems[category]
        if (!items?.length) return null

        return (
          <div key={category} className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              {categoryLabels[category]}
            </h4>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Partida</TableHead>
                  <TableHead className="w-[80px] text-right">Meta</TableHead>
                  <TableHead className="w-[100px] text-right">Cantidad</TableHead>
                  <TableHead className="w-[80px] text-right">Cumpl.</TableHead>
                  <TableHead className="w-[150px]">Progreso</TableHead>
                  {showTiposVenta && (
                    <TableHead className="text-xs">Tipos de Venta</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const itemName = getEffectiveItemName(item)
                  const displayName = getDisplayName(item)
                  const quota = item.quota || 0
                  const sales = salesData[itemName] || 0
                  const fulfillment = quota > 0 ? sales / quota : 0
                  const fulfillmentPercent = Math.min(fulfillment * 100, 100)

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {displayName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {quota > 0 ? formatSalesQuantity(quota) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {quota > 0 ? (
                          readOnly ? (
                            <span className="tabular-nums font-medium">
                              {formatSalesQuantity(sales)}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              step={quota >= 10 ? 1 : 0.1}
                              value={sales}
                              onChange={(e) =>
                                onSalesChange(itemName, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 text-right h-8 tabular-nums"
                            />
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {quota > 0 ? (
                          <Badge
                            variant="outline"
                            className={getFulfillmentColor(fulfillment)}
                          >
                            {formatPercentage(fulfillment)}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {quota > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={fulfillmentPercent}
                              className="h-2 flex-1"
                            />
                            {fulfillment >= 1 && (
                              <span className="text-green-600 text-xs">✓</span>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                      {showTiposVenta && (
                        <TableCell className="text-xs text-muted-foreground">
                          {getTiposVentaDescripcion(item)}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}

                {/* Fila de totales para partidas principales */}
                {category === 'principal' && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total Cuota SS</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatSalesQuantity(principalTotals.totalQuota)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatSalesQuantity(principalTotals.totalSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={getFulfillmentColor(principalTotals.fulfillment)}
                      >
                        {formatPercentage(principalTotals.fulfillment)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Progress
                        value={Math.min(principalTotals.fulfillment * 100, 100)}
                        className="h-2"
                      />
                    </TableCell>
                    {showTiposVenta && <TableCell />}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )
      })}
    </div>
  )
}
