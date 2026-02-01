'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Lock,
  AlertTriangle,
  ChevronRight,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { SchemeStatusBadge } from '@/components/comisiones/SchemeStatusBadge'
import { SchemeItemModal } from '@/components/comisiones/SchemeItemModal'
import { LockConfigModal } from '@/components/comisiones/LockConfigModal'
import {
  CommissionScheme,
  CommissionSchemeItem,
  CommissionItemType,
  CommissionItemLock,
  PartitionPreset,
  TipoVenta,
  formatPeriod,
  SCHEME_TYPE_LABELS,
  ITEM_CATEGORY_LABELS,
} from '@/lib/comisiones'
import { type SchemeItemFormValues, type LockFormValues } from '@/lib/comisiones/validations'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'
import { toast } from 'sonner'

const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

interface PresetWithVentas extends PartitionPreset {
  tipos_venta?: Array<{
    tipo_venta_id: string
    codigo: string
    nombre: string
    categoria: string
    cuenta_linea: boolean
    cuenta_equipo: boolean
  }>
}

interface ItemVenta {
  id: string
  tipo_venta_id: string
  codigo?: string
  nombre?: string
  categoria?: string
  cuenta_linea: boolean
  cuenta_equipo: boolean
}

// Use Omit to avoid conflict with tipos_venta type from parent
interface ItemWithLocks extends Omit<CommissionSchemeItem, 'tipos_venta'> {
  locks: CommissionItemLock[]
  pxq_scales: Array<{ id: string; min_fulfillment: number; max_fulfillment?: number; amount_per_unit: number }>
  tipos_venta?: ItemVenta[]
}

export default function PartidasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [scheme, setScheme] = useState<CommissionScheme | null>(null)
  const [items, setItems] = useState<ItemWithLocks[]>([])
  const [itemTypes, setItemTypes] = useState<CommissionItemType[]>([])
  const [presets, setPresets] = useState<PresetWithVentas[]>([])
  const [tiposVenta, setTiposVenta] = useState<TipoVenta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemWithLocks | null>(null)
  const [lockModalOpen, setLockModalOpen] = useState(false)
  const [selectedItemForLocks, setSelectedItemForLocks] = useState<ItemWithLocks | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  const isDraft = scheme?.status === 'draft'
  const canEdit = user?.rol && ROLES_EDICION.includes(user.rol) && isDraft

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_EDICION.includes(usuario.rol)) {
      router.push(`/comisiones/esquemas/${id}`)
      return
    }
    setUser(usuario)
  }, [router, id])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Cargar esquema, partidas, presets y tipos de venta
        const [schemeResponse, itemsResponse, typesResponse, presetsResponse, tiposVentaResponse] = await Promise.all([
          fetch(`/api/comisiones/esquemas/${id}`),
          fetch(`/api/comisiones/esquemas/${id}/partidas`),
          fetch('/api/comisiones/tipos-partida'),
          fetch('/api/comisiones/presets'),
          fetch('/api/comisiones/tipos-venta'),
        ])

        const schemeData = await schemeResponse.json()
        const itemsData = await itemsResponse.json()
        const typesData = await typesResponse.json()
        const presetsData = await presetsResponse.json()
        const tiposVentaData = await tiposVentaResponse.json()

        if (!schemeResponse.ok) {
          throw new Error(schemeData.error || 'Error al cargar esquema')
        }

        setScheme(schemeData.scheme)
        setItems(itemsData.items || [])
        setItemTypes(typesData.itemTypes || [])
        setPresets(presetsData || [])
        setTiposVenta(tiposVentaData.items || [])
      } catch (error) {
        console.error('Error:', error)
        toast.error('Error al cargar datos')
        router.push('/comisiones/esquemas')
      } finally {
        setLoading(false)
      }
    }

    if (user && id) {
      loadData()
    }
  }, [user, id, router])

  const handleAddItem = async (values: SchemeItemFormValues) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/comisiones/esquemas/${id}/partidas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al agregar partida')
      }

      setItems([...items, data.item])
      setItemModalOpen(false)
      toast.success('Partida agregada')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al agregar partida')
    } finally {
      setSaving(false)
    }
  }

  const handleEditItem = async (values: SchemeItemFormValues) => {
    if (!editingItem) return

    try {
      setSaving(true)
      const response = await fetch(`/api/comisiones/esquemas/${id}/partidas/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar partida')
      }

      setItems(items.map(item =>
        item.id === editingItem.id ? data.item : item
      ))
      setItemModalOpen(false)
      setEditingItem(null)
      toast.success('Partida actualizada')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al actualizar partida')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      setDeletingItemId(itemId)
      const response = await fetch(`/api/comisiones/esquemas/${id}/partidas/${itemId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al eliminar partida')
      }

      setItems(items.filter(item => item.id !== itemId))
      toast.success('Partida eliminada')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al eliminar partida')
    } finally {
      setDeletingItemId(null)
    }
  }

  const handleAddLock = async (values: LockFormValues) => {
    if (!selectedItemForLocks) return

    try {
      setSaving(true)
      const response = await fetch(`/api/comisiones/esquemas/${id}/partidas/${selectedItemForLocks.id}/candados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al agregar candado')
      }

      // Actualizar el item con el nuevo candado
      setItems(items.map(item =>
        item.id === selectedItemForLocks.id
          ? { ...item, locks: [...item.locks, data.lock] }
          : item
      ))
      setSelectedItemForLocks(prev => prev ? {
        ...prev,
        locks: [...prev.locks, data.lock],
      } : null)
      toast.success('Candado agregado')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al agregar candado')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLock = async (lockId: string) => {
    if (!selectedItemForLocks) return

    try {
      const response = await fetch(
        `/api/comisiones/esquemas/${id}/partidas/${selectedItemForLocks.id}/candados?lock_id=${lockId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al eliminar candado')
      }

      // Actualizar el item sin el candado eliminado
      setItems(items.map(item =>
        item.id === selectedItemForLocks.id
          ? { ...item, locks: item.locks.filter(l => l.id !== lockId) }
          : item
      ))
      setSelectedItemForLocks(prev => prev ? {
        ...prev,
        locks: prev.locks.filter(l => l.id !== lockId),
      } : null)
      toast.success('Candado eliminado')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al eliminar candado')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount)
  }

  // Calcular suma de pesos de partidas principales
  const principalItems = items.filter(i =>
    i.item_type?.category === 'principal' || i.preset?.default_category === 'principal'
  )
  const totalWeight = principalItems.reduce((sum, item) => sum + (item.weight || 0), 0)
  const weightsValid = Math.abs(totalWeight - 1) <= 0.001

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!scheme) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/comisiones/esquemas/${id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Partidas del Esquema</h1>
              <SchemeStatusBadge status={scheme.status} />
            </div>
            <p className="text-muted-foreground">
              {scheme.name} - {SCHEME_TYPE_LABELS[scheme.scheme_type]} - {formatPeriod(scheme.year, scheme.month)}
            </p>
          </div>
        </div>

        {canEdit && (
          <Button onClick={() => {
            setEditingItem(null)
            setItemModalOpen(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Partida
          </Button>
        )}
      </div>

      {/* Indicador de pesos */}
      {principalItems.length > 0 && (
        <Card className={weightsValid ? 'border-green-500' : 'border-yellow-500'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {weightsValid ? (
                <Badge variant="default" className="bg-green-500">
                  Pesos OK
                </Badge>
              ) : (
                <Badge variant="default" className="bg-yellow-500">
                  Pesos: {(totalWeight * 100).toFixed(1)}%
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {weightsValid
                  ? 'Las partidas principales suman 100%'
                  : `Las partidas principales deben sumar 100%. Actual: ${(totalWeight * 100).toFixed(1)}%`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de partidas */}
      <Card>
        <CardHeader>
          <CardTitle>Partidas ({items.length})</CardTitle>
          <CardDescription>
            Configura las partidas comisionables del esquema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay partidas configuradas</p>
              {canEdit && (
                <Button
                  className="mt-4"
                  onClick={() => {
                    setEditingItem(null)
                    setItemModalOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar primera partida
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Variable</TableHead>
                  <TableHead className="text-right">Cumpl. Mín</TableHead>
                  <TableHead className="text-center">Tope</TableHead>
                  <TableHead className="text-center">Candados</TableHead>
                  {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.custom_name || item.preset?.name || item.item_type?.name || item.item_type?.code || 'Sin nombre'}
                      {!item.is_active && (
                        <Badge variant="outline" className="ml-2">Inactivo</Badge>
                      )}
                      {item.tipos_venta && item.tipos_venta.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.tipos_venta.slice(0, 3).map(tv => (
                            <Badge key={tv.tipo_venta_id} variant="outline" className="text-xs">
                              {tv.codigo}
                            </Badge>
                          ))}
                          {item.tipos_venta.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.tipos_venta.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ITEM_CATEGORY_LABELS[item.preset?.default_category || item.item_type?.category || 'adicional']}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quota || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.weight ? `${(item.weight * 100).toFixed(0)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.variable_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.min_fulfillment
                        ? `${(item.min_fulfillment * 100).toFixed(0)}%`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.has_cap ? (
                        <Badge variant="outline">
                          {item.cap_percentage
                            ? `${(item.cap_percentage * 100).toFixed(0)}%`
                            : 'Sí'}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.locks.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItemForLocks(item)
                            setLockModalOpen(true)
                          }}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          {item.locks.length}
                        </Button>
                      ) : canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItemForLocks(item)
                            setLockModalOpen(true)
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      ) : '-'}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingItem(item)
                              setItemModalOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                {deletingItemId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar partida?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará la partida "{item.custom_name || item.preset?.name || item.item_type?.name || 'sin nombre'}" y sus candados asociados.
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Navegación */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push(`/comisiones/esquemas/${id}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Resumen
        </Button>

        <Button
          onClick={() => router.push(`/comisiones/esquemas/${id}/restricciones`)}
        >
          Configurar Restricciones
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Modales */}
      <SchemeItemModal
        open={itemModalOpen}
        onOpenChange={(open) => {
          setItemModalOpen(open)
          if (!open) setEditingItem(null)
        }}
        presets={presets}
        tiposVenta={tiposVenta}
        defaultValues={editingItem ? {
          item_type_id: editingItem.item_type_id,
          preset_id: editingItem.preset_id,
          custom_name: editingItem.custom_name,
          custom_description: editingItem.custom_description,
          tipos_venta_ids: editingItem.tipos_venta?.map(tv => ({
            tipo_venta_id: tv.tipo_venta_id,
            cuenta_linea: tv.cuenta_linea,
            cuenta_equipo: tv.cuenta_equipo,
          })),
          quota: editingItem.quota,
          quota_amount: editingItem.quota_amount,
          weight: editingItem.weight,
          mix_factor: editingItem.mix_factor,
          variable_amount: editingItem.variable_amount,
          min_fulfillment: editingItem.min_fulfillment,
          has_cap: editingItem.has_cap,
          cap_percentage: editingItem.cap_percentage,
          cap_amount: editingItem.cap_amount,
          is_active: editingItem.is_active,
          display_order: editingItem.display_order,
          notes: editingItem.notes,
        } : undefined}
        onSubmit={editingItem ? handleEditItem : handleAddItem}
        isLoading={saving}
        isEditing={!!editingItem}
      />

      {selectedItemForLocks && (
        <LockConfigModal
          open={lockModalOpen}
          onOpenChange={(open) => {
            setLockModalOpen(open)
            if (!open) setSelectedItemForLocks(null)
          }}
          itemName={selectedItemForLocks.custom_name || selectedItemForLocks.preset?.name || selectedItemForLocks.item_type?.name || 'Partida'}
          itemTypes={itemTypes}
          existingLocks={selectedItemForLocks.locks}
          onAddLock={handleAddLock}
          onDeleteLock={handleDeleteLock}
          isLoading={saving}
        />
      )}
    </div>
  )
}
