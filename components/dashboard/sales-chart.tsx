'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TiendaMetrics } from '@/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface SalesChartProps {
  tiendasData: TiendaMetrics[]
}

export function SalesChart({ tiendasData }: SalesChartProps) {
  // Transform data for the chart
  const chartData = tiendasData.map((tienda) => ({
    name: tienda.tienda_codigo,
    Cuota: tienda.cuota,
    'Total Ventas': tienda.monto_total,
  }))

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas por Tienda</CardTitle>
      </CardHeader>
      <CardContent>
        {tiendasData.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No hay datos disponibles para mostrar el gráfico
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat('es-MX', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Bar dataKey="Cuota" fill="hsl(var(--muted-foreground))" />
              <Bar dataKey="Total Ventas" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
