'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRightLeft, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { Scenario } from '@/lib/simulador/types'
import {
  formatCurrency,
  formatPercentage,
  formatDifference,
  calculatePercentageChange,
} from '@/lib/simulador/formatters'
import { SimulationResultCompact } from './SimulationResult'

interface ScenarioComparisonProps {
  scenarioA: Scenario
  scenarioB: Scenario
  onSwap?: () => void
  onNewScenarioA?: () => void
  onNewScenarioB?: () => void
  onExport?: () => void
}

/**
 * Comparación side-by-side de dos escenarios de simulación
 */
export function ScenarioComparison({
  scenarioA,
  scenarioB,
  onSwap,
  onNewScenarioA,
  onNewScenarioB,
  onExport,
}: ScenarioComparisonProps) {
  if (!scenarioA.result || !scenarioB.result) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Ambos escenarios deben tener resultados para comparar
        </CardContent>
      </Card>
    )
  }

  const resultA = scenarioA.result
  const resultB = scenarioB.result

  const totalDifference = resultB.totalNet - resultA.totalNet
  const percentageChange = calculatePercentageChange(
    resultA.totalNet,
    resultB.totalNet
  )

  const compareRows = [
    {
      label: 'Sueldo Fijo',
      valueA: resultA.fixedSalary,
      valueB: resultB.fixedSalary,
    },
    {
      label: 'Variable',
      valueA: resultA.variableCommission,
      valueB: resultB.variableCommission,
    },
    {
      label: 'Adicionales',
      valueA: resultA.additionalCommission,
      valueB: resultB.additionalCommission,
    },
    {
      label: 'PxQ',
      valueA: resultA.pxqCommission,
      valueB: resultB.pxqCommission,
    },
    {
      label: 'Bonos',
      valueA: resultA.bonusCommission,
      valueB: resultB.bonusCommission,
    },
    {
      label: 'Penalidades',
      valueA: resultA.predictedPenalties,
      valueB: resultB.predictedPenalties,
    },
    {
      label: 'NETO',
      valueA: resultA.totalNet,
      valueB: resultB.totalNet,
      isTotal: true,
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Comparación de Escenarios</CardTitle>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            Exportar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Headers de escenarios */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">ESCENARIO A</h4>
              {onNewScenarioA && (
                <Button variant="ghost" size="sm" onClick={onNewScenarioA}>
                  Cambiar
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{scenarioA.schemeName}</p>
            <SimulationResultCompact result={resultA} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">ESCENARIO B</h4>
              {onNewScenarioB && (
                <Button variant="ghost" size="sm" onClick={onNewScenarioB}>
                  Cambiar
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{scenarioB.schemeName}</p>
            <SimulationResultCompact result={resultB} />
          </div>
        </div>

        {/* Botón de intercambiar */}
        {onSwap && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={onSwap}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Intercambiar
            </Button>
          </div>
        )}

        {/* Tabla de comparación detallada */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Concepto</th>
                <th className="text-right p-3">Escenario A</th>
                <th className="text-right p-3">Escenario B</th>
                <th className="text-right p-3">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => {
                const diff = row.valueB - row.valueA
                const isPositive = diff > 0
                const isNegative = diff < 0

                return (
                  <tr
                    key={row.label}
                    className={`border-t ${row.isTotal ? 'bg-muted/30 font-semibold' : ''}`}
                  >
                    <td className="p-3">{row.label}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(row.valueA)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(row.valueB)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DifferenceIndicator difference={diff} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Resumen de diferencia */}
        <div
          className={`p-4 rounded-lg text-center ${
            totalDifference > 0
              ? 'bg-green-50 text-green-800'
              : totalDifference < 0
              ? 'bg-red-50 text-red-800'
              : 'bg-muted'
          }`}
        >
          <p className="font-medium">
            {totalDifference === 0 ? (
              'Ambos escenarios tienen el mismo ingreso neto'
            ) : totalDifference > 0 ? (
              <>
                Escenario B paga{' '}
                <span className="font-bold">
                  {formatCurrency(Math.abs(totalDifference))}
                </span>{' '}
                más ({formatPercentage(Math.abs(percentageChange))})
              </>
            ) : (
              <>
                Escenario A paga{' '}
                <span className="font-bold">
                  {formatCurrency(Math.abs(totalDifference))}
                </span>{' '}
                más ({formatPercentage(Math.abs(percentageChange))})
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function DifferenceIndicator({ difference }: { difference: number }) {
  if (Math.abs(difference) < 0.01) {
    return (
      <span className="text-muted-foreground flex items-center gap-1">
        <Minus className="h-3 w-3" />
        -
      </span>
    )
  }

  if (difference > 0) {
    return (
      <span className="text-green-600 flex items-center gap-1">
        <ArrowUp className="h-3 w-3" />
        {formatDifference(difference)}
      </span>
    )
  }

  return (
    <span className="text-red-600 flex items-center gap-1">
      <ArrowDown className="h-3 w-3" />
      {formatCurrency(difference)}
    </span>
  )
}
