'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Search,
  AlertCircle,
  CheckCircle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ROLES_REGISTRAR,
  formatCurrency,
  calculateTransferredAmount,
} from '@/lib/penalidades/types'
import type { PenaltyType, PenaltyEquivalence } from '@/lib/penalidades/types'
import type { Usuario } from '@/types'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface UserOption {
  id: string
  codigo_asesor: string
  nombre_completo: string
  store_name?: string
  store_id?: string
}

export default function RegistroPenalidadPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Datos para selects
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyType[]>([])
  const [equivalences, setEquivalences] = useState<PenaltyEquivalence[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Formulario
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUserLabel, setSelectedUserLabel] = useState<string>('')
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [originalAmount, setOriginalAmount] = useState<number | null>(null)
  const [incidentDate, setIncidentDate] = useState('')
  const [notes, setNotes] = useState('')
  const [overrideAmount, setOverrideAmount] = useState(false)
  const [customTransferredAmount, setCustomTransferredAmount] = useState<number | null>(null)

  // UI
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')

  const supabase = createClient()

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_REGISTRAR.includes(usuario.rol)) {
      router.push('/comisiones/penalidades')
      return
    }
    setUser(usuario)
    setLoading(false)
  }, [router])

  // Cargar tipos de penalidad (solo internos para registro manual)
  useEffect(() => {
    async function loadTypes() {
      try {
        const response = await fetch('/api/penalidades/types?source=internal')
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

  // Cargar equivalencias
  useEffect(() => {
    async function loadEquivalences() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const response = await fetch(`/api/penalidades/equivalences?valid_date=${today}`)
        const data = await response.json()
        if (data.current) {
          setEquivalences(data.current)
        }
      } catch (error) {
        console.error('Error cargando equivalencias:', error)
      }
    }
    loadEquivalences()
  }, [])

  // Buscar usuarios
  useEffect(() => {
    async function searchUsers() {
      if (userSearchQuery.length < 2) {
        setUsers([])
        return
      }

      setLoadingUsers(true)
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select(`
            id,
            codigo_asesor,
            nombre_completo,
            usuarios_tiendas(
              es_principal,
              tienda:tiendas(id, nombre)
            )
          `)
          .eq('activo', true)
          .in('rol', ['ASESOR', 'ASESOR_REFERENTE', 'SUPERVISOR', 'COORDINADOR'])
          .or(`nombre_completo.ilike.%${userSearchQuery}%,codigo_asesor.ilike.%${userSearchQuery}%`)
          .limit(20)

        if (error) throw error

        const userOptions: UserOption[] = (data || []).map(u => {
          const mainStore = u.usuarios_tiendas?.find((ut: { es_principal: boolean }) => ut.es_principal)
          const store = mainStore?.tienda || u.usuarios_tiendas?.[0]?.tienda

          return {
            id: u.id,
            codigo_asesor: u.codigo_asesor,
            nombre_completo: u.nombre_completo,
            store_name: store?.nombre,
            store_id: store?.id,
          }
        })

        setUsers(userOptions)
      } catch (error) {
        console.error('Error buscando usuarios:', error)
      } finally {
        setLoadingUsers(false)
      }
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [userSearchQuery, supabase])

  // Tipo de penalidad seleccionado
  const selectedType = useMemo(() => {
    return penaltyTypes.find(t => t.id === selectedTypeId)
  }, [penaltyTypes, selectedTypeId])

  // Equivalencia del tipo seleccionado
  const selectedEquivalence = useMemo(() => {
    return equivalences.find(e => e.penalty_type_id === selectedTypeId)
  }, [equivalences, selectedTypeId])

  // Calcular monto trasladado
  const calculatedAmount = useMemo(() => {
    if (!selectedEquivalence) return null

    // Si hay monto base en el tipo, usarlo
    const baseAmount = selectedType?.base_amount_ssnn || originalAmount || 0

    return calculateTransferredAmount(
      baseAmount * quantity,
      quantity,
      selectedEquivalence
    )
  }, [selectedType, selectedEquivalence, quantity, originalAmount])

  // Monto final a aplicar
  const finalAmount = overrideAmount && customTransferredAmount !== null
    ? customTransferredAmount
    : calculatedAmount

  // Seleccionar usuario
  const handleSelectUser = (userOption: UserOption) => {
    setSelectedUserId(userOption.id)
    setSelectedUserLabel(`${userOption.nombre_completo} (${userOption.codigo_asesor})`)
    setSelectedStoreId(userOption.store_id || '')
    setUserSearchOpen(false)
    setUserSearchQuery('')
  }

  // Guardar penalidad
  const handleSubmit = async () => {
    if (!selectedTypeId) {
      toast.error('Seleccione un tipo de penalidad')
      return
    }
    if (!selectedUserId) {
      toast.error('Seleccione un usuario')
      return
    }
    if (quantity < 1) {
      toast.error('La cantidad debe ser al menos 1')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/penalidades/penalties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUserId,
          store_id: selectedStoreId || null,
          penalty_type_id: selectedTypeId,
          year: selectedYear,
          month: selectedMonth,
          incident_date: incidentDate || null,
          quantity,
          original_amount: originalAmount || (selectedType?.base_amount_ssnn || 0) * quantity,
          transferred_amount: finalAmount,
          notes: notes || null,
          created_by: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Error al registrar penalidad')
        return
      }

      toast.success('Penalidad registrada correctamente')
      router.push('/comisiones/penalidades/historial')
    } catch (error) {
      console.error('Error guardando:', error)
      toast.error('Error al registrar penalidad')
    } finally {
      setSaving(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i)

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/comisiones/penalidades')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registrar Penalidad</h1>
          <p className="text-muted-foreground">
            Registrar una penalidad interna manualmente
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Penalidad</CardTitle>
          <CardDescription>
            Complete los datos de la penalidad a registrar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo de penalidad */}
          <div className="space-y-2">
            <Label>Tipo de Penalidad *</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un tipo" />
              </SelectTrigger>
              <SelectContent>
                {penaltyTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                    {type.base_amount_ssnn && (
                      <span className="text-muted-foreground ml-2">
                        ({formatCurrency(type.base_amount_ssnn)})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Usuario */}
          <div className="space-y-2">
            <Label>Usuario HC *</Label>
            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-start"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {selectedUserLabel || 'Buscar usuario...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar por nombre o código..."
                    value={userSearchQuery}
                    onValueChange={setUserSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : userSearchQuery.length < 2 ? (
                        'Ingrese al menos 2 caracteres'
                      ) : (
                        'No se encontraron usuarios'
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {users.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={u.id}
                          onSelect={() => handleSelectUser(u)}
                        >
                          <div>
                            <div className="font-medium">{u.nombre_completo}</div>
                            <div className="text-sm text-muted-foreground">
                              {u.codigo_asesor}
                              {u.store_name && ` - ${u.store_name}`}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Año *</Label>
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
            <div className="space-y-2">
              <Label>Mes *</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(val) => setSelectedMonth(parseInt(val))}
              >
                <SelectTrigger>
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
            </div>
          </div>

          {/* Fecha del incidente */}
          <div className="space-y-2">
            <Label>Fecha del Incidente (opcional)</Label>
            <Input
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
            />
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <Label>Cantidad de Incidencias *</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Monto calculado */}
          {selectedEquivalence && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Monto calculado según equivalencia:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(calculatedAmount || 0)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedType?.base_amount_ssnn
                    ? `${formatCurrency(selectedType.base_amount_ssnn)} × ${quantity} incidencia(s)`
                    : 'Monto base no definido'}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!selectedEquivalence && selectedTypeId && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay equivalencia configurada para este tipo de penalidad.
                Ingrese el monto manualmente.
              </AlertDescription>
            </Alert>
          )}

          {/* Override monto */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="override"
                checked={overrideAmount}
                onCheckedChange={(checked) => setOverrideAmount(checked === true)}
              />
              <Label htmlFor="override">Modificar monto manualmente</Label>
            </div>

            {(overrideAmount || !selectedEquivalence) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto Original (SSNN)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={originalAmount || ''}
                    onChange={(e) => setOriginalAmount(parseFloat(e.target.value) || null)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto Trasladado (HC)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customTransferredAmount || ''}
                    onChange={(e) => setCustomTransferredAmount(parseFloat(e.target.value) || null)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas / Observaciones</Label>
            <Textarea
              placeholder="Descripción del incidente..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Resumen */}
          {selectedTypeId && selectedUserId && finalAmount !== null && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Resumen</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Tipo:</span>
                <span className="font-medium">{selectedType?.name}</span>
                <span>Usuario:</span>
                <span className="font-medium">{selectedUserLabel}</span>
                <span>Período:</span>
                <span className="font-medium">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
                <span>Cantidad:</span>
                <span className="font-medium">{quantity}</span>
                <span>Monto a aplicar:</span>
                <span className="font-bold text-red-600">{formatCurrency(finalAmount)}</span>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/comisiones/penalidades')}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !selectedTypeId || !selectedUserId || finalAmount === null}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Penalidad
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
