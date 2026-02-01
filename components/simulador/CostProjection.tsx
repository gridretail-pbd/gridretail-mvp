'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Loader2, DollarSign, Users, Building } from 'lucide-react'
import type { CostProjection as CostProjectionType, SalesProfile, SchemeForSimulation } from '@/lib/simulador/types'
import { formatCurrency, formatPercentage, formatPeriod } from '@/lib/simulador/formatters'
import { PROFILE_LABELS } from '@/lib/simulador/types'
import { ProfileSelector } from './ProfileSelector'

interface CostProjectionProps {
  scheme: SchemeForSimulation
  projection: CostProjectionType | null
  loading?: boolean
  onCalculate: (profile: SalesProfile) => Promise<void>
  onExport?: () => void
}

/**
 * Proyección de costos totales para el SSNN
 * Muestra el costo total proyectado de comisiones para todos los HC
 */
export function CostProjection({
  scheme,
  projection,
  loading = false,
  onCalculate,
  onExport,
}: CostProjectionProps) {
  const [selectedProfile, setSelectedProfile] = useState<SalesProfile>('average')

  const handleCalculate = useCallback(() => {
    onCalculate(selectedProfile)
  }, [onCalculate, selectedProfile])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Proyección de Costos
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {scheme.name} • {formatPeriod(scheme.year, scheme.month)}
          </p>
        </div>
        {onExport && projection && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selector de perfil */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Perfil de ventas para proyección:
          </p>
          <div className="flex items-center gap-3">
            <ProfileSelector
              selectedProfile={selectedProfile}
              onProfileChange={setSelectedProfile}
              disabled={loading}
            />
            <Button onClick={handleCalculate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                'Calcular proyección'
              )}
            </Button>
          </div>
        </div>

        {projection && (
          <>
            {/* Monto total */}
            <div className="text-center p-6 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                Costo Total Proyectado
              </p>
              <p className="text-4xl font-bold tabular-nums">
                {formatCurrency(projection.totals.totalCost)}
              </p>
              <div className="flex items-center justify-center gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{projection.totalHC} HC activos</span>
                </div>
                <Badge variant="outline">
                  Perfil: {PROFILE_LABELS[projection.profile]}
                </Badge>
              </div>
            </div>

            {/* Desglose de totales */}
            <div>
              <h4 className="font-medium mb-3">Desglose</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Promedio por HC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Sueldos Fijos</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.totals.fixedSalary)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.averages.fixedSalary)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Variables</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.totals.variableCommission)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.averages.variableCommission)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>PxQ</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.totals.pxqCommission)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.averages.pxqCommission)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bonos</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.totals.bonusCommission)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(projection.averages.bonusCommission)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-medium">BRUTO</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(projection.totals.totalGross)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(projection.averages.totalGross)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">
                      (+) Cargas sociales (est. 3.4%)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(projection.totals.socialCharges)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      -
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t-2 bg-muted/50">
                    <TableCell className="font-bold">COSTO TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-lg">
                      {formatCurrency(projection.totals.totalCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold">
                      {formatCurrency(projection.averages.totalCost)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Distribución por tienda */}
            {projection.byStore && projection.byStore.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Distribución por Tienda
                </h4>
                <div className="max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tienda</TableHead>
                        <TableHead className="text-center">HC</TableHead>
                        <TableHead className="text-right">Costo Fijo</TableHead>
                        <TableHead className="text-right">Costo Var.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projection.byStore.map((store) => (
                        <TableRow key={store.storeId}>
                          <TableCell className="font-medium">
                            {store.storeName}
                          </TableCell>
                          <TableCell className="text-center">
                            {store.hcCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(store.fixedCost)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(store.variableCost)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(store.totalCost)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercentage(store.percentageOfTotal / 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}

        {!projection && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            Selecciona un perfil de ventas y calcula la proyección de costos
          </div>
        )}
      </CardContent>
    </Card>
  )
}
