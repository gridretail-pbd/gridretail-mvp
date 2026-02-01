'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  Plus,
  Settings,
  FileSpreadsheet,
  AlertTriangle,
  TrendingDown,
  Users,
  Building,
  ChevronRight,
  Loader2,
  Eye,
  BarChart3,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import {
  ROLES_VER_PENALIDADES,
  ROLES_IMPORTAR,
  ROLES_REGISTRAR,
  ROLES_CONFIGURAR,
  formatCurrency,
  formatPenaltyPeriod,
} from '@/lib/penalidades/types'
import type { Usuario } from '@/types'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface PenaltySummary {
  period: {
    year: number
    month: number
  }
  totals: {
    total_penalties: number
    total_original_amount: number
    total_transferred_amount: number
    hc_affected: number
    avg_per_hc: number
    max_hc: {
      user_id: string
      nombre_completo: string
      total_amount: number
    } | null
  }
  by_source: {
    entel: { count: number; original_amount: number; transferred_amount: number }
    internal: { count: number; original_amount: number; transferred_amount: number }
  }
  by_status: {
    pending: { count: number; amount: number }
    applied: { count: number; amount: number }
    waived: { count: number; amount: number }
    disputed: { count: number; amount: number }
  }
  by_type: Array<{
    penalty_type_id: string
    penalty_code: string
    penalty_name: string
    count: number
    quantity: number
    transferred_amount: number
  }>
  last_imports: Array<{
    id: string
    file_name: string
    imported_at: string
    imported_rows: number
    status: string
  }>
}

export default function PenalidadesPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PenaltySummary | null>(null)

  // Período seleccionado
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  const canImport = user?.rol && ROLES_IMPORTAR.includes(user.rol)
  const canRegister = user?.rol && ROLES_REGISTRAR.includes(user.rol)
  const canConfigure = user?.rol && ROLES_CONFIGURAR.includes(user.rol)

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_VER_PENALIDADES.includes(usuario.rol)) {
      router.push('/dashboard')
      return
    }
    setUser(usuario)
  }, [router])

  // Cargar resumen del período
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/penalidades/summary?year=${selectedYear}&month=${selectedMonth}`
        )
        const data = await response.json()

        if (data.period) {
          setSummary(data)
        }
      } catch (error) {
        console.error('Error cargando resumen:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadSummary()
    }
  }, [user, selectedYear, selectedMonth])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalAmount = summary?.totals.total_transferred_amount || 0
  const entelAmount = summary?.by_source.entel.transferred_amount || 0
  const internalAmount = summary?.by_source.internal.transferred_amount || 0
  const entelPct = totalAmount > 0 ? Math.round((entelAmount / totalAmount) * 100) : 0
  const internalPct = totalAmount > 0 ? Math.round((internalAmount / totalAmount) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penalidades</h1>
          <p className="text-muted-foreground">
            Gestiona las penalidades de Entel e internas del personal comercial
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de período */}
          <Select
            value={selectedMonth.toString()}
            onValueChange={(val) => setSelectedMonth(parseInt(val))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(val) => setSelectedYear(parseInt(val))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Acciones Rápidas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !canImport ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              onClick={() => canImport && router.push('/comisiones/penalidades/importar')}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Importar FICHA</p>
                  <p className="text-sm text-muted-foreground">
                    Subir Excel de penalidades Entel
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !canRegister ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              onClick={() => canRegister && router.push('/comisiones/penalidades/registro')}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Plus className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Nueva Penalidad</p>
                  <p className="text-sm text-muted-foreground">
                    Registrar penalidad manual
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !canConfigure ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              onClick={() => canConfigure && router.push('/comisiones/penalidades/configuracion')}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Configuración</p>
                  <p className="text-sm text-muted-foreground">
                    Equivalencias y tipos
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {/* Resumen del Mes */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Mes</CardTitle>
              <CardDescription>
                {formatPenaltyPeriod(selectedYear, selectedMonth)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Total */}
                <div className="space-y-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Penalidades</p>
                    <p className="text-3xl font-bold text-red-600">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        Entel (FICHA)
                      </span>
                      <span>{formatCurrency(entelAmount)} ({entelPct}%)</span>
                    </div>
                    <Progress value={entelPct} className="h-2" />

                    <div className="flex items-center justify-between text-sm mt-3">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        Internas (PBD)
                      </span>
                      <span>{formatCurrency(internalAmount)} ({internalPct}%)</span>
                    </div>
                    <Progress value={internalPct} className="h-2 [&>div]:bg-purple-500" />
                  </div>
                </div>

                {/* Por Estado */}
                <div className="space-y-4">
                  <p className="text-sm font-medium">Por Estado</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500">◐</span>
                        <span className="text-sm">Pendientes</span>
                      </div>
                      <p className="text-lg font-semibold mt-1">
                        {formatCurrency(summary?.by_status.pending.amount || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summary?.by_status.pending.count || 0} registros
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">●</span>
                        <span className="text-sm">Aplicadas</span>
                      </div>
                      <p className="text-lg font-semibold mt-1">
                        {formatCurrency(summary?.by_status.applied.amount || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summary?.by_status.applied.count || 0} registros
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">○</span>
                        <span className="text-sm">Condonadas</span>
                      </div>
                      <p className="text-lg font-semibold mt-1">
                        {formatCurrency(summary?.by_status.waived.amount || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summary?.by_status.waived.count || 0} registros
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500">⚠</span>
                        <span className="text-sm">En Disputa</span>
                      </div>
                      <p className="text-lg font-semibold mt-1">
                        {formatCurrency(summary?.by_status.disputed.amount || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summary?.by_status.disputed.count || 0} registros
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.totals.total_penalties || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Penalidades del período
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">HC Afectados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.totals.hc_affected || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Asesores con penalidades
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio/HC</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totals.avg_per_hc || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Por asesor afectado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Máximo Individual</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totals.max_hc?.total_amount || 0)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {summary?.totals.max_hc?.nombre_completo || '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Tipos de Penalidad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Tipos de Penalidad
              </CardTitle>
              <CardDescription>
                Tipos con mayor monto en el período
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(!summary?.by_type || summary.by_type.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay penalidades registradas en este período
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="w-[200px]">% del Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.by_type.slice(0, 5).map((type) => {
                      const pct = totalAmount > 0
                        ? Math.round((type.transferred_amount / totalAmount) * 100)
                        : 0
                      return (
                        <TableRow key={type.penalty_type_id}>
                          <TableCell>
                            <div className="font-medium">{type.penalty_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {type.penalty_code}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {type.quantity}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(type.transferred_amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className="text-sm text-muted-foreground w-12">
                                {pct}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Últimas Importaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Últimas Importaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!summary?.last_imports || summary.last_imports.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay importaciones para este período
                  </p>
                  {canImport && (
                    <Button
                      className="mt-4"
                      onClick={() => router.push('/comisiones/penalidades/importar')}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Importar FICHA
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead className="text-center">Registros</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.last_imports.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell>
                          {imp.imported_at
                            ? new Date(imp.imported_at).toLocaleDateString('es-PE')
                            : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {imp.file_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {imp.imported_rows}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={imp.status === 'completed' ? 'default' : 'secondary'}
                          >
                            {imp.status === 'completed' ? 'Completo' : imp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Links adicionales */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => router.push('/comisiones/penalidades/historial')}
            >
              <History className="mr-2 h-4 w-4" />
              Ver Historial Completo
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/comisiones/penalidades/resumen')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Ver Resumen Mensual
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
