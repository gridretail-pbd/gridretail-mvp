'use client'

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
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import type { SimulationResult as SimulationResultType, SimulationResultV2 } from '@/lib/simulador/types'
import { formatCurrency, formatPercentage } from '@/lib/simulador/formatters'
import { getFulfillmentColor } from '@/lib/simulador/types'

// Type guard para distinguir SimulationResultV2
function isResultV2(result: SimulationResultType | SimulationResultV2): result is SimulationResultV2 {
  return 'acceleratorAdjustment' in result || 'overcomplianceBonus' in result
}

interface SimulationResultProps {
  result: SimulationResultType | SimulationResultV2
  schemeName?: string
  onExport?: () => void
  showExport?: boolean
}

/**
 * Muestra el resultado principal de la simulación
 * con el ingreso proyectado y desglose de conceptos
 */
export function SimulationResult({
  result,
  schemeName,
  onExport,
  showExport = true,
}: SimulationResultProps) {
  const isV2 = isResultV2(result)

  // Construir filas dinámicamente
  const rows: { concept: string; amount: number; detail: string; highlight?: 'positive' | 'negative' }[] = [
    {
      concept: 'Sueldo Fijo',
      amount: result.fixedSalary,
      detail: 'Base mensual',
    },
    {
      concept: 'Variable (Principales)',
      amount: result.variableCommission,
      detail: `${formatPercentage(result.globalFulfillment)} cumpl. global`,
    },
  ]

  // v2: Agregar ajuste de aceleradores si existe
  if (isV2 && result.acceleratorAdjustment !== 0) {
    rows.push({
      concept: 'Ajuste Aceleradores',
      amount: result.acceleratorAdjustment,
      detail: result.acceleratorAdjustment > 0 ? 'Bonus por desempeño' : 'Ajuste por bajo desempeño',
      highlight: result.acceleratorAdjustment > 0 ? 'positive' : 'negative',
    })
  }

  rows.push({
    concept: 'Adicionales',
    amount: result.additionalCommission,
    detail: 'RENO + PACK + otros',
  })

  rows.push({
    concept: 'PxQ',
    amount: result.pxqCommission,
    detail: 'Bonos por unidad',
  })

  rows.push({
    concept: 'Bonos',
    amount: result.bonusCommission,
    detail: 'NPS, objetivos especiales',
  })

  // v2: Agregar sobrecumplimiento si existe
  if (isV2 && result.overcomplianceBonus > 0) {
    rows.push({
      concept: 'Bono Sobrecumplimiento',
      amount: result.overcomplianceBonus,
      detail: 'Ventas sobre meta',
      highlight: 'positive',
    })
  }

  const hasPenalties = result.predictedPenalties !== 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Resultado de Simulación</CardTitle>
        {showExport && onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monto principal */}
        <div className="text-center p-6 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">
            Ingreso Proyectado
          </p>
          <p className="text-4xl font-bold tabular-nums">
            {formatCurrency(result.totalNet)}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              Cumplimiento global:
            </span>
            <Badge
              variant="outline"
              className={getFulfillmentColor(result.globalFulfillment)}
            >
              {formatPercentage(result.globalFulfillment)}
            </Badge>
          </div>
          {schemeName && (
            <p className="text-xs text-muted-foreground mt-2">
              Esquema: {schemeName}
            </p>
          )}
        </div>

        {/* Desglose */}
        <div>
          <h4 className="font-medium mb-3">Desglose</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.concept}
                  className={
                    row.highlight === 'positive'
                      ? 'bg-emerald-50/50'
                      : row.highlight === 'negative'
                      ? 'bg-red-50/50'
                      : ''
                  }
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {row.highlight === 'positive' && (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      )}
                      {row.highlight === 'negative' && (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      {row.concept}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      row.highlight === 'positive'
                        ? 'text-emerald-700 font-medium'
                        : row.highlight === 'negative'
                        ? 'text-red-700 font-medium'
                        : ''
                    }`}
                  >
                    {row.highlight === 'positive' && '+'}
                    {formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.detail}
                  </TableCell>
                </TableRow>
              ))}

              {/* Separador */}
              <TableRow className="border-t-2">
                <TableCell className="font-semibold">BRUTO</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatCurrency(result.totalGross)}
                </TableCell>
                <TableCell />
              </TableRow>

              {/* Penalidades */}
              {hasPenalties && (
                <TableRow className="text-red-600">
                  <TableCell>(-) Penalidades</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(result.predictedPenalties)}
                  </TableCell>
                  <TableCell className="text-sm">Predichas</TableCell>
                </TableRow>
              )}

              {/* Total Neto */}
              <TableRow className="border-t-2 bg-muted/50">
                <TableCell className="font-bold">NETO PROYECTADO</TableCell>
                <TableCell className="text-right tabular-nums font-bold text-lg">
                  {formatCurrency(result.totalNet)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Versión compacta del resultado para comparaciones
 */
export function SimulationResultCompact({
  result,
  title,
}: {
  result: SimulationResultType | SimulationResultV2
  title?: string
}) {
  const isV2 = isResultV2(result)

  return (
    <div className="p-4 border rounded-lg space-y-3">
      {title && (
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      )}
      <div className="text-center">
        <p className="text-2xl font-bold tabular-nums">
          {formatCurrency(result.totalNet)}
        </p>
        <Badge
          variant="outline"
          className={getFulfillmentColor(result.globalFulfillment)}
        >
          {formatPercentage(result.globalFulfillment)}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fijo:</span>
          <span className="tabular-nums">{formatCurrency(result.fixedSalary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Variable:</span>
          <span className="tabular-nums">
            {formatCurrency(result.variableCommission)}
          </span>
        </div>
        {/* v2: Aceleradores */}
        {isV2 && result.acceleratorAdjustment !== 0 && (
          <div className={`flex justify-between ${result.acceleratorAdjustment > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            <span>Acelerador:</span>
            <span className="tabular-nums">
              {result.acceleratorAdjustment > 0 ? '+' : ''}
              {formatCurrency(result.acceleratorAdjustment)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Adicionales:</span>
          <span className="tabular-nums">
            {formatCurrency(result.additionalCommission)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">PxQ:</span>
          <span className="tabular-nums">{formatCurrency(result.pxqCommission)}</span>
        </div>
        {result.bonusCommission > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bonos:</span>
            <span className="tabular-nums">
              {formatCurrency(result.bonusCommission)}
            </span>
          </div>
        )}
        {/* v2: Sobrecumplimiento */}
        {isV2 && result.overcomplianceBonus > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Sobrecumpl.:</span>
            <span className="tabular-nums">
              +{formatCurrency(result.overcomplianceBonus)}
            </span>
          </div>
        )}
        {result.predictedPenalties !== 0 && (
          <div className="flex justify-between text-red-600">
            <span>Penalidades:</span>
            <span className="tabular-nums">
              {formatCurrency(result.predictedPenalties)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
