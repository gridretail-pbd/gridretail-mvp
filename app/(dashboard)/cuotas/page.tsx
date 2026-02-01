'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  Upload,
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Users,
  Building,
  TrendingUp,
  ChevronRight,
  Save,
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
import { Input } from '@/components/ui/input'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { toast } from 'sonner'
import type { Usuario } from '@/types'
import { QuotaDifferenceIndicator } from './components/QuotaDifferenceIndicator'

// Roles que pueden ver el módulo de cuotas
const ROLES_CUOTAS = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'GERENTE_GENERAL',
  'JEFE_VENTAS',
  'BACKOFFICE_OPERACIONES',
]

// Roles que pueden importar/distribuir
const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface PeriodSummary {
  period: {
    year: number
    month: number
    status: 'no_import' | 'imported' | 'distributing' | 'pending_approval' | 'approved'
  }
  totals: {
    ss_quota: number
    ss_quota_entel: number
    ss_quota_ssnn: number
    ss_quota_diferencia: number
    hc_quota: number
    stores_total: number
    stores_with_quotas: number
    stores_distributed: number
    stores_approved: number
    hcs_total: number
    hcs_with_quotas: number
  }
  by_status: {
    draft: number
    pending_approval: number
    approved: number
    archived: number
  }
  stores: Array<{
    store_quota_id: string
    store_id: string
    store_code: string
    store_name: string
    ss_quota: number
    ss_quota_entel: number
    diferencia: number
    status: string
    hc_count: number
    hc_quota_total: number
    is_distributed: boolean
    distribution_diff: number
  }>
  last_import: {
    id: string
    file_name: string
    imported_at: string
    imported_rows: number
  } | null
}

interface LocalQuotaEdit {
  [storeQuotaId: string]: number
}

const STATUS_CONFIG = {
  no_import: { label: 'Sin Importar', color: 'bg-gray-500', icon: FileSpreadsheet },
  imported: { label: 'Importado', color: 'bg-blue-500', icon: Upload },
  distributing: { label: 'En Distribución', color: 'bg-yellow-500', icon: BarChart3 },
  pending_approval: { label: 'Pendiente Aprobación', color: 'bg-orange-500', icon: Clock },
  approved: { label: 'Aprobado', color: 'bg-green-500', icon: CheckCircle },
}

const STORE_STATUS_CONFIG = {
  draft: { label: 'Borrador', variant: 'secondary' as const },
  pending_approval: { label: 'Pendiente', variant: 'outline' as const },
  approved: { label: 'Aprobado', variant: 'default' as const },
  archived: { label: 'Archivado', variant: 'secondary' as const },
}

export default function CuotasPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [localQuotaEdits, setLocalQuotaEdits] = useState<LocalQuotaEdit>({})
  const [savingQuotas, setSavingQuotas] = useState<Set<string>>(new Set())

  // Período seleccionado
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  const canEdit = user?.rol && ROLES_EDICION.includes(user.rol)

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_CUOTAS.includes(usuario.rol)) {
      router.push('/dashboard')
      return
    }
    setUser(usuario)
  }, [router])

  // Cargar resumen del período
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/cuotas/summary?year=${selectedYear}&month=${selectedMonth}`
      )
      const data = await response.json()

      if (data.period) {
        setSummary(data)
        setLocalQuotaEdits({}) // Reset edits when loading new data
      }
    } catch (error) {
      console.error('Error cargando resumen:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    if (user) {
      loadSummary()
    }
  }, [user, loadSummary])

  // Handle local quota change
  const handleQuotaChange = (storeQuotaId: string, value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 0) {
      setLocalQuotaEdits(prev => ({
        ...prev,
        [storeQuotaId]: numValue
      }))
    }
  }

  // Save quota to server
  const handleSaveQuota = async (storeQuotaId: string) => {
    const newValue = localQuotaEdits[storeQuotaId]
    if (newValue === undefined) return

    setSavingQuotas(prev => new Set(prev).add(storeQuotaId))

    try {
      const response = await fetch(`/api/cuotas/store-quotas/${storeQuotaId}/update-ssnn`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ss_quota: newValue, user_id: user?.id })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Error al actualizar cuota')
        return
      }

      toast.success('Cuota actualizada correctamente')

      // Remove from local edits and refresh data
      setLocalQuotaEdits(prev => {
        const next = { ...prev }
        delete next[storeQuotaId]
        return next
      })

      // Refresh summary to get updated totals
      await loadSummary()
    } catch (error) {
      console.error('Error actualizando cuota:', error)
      toast.error('Error al actualizar cuota')
    } finally {
      setSavingQuotas(prev => {
        const next = new Set(prev)
        next.delete(storeQuotaId)
        return next
      })
    }
  }

  // Check if a quota has been edited
  const hasQuotaEdit = (storeQuotaId: string) => {
    return localQuotaEdits[storeQuotaId] !== undefined
  }

  // Get display value for quota input
  const getQuotaDisplayValue = (storeQuotaId: string, originalValue: number) => {
    return localQuotaEdits[storeQuotaId] ?? originalValue
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const periodStatus = summary?.period.status || 'no_import'
  const StatusIcon = STATUS_CONFIG[periodStatus].icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Cuotas</h1>
          <p className="text-muted-foreground">
            Importa, distribuye y aprueba las cuotas comerciales mensuales
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Selector de período */}
          <div className="flex items-center gap-2">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Estado del Período */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${STATUS_CONFIG[periodStatus].color}`}>
                    <StatusIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado del período</p>
                    <p className="text-2xl font-bold">
                      {MONTHS[selectedMonth - 1]} {selectedYear}
                    </p>
                    <Badge variant={periodStatus === 'approved' ? 'default' : 'secondary'}>
                      {STATUS_CONFIG[periodStatus].label}
                    </Badge>
                  </div>
                </div>
                {summary?.last_import && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Última importación</p>
                    <p className="font-medium">{summary.last_import.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(summary.last_import.imported_at).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPIs - Primera fila: Cuotas */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">Cuota SSNN</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(summary?.totals.ss_quota_ssnn || summary?.totals.ss_quota || 0)} SS
                </div>
                <p className="text-xs text-muted-foreground">
                  Cuota operativa (editable)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cuota Entel</CardTitle>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totals.ss_quota_entel || 0)} SS
                </div>
                <p className="text-xs text-muted-foreground">
                  Cuota de referencia (importada)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Diferencia</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <QuotaDifferenceIndicator
                    diferencia={summary?.totals.ss_quota_diferencia || 0}
                    size="lg"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  SSNN vs Entel
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tiendas</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.totals.stores_with_quotas || 0} / {summary?.totals.stores_total || 0}
                </div>
                <Progress
                  value={
                    summary?.totals.stores_total
                      ? (summary.totals.stores_with_quotas / summary.totals.stores_total) * 100
                      : 0
                  }
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>

          {/* KPIs - Segunda fila: Distribución y HC */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Distribución</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.totals.stores_distributed || 0} / {summary?.totals.stores_with_quotas || 0}
                </div>
                <Progress
                  value={
                    summary?.totals.stores_with_quotas
                      ? (summary.totals.stores_distributed / summary.totals.stores_with_quotas) * 100
                      : 0
                  }
                  className="mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">HC Asignados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.totals.hcs_with_quotas || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Asesores con cuota asignada
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">SS Distribuidos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totals.hc_quota || 0)} SS
                </div>
                <p className="text-xs text-muted-foreground">
                  Total asignado a asesores
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Acciones Rápidas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !canEdit ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              onClick={() => canEdit && router.push('/cuotas/importar')}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Importar Cuotas</p>
                  <p className="text-sm text-muted-foreground">
                    Subir archivo Excel de Entel
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !canEdit || periodStatus === 'no_import' ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              onClick={() =>
                canEdit && periodStatus !== 'no_import' && router.push('/cuotas/distribucion')
              }
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Distribuir Cuotas</p>
                  <p className="text-sm text-muted-foreground">
                    Asignar cuotas a asesores
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                periodStatus !== 'pending_approval' && periodStatus !== 'distributing'
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
              onClick={() =>
                (periodStatus === 'pending_approval' || periodStatus === 'distributing') &&
                router.push('/cuotas/aprobacion')
              }
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Aprobar Cuotas</p>
                  <p className="text-sm text-muted-foreground">
                    Revisar y aprobar distribución
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Tiendas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Cuotas por Tienda
              </CardTitle>
              <CardDescription>
                {summary?.stores.length || 0} tiendas con cuota asignada
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(!summary?.stores || summary.stores.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay cuotas importadas para este período
                  </p>
                  {canEdit && (
                    <Button
                      className="mt-4"
                      onClick={() => router.push('/cuotas/importar')}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Importar Cuotas
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tienda</TableHead>
                      <TableHead className="text-right">Entel</TableHead>
                      <TableHead className="text-right">SSNN</TableHead>
                      <TableHead className="text-center">Dif</TableHead>
                      <TableHead className="text-center">HC</TableHead>
                      <TableHead className="text-right">Distribuido</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.stores.map((store) => {
                      const storeQuotaId = store.store_quota_id
                      const isEdited = hasQuotaEdit(storeQuotaId)
                      const isSaving = savingQuotas.has(storeQuotaId)
                      const displayValue = getQuotaDisplayValue(storeQuotaId, store.ss_quota)
                      const canEditQuota = canEdit && store.status !== 'approved'

                      return (
                        <TableRow key={store.store_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{store.store_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {store.store_code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {store.ss_quota_entel}
                          </TableCell>
                          <TableCell className="text-right">
                            {canEditQuota ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-20 text-right h-8"
                                  value={displayValue}
                                  onChange={(e) => handleQuotaChange(storeQuotaId, e.target.value)}
                                  disabled={isSaving}
                                />
                                {isEdited && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleSaveQuota(storeQuotaId)}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4 text-primary" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="font-medium">{store.ss_quota}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <QuotaDifferenceIndicator
                              diferencia={isEdited ? (displayValue - store.ss_quota_entel) : store.diferencia}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {store.hc_count}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span>{store.hc_quota_total}</span>
                              {store.distribution_diff !== 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {store.distribution_diff > 0 ? '-' : '+'}
                                  {Math.abs(store.distribution_diff)}
                                </Badge>
                              )}
                              {store.is_distributed && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                STORE_STATUS_CONFIG[store.status as keyof typeof STORE_STATUS_CONFIG]
                                  ?.variant || 'secondary'
                              }
                            >
                              {STORE_STATUS_CONFIG[store.status as keyof typeof STORE_STATUS_CONFIG]
                                ?.label || store.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/cuotas/distribucion?store_id=${store.store_id}`
                                )
                              }
                              disabled={!canEdit}
                            >
                              {canEdit ? 'Distribuir' : 'Ver'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Exportar */}
          <div className="flex justify-end">
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Exportar Resumen
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
