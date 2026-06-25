'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeVerAsistenciaEquipo, puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useAsistencia } from '@/lib/rrhh/hooks/useAsistencia'
import {
  ESTADO_ASISTENCIA, ESTADO_ASISTENCIA_LABELS, ESTADO_ASISTENCIA_COLORS,
} from '@/lib/rrhh/types'
import type { EstadoAsistencia } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

import { Clock, Search, X, Loader2, MapPin, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function AsistenciaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [estadoFilter, setEstadoFilter] = useState('')

  // Debounce
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!puedeVerAsistenciaEquipo(usuario.rol)) {
      router.push('/rrhh')
      return
    }
    setUser(usuario)
  }, [router])

  const { data: asistencia, loading, refetch } = useAsistencia({
    fecha: fecha || undefined,
    estado: estadoFilter || undefined,
    search: debouncedSearch || undefined,
  })

  // Dialog para editar/justificar
  const [editDialog, setEditDialog] = useState<{ id: string; estado: string } | null>(null)
  const [editMotivo, setEditMotivo] = useState('')
  const [editEstado, setEditEstado] = useState('')
  const [saving, setSaving] = useState(false)

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const hayFiltros = estadoFilter || searchTerm

  function limpiarFiltros() {
    setSearchTerm('')
    setEstadoFilter('')
  }

  function formatHora(hora: string | null) {
    if (!hora) return '—'
    return new Date(hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleGuardarEdicion() {
    if (!editDialog || !user) return

    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/asistencia/${editDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: editEstado || editDialog.estado,
          observaciones: editMotivo,
          editado_por: user.id,
          editado_motivo: editMotivo,
        }),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Marcación actualizada correctamente')
      setEditDialog(null)
      setEditMotivo('')
      setEditEstado('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  // Agrupar marcaciones por usuario para vista consolidada
  const marcacionesPorUsuario = asistencia.reduce((acc, m) => {
    const key = m.usuario_id
    if (!acc[key]) {
      acc[key] = {
        usuario_id: m.usuario_id,
        nombre: m.usuario?.nombre_completo || '—',
        codigo: m.usuario?.codigo_asesor || '',
        tienda: m.tienda?.nombre || '—',
        entrada: null as typeof m | null,
        salida: null as typeof m | null,
      }
    }
    if (m.tipo === 'ENTRADA') acc[key].entrada = m
    if (m.tipo === 'SALIDA') acc[key].salida = m
    return acc
  }, {} as Record<string, {
    usuario_id: string
    nombre: string
    codigo: string
    tienda: string
    entrada: typeof asistencia[number] | null
    salida: typeof asistencia[number] | null
  }>)

  const filas = Object.values(marcacionesPorUsuario)

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asistencia</h1>
        <p className="text-muted-foreground">
          Control de marcaciones de entrada y salida
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-[180px]"
            />

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_ASISTENCIA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_ASISTENCIA_LABELS[e]}
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

      {/* Tabla consolidada */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Marcaciones del día</CardTitle>
              <CardDescription>
                {fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Hoy'} — {filas.length} colaboradores
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No hay marcaciones para esta fecha
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tardanza</TableHead>
                    <TableHead>GPS</TableHead>
                    {esGestion && <TableHead className="w-[100px]">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((fila) => {
                    const entrada = fila.entrada
                    const salida = fila.salida
                    const estadoEntrada = entrada?.estado as EstadoAsistencia | undefined
                    const tieneTardanza = entrada?.es_tardanza

                    return (
                      <TableRow key={fila.usuario_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{fila.nombre}</p>
                            <p className="text-xs text-muted-foreground">{fila.codigo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{fila.tienda}</TableCell>
                        <TableCell className="text-sm">
                          {entrada ? formatHora(entrada.hora_servidor) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {salida ? formatHora(salida.hora_servidor) : '—'}
                        </TableCell>
                        <TableCell>
                          {estadoEntrada && (
                            <Badge className={cn('text-xs', ESTADO_ASISTENCIA_COLORS[estadoEntrada])}>
                              {ESTADO_ASISTENCIA_LABELS[estadoEntrada]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {tieneTardanza ? (
                            <span className="text-sm text-orange-600 font-medium">
                              {entrada?.minutos_tardanza}min
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entrada?.dentro_radio === false ? (
                            <div className="flex items-center gap-1 text-orange-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="text-xs">Fuera</span>
                            </div>
                          ) : entrada?.dentro_radio === true ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-xs">OK</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {esGestion && (
                          <TableCell>
                            {entrada && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditDialog({ id: entrada.id, estado: entrada.estado })
                                  setEditEstado(entrada.estado)
                                }}
                              >
                                Editar
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog editar marcación */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Marcación</DialogTitle>
            <DialogDescription>
              Modificar el estado o agregar observaciones a la marcación
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Select value={editEstado} onValueChange={setEditEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_ASISTENCIA.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ESTADO_ASISTENCIA_LABELS[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo de edición</label>
              <Textarea
                value={editMotivo}
                onChange={(e) => setEditMotivo(e.target.value)}
                placeholder="Explique el motivo de la edición..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarEdicion} disabled={saving || !editMotivo}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
