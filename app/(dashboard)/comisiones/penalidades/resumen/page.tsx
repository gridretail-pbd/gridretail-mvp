'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  TrendingDown,
  Users,
  Building2,
  FileText,
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { MONTH_NAMES, STATUS_LABELS, STATUS_COLORS } from '@/lib/penalidades/types'
import type { PenaltySummary } from '@/lib/penalidades/types'

export default function ResumenMensualPage() {
  const currentDate = new Date()
  const [year, setYear] = useState(currentDate.getFullYear())
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PenaltySummary | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/penalidades/summary?year=${year}&month=${month}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return 'S/ 0.00'
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'applied':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'waived':
        return <XCircle className="h-4 w-4 text-gray-500" />
      case 'disputed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/comisiones/penalidades">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Resumen Mensual de Penalidades
            </h1>
            <p className="text-muted-foreground">
              Análisis detallado del período {MONTH_NAMES[month]} {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MONTH_NAMES).map(([num, name]) => (
                <SelectItem key={num} value={num}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Penalidades</p>
                <p className="text-3xl font-bold">{summary?.totals.total_penalties || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monto Total Transferido</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary?.totals.total_transferred_amount)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">HC Afectados</p>
                <p className="text-3xl font-bold">{summary?.totals.hc_affected || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Promedio por HC</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary?.totals.avg_per_hc)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Origen</CardTitle>
            <CardDescription>Distribución según fuente de la penalidad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Entel (FICHA)</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">
                    {formatCurrency(summary?.by_source.entel.transferred_amount)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({summary?.by_source.entel.count || 0} registros)
                  </span>
                </div>
              </div>
              {summary && summary.totals.total_transferred_amount > 0 && (
                <Progress
                  value={
                    (summary.by_source.entel.transferred_amount /
                      summary.totals.total_transferred_amount) *
                    100
                  }
                  className="h-2"
                />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Internos (PBD)</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">
                    {formatCurrency(summary?.by_source.internal.transferred_amount)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({summary?.by_source.internal.count || 0} registros)
                  </span>
                </div>
              </div>
              {summary && summary.totals.total_transferred_amount > 0 && (
                <Progress
                  value={
                    (summary.by_source.internal.transferred_amount /
                      summary.totals.total_transferred_amount) *
                    100
                  }
                  className="h-2 [&>div]:bg-green-500"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Estado</CardTitle>
            <CardDescription>Distribución según estado de la penalidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(['pending', 'applied', 'waived', 'disputed'] as const).map((status) => {
                const statusData = summary?.by_status[status]
                const percentage =
                  summary && summary.totals.total_penalties > 0
                    ? ((statusData?.count || 0) / summary.totals.total_penalties) * 100
                    : 0

                return (
                  <div key={status} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span className="font-medium">{STATUS_LABELS[status]}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{statusData?.count || 0}</Badge>
                      <span className="font-bold w-28 text-right">
                        {formatCurrency(statusData?.amount)}
                      </span>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Tipos de Penalidad</CardTitle>
          <CardDescription>Penalidades más frecuentes del período</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Monto Original</TableHead>
                <TableHead className="text-right">Monto Transferido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!summary?.by_type || summary.by_type.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay datos para este período
                  </TableCell>
                </TableRow>
              ) : (
                summary.by_type.map((type, idx) => (
                  <TableRow key={type.penalty_type_id}>
                    <TableCell className="font-mono font-medium">
                      {type.penalty_code}
                    </TableCell>
                    <TableCell>{type.penalty_name}</TableCell>
                    <TableCell>
                      <Badge variant={type.penalty_source === 'entel' ? 'default' : 'secondary'}>
                        {type.penalty_source === 'entel' ? 'Entel' : 'Interno'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{type.count}</TableCell>
                    <TableCell className="text-right">{type.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(type.original_amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(type.transferred_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By Store */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Tiendas con más Penalidades</CardTitle>
          <CardDescription>Tiendas con mayor monto de penalidades transferidas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">HC Afectados</TableHead>
                <TableHead className="text-right">Cantidad Registros</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!summary?.by_store || summary.by_store.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay datos para este período
                  </TableCell>
                </TableRow>
              ) : (
                summary.by_store.map((store) => (
                  <TableRow key={store.store_id}>
                    <TableCell className="font-mono font-medium">{store.store_code}</TableCell>
                    <TableCell>{store.store_name}</TableCell>
                    <TableCell className="text-right">{store.hc_count}</TableCell>
                    <TableCell className="text-right">{store.penalty_count}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(store.total_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top HC */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 HC con más Penalidades</CardTitle>
          <CardDescription>Colaboradores con mayor monto de penalidades</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!summary?.top_hc || summary.top_hc.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay datos para este período
                  </TableCell>
                </TableRow>
              ) : (
                summary.top_hc.map((hc) => (
                  <TableRow key={hc.user_id}>
                    <TableCell className="font-mono font-medium">{hc.codigo_asesor}</TableCell>
                    <TableCell>{hc.nombre_completo}</TableCell>
                    <TableCell>{hc.store_name}</TableCell>
                    <TableCell className="text-right">{hc.penalty_count}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(hc.total_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Last Imports */}
      {summary?.last_imports && summary.last_imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimas Importaciones del Período</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Importado por</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.last_imports.map((imp: any) => (
                  <TableRow key={imp.id}>
                    <TableCell className="font-mono text-sm">{imp.file_name}</TableCell>
                    <TableCell>
                      {new Date(imp.imported_at).toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{imp.imported_by_user?.nombre_completo || '-'}</TableCell>
                    <TableCell className="text-right">{imp.imported_rows}</TableCell>
                    <TableCell>
                      <Badge variant={imp.status === 'completed' ? 'default' : 'secondary'}>
                        {imp.status === 'completed' ? 'Completado' : imp.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
