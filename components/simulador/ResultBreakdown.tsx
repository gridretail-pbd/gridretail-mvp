'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Lock, LockOpen, AlertTriangle } from 'lucide-react'
import type { ItemDetail } from '@/lib/simulador/types'
import {
  formatCurrency,
  formatPercentage,
  formatSalesQuantity,
} from '@/lib/simulador/formatters'
import { getFulfillmentColor } from '@/lib/simulador/types'

interface ResultBreakdownProps {
  details: ItemDetail[]
  showLocks?: boolean
  showRestrictions?: boolean
}

/**
 * Desglose detallado por partida
 * Muestra el cálculo de cada partida agrupado por categoría
 */
export function ResultBreakdown({
  details,
  showLocks = true,
  showRestrictions = true,
}: ResultBreakdownProps) {
  // Agrupar por categoría
  const grouped = details.reduce((acc, item) => {
    const category = item.category || 'adicional'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, ItemDetail[]>)

  const categoryOrder = ['principal', 'adicional', 'pxq', 'bono', 'postventa']
  const categoryLabels: Record<string, string> = {
    principal: 'Partidas Principales',
    adicional: 'Partidas Adicionales',
    pxq: 'Partidas PxQ',
    bono: 'Bonos',
    postventa: 'Post Venta',
  }

  // Calcular subtotales por categoría
  const categorySubtotals = Object.entries(grouped).reduce((acc, [cat, items]) => {
    acc[cat] = items.reduce((sum, item) => sum + item.commission, 0)
    return acc
  }, {} as Record<string, number>)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Detalle por Partida</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categoryOrder.map((category) => {
          const items = grouped[category]
          if (!items?.length) return null

          return (
            <CategorySection
              key={category}
              category={category}
              label={categoryLabels[category]}
              items={items}
              subtotal={categorySubtotals[category]}
              showLocks={showLocks}
              showRestrictions={showRestrictions}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

interface CategorySectionProps {
  category: string
  label: string
  items: ItemDetail[]
  subtotal: number
  showLocks: boolean
  showRestrictions: boolean
}

function CategorySection({
  category,
  label,
  items,
  subtotal,
  showLocks,
  showRestrictions,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-2 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-medium">{label}</span>
          </div>
          <span className="font-semibold tabular-nums">
            {formatCurrency(subtotal)}
          </span>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-[140px]">Partida</TableHead>
              <TableHead className="w-[60px] text-right">Meta</TableHead>
              <TableHead className="w-[60px] text-right">Logro</TableHead>
              <TableHead className="w-[70px] text-right">Cumpl.</TableHead>
              <TableHead className="w-[80px] text-right">Variable</TableHead>
              <TableHead className="w-[80px] text-right">Comisión</TableHead>
              <TableHead className="w-[80px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showLocks={showLocks}
                showRestrictions={showRestrictions}
              />
            ))}
            {/* Subtotal */}
            <TableRow className="bg-muted/30 font-medium">
              <TableCell colSpan={5} className="text-right">
                SUBTOTAL
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(subtotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ItemRowProps {
  item: ItemDetail
  showLocks: boolean
  showRestrictions: boolean
}

function ItemRow({ item, showLocks, showRestrictions }: ItemRowProps) {
  const hasLockIssue = !item.lockUnlocked && item.lockPending.length > 0
  const hasRestriction = item.restrictionApplied

  return (
    <>
      <TableRow className={!item.meetsMinimum ? 'opacity-60' : ''}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1">
            {item.name}
            {hasLockIssue && showLocks && (
              <Lock className="h-3 w-3 text-red-500" />
            )}
            {item.lockUnlocked && item.lockPending.length > 0 && showLocks && (
              <LockOpen className="h-3 w-3 text-green-500" />
            )}
            {hasRestriction && showRestrictions && (
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
            )}
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {item.quota !== null ? formatSalesQuantity(item.quota) : '-'}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatSalesQuantity(item.sales)}
          {item.effectiveSales !== item.sales && (
            <span className="text-xs text-muted-foreground ml-1">
              ({formatSalesQuantity(item.effectiveSales)})
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {item.quota !== null ? (
            <Badge
              variant="outline"
              className={`text-xs ${getFulfillmentColor(item.fulfillment)}`}
            >
              {formatPercentage(item.fulfillment)}
            </Badge>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(item.variableAmount, { showDecimals: false })}
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {formatCurrency(item.commission)}
        </TableCell>
        <TableCell>
          <ItemStatus item={item} />
        </TableCell>
      </TableRow>

      {/* Fila de candados si hay pendientes */}
      {showLocks && hasLockIssue && item.lockPending.length > 0 && (
        <TableRow className="bg-red-50/50">
          <TableCell colSpan={7} className="py-1 pl-8">
            <div className="flex items-center gap-2 text-xs text-red-600">
              <Lock className="h-3 w-3" />
              <span>Candados pendientes:</span>
              {item.lockPending.map((lock, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {lock.description}
                </Badge>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Fila de restricción si aplica */}
      {showRestrictions && hasRestriction && item.restrictionDetail && (
        <TableRow className="bg-yellow-50/50">
          <TableCell colSpan={7} className="py-1 pl-8">
            <div className="flex items-center gap-2 text-xs text-yellow-700">
              <AlertTriangle className="h-3 w-3" />
              <span>{item.restrictionDetail}</span>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ItemStatus({ item }: { item: ItemDetail }) {
  if (!item.meetsMinimum) {
    return (
      <Badge variant="outline" className="text-xs text-red-600 bg-red-50">
        &lt; {formatPercentage(item.minFulfillment)}
      </Badge>
    )
  }

  if (!item.lockUnlocked) {
    return (
      <Badge variant="outline" className="text-xs text-red-600 bg-red-50">
        Bloqueado
      </Badge>
    )
  }

  if (item.hasCap && item.capPercentage && item.fulfillment > item.capPercentage) {
    return (
      <Badge variant="outline" className="text-xs text-yellow-600 bg-yellow-50">
        Tope {formatPercentage(item.capPercentage)}
      </Badge>
    )
  }

  if (item.fulfillment >= 1) {
    return (
      <Badge variant="outline" className="text-xs text-green-600 bg-green-50">
        OK
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-xs text-green-600 bg-green-50">
      OK
    </Badge>
  )
}
