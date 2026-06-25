'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeAprobarPermisos, puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { usePermisos } from '@/lib/rrhh/hooks/usePermisos'
import {
  TIPO_PERMISO, TIPO_PERMISO_LABELS, TIPO_PERMISO_COLORS,
  ESTADO_PERMISO, ESTADO_PERMISO_LABELS, ESTADO_PERMISO_COLORS,
} from '@/lib/rrhh/types'
import type { TipoPermiso, EstadoPermiso } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

import { CalendarCheck, Plus, X, Loader2, Check, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function PermisosPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [tipoFilter, setTipoFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  // Si no es gestión, solo ver propios permisos
  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const puedeAprobar = user ? puedeAprobarPermisos(user.rol) : false

  const { data: permisos, loading, total, refetch } = usePermisos({
    usuario_id: esGestion ? undefined : user?.id,
    tipo: tipoFilter || undefined,
    estado: estadoFilter || undefined,
  })

  // Dialog para rechazar
  const [rechazoDialog, setRechazoDialog] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [saving, setSaving] = useState(false)

  const hayFiltros = tipoFilter || estadoFilter

  function limpiarFiltros() {
    setTipoFilter('')
    setEstadoFilter('')
  }

  function formatFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE')
  }

  async function handleAprobar(permisoId: string) {
    if (!user) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/permisos/${permisoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aprobado: true,
          aprobado_por: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Permiso aprobado')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aprobar')
    } finally {
      setSaving(false)
    }
  }

  async function handleRechazar() {
    if (!rechazoDialog || !user || !motivoRechazo) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/permisos/${rechazoDialog}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aprobado: false,
          aprobado_por: user.id,
          motivo_rechazo: motivoRechazo,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Permiso rechazado')
      setRechazoDialog(null)
      setMotivoRechazo('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permisos y Vacaciones</h1>
          <p className="text-muted-foreground">
            {esGestion ? 'Gestión de solicitudes de permisos y vacaciones' : 'Mis solicitudes de permisos'}
          </p>
        </div>
        <Button onClick={() => router.push('/rrhh/permisos/nueva')}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Tipo de permiso" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_PERMISO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_PERMISO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_PERMISO.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_PERMISO_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hayFiltros && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Solicitudes</CardTitle>
              <CardDescription>{total} solicitudes encontradas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : permisos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No hay solicitudes
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltros ? 'Intenta modificar los filtros' : 'No se han registrado solicitudes'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {esGestion && <TableHead>Colaborador</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hasta</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Estado</TableHead>
                    {puedeAprobar && <TableHead className="w-[140px]">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permisos.map((p) => (
                    <TableRow key={p.id}>
                      {esGestion && (
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.usuario?.nombre_completo || '—'}</p>
                            <p className="text-xs text-muted-foreground">{p.usuario?.codigo_asesor}</p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge className={cn('text-xs', TIPO_PERMISO_COLORS[p.tipo as TipoPermiso])}>
                          {TIPO_PERMISO_LABELS[p.tipo as TipoPermiso] || p.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatFecha(p.fecha_inicio)}</TableCell>
                      <TableCell className="text-sm">{formatFecha(p.fecha_fin)}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{p.motivo}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', ESTADO_PERMISO_COLORS[p.estado as EstadoPermiso])}>
                          {ESTADO_PERMISO_LABELS[p.estado as EstadoPermiso] || p.estado}
                        </Badge>
                      </TableCell>
                      {puedeAprobar && (
                        <TableCell>
                          {p.estado === 'PENDIENTE' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleAprobar(p.id)}
                                disabled={saving}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setRechazoDialog(p.id)}
                                disabled={saving}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog rechazar */}
      <Dialog open={!!rechazoDialog} onOpenChange={(open) => !open && setRechazoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
            <DialogDescription>
              Indique el motivo por el cual se rechaza la solicitud
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo (mínimo 5 caracteres)..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazoDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={saving || motivoRechazo.length < 5}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
