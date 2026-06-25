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
import {
  ChevronDown,
  ChevronRight,
  Lock,
  LockOpen,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import type { ItemDetail, ItemDetailV2, MultiplierEvaluation } from '@/lib/simulador/types'
import {
  formatCurrency,
  formatPercentage,
  formatSalesQuantity,
} from '@/lib/simulador/formatters'
import { getFulfillmentColor } from '@/lib/simulador/types'

// Type guard para distinguir ItemDetailV2
function isItemDetailV2(item: ItemDetail | ItemDetailV2): item is ItemDetailV2 {
  return 'multipliersEvaluated' in item && Array.isArray(item.multipliersEvaluated)
}

interface ResultBreakdownProps {
  details: (ItemDetail | ItemDetailV2)[]
  showLocks?: boolean
  showRestrictions?: boolean
  showMultipliers?: boolean
  showOvercompliance?: boolean
}

/**
 * Desglose detallado por partida
 * Muestra el cálculo de cada partida agrupado por categoría
 */
export function ResultBreakdown({
  details,
  showLocks = true,
  showRestrictions = true,
  showMultipliers = true,
  showOvercompliance = true,
}: ResultBreakdownProps) {
  // Agrupar por categoría
  const grouped = details.reduce((acc, item) => {
    const category = item.category || 'adicional'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, (ItemDetail | ItemDetailV2)[]>)

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
              showMultipliers={showMultipliers}
              showOvercompliance={showOvercompliance}
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
  items: (ItemDetail | ItemDetailV2)[]
  subtotal: number
  showLocks: boolean
  showRestrictions: boolean
  showMultipliers: boolean
  showOvercompliance: boolean
}

function CategorySection({
  category,
  label,
  items,
  subtotal,
  showLocks,
  showRestrictions,
  showMultipliers,
  showOvercompliance,
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
                showMultipliers={showMultipliers}
                showOvercompliance={showOvercompliance}
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
  item: ItemDetail | ItemDetailV2
  showLocks: boolean
  showRestrictions: boolean
  showMultipliers: boolean
  showOvercompliance: boolean
}

function ItemRow({ item, showLocks, showRestrictions, showMultipliers, showOvercompliance }: ItemRowProps) {
  // Determinar si es v2
  const isV2 = isItemDetailV2(item)

  // v1: usar lockUnlocked/lockPending
  // v2: usar hasBlockingMultiplier/multipliersEvaluated
  const hasLockIssue = isV2
    ? item.hasBlockingMultiplier
    : !item.lockUnlocked && item.lockPending.length > 0

  const hasRestriction = item.restrictionApplied

  // v2: detectar si hay multiplicadores no-triviales (factor != 1)
  const hasMultipliers = isV2 && item.multipliersEvaluated.length > 0
  const hasNonTrivialMultiplier = isV2 && item.multipliersEvaluated.some(e => e.appliedFactor !== 1)

  // v2: detectar sobrecumplimiento
  const hasOvercompliance = isV2 && item.overcomplianceResult && item.overcomplianceResult.bonusCommission > 0

  return (
    <>
      <TableRow className={!item.meetsMinimum ? 'opacity-60' : ''}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1">
            {item.name}
            {/* v2: mostrar icono si hay multiplicador bloqueante */}
            {isV2 && hasLockIssue && showMultipliers && (
              <Lock className="h-3 w-3 text-red-500" />
            )}
            {/* v2: mostrar icono si todos los multiplicadores pasaron */}
            {isV2 && hasMultipliers && !hasLockIssue && showMultipliers && (
              <LockOpen className="h-3 w-3 text-green-500" />
            )}
            {/* v1: compatibilidad */}
            {!isV2 && hasLockIssue && showLocks && (
              <Lock className="h-3 w-3 text-red-500" />
            )}
            {!isV2 && item.lockUnlocked && item.lockPending.length > 0 && showLocks && (
              <LockOpen className="h-3 w-3 text-green-500" />
            )}
            {/* Sobrecumplimiento */}
            {hasOvercompliance && showOvercompliance && (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
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
          {isV2 && item.salesRaw !== item.sales && (
            <span className="text-xs text-muted-foreground ml-1">
              ({formatSalesQuantity(item.salesRaw)})
            </span>
          )}
          {!isV2 && item.effectiveSales !== item.sales && (
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

      {/* v2: Fila de multiplicadores */}
      {isV2 && showMultipliers && hasMultipliers && (
        <TableRow className={hasLockIssue ? 'bg-red-50/50' : 'bg-muted/30'}>
          <TableCell colSpan={7} className="py-2 pl-8">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Multiplicadores:</p>
              <div className="flex flex-wrap gap-2">
                {item.multipliersEvaluated.map((evaluation, idx) => (
                  <MultiplierBadge key={idx} evaluation={evaluation} />
                ))}
              </div>
              {hasNonTrivialMultiplier && (
                <div className="flex items-center gap-2 text-xs mt-1 pt-1 border-t">
                  <span className="text-muted-foreground">Factor combinado:</span>
                  <Badge
                    variant={hasLockIssue ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    x{item.combinedMultiplierFactor.toFixed(2)}
                  </Badge>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* v2: Fila de sobrecumplimiento */}
      {isV2 && showOvercompliance && hasOvercompliance && item.overcomplianceResult && (
        <TableRow className="bg-emerald-50/50">
          <TableCell colSpan={7} className="py-2 pl-8">
            <div className="flex items-center gap-3 text-xs text-emerald-700">
              <TrendingUp className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">
                  Sobrecumplimiento ({item.overcomplianceResult.mode === 'proportional' ? 'Proporcional' : 'PxQ Bonus'})
                </span>
                <span className="text-emerald-600">
                  {item.overcomplianceResult.bonusUnits.toFixed(0)} unidades sobre meta
                  {item.overcomplianceResult.cappedUnits !== item.overcomplianceResult.bonusUnits && (
                    <span> (tope: {item.overcomplianceResult.cappedUnits?.toFixed(0)})</span>
                  )}
                </span>
              </div>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800">
                +{formatCurrency(item.overcomplianceResult.bonusCommission)}
              </Badge>
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* v1: Fila de candados legacy si hay pendientes */}
      {!isV2 && showLocks && hasLockIssue && item.lockPending.length > 0 && (
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

/**
 * Badge para mostrar un multiplicador evaluado
 */
function MultiplierBadge({ evaluation }: { evaluation: MultiplierEvaluation }) {
  const { conditionMet, appliedFactor, description } = evaluation

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {conditionMet ? (
        <CheckCircle className="h-3 w-3 text-green-500" />
      ) : (
        <XCircle className="h-3 w-3 text-red-500" />
      )}
      <span className={conditionMet ? 'text-green-700' : 'text-red-700'}>
        {description}
      </span>
      <Badge
        variant="outline"
        className={`text-xs ${appliedFactor === 0 ? 'bg-red-100 text-red-700' : appliedFactor > 1 ? 'bg-green-100 text-green-700' : ''}`}
      >
        x{appliedFactor.toFixed(2)}
      </Badge>
    </div>
  )
}

function ItemStatus({ item }: { item: ItemDetail | ItemDetailV2 }) {
  const isV2 = isItemDetailV2(item)

  if (!item.meetsMinimum) {
    return (
      <Badge variant="outline" className="text-xs text-red-600 bg-red-50">
        &lt; {formatPercentage(item.minFulfillment)}
      </Badge>
    )
  }

  // v2: verificar multiplicadores bloqueantes
  if (isV2 && item.hasBlockingMultiplier) {
    return (
      <Badge variant="outline" className="text-xs text-red-600 bg-red-50">
        Bloqueado
      </Badge>
    )
  }

  // v1: verificar locks legacy
  if (!isV2 && !item.lockUnlocked) {
    return (
      <Badge variant="outline" className="text-xs text-red-600 bg-red-50">
        Bloqueado
      </Badge>
    )
  }

  // v2: sobrecumplimiento activo
  if (isV2 && item.overcomplianceResult && item.overcomplianceResult.bonusCommission > 0) {
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 bg-emerald-50">
        +{formatPercentage(item.fulfillment - 1)}
      </Badge>
    )
  }

  // v1: tope legacy
  if (!isV2 && item.hasCap && item.capPercentage && item.fulfillment > item.capPercentage) {
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
