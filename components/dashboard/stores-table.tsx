import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TiendaMetrics } from '@/types'

interface TiendasTableProps {
  tiendasData: TiendaMetrics[]
}

export function TiendasTable({ tiendasData }: TiendasTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getCumplimientoColor = (cumplimiento: number) => {
    if (cumplimiento >= 100) return 'text-green-600 font-semibold'
    if (cumplimiento >= 80) return 'text-yellow-600 font-semibold'
    return 'text-red-600 font-semibold'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen por Tienda</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Total Ventas</TableHead>
                <TableHead className="text-right">Falta</TableHead>
                <TableHead className="text-right">% Cumplimiento</TableHead>
                <TableHead className="text-right">Conversión %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiendasData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay datos disponibles para la fecha seleccionada
                  </TableCell>
                </TableRow>
              ) : (
                tiendasData.map((tienda) => (
                  <TableRow key={tienda.tienda_id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{tienda.tienda_nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {tienda.tienda_codigo}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(tienda.cuota)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(tienda.monto_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(tienda.falta)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${getCumplimientoColor(tienda.cumplimiento)}`}
                    >
                      {formatPercent(tienda.cumplimiento)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(tienda.conversion)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
