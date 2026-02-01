'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  Download,
  Eye,
  Loader2,
  Filter,
  X,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  ROLES_VER_PENALIDADES,
  ROLES_CONDONAR,
  PENALTY_STATUS_LABELS,
  PENALTY_STATUS_ICONS,
  PENALTY_SOURCE_LABELS,
  formatCurrency,
  formatShortDate,
  getStatusBadgeVariant,
} from '@/lib/penalidades/types'
import type { HCPenalty, PenaltyType, PenaltyStatus } from '@/lib/penalidades/types'
import type { Usuario } from '@/types'

const MONTHS = [
  'Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function HistorialPenalidadesPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [penalties, setPenalties] = useState<HCPenalty[]>([])
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyType[]>([])

  // Filtros
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = Todos
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchUser, setSearchUser] = useState('')

  // Modal de detalle
  const [selectedPenalty, setSelectedPenalty] = useState<HCPenalty | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Modal de condonar
  const [showWaiveModal, setShowWaiveModal] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')
  const [waiving, setWaiving] = useState(false)

  const canWaive = user?.rol && ROLES_CONDONAR.includes(user.rol)

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

  // Cargar tipos de penalidad
  useEffect(() => {
    async function loadTypes() {
      try {
        const response = await fetch('/api/penalidades/types')
        const data = await response.json()
        if (data.types) {
          setPenaltyTypes(data.types)
        }
      } catch (error) {
        console.error('Error cargando tipos:', error)
      }
    }
    loadTypes()
  }, [])

  // Cargar penalidades
  const loadPenalties = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('year', selectedYear.toString())
      if (selectedMonth > 0) params.set('month', selectedMonth.toString())
      if (selectedStatus !== 'all') params.set('status', selectedStatus)
      if (selectedSource !== 'all') params.set('source', selectedSource)
      if (selectedType !== 'all') params.set('penalty_type_id', selectedType)

      const response = await fetch(`/api/penalidades/penalties?${params}`)
      const data = await response.json()

      if (data.penalties) {
        // Filtrar por usuario si hay búsqueda
        let filtered = data.penalties
        if (searchUser.trim()) {
          const search = searchUser.toLowerCase()
          filtered = filtered.filter((p: HCPenalty) =>
            p.user?.nombre_completo?.toLowerCase().includes(search) ||
            p.user?.codigo_asesor?.toLowerCase().includes(search)
          )
        }
        setPenalties(filtered)
      }
    } catch (error) {
      console.error('Error cargando penalidades:', error)
      toast.error('Error al cargar penalidades')
    } finally {
      setLoading(false)
    }
  }, [user, selectedYear, selectedMonth, selectedStatus, selectedSource, selectedType, searchUser])

  useEffect(() => {
    if (user) {
      loadPenalties()
    }
  }, [user, loadPenalties])

  // Abrir detalle
  const handleViewDetail = (penalty: HCPenalty) => {
    setSelectedPenalty(penalty)
    setShowDetailModal(true)
  }

  // Abrir modal de condonar
  const handleOpenWaive = (penalty: HCPenalty) => {
    setSelectedPenalty(penalty)
    setWaiveReason('')
    setShowWaiveModal(true)
  }

  // Condonar penalidad
  const handleWaive = async () => {
    if (!selectedPenalty || !waiveReason.trim()) {
      toast.error('Se requiere un motivo de condonación')
      return
    }

    setWaiving(true)
    try {
      const response = await fetch(
        `/api/penalidades/penalties/${selectedPenalty.id}/waive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            waived_reason: waiveReason,
            waived_by: user?.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Error al condonar penalidad')
        return
      }

      toast.success('Penalidad condonada correctamente')
      setShowWaiveModal(false)
      setShowDetailModal(false)
      loadPenalties()
    } catch (error) {
      console.error('Error condonando:', error)
      toast.error('Error al condonar penalidad')
    } finally {
      setWaiving(false)
    }
  }

  // Limpiar filtros
  const clearFilters = () => {
    setSelectedMonth(0)
    setSelectedStatus('all')
    setSelectedSource('all')
    setSelectedType('all')
    setSearchUser('')
  }

  const hasFilters = selectedMonth > 0 || selectedStatus !== 'all' ||
    selectedSource !== 'all' || selectedType !== 'all' || searchUser.trim()

  // Estadísticas
  const totalAmount = penalties.reduce((sum, p) => sum + (p.transferred_amount || 0), 0)
  const appliedAmount = penalties
    .filter(p => p.status === 'applied')
    .reduce((sum, p) => sum + (p.transferred_amount || 0), 0)

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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/comisiones/penalidades')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Historial de Penalidades</h1>
          <p className="text-muted-foreground">
            Consulta y gestiona todas las penalidades registradas
          </p>
        </div>
        <Button variant="outline" disabled>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <div>
              <Label className="text-xs">Año</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(parseInt(val))}
              >
                <SelectTrigger>
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
            <div>
              <Label className="text-xs">Mes</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(val) => setSelectedMonth(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="applied">Aplicada</SelectItem>
                  <SelectItem value="waived">Condonada</SelectItem>
                  <SelectItem value="disputed">En Disputa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Origen</Label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entel">Entel (FICHA)</SelectItem>
                  <SelectItem value="manual">Interna (PBD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {penaltyTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Usuario</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-8"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
            </div>
          </div>
          {hasFilters && (
            <div className="flex justify-end mt-4">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Registros</div>
            <div className="text-2xl font-bold">{penalties.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Monto Total</div>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Monto Aplicado</div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(appliedAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : penalties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No se encontraron penalidades con los filtros seleccionados
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {penalties.map((penalty) => (
                  <TableRow key={penalty.id}>
                    <TableCell>
                      {penalty.incident_date
                        ? formatShortDate(penalty.incident_date)
                        : `${penalty.month}/${penalty.year}`}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {penalty.user?.nombre_completo || '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {penalty.user?.codigo_asesor}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {penalty.penalty_type?.name || '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {penalty.source === 'entel' ? 'Entel' : 'Interna'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {penalty.quantity}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(penalty.transferred_amount || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(penalty.status)}>
                        {PENALTY_STATUS_ICONS[penalty.status]}{' '}
                        {PENALTY_STATUS_LABELS[penalty.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(penalty)}
                      >
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

      {/* Modal de Detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Penalidad</DialogTitle>
            <DialogDescription>
              {selectedPenalty?.penalty_type?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedPenalty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <div>
                    <Badge variant={getStatusBadgeVariant(selectedPenalty.status)}>
                      {PENALTY_STATUS_ICONS[selectedPenalty.status]}{' '}
                      {PENALTY_STATUS_LABELS[selectedPenalty.status]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Origen</Label>
                  <div>{PENALTY_SOURCE_LABELS[selectedPenalty.source === 'entel' ? 'entel' : 'internal']}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Usuario</Label>
                <div className="font-medium">{selectedPenalty.user?.nombre_completo}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedPenalty.user?.codigo_asesor}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Tienda</Label>
                <div>{selectedPenalty.store?.nombre || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Período</Label>
                  <div>{selectedPenalty.month}/{selectedPenalty.year}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha Incidente</Label>
                  <div>
                    {selectedPenalty.incident_date
                      ? formatShortDate(selectedPenalty.incident_date)
                      : '-'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Cantidad</Label>
                  <div className="text-lg font-semibold">{selectedPenalty.quantity}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monto SSNN</Label>
                  <div>{formatCurrency(selectedPenalty.original_amount || 0)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monto HC</Label>
                  <div className="text-lg font-semibold text-red-600">
                    {formatCurrency(selectedPenalty.transferred_amount || 0)}
                  </div>
                </div>
              </div>

              {selectedPenalty.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notas</Label>
                  <div className="text-sm">{selectedPenalty.notes}</div>
                </div>
              )}

              {selectedPenalty.status === 'waived' && (
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-xs text-muted-foreground">Motivo de Condonación</Label>
                  <div className="text-sm">{selectedPenalty.waived_reason}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Por: {selectedPenalty.waived_by_user?.nombre_completo || '-'}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedPenalty && canWaive && selectedPenalty.status !== 'waived' && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowDetailModal(false)
                  handleOpenWaive(selectedPenalty)
                }}
              >
                Condonar
              </Button>
            )}
            <Button onClick={() => setShowDetailModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Condonar */}
      <Dialog open={showWaiveModal} onOpenChange={setShowWaiveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Condonar Penalidad</DialogTitle>
            <DialogDescription>
              Esta acción marcará la penalidad como condonada y no se aplicará al cálculo de comisiones.
            </DialogDescription>
          </DialogHeader>

          {selectedPenalty && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedPenalty.penalty_type?.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedPenalty.user?.nombre_completo} - {formatCurrency(selectedPenalty.transferred_amount || 0)}
                </div>
              </div>

              <div>
                <Label>Motivo de Condonación *</Label>
                <Textarea
                  placeholder="Ingrese el motivo por el cual se condona esta penalidad..."
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWaiveModal(false)}
              disabled={waiving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleWaive}
              disabled={waiving || !waiveReason.trim()}
            >
              {waiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Condonación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
