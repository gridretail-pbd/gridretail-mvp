'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Pencil,
  Copy,
  Check,
  Loader2,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
  Calendar,
  User,
  DollarSign,
  Target,
  Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  CommissionScheme,
  CommissionSchemeItem,
  CommissionItemRestriction,
  formatPeriod,
  SCHEME_TYPE_LABELS,
  ITEM_CATEGORY_LABELS,
} from '@/lib/comisiones'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'
import { toast } from 'sonner'

// Roles que pueden editar/aprobar
const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']
const ROLES_VISTA = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'GERENTE_GENERAL',
  'JEFE_VENTAS',
  'BACKOFFICE_OPERACIONES',
]

interface SchemeDetailData {
  scheme: CommissionScheme & {
    created_by_name?: string
    approved_by_name?: string
  }
  items: (CommissionSchemeItem & {
    locks?: Array<{ id: string; lock_type: string; required_value: number }>
  })[]
  restrictions: CommissionItemRestriction[]
}

export default function EsquemaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [data, setData] = useState<SchemeDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [cloning, setCloning] = useState(false)

  const canEdit = user?.rol && ROLES_EDICION.includes(user.rol)
  const canView = user?.rol && ROLES_VISTA.includes(user.rol)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_VISTA.includes(usuario.rol)) {
      router.push('/dashboard')
      return
    }
    setUser(usuario)
  }, [router])

  useEffect(() => {
    async function loadScheme() {
      try {
        setLoading(true)
        const response = await fetch(`/api/comisiones/esquemas/${id}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Error al cargar esquema')
        }

        setData(result)
      } catch (error) {
        console.error('Error:', error)
        toast.error('Error al cargar el esquema')
        router.push('/comisiones/esquemas')
      } finally {
        setLoading(false)
      }
    }

    if (user && id) {
      loadScheme()
    }
  }, [user, id, router])

  const handleApprove = async () => {
    try {
      setApproving(true)
      const response = await fetch(`/api/comisiones/esquemas/${id}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: user?.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al aprobar esquema')
      }

      toast.success('Esquema aprobado exitosamente')
      // Recargar datos
      const reloadResponse = await fetch(`/api/comisiones/esquemas/${id}`)
      const reloadData = await reloadResponse.json()
      setData(reloadData)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al aprobar')
    } finally {
      setApproving(false)
    }
  }

  const handleClone = async () => {
    try {
      setCloning(true)
      const response = await fetch(`/api/comisiones/esquemas/${id}/clonar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: user?.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al clonar esquema')
      }

      toast.success('Esquema clonado exitosamente')
      router.push(`/comisiones/esquemas/${result.scheme.id}`)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al clonar')
    } finally {
      setCloning(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount)
  }

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { scheme, items, restrictions } = data
  const isDraft = scheme.status === 'draft'
  const ponderadaItems = items.filter(i => (i as any).contribution_type === 'PONDERADA' || (!(i as any).contribution_type && (i.item_type?.category === 'principal' || i.item_type?.category === 'adicional')))
  const aceleradorItems = items.filter(i => (i as any).contribution_type === 'ACELERADOR')
  const pxqItems = items.filter(i => (i as any).contribution_type === 'PXQ_INDEPENDIENTE' || (!(i as any).contribution_type && i.item_type?.category === 'pxq'))
  const bonoItems = items.filter(i => (i as any).contribution_type === 'BONO' || (!(i as any).contribution_type && i.item_type?.category === 'bono'))

  // Calcular suma de cuotas de partidas principales para detectar desajustes
  // Las partidas principales son aquellas que contribuyen a la cuota SS:
  // - OSS (portabilidad post→post)
  // - OPP (portabilidad pre→post)
  // - VR (venta regular)
  // Se identifican por nombre/código que contenga estos patrones
  const ssPatterns = ['OSS', 'OPP', 'VR_', 'VR ']
  const principalItems = items.filter(i => {
    if (!i.is_active) return false
    const name = ((i as any).custom_name || (i as any).preset?.name || i.item_type?.name || i.item_type?.code || '').toUpperCase()
    // Incluir si el nombre contiene algún patrón SS
    return ssPatterns.some(pattern => name.includes(pattern))
  })

  // Verificar que los items identificados tienen peso y suman ~100%
  const principalWeightSum = principalItems.reduce((sum, i) => sum + (i.weight || 0), 0)
  const isPrincipalGroupValid = principalItems.length > 0 && Math.abs(principalWeightSum - 1) < 0.1

  const principalQuotaSum = principalItems.reduce((sum, i) => sum + (i.quota || 0), 0)
  const hasQuotaMismatch = isPrincipalGroupValid && principalQuotaSum > 0 && principalQuotaSum !== scheme.total_ss_quota

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/comisiones/esquemas')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{scheme.name}</h1>
              <SchemeStatusBadge status={scheme.status} />
            </div>
            <p className="text-muted-foreground">
              {SCHEME_TYPE_LABELS[scheme.scheme_type]} - {formatPeriod(scheme.year, scheme.month)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && isDraft && (
            <Button
              variant="outline"
              onClick={() => router.push(`/comisiones/esquemas/${id}/editar`)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Editar Esquema
            </Button>
          )}

          {canEdit && isDraft && (
            <Button
              variant="outline"
              onClick={() => router.push(`/comisiones/esquemas/${id}/partidas`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar Partidas
            </Button>
          )}

          {canEdit && (
            <Button variant="outline" onClick={handleClone} disabled={cloning}>
              {cloning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Clonar
            </Button>
          )}

          {canEdit && isDraft && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={approving || items.length === 0}>
                  {approving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Aprobar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Aprobar este esquema?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Este esquema será el vigente para {SCHEME_TYPE_LABELS[scheme.scheme_type]} - {formatPeriod(scheme.year, scheme.month)}.
                    Si existe otro esquema aprobado para este período, será archivado automáticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApprove}>
                    Aprobar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Alerta de desajuste de cuotas */}
      {hasQuotaMismatch && isDraft && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Desajuste en cuotas de partidas
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  La suma de cuotas de partidas principales ({principalQuotaSum}) no coincide con
                  la Cuota SS Total del esquema ({scheme.total_ss_quota}).
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(`/comisiones/esquemas/${id}/editar`)}
                >
                  Ir a Editar Esquema para corregir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información y Montos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código:</span>
              <span className="font-mono">{scheme.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo:</span>
              <span>{SCHEME_TYPE_LABELS[scheme.scheme_type]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período:</span>
              <span>{formatPeriod(scheme.year, scheme.month)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Origen:</span>
              <Badge variant="outline" className="capitalize">{scheme.source}</Badge>
            </div>
            {scheme.created_by_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creado por:</span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {scheme.created_by_name}
                </span>
              </div>
            )}
            {scheme.approved_by_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprobado por:</span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {scheme.approved_by_name}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Montos Base
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sueldo Fijo:</span>
              <span className="font-semibold">{formatCurrency(scheme.fixed_salary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sueldo Variable:</span>
              <span className="font-semibold">{formatCurrency(scheme.variable_salary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cuota SS:</span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {scheme.total_ss_quota} líneas
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cumplimiento Mínimo:</span>
              <span>{((scheme.default_min_fulfillment || 0.5) * 100).toFixed(0)}%</span>
            </div>
            {(scheme as any).accelerator_base && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Acelerador:</span>
                <span>{formatCurrency((scheme as any).accelerator_base)}</span>
              </div>
            )}
            {(scheme as any).conversion_table && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tabla de conversión:</span>
                <span>Sí</span>
              </div>
            )}
            <hr />
            <div className="flex justify-between text-lg">
              <span className="font-medium">Ingreso Potencial:</span>
              <span className="font-bold text-green-600">
                {formatCurrency(scheme.fixed_salary + scheme.variable_salary)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partidas */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Partidas ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
              <p className="text-muted-foreground">No hay partidas configuradas</p>
              {canEdit && isDraft && (
                <Button
                  className="mt-4"
                  onClick={() => router.push(`/comisiones/esquemas/${id}/partidas`)}
                >
                  Agregar Partidas
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Partidas Ponderadas */}
              {ponderadaItems.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                    Ponderadas ({(ponderadaItems.reduce((sum, i) => sum + (i.weight || 0), 0) * 100).toFixed(0)}% del variable)
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Variable</TableHead>
                        <TableHead className="text-right">Cumpl. Mín</TableHead>
                        <TableHead className="text-center">Tope</TableHead>
                        <TableHead className="text-center">Mult.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ponderadaItems.map((item) => {
                        const multiplierCount = (item.locks?.length || 0) + ((item as any).multipliers?.length || 0)
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {(item as any).custom_name || item.preset?.name || item.item_type?.name || item.item_type?.code}
                            </TableCell>
                            <TableCell className="text-right">{item.quota}</TableCell>
                            <TableCell className="text-right">
                              {((item.weight || 0) * 100).toFixed(0)}%
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
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {multiplierCount > 0 ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Lock className="h-3 w-3" />
                                  {multiplierCount}
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Aceleradores */}
              {aceleradorItems.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                    Aceleradores
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Rango de Efecto</TableHead>
                        <TableHead className="text-right">Variable Base</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aceleradorItems.map((item) => {
                        const ranges = (item as any).ranges || (item as any).scale_ranges || []
                        const rangeSummary = ranges.length > 0
                          ? `${ranges.length} tramos`
                          : `${((item.min_fulfillment || 0) * 100).toFixed(0)}% - ${item.has_cap && item.cap_percentage ? `${(item.cap_percentage * 100).toFixed(0)}%` : '∞'}`
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {(item as any).custom_name || item.preset?.name || item.item_type?.name || item.item_type?.code}
                            </TableCell>
                            <TableCell className="text-right">{rangeSummary}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.variable_amount)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* PxQ y Bonos */}
              {(pxqItems.length > 0 || bonoItems.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pxqItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">PxQ</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {pxqItems.map((item) => (
                            <li key={item.id} className="flex justify-between">
                              <span>{(item as any).custom_name || item.item_type?.name}</span>
                              <span className="text-muted-foreground">
                                {formatCurrency(item.variable_amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {bonoItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Bonos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {bonoItems.map((item) => (
                            <li key={item.id} className="flex justify-between">
                              <span>{(item as any).custom_name || item.item_type?.name}</span>
                              <span className="text-muted-foreground">
                                {formatCurrency(item.variable_amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restricciones */}
      {restrictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Restricciones Activas ({restrictions.filter(r => r.is_active).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {restrictions.filter(r => r.is_active).map((restriction) => (
                <li key={restriction.id} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>{restriction.description || `${restriction.restriction_type}: ${restriction.plan_code || restriction.operator_code}`}</span>
                  <Badge variant="outline" className="ml-auto">
                    {restriction.scope === 'hc' ? 'Por HC' : restriction.scope === 'tex' ? 'Por TEX' : 'Global'}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Alerta para estado Draft */}
      {isDraft && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Este esquema está en estado Borrador
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Al aprobar, reemplazará cualquier esquema aprobado del mismo período.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
