'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  Building,
  Check,
  AlertTriangle,
  Loader2,
  Calculator,
  Save,
  ChevronDown,
  ChevronRight,
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
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Usuario } from '@/types'

// Roles que pueden distribuir
const ROLES_DISTRIBUIR = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES', 'JEFE_VENTAS']

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface StoreQuota {
  id: string
  store_id: string
  ss_quota: number
  quota_breakdown: Record<string, number>
  status: string
  store: {
    id: string
    codigo: string
    nombre: string
  }
  hc_count: number
}

interface Advisor {
  id: string
  codigo_asesor: string
  nombre_completo: string
  rol: string
  zona?: string
}

interface HCQuota {
  user_id: string
  ss_quota: number
  start_date: string | null
  proration_factor: number
}

interface Distribution {
  user_id: string
  ss_quota: number
  start_date: string | null
}

export default function DistribucionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedStoreId = searchParams.get('store_id')

  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Período
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  // Datos
  const [storeQuotas, setStoreQuotas] = useState<StoreQuota[]>([])
  const [expandedStore, setExpandedStore] = useState<string | null>(preselectedStoreId)
  const [storeAdvisors, setStoreAdvisors] = useState<Record<string, Advisor[]>>({})
  const [storeDistributions, setStoreDistributions] = useState<Record<string, Distribution[]>>({})

  // Modal de distribución
  const [showDistributeModal, setShowDistributeModal] = useState(false)
  const [selectedStoreQuota, setSelectedStoreQuota] = useState<StoreQuota | null>(null)
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_DISTRIBUIR.includes(usuario.rol)) {
      router.push('/cuotas')
      return
    }
    setUser(usuario)
  }, [router])

  // Cargar cuotas de tienda
  useEffect(() => {
    async function loadStoreQuotas() {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/cuotas/store-quotas?year=${selectedYear}&month=${selectedMonth}`
        )
        const data = await response.json()

        if (data.store_quotas) {
          setStoreQuotas(data.store_quotas)

          // Si hay una tienda preseleccionada, expandirla
          if (preselectedStoreId) {
            setExpandedStore(preselectedStoreId)
          }
        }
      } catch (error) {
        console.error('Error cargando cuotas:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadStoreQuotas()
    }
  }, [user, selectedYear, selectedMonth, preselectedStoreId])

  // Cargar asesores cuando se expande una tienda
  const loadAdvisorsForStore = useCallback(async (storeId: string) => {
    if (storeAdvisors[storeId]) return // Ya cargados

    try {
      // Obtener usuarios asignados a la tienda via usuarios_tiendas
      const { data: usuariosTiendas } = await supabase
        .from('usuarios_tiendas')
        .select('usuario:usuarios(id, codigo_asesor, nombre_completo, rol, zona)')
        .eq('tienda_id', storeId)

      // Filtrar usuarios activos con roles válidos
      const advisors = (usuariosTiendas || [])
        .map(ut => ut.usuario as unknown as { id: string; codigo_asesor: string; nombre_completo: string; rol: string; zona: string } | null)
        .filter((u): u is NonNullable<typeof u> =>
          u !== null &&
          ['ASESOR', 'ASESOR_REFERENTE'].includes(u.rol)
        )
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))

      setStoreAdvisors(prev => ({ ...prev, [storeId]: advisors }))

      // Cargar distribuciones existentes
      const storeQuota = storeQuotas.find(sq => sq.store_id === storeId)
      if (storeQuota) {
        const { data: hcQuotas } = await supabase
          .from('hc_quotas')
          .select('user_id, ss_quota, start_date, proration_factor')
          .eq('store_quota_id', storeQuota.id)

        if (hcQuotas) {
          const dists: Distribution[] = hcQuotas.map(hq => ({
            user_id: hq.user_id,
            ss_quota: hq.ss_quota,
            start_date: hq.start_date,
          }))
          setStoreDistributions(prev => ({ ...prev, [storeId]: dists }))
        }
      }
    } catch (error) {
      console.error('Error cargando asesores:', error)
    }
  }, [storeAdvisors, storeQuotas, supabase])

  // Toggle expansión de tienda
  const handleToggleStore = (storeId: string) => {
    if (expandedStore === storeId) {
      setExpandedStore(null)
    } else {
      setExpandedStore(storeId)
      loadAdvisorsForStore(storeId)
    }
  }

  // Abrir modal de distribución
  const handleOpenDistribute = (storeQuota: StoreQuota) => {
    setSelectedStoreQuota(storeQuota)
    setError(null)

    const advisors = storeAdvisors[storeQuota.store_id] || []
    const existingDist = storeDistributions[storeQuota.store_id] || []

    // Crear distribuciones iniciales
    const initialDist: Distribution[] = advisors.map(advisor => {
      const existing = existingDist.find(d => d.user_id === advisor.id)
      return {
        user_id: advisor.id,
        ss_quota: existing?.ss_quota || 0,
        start_date: existing?.start_date || null,
      }
    })

    setDistributions(initialDist)
    setShowDistributeModal(true)
  }

  // Distribución equitativa
  const handleDistributeEqually = () => {
    if (!selectedStoreQuota) return

    const count = distributions.length
    if (count === 0) return

    const perAdvisor = Math.floor(selectedStoreQuota.ss_quota / count)
    const remainder = selectedStoreQuota.ss_quota % count

    setDistributions(prev =>
      prev.map((d, i) => ({
        ...d,
        ss_quota: perAdvisor + (i < remainder ? 1 : 0),
      }))
    )
  }

  // Actualizar cuota de un asesor
  const handleQuotaChange = (userId: string, value: number) => {
    setDistributions(prev =>
      prev.map(d =>
        d.user_id === userId ? { ...d, ss_quota: value } : d
      )
    )
  }

  // Actualizar fecha de inicio
  const handleStartDateChange = (userId: string, date: string | null) => {
    setDistributions(prev =>
      prev.map(d =>
        d.user_id === userId ? { ...d, start_date: date } : d
      )
    )
  }

  // Guardar distribución
  const handleSaveDistribution = async () => {
    if (!selectedStoreQuota || !user) return

    const totalDistributed = distributions.reduce((sum, d) => sum + d.ss_quota, 0)

    if (totalDistributed !== selectedStoreQuota.ss_quota) {
      setError(
        `La suma (${totalDistributed}) no coincide con la cuota de tienda (${selectedStoreQuota.ss_quota})`
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/cuotas/store-quotas/${selectedStoreQuota.id}/distribute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            distributions: distributions.filter(d => d.ss_quota > 0),
            distributed_by: user.id,
          }),
        }
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al distribuir')
      }

      // Actualizar estado local
      setStoreDistributions(prev => ({
        ...prev,
        [selectedStoreQuota.store_id]: distributions,
      }))

      // Actualizar conteo de HCs en la lista
      setStoreQuotas(prev =>
        prev.map(sq =>
          sq.id === selectedStoreQuota.id
            ? { ...sq, hc_count: distributions.filter(d => d.ss_quota > 0).length }
            : sq
        )
      )

      setShowDistributeModal(false)
      toast.success('Distribución guardada correctamente', {
        description: `${distributions.filter(d => d.ss_quota > 0).length} asesores con cuota asignada`,
      })
    } catch (error) {
      console.error('Error guardando distribución:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar'
      setError(errorMessage)
      toast.error('Error al guardar distribución', {
        description: errorMessage,
      })
    } finally {
      setSaving(false)
    }
  }

  const totalDistributed = distributions.reduce((sum, d) => sum + d.ss_quota, 0)
  const isBalanced = selectedStoreQuota ? totalDistributed === selectedStoreQuota.ss_quota : false

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
            <h1 className="text-3xl font-bold tracking-tight">Distribución de Cuotas</h1>
            <p className="text-muted-foreground">
              Asigna las cuotas de tienda a los asesores
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : storeQuotas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay cuotas importadas para este período
            </p>
            <Button className="mt-4" onClick={() => router.push('/cuotas/importar')}>
              Importar Cuotas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {storeQuotas.map((storeQuota) => {
            const advisors = storeAdvisors[storeQuota.store_id] || []
            const existingDist = storeDistributions[storeQuota.store_id] || []
            const isExpanded = expandedStore === storeQuota.store_id
            const totalDist = existingDist.reduce((sum, d) => sum + d.ss_quota, 0)
            const isComplete = totalDist === storeQuota.ss_quota && advisors.length > 0

            return (
              <Collapsible
                key={storeQuota.id}
                open={isExpanded}
                onOpenChange={() => handleToggleStore(storeQuota.store_id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <div>
                            <CardTitle className="text-lg">
                              {storeQuota.store.nombre}
                            </CardTitle>
                            <CardDescription>
                              {storeQuota.store.codigo}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-2xl font-bold">{storeQuota.ss_quota}</p>
                            <p className="text-sm text-muted-foreground">Cuota SS</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-medium">{storeQuota.hc_count || 0}</p>
                            <p className="text-sm text-muted-foreground">HC</p>
                          </div>
                          <Badge variant={isComplete ? 'default' : 'secondary'}>
                            {isComplete ? 'Distribuido' : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="border-t">
                      {advisors.length === 0 ? (
                        <div className="py-4 text-center text-muted-foreground">
                          {storeAdvisors[storeQuota.store_id] === undefined ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          ) : (
                            <>
                              <Users className="h-8 w-8 mx-auto mb-2" />
                              <p>No hay asesores asignados a esta tienda</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Asesor</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead className="text-right">Cuota SS</TableHead>
                                <TableHead>Inicio</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {advisors.map((advisor) => {
                                const dist = existingDist.find(d => d.user_id === advisor.id)
                                return (
                                  <TableRow key={advisor.id}>
                                    <TableCell>
                                      <div className="font-medium">
                                        {advisor.nombre_completo}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {advisor.codigo_asesor}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{advisor.rol}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {dist?.ss_quota || 0}
                                    </TableCell>
                                    <TableCell>
                                      {dist?.start_date || '01/01'}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                          <div className="flex justify-between items-center mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Total distribuido:</span>
                              <span className="font-bold">{totalDist}</span>
                              <span className="text-muted-foreground">de</span>
                              <span className="font-bold">{storeQuota.ss_quota}</span>
                              {totalDist === storeQuota.ss_quota ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <Button onClick={() => handleOpenDistribute(storeQuota)}>
                              <Calculator className="mr-2 h-4 w-4" />
                              Distribuir
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )
          })}
        </div>
      )}

      {/* Modal de Distribución */}
      <Dialog open={showDistributeModal} onOpenChange={setShowDistributeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Distribuir Cuota - {selectedStoreQuota?.store.nombre}
            </DialogTitle>
            <DialogDescription>
              Cuota de tienda: <strong>{selectedStoreQuota?.ss_quota} SS</strong> |
              Propuesta equitativa:{' '}
              <strong>
                {distributions.length > 0
                  ? ((selectedStoreQuota?.ss_quota || 0) / distributions.length).toFixed(1)
                  : 0}{' '}
                SS/asesor
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asesor</TableHead>
                  <TableHead className="w-[120px]">Cuota SS</TableHead>
                  <TableHead className="w-[140px]">Inicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((dist) => {
                  const advisor = storeAdvisors[selectedStoreQuota?.store_id || '']?.find(
                    a => a.id === dist.user_id
                  )
                  return (
                    <TableRow key={dist.user_id}>
                      <TableCell>
                        <div className="font-medium">
                          {advisor?.nombre_completo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={selectedStoreQuota?.ss_quota || 999}
                          value={dist.ss_quota}
                          onChange={(e) =>
                            handleQuotaChange(dist.user_id, parseInt(e.target.value) || 0)
                          }
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={dist.start_date || ''}
                          onChange={(e) =>
                            handleStartDateChange(dist.user_id, e.target.value || null)
                          }
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <span>Total:</span>
              <span className={`font-bold text-lg ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {totalDistributed}
              </span>
              <span className="text-muted-foreground">
                / {selectedStoreQuota?.ss_quota}
              </span>
              {isBalanced ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
            <Button variant="outline" onClick={handleDistributeEqually}>
              <Calculator className="mr-2 h-4 w-4" />
              Distribuir equitativamente
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistributeModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDistribution} disabled={saving || !isBalanced}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar Distribución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
