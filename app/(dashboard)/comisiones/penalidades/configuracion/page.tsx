'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Settings,
  Plus,
  Edit,
  History,
  AlertTriangle,
  Building2,
  FileText,
  ArrowLeft,
  Save,
  Loader2,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import {
  type PenaltyType,
  type PenaltyEquivalence,
  type TransferType,
  TRANSFER_TYPE_LABELS,
} from '@/lib/penalidades/types'

interface PenaltyTypeWithEquivalence extends PenaltyType {
  equivalence?: PenaltyEquivalence
}

interface EquivalenceFormData {
  transfer_type: TransferType
  transfer_percentage: number | null
  transfer_fixed_amount: number | null
  max_incidents_per_month: number | null
  notes: string
}

export default function ConfiguracionPenalidadesPage() {
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyTypeWithEquivalence[]>([])
  const [equivalences, setEquivalences] = useState<PenaltyEquivalence[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [newTypeModalOpen, setNewTypeModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<PenaltyTypeWithEquivalence | null>(null)

  // Form states
  const [equivalenceForm, setEquivalenceForm] = useState<EquivalenceFormData>({
    transfer_type: 'full',
    transfer_percentage: null,
    transfer_fixed_amount: null,
    max_incidents_per_month: null,
    notes: '',
  })

  const [newTypeForm, setNewTypeForm] = useState({
    code: '',
    name: '',
    description: '',
    base_amount_ssnn: 0,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [typesRes, equivRes] = await Promise.all([
        fetch('/api/penalidades/types'),
        fetch('/api/penalidades/equivalences'),
      ])

      if (typesRes.ok) {
        const typesData = await typesRes.json()
        // La API retorna { types, by_source }, extraemos el array
        const typesArray = typesData.types || typesData
        setPenaltyTypes(Array.isArray(typesArray) ? typesArray : [])
      }

      if (equivRes.ok) {
        const equivData = await equivRes.json()
        // La API puede retornar array directo o dentro de un objeto
        const equivArray = Array.isArray(equivData) ? equivData : (equivData.equivalences || [])
        setEquivalences(equivArray)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Merge equivalences with penalty types
  const typesWithEquivalences: PenaltyTypeWithEquivalence[] = penaltyTypes.map((type) => {
    const equivalence = equivalences.find(
      (eq) => eq.penalty_type_id === type.id && !eq.valid_to
    )
    return { ...type, equivalence }
  })

  const entelTypes = typesWithEquivalences.filter((t) => t.source === 'entel')
  const internalTypes = typesWithEquivalences.filter((t) => t.source === 'internal')

  const openEditModal = (type: PenaltyTypeWithEquivalence) => {
    setSelectedType(type)
    setEquivalenceForm({
      transfer_type: type.equivalence?.transfer_type || 'full',
      transfer_percentage: type.equivalence?.transfer_percentage || null,
      transfer_fixed_amount: type.equivalence?.transfer_fixed_amount || null,
      max_incidents_per_month: type.equivalence?.max_incidents || null,
      notes: type.equivalence?.notes || '',
    })
    setEditModalOpen(true)
  }

  const handleSaveEquivalence = async () => {
    if (!selectedType) return

    setSaving(true)
    try {
      const res = await fetch('/api/penalidades/equivalences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          penalty_type_id: selectedType.id,
          valid_from: new Date().toISOString().split('T')[0],
          transfer_type: equivalenceForm.transfer_type,
          transfer_percentage: equivalenceForm.transfer_percentage,
          transfer_fixed_amount: equivalenceForm.transfer_fixed_amount,
          max_incidents: equivalenceForm.max_incidents_per_month,
          notes: equivalenceForm.notes,
        }),
      })

      if (res.ok) {
        await fetchData()
        setEditModalOpen(false)
        setSelectedType(null)
      } else {
        const error = await res.json()
        alert(error.error || 'Error al guardar configuración')
      }
    } catch (error) {
      console.error('Error saving equivalence:', error)
      alert('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateType = async () => {
    if (!newTypeForm.code || !newTypeForm.name) {
      alert('Código y nombre son requeridos')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/penalidades/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTypeForm,
          source: 'internal',
          is_active: true,
        }),
      })

      if (res.ok) {
        await fetchData()
        setNewTypeModalOpen(false)
        setNewTypeForm({
          code: '',
          name: '',
          description: '',
          base_amount_ssnn: 0,
        })
      } else {
        const error = await res.json()
        alert(error.error || 'Error al crear tipo de penalidad')
      }
    } catch (error) {
      console.error('Error creating type:', error)
      alert('Error al crear tipo de penalidad')
    } finally {
      setSaving(false)
    }
  }

  const getTransferDescription = (equivalence?: PenaltyEquivalence): string => {
    if (!equivalence) return 'Sin configurar'

    switch (equivalence.transfer_type) {
      case 'none':
        return 'No se transfiere al HC'
      case 'full':
        return '100% del monto SSNN'
      case 'percentage':
        return `${equivalence.transfer_percentage}% del monto SSNN`
      case 'fixed':
        return `Monto fijo: S/ ${equivalence.transfer_fixed_amount?.toFixed(2)}`
      case 'partial_count':
        return `Máx ${equivalence.max_incidents_per_month} incidencias/mes`
      default:
        return 'Desconocido'
    }
  }

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-'
    return `S/ ${amount.toFixed(2)}`
  }

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
              <Settings className="h-6 w-6" />
              Configuración de Penalidades
            </h1>
            <p className="text-muted-foreground">
              Administra los tipos de penalidades y sus equivalencias de transferencia
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Sobre las equivalencias de transferencia</p>
              <p>
                Las equivalencias definen cómo se calcula el monto que se transfiere de la
                penalidad SSNN al HC. Puedes configurar transferencia total, porcentual, monto
                fijo, o limitar por cantidad de incidencias.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="entel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entel" className="gap-2">
            <Building2 className="h-4 w-4" />
            Penalidades Entel ({entelTypes.length})
          </TabsTrigger>
          <TabsTrigger value="internal" className="gap-2">
            <FileText className="h-4 w-4" />
            Penalidades Internas ({internalTypes.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Entel Penalties */}
        <TabsContent value="entel">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Penalidades de Entel (FICHA)
              </CardTitle>
              <CardDescription>
                Penalidades que Entel cobra a SSNN y pueden transferirse parcialmente a los HC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Monto Base SSNN</TableHead>
                    <TableHead>Transferencia HC</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entelTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay tipos de penalidades Entel configurados
                      </TableCell>
                    </TableRow>
                  ) : (
                    entelTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-mono font-medium">{type.code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{type.name}</div>
                            {type.description && (
                              <div className="text-xs text-muted-foreground">
                                {type.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(type.base_amount_ssnn)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!type.equivalence ? (
                              <Badge variant="outline" className="text-yellow-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Sin configurar
                              </Badge>
                            ) : (
                              <span className="text-sm">
                                {getTransferDescription(type.equivalence)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={type.is_active ? 'default' : 'secondary'}>
                            {type.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(type)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Internal Penalties */}
        <TabsContent value="internal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Penalidades Internas (PBD)
                </CardTitle>
                <CardDescription>
                  Penalidades internas del socio (tardanzas, inasistencias, uniformes, etc.)
                </CardDescription>
              </div>
              <Button onClick={() => setNewTypeModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Tipo
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Monto Base</TableHead>
                    <TableHead>Transferencia HC</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {internalTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay tipos de penalidades internas configurados
                      </TableCell>
                    </TableRow>
                  ) : (
                    internalTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-mono font-medium">{type.code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{type.name}</div>
                            {type.description && (
                              <div className="text-xs text-muted-foreground">
                                {type.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(type.base_amount_ssnn)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!type.equivalence ? (
                              <Badge variant="outline" className="text-yellow-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Sin configurar
                              </Badge>
                            ) : (
                              <span className="text-sm">
                                {getTransferDescription(type.equivalence)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={type.is_active ? 'default' : 'secondary'}>
                            {type.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(type)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Cambios
              </CardTitle>
              <CardDescription>
                Registro de cambios en la configuración de equivalencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                El historial de cambios estará disponible próximamente
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Equivalence Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Equivalencia</DialogTitle>
            <DialogDescription>
              {selectedType && (
                <span>
                  Penalidad: <strong>{selectedType.code}</strong> - {selectedType.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Transferencia</Label>
              <Select
                value={equivalenceForm.transfer_type}
                onValueChange={(value: TransferType) =>
                  setEquivalenceForm((prev) => ({
                    ...prev,
                    transfer_type: value,
                    transfer_percentage: value === 'percentage' ? prev.transfer_percentage : null,
                    transfer_fixed_amount: value === 'fixed' ? prev.transfer_fixed_amount : null,
                    max_incidents_per_month:
                      value === 'partial_count' ? prev.max_incidents_per_month : null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRANSFER_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {equivalenceForm.transfer_type === 'percentage' && (
              <div className="space-y-2">
                <Label>Porcentaje de Transferencia</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={equivalenceForm.transfer_percentage || ''}
                    onChange={(e) =>
                      setEquivalenceForm((prev) => ({
                        ...prev,
                        transfer_percentage: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                    placeholder="50"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Porcentaje del monto SSNN que se transfiere al HC
                </p>
              </div>
            )}

            {equivalenceForm.transfer_type === 'fixed' && (
              <div className="space-y-2">
                <Label>Monto Fijo</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">S/</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={equivalenceForm.transfer_fixed_amount || ''}
                    onChange={(e) =>
                      setEquivalenceForm((prev) => ({
                        ...prev,
                        transfer_fixed_amount: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                    placeholder="50.00"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Monto fijo que se transfiere al HC independiente del monto SSNN
                </p>
              </div>
            )}

            {equivalenceForm.transfer_type === 'partial_count' && (
              <div className="space-y-2">
                <Label>Máximo de Incidencias por Mes</Label>
                <Input
                  type="number"
                  min={1}
                  value={equivalenceForm.max_incidents_per_month || ''}
                  onChange={(e) =>
                    setEquivalenceForm((prev) => ({
                      ...prev,
                      max_incidents_per_month: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  placeholder="3"
                />
                <p className="text-xs text-muted-foreground">
                  Solo se transfieren hasta este número de incidencias al mes
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={equivalenceForm.notes}
                onChange={(e) =>
                  setEquivalenceForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Notas sobre esta configuración..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEquivalence} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Type Modal */}
      <Dialog open={newTypeModalOpen} onOpenChange={setNewTypeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Tipo de Penalidad Interna</DialogTitle>
            <DialogDescription>
              Crea un nuevo tipo de penalidad para registros internos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={newTypeForm.code}
                onChange={(e) =>
                  setNewTypeForm((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="TARDANZA"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Identificador único en mayúsculas sin espacios
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={newTypeForm.name}
                onChange={(e) =>
                  setNewTypeForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Tardanza"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={newTypeForm.description}
                onChange={(e) =>
                  setNewTypeForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descripción de la penalidad..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Monto Base</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">S/</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newTypeForm.base_amount_ssnn || ''}
                  onChange={(e) =>
                    setNewTypeForm((prev) => ({
                      ...prev,
                      base_amount_ssnn: e.target.value ? parseFloat(e.target.value) : 0,
                    }))
                  }
                  placeholder="50.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Monto de referencia para esta penalidad
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTypeModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateType} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Tipo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
