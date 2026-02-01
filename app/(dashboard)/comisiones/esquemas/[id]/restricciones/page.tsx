'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SchemeStatusBadge } from '@/components/comisiones/SchemeStatusBadge'
import {
  CommissionScheme,
  CommissionItemRestriction,
  formatPeriod,
  SCHEME_TYPE_LABELS,
  RESTRICTION_TYPE_LABELS,
  SCOPE_LABELS,
} from '@/lib/comisiones'
import { restrictionFormSchema, type RestrictionFormValues } from '@/lib/comisiones/validations'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'
import { toast } from 'sonner'

const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

export default function RestriccionesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [scheme, setScheme] = useState<CommissionScheme | null>(null)
  const [restrictions, setRestrictions] = useState<CommissionItemRestriction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRestriction, setEditingRestriction] = useState<CommissionItemRestriction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isDraft = scheme?.status === 'draft'
  const canEdit = user?.rol && ROLES_EDICION.includes(user.rol) && isDraft

  const form = useForm<RestrictionFormValues>({
    resolver: zodResolver(restrictionFormSchema),
    defaultValues: {
      restriction_type: 'max_percentage',
      plan_code: '',
      operator_code: '',
      max_percentage: null,
      max_quantity: null,
      min_percentage: null,
      scope: 'hc',
      description: '',
      is_active: true,
    },
  })

  const restrictionType = form.watch('restriction_type')

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

        const [schemeResponse, restrictionsResponse] = await Promise.all([
          fetch(`/api/comisiones/esquemas/${id}`),
          fetch(`/api/comisiones/esquemas/${id}/restricciones`),
        ])

        const schemeData = await schemeResponse.json()
        const restrictionsData = await restrictionsResponse.json()

        if (!schemeResponse.ok) {
          throw new Error(schemeData.error || 'Error al cargar esquema')
        }

        setScheme(schemeData.scheme)
        setRestrictions(restrictionsData.restrictions || [])
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

  const handleOpenModal = (restriction?: CommissionItemRestriction) => {
    if (restriction) {
      setEditingRestriction(restriction)
      form.reset({
        restriction_type: restriction.restriction_type,
        plan_code: restriction.plan_code || '',
        operator_code: restriction.operator_code || '',
        max_percentage: restriction.max_percentage,
        max_quantity: restriction.max_quantity,
        min_percentage: restriction.min_percentage,
        scope: restriction.scope,
        description: restriction.description || '',
        is_active: restriction.is_active,
      })
    } else {
      setEditingRestriction(null)
      form.reset()
    }
    setModalOpen(true)
  }

  const handleSubmit = async (values: RestrictionFormValues) => {
    try {
      setSaving(true)

      const url = `/api/comisiones/esquemas/${id}/restricciones`
      const method = editingRestriction ? 'PUT' : 'POST'
      const body = editingRestriction
        ? { restriction_id: editingRestriction.id, ...values }
        : values

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar restricción')
      }

      if (editingRestriction) {
        setRestrictions(restrictions.map(r =>
          r.id === editingRestriction.id ? data.restriction : r
        ))
        toast.success('Restricción actualizada')
      } else {
        setRestrictions([...restrictions, data.restriction])
        toast.success('Restricción agregada')
      }

      setModalOpen(false)
      setEditingRestriction(null)
      form.reset()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (restrictionId: string) => {
    try {
      setDeletingId(restrictionId)
      const response = await fetch(
        `/api/comisiones/esquemas/${id}/restricciones?restriction_id=${restrictionId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al eliminar restricción')
      }

      setRestrictions(restrictions.filter(r => r.id !== restrictionId))
      toast.success('Restricción eliminada')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const getRestrictionDescription = (restriction: CommissionItemRestriction) => {
    const scope = SCOPE_LABELS[restriction.scope]
    switch (restriction.restriction_type) {
      case 'max_percentage':
        return `Plan ${restriction.plan_code}: máx ${((restriction.max_percentage || 0) * 100).toFixed(0)}% de cuota SS (${scope})`
      case 'max_quantity':
        return `Plan ${restriction.plan_code}: máx ${restriction.max_quantity} unidades (${scope})`
      case 'min_percentage':
        return `Mínimo ${((restriction.min_percentage || 0) * 100).toFixed(0)}% de ${restriction.plan_code || restriction.operator_code} (${scope})`
      case 'operator_origin':
        return `Operador ${restriction.operator_code}: ${((restriction.min_percentage || 0) * 100).toFixed(0)}% mínimo`
      default:
        return restriction.description || 'Restricción configurada'
    }
  }

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
            onClick={() => router.push(`/comisiones/esquemas/${id}/partidas`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Restricciones</h1>
              <SchemeStatusBadge status={scheme.status} />
            </div>
            <p className="text-muted-foreground">
              {scheme.name} - {SCHEME_TYPE_LABELS[scheme.scheme_type]} - {formatPeriod(scheme.year, scheme.month)}
            </p>
          </div>
        </div>

        {canEdit && (
          <Button onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Restricción
          </Button>
        )}
      </div>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Restricciones de Mix de Productos</p>
              <p className="text-sm text-muted-foreground">
                Las restricciones limitan qué unidades cuentan para comisión según plan tarifario u origen de portabilidad.
                Puedes definir restricciones por HC individual, por tienda TEX o globales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de restricciones */}
      <Card>
        <CardHeader>
          <CardTitle>Restricciones Activas ({restrictions.filter(r => r.is_active).length})</CardTitle>
          <CardDescription>
            Configura los límites de mix de productos para el esquema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {restrictions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Check className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-muted-foreground">No hay restricciones configuradas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sin restricciones, todas las ventas cuentan al 100% para comisión
              </p>
              {canEdit && (
                <Button className="mt-4" onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar restricción
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {restrictions.map((restriction) => (
                  <TableRow key={restriction.id} className={!restriction.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      {RESTRICTION_TYPE_LABELS[restriction.restriction_type]}
                    </TableCell>
                    <TableCell>
                      {getRestrictionDescription(restriction)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SCOPE_LABELS[restriction.scope]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {restriction.is_active ? (
                        <Badge variant="default" className="bg-green-500">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(restriction)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                {deletingId === restriction.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar restricción?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(restriction.id)}
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
          onClick={() => router.push(`/comisiones/esquemas/${id}/partidas`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Partidas
        </Button>

        <Button
          onClick={() => router.push(`/comisiones/esquemas/${id}`)}
        >
          Ver Resumen
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Modal de restricción */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRestriction ? 'Editar Restricción' : 'Nueva Restricción'}
            </DialogTitle>
            <DialogDescription>
              Define los límites de mix de productos para el esquema
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="restriction_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de restricción</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(RESTRICTION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(restrictionType === 'max_percentage' || restrictionType === 'max_quantity' || restrictionType === 'min_percentage') && (
                <FormField
                  control={form.control}
                  name="plan_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de plan</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: 39.90"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>Plan tarifario afectado</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {restrictionType === 'operator_origin' && (
                <FormField
                  control={form.control}
                  name="operator_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operador</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar operador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MOVISTAR">Movistar</SelectItem>
                          <SelectItem value="CLARO">Claro</SelectItem>
                          <SelectItem value="BITEL">Bitel</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {restrictionType === 'max_percentage' && (
                <FormField
                  control={form.control}
                  name="max_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje máximo (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          placeholder="Ej: 10"
                          value={field.value ? (field.value * 100) : ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                        />
                      </FormControl>
                      <FormDescription>% máximo de la cuota SS</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {restrictionType === 'max_quantity' && (
                <FormField
                  control={form.control}
                  name="max_quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad máxima</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Ej: 20"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(restrictionType === 'min_percentage' || restrictionType === 'operator_origin') && (
                <FormField
                  control={form.control}
                  name="min_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje mínimo (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          placeholder="Ej: 40"
                          value={field.value ? (field.value * 100) : ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alcance</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Define si la restricción aplica por HC, por tienda o global
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Descripción de la restricción..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel>Restricción activa</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRestriction ? 'Guardar Cambios' : 'Agregar Restricción'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
