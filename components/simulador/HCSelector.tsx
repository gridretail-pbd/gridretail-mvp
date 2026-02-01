'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Loader2, User, Target, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QuotaProrationBadge } from './QuotaProrationBadge'
import type { HCEffectiveQuota, QuotaBreakdown } from '@/lib/simulador/types'

// v1.2: Interfaz actualizada con datos de cuota
interface HCUser {
  id: string
  nombre: string
  codigo: string
  dni: string
  rol: string
  tienda_id: string | null
  tienda_nombre: string | null
  zona: string | null
  // Datos de ventas del mes
  ventas_mes?: number
  penalidades_historicas?: number
  // v1.2: Datos de cuota
  cuota_efectiva?: HCEffectiveQuota | null
}

interface HCSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (user: HCUser) => void
  filterByZona?: string // Para JV que solo puede ver su zona
  title?: string
  // v1.2: Para cargar cuota del período
  year?: number
  month?: number
}

/**
 * Modal para seleccionar un HC específico para simulación
 * Permite buscar, filtrar por tienda/rol/zona, y ver resumen de datos
 */
export function HCSelector({
  open,
  onOpenChange,
  onSelect,
  filterByZona,
  title = 'Seleccionar HC para Simulación',
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
}: HCSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [loadingQuota, setLoadingQuota] = useState(false)
  const [users, setUsers] = useState<HCUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<HCUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [tiendas, setTiendas] = useState<Array<{ id: string; nombre: string }>>([])
  const [selectedUserQuota, setSelectedUserQuota] = useState<HCEffectiveQuota | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [tiendaFilter, setTiendaFilter] = useState<string>('all')
  const [rolFilter, setRolFilter] = useState<string>('all')

  const supabase = createClient()

  // Cargar usuarios HC
  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('usuarios')
        .select(`
          id,
          nombre,
          codigo,
          dni,
          rol,
          tienda_id,
          tiendas(id, nombre, zona)
        `)
        .in('rol', ['ASESOR', 'ASESOR_REFERENTE', 'SUPERVISOR', 'COORDINADOR'])
        .eq('activo', true)
        .order('nombre')

      if (filterByZona) {
        // Filtrar por zona (requiere join con tiendas)
        query = query.eq('tiendas.zona', filterByZona)
      }

      const { data, error } = await query

      if (error) throw error

      const mappedUsers: HCUser[] = (data || []).map((u: any) => ({
        id: u.id,
        nombre: u.nombre,
        codigo: u.codigo,
        dni: u.dni,
        rol: u.rol,
        tienda_id: u.tienda_id,
        tienda_nombre: u.tiendas?.nombre || null,
        zona: u.tiendas?.zona || null,
      }))

      setUsers(mappedUsers)
      setFilteredUsers(mappedUsers)

      // Extraer tiendas únicas
      const uniqueTiendas = Array.from(
        new Map(
          mappedUsers
            .filter(u => u.tienda_id && u.tienda_nombre)
            .map(u => [u.tienda_id, { id: u.tienda_id!, nombre: u.tienda_nombre! }])
        ).values()
      )
      setTiendas(uniqueTiendas)
    } catch (err) {
      console.error('Error cargando usuarios:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, filterByZona])

  // Cargar al abrir
  useEffect(() => {
    if (open) {
      loadUsers()
      setSelectedUserId(null)
      setSearchTerm('')
      setTiendaFilter('all')
      setRolFilter('all')
    }
  }, [open, loadUsers])

  // Aplicar filtros
  useEffect(() => {
    let result = users

    // Filtro de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        u =>
          u.nombre.toLowerCase().includes(term) ||
          u.codigo.toLowerCase().includes(term) ||
          u.dni.includes(term)
      )
    }

    // Filtro de tienda
    if (tiendaFilter !== 'all') {
      result = result.filter(u => u.tienda_id === tiendaFilter)
    }

    // Filtro de rol
    if (rolFilter !== 'all') {
      result = result.filter(u => u.rol === rolFilter)
    }

    setFilteredUsers(result)
  }, [users, searchTerm, tiendaFilter, rolFilter])

  // v1.2: Cargar cuota cuando se selecciona un usuario
  useEffect(() => {
    const loadUserQuota = async () => {
      if (!selectedUserId) {
        setSelectedUserQuota(null)
        return
      }

      setLoadingQuota(true)
      try {
        // Intentar obtener cuota del RPC
        const { data, error: rpcError } = await supabase
          .rpc('get_hc_effective_quota', {
            p_user_id: selectedUserId,
            p_year: year,
            p_month: month
          })

        if (rpcError) {
          // Fallback a query directa si el RPC no existe
          if (rpcError.message?.includes('function') || rpcError.code === '42883') {
            const { data: directData } = await supabase
              .from('hc_quotas')
              .select(`
                id, ss_quota, quota_breakdown, start_date, proration_factor, prorated_ss_quota,
                store:tiendas(nombre)
              `)
              .eq('user_id', selectedUserId)
              .eq('year', year)
              .eq('month', month)
              .single()

            if (directData) {
              const factor = directData.proration_factor || 1
              const breakdown = (directData.quota_breakdown || {}) as QuotaBreakdown
              const effectiveBreakdown: QuotaBreakdown = {}
              for (const [key, value] of Object.entries(breakdown)) {
                effectiveBreakdown[key] = Math.round(value * factor * 10) / 10
              }

              const storeData = Array.isArray(directData.store) ? directData.store[0] : directData.store

              setSelectedUserQuota({
                ss_quota: directData.ss_quota,
                effective_quota: directData.prorated_ss_quota || Math.round(directData.ss_quota * factor * 10) / 10,
                proration_factor: factor,
                quota_breakdown: breakdown,
                effective_breakdown: effectiveBreakdown,
                start_date: directData.start_date,
                store_id: '',
                store_name: storeData?.nombre || '',
                user_name: '',
                has_quota: true
              })
            } else {
              setSelectedUserQuota(null)
            }
            return
          }
          throw rpcError
        }

        if (data) {
          setSelectedUserQuota({
            ss_quota: data.ss_quota || 0,
            effective_quota: data.effective_quota || data.ss_quota || 0,
            proration_factor: data.proration_factor || 1,
            quota_breakdown: data.quota_breakdown || {},
            effective_breakdown: data.effective_breakdown || data.quota_breakdown || {},
            start_date: data.start_date || null,
            store_id: data.store_id || '',
            store_name: data.store_name || '',
            user_name: data.user_name || '',
            has_quota: true
          })
        } else {
          setSelectedUserQuota(null)
        }
      } catch (err) {
        console.error('Error cargando cuota del usuario:', err)
        setSelectedUserQuota(null)
      } finally {
        setLoadingQuota(false)
      }
    }

    loadUserQuota()
  }, [selectedUserId, supabase, year, month])

  // Usuario seleccionado
  const selectedUser = users.find(u => u.id === selectedUserId)

  const handleConfirm = () => {
    if (selectedUser) {
      // v1.2: Incluir cuota en el usuario seleccionado
      const userWithQuota: HCUser = {
        ...selectedUser,
        cuota_efectiva: selectedUserQuota
      }
      onSelect(userWithQuota)
      onOpenChange(false)
    }
  }

  const rolLabels: Record<string, string> = {
    ASESOR: 'Asesor',
    ASESOR_REFERENTE: 'Asesor Ref.',
    SUPERVISOR: 'Supervisor',
    COORDINADOR: 'Coordinador',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Busca y selecciona un HC para simular su comisión con datos reales
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <Label className="sr-only">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label className="sr-only">Tienda</Label>
            <Select value={tiendaFilter} onValueChange={setTiendaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tienda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las tiendas</SelectItem>
                {tiendas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="sr-only">Rol</Label>
            <Select value={rolFilter} onValueChange={setRolFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="ASESOR">Asesor</SelectItem>
                <SelectItem value="ASESOR_REFERENTE">Asesor Referente</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                <SelectItem value="COORDINADOR">Coordinador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando usuarios...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              No se encontraron usuarios
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <RadioGroup
                  value={selectedUserId || ''}
                  onValueChange={setSelectedUserId}
                >
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className={`cursor-pointer ${
                        selectedUserId === user.id ? 'bg-muted/50' : ''
                      }`}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <TableCell>
                        <RadioGroupItem value={user.id} />
                      </TableCell>
                      <TableCell className="font-medium">{user.nombre}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {user.codigo}
                      </TableCell>
                      <TableCell>{user.tienda_nombre || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {rolLabels[user.rol] || user.rol}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </RadioGroup>
              </TableBody>
            </Table>
          )}
        </div>

        {/* Resumen del usuario seleccionado - v1.2: Con datos de cuota */}
        {selectedUser && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{selectedUser.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedUser.tienda_nombre} • {rolLabels[selectedUser.rol]}
                </p>
              </div>
              {selectedUser.ventas_mes !== undefined && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Ventas del mes</p>
                  <p className="font-medium">{selectedUser.ventas_mes} líneas SS</p>
                </div>
              )}
            </div>

            {/* v1.2: Info de cuota del usuario */}
            <div className="pt-2 border-t">
              {loadingQuota ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando cuota...
                </div>
              ) : selectedUserQuota ? (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" />
                      Cuota SS
                    </p>
                    <p className="font-medium">
                      {selectedUserQuota.ss_quota}
                      {selectedUserQuota.proration_factor < 1 && (
                        <span className="text-muted-foreground"> → {selectedUserQuota.effective_quota}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prorrateo</p>
                    <QuotaProrationBadge
                      startDate={selectedUserQuota.start_date}
                      prorationFactor={selectedUserQuota.proration_factor}
                      year={year}
                      month={month}
                      size="sm"
                    />
                  </div>
                  {selectedUserQuota.start_date && selectedUserQuota.proration_factor < 1 && (
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Inicio
                      </p>
                      <p className="font-medium">
                        {new Date(selectedUserQuota.start_date).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  Sin cuota asignada para este período
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          <p className="text-sm text-muted-foreground flex-1">
            Mostrando {filteredUsers.length} de {users.length} usuarios
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedUserId}>
            Simular con este HC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
