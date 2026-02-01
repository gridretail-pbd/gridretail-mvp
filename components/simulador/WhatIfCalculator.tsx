'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, Calculator, TrendingUp } from 'lucide-react'
import type { SchemeItemWithMapping, SimulationResult, SalesData } from '@/lib/simulador/types'
import { getDisplayName, getEffectiveItemName, getEffectiveCategory } from '@/lib/simulador/profiles'
import { formatCurrency, formatDifference } from '@/lib/simulador/formatters'

interface WhatIfCalculatorProps {
  schemeItems: SchemeItemWithMapping[]
  currentResult: SimulationResult
  currentSalesData: SalesData
  onCalculate: (newSalesData: SalesData) => Promise<SimulationResult | null>
}

/**
 * Mini calculadora "¿Qué pasa si?" para el HC
 * Permite simular el impacto de vender X unidades adicionales
 */
export function WhatIfCalculator({
  schemeItems,
  currentResult,
  currentSalesData,
  onCalculate,
}: WhatIfCalculatorProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [additionalSales, setAdditionalSales] = useState<number>(5)
  const [newResult, setNewResult] = useState<SimulationResult | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Filtrar solo partidas con cuota (que pueden incrementarse)
  const selectableItems = useMemo(
    () =>
      schemeItems.filter(
        (item) =>
          item.is_active &&
          item.quota !== null &&
          item.quota > 0 &&
          getEffectiveCategory(item) === 'principal'
      ),
    [schemeItems]
  )

  const selectedItem = selectableItems.find((i) => i.id === selectedItemId)
  const selectedItemName = selectedItem ? getEffectiveItemName(selectedItem) : ''

  const handleCalculate = async () => {
    if (!selectedItem || additionalSales <= 0) return

    setCalculating(true)
    try {
      const newSalesData = {
        ...currentSalesData,
        [selectedItemName]: (currentSalesData[selectedItemName] || 0) + additionalSales,
      }

      const result = await onCalculate(newSalesData)
      setNewResult(result)
    } finally {
      setCalculating(false)
    }
  }

  const difference = newResult ? newResult.totalNet - currentResult.totalNet : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          ¿Qué pasa si...?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Partida</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {selectableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {getDisplayName(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Ventas adicionales</Label>
            <Input
              type="number"
              min={1}
              value={additionalSales}
              onChange={(e) => setAdditionalSales(parseInt(e.target.value) || 0)}
              className="tabular-nums"
            />
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!selectedItemId || additionalSales <= 0 || calculating}
          className="w-full"
          size="sm"
        >
          {calculating ? 'Calculando...' : 'Calcular'}
        </Button>

        {/* Resultado */}
        {newResult && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              Si vendes <strong>{additionalSales}</strong> más de{' '}
              <strong>{selectedItem ? getDisplayName(selectedItem) : ''}</strong>:
            </p>

            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Actual</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(currentResult.totalNet)}
                </p>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground" />

              <div className="text-center">
                <p className="text-xs text-muted-foreground">Nuevo</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(newResult.totalNet)}
                </p>
              </div>
            </div>

            <div
              className={`text-center p-2 rounded ${
                difference > 0
                  ? 'bg-green-100 text-green-800'
                  : difference < 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-muted'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                {difference > 0 && <TrendingUp className="h-4 w-4" />}
                <span className="font-semibold">
                  {formatDifference(difference, 'currency')}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Versión compacta para widget en dashboard
 */
export function WhatIfCalculatorCompact({
  schemeItems,
  currentProjection,
  onCalculate,
}: {
  schemeItems: SchemeItemWithMapping[]
  currentProjection: number
  onCalculate: (itemName: string, additional: number) => Promise<number>
}) {
  const [itemName, setItemName] = useState('')
  const [additional, setAdditional] = useState(5)
  const [newProjection, setNewProjection] = useState<number | null>(null)

  const selectableItems = schemeItems.filter(
    (item) =>
      item.is_active &&
      item.quota !== null &&
      getEffectiveCategory(item) === 'principal'
  )

  const handleCalculate = async () => {
    if (!itemName) return
    const result = await onCalculate(itemName, additional)
    setNewProjection(result)
  }

  const difference = newProjection !== null ? newProjection - currentProjection : 0

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Si vendo{' '}
        <Input
          type="number"
          min={1}
          value={additional}
          onChange={(e) => setAdditional(parseInt(e.target.value) || 0)}
          className="w-16 inline-block h-7 text-center mx-1"
        />{' '}
        líneas más de{' '}
        <Select value={itemName} onValueChange={setItemName}>
          <SelectTrigger className="w-32 inline-flex h-7">
            <SelectValue placeholder="partida" />
          </SelectTrigger>
          <SelectContent>
            {selectableItems.map((item) => (
              <SelectItem key={item.id} value={getEffectiveItemName(item)}>
                {getDisplayName(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        , ganaría:
      </p>

      {newProjection !== null && (
        <div className="flex items-center gap-2 text-lg">
          <span className="tabular-nums">{formatCurrency(currentProjection)}</span>
          <ArrowRight className="h-4 w-4" />
          <span className="font-bold tabular-nums">{formatCurrency(newProjection)}</span>
          <span
            className={`text-sm ${
              difference > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ({formatDifference(difference, 'currency')})
          </span>
        </div>
      )}

      <Button size="sm" onClick={handleCalculate} disabled={!itemName}>
        Calcular
      </Button>
    </div>
  )
}
