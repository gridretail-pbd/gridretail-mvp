'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Building,
  Users,
  Eye,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import type { Usuario } from '@/types'

// Roles que pueden aprobar
const ROLES_APROBAR = ['ADMIN', 'GERENTE_COMERCIAL']

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface StoreQuota {
  id: string
  store_id: string
  ss_quota: number
  status: string
  store: {
    id: string
    codigo: string
    nombre: string
  }
  hc_count: number
}

interface HCQuota {
  id: string
  user_id: string
  ss_quota: number
  proration_factor: number
  prorated_ss_quota: number | null
  start_date: string | null
  user: {
    id: string
    codigo_asesor: string
    nombre_completo: string
    rol: string
    zona?: string
  }
}

export default function AprobacionPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  // Período
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  // Datos
  const [storeQuotas, setStoreQuotas] = useState<StoreQuota[]>([])
  const [selectedQuotas, setSelectedQuotas] = useState<Set<string>>(new Set())

  // Modal de detalle
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedStore, setSelectedStore] = useState<StoreQuota | null>(null)
  const [hcQuotas, setHcQuotas] = useState<HCQuota[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Aprobación
  const [approving, setApproving] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [approvalResult, setApprovalResult] = useState<{
    success: boolean
    count: number
  } | null>(null)

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_APROBAR.includes(usuario.rol)) {
      router.push('/cuotas')
      return
    }
    setUser(usuario)
  }, [router])

  // Cargar cuotas pendientes
  useEffect(() => {
    async function loadPendingQuotas() {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/cuotas/store-quotas?year=${selectedYear}&month=${selectedMonth}&status=draft,pending_approval`
        )
        const data = await response.json()

        if (data.store_quotas) {
          // Filtrar solo las que tienen distribución
          const withDistribution = data.store_quotas.filter(
            (sq: StoreQuota) => sq.hc_count > 0
          )
          setStoreQuotas(withDistribution)
        }
      } catch (error) {
        console.error('Error cargando cuotas:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadPendingQuotas()
    }
  }, [user, selectedYear, selectedMonth])

  // Cargar detalle de tienda
  const handleViewDetail = async (storeQuota: StoreQuota) => {
    setSelectedStore(storeQuota)
    setShowDetailModal(true)
    setLoadingDetail(true)

    try {
      const response = await fetch(`/api/cuotas/store-quotas/${storeQuota.id}`)
      const data = await response.json()

      if (data.store_quota?.hc_quotas) {
        setHcQuotas(data.store_quota.hc_quotas)
      }
    } catch (error) {
      console.error('Error cargando detalle:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Toggle selección
  const handleToggleSelection = (quotaId: string) => {
    setSelectedQuotas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(quotaId)) {
        newSet.delete(quotaId)
      } else {
        newSet.add(quotaId)
      }
      return newSet
    })
  }

  // Seleccionar/deseleccionar todos
  const handleToggleAll = () => {
    if (selectedQuotas.size === storeQuotas.length) {
      setSelectedQuotas(new Set())
    } else {
      setSelectedQuotas(new Set(storeQuotas.map(sq => sq.id)))
    }
  }

  // Aprobar seleccionadas
  const handleApprove = async () => {
    if (!user || selectedQuotas.size === 0) return

    setApproving(true)

    try {
      const response = await fetch('/api/cuotas/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_quota_ids: Array.from(selectedQuotas),
          approved_by: user.id,
          approval_notes: approvalNotes || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setApprovalResult({ success: true, count: data.approved_count })

        // Remover las aprobadas de la lista
        setStoreQuotas(prev =>
          prev.filter(sq => !selectedQuotas.has(sq.id))
        )
        setSelectedQuotas(new Set())
        setShowApproveDialog(false)
        setApprovalNotes('')
      } else {
        throw new Error(data.error || 'Error al aprobar')
      }
    } catch (error) {
      console.error('Error aprobando:', error)
      setApprovalResult({ success: false, count: 0 })
    } finally {
      setApproving(false)
    }
  }

  const totalSSSelected = storeQuotas
    .filter(sq => selectedQuotas.has(sq.id))
    .reduce((sum, sq) => sum + sq.ss_quota, 0)

  const totalHCSelected = storeQuotas
    .filter(sq => selectedQuotas.has(sq.id))
    .reduce((sum, sq) => sum + sq.hc_count, 0)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/cuotas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Aprobar Cuotas</h1>
            <p className="text-muted-foreground">
              Revisa y aprueba la distribución de cuotas
            </p>
          </div>
        </div>
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

      {/* Resultado de aprobación */}
      {approvalResult && (
        <Alert variant={approvalResult.success ? 'default' : 'destructive'}>
          {approvalResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>
            {approvalResult.success ? 'Cuotas Aprobadas' : 'Error'}
          </AlertTitle>
          <AlertDescription>
            {approvalResult.success
              ? `Se aprobaron ${approvalResult.count} cuotas de tienda exitosamente.`
              : 'Ocurrió un error al aprobar las cuotas.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Resumen */}
      {selectedQuotas.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold">{selectedQuotas.size}</p>
                  <p className="text-sm text-muted-foreground">Tiendas seleccionadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSSSelected.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Cuota SS total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalHCSelected}</p>
                  <p className="text-sm text-muted-foreground">HC totales</p>
                </div>
              </div>
              <Button onClick={() => setShowApproveDialog(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Aprobar Seleccionadas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : storeQuotas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">No hay cuotas pendientes de aprobación</p>
            <p className="text-muted-foreground mt-2">
              Todas las cuotas del período ya han sido aprobadas o no tienen distribución.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/cuotas')}>
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cuotas Pendientes de Aprobación</CardTitle>
            <CardDescription>
              {storeQuotas.length} tiendas con distribución lista para aprobar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedQuotas.size === storeQuotas.length}
                      onCheckedChange={handleToggleAll}
                    />
                  </TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead className="text-right">Cuota SS</TableHead>
                  <TableHead className="text-center">HC</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeQuotas.map((storeQuota) => (
                  <TableRow key={storeQuota.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedQuotas.has(storeQuota.id)}
                        onCheckedChange={() => handleToggleSelection(storeQuota.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{storeQuota.store.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {storeQuota.store.codigo}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {storeQuota.ss_quota}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {storeQuota.hc_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {storeQuota.status === 'draft' ? 'Borrador' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(storeQuota)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal de detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedStore?.store.nombre}</DialogTitle>
            <DialogDescription>
              Cuota de tienda: <strong>{selectedStore?.ss_quota} SS</strong> |
              Asesores: <strong>{selectedStore?.hc_count}</strong>
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asesor</TableHead>
                  <TableHead className="text-right">Cuota SS</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Prorrateo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hcQuotas.map((hc) => (
                  <TableRow key={hc.id}>
                    <TableCell>
                      <div className="font-medium">
                        {hc.user.nombre_completo}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {hc.user.codigo_asesor}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {hc.ss_quota}
                    </TableCell>
                    <TableCell>
                      {hc.start_date
                        ? new Date(hc.start_date).toLocaleDateString('es-PE')
                        : '01/01'}
                    </TableCell>
                    <TableCell className="text-right">
                      {hc.proration_factor < 1 ? (
                        <Badge variant="secondary">
                          {(hc.proration_factor * 100).toFixed(0)}%
                        </Badge>
                      ) : (
                        '100%'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de aprobación */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprobación</DialogTitle>
            <DialogDescription>
              Estás a punto de aprobar {selectedQuotas.size} cuotas de tienda
              ({totalHCSelected} HC, {totalSSSelected.toLocaleString()} SS total).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Notas de aprobación (opcional)
              </label>
              <Textarea
                placeholder="Ej: Aprobado según distribución propuesta por JV."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Aprobar {selectedQuotas.size} Cuotas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
