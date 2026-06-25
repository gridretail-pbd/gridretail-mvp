'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeRegistrarIncidencia, puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useIncidencias } from '@/lib/rrhh/hooks/useIncidencias'
import {
  TIPO_INCIDENCIA, TIPO_INCIDENCIA_LABELS, TIPO_INCIDENCIA_COLORS,
  ESTADO_INCIDENCIA, ESTADO_INCIDENCIA_LABELS, ESTADO_INCIDENCIA_COLORS,
} from '@/lib/rrhh/types'
import type { TipoIncidencia, EstadoIncidencia } from '@/lib/rrhh/types'
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

import { AlertTriangle, Search, MoreHorizontal, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function IncidenciasPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
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
    setUser(usuario)
  }, [router])

  const { data: incidencias, loading, total, refetch } = useIncidencias({
    tipo: tipoFilter || undefined,
    estado: estadoFilter || undefined,
    search: debouncedSearch || undefined,
  })

  // Dialog para descargo
  const [descargoDialog, setDescargoDialog] = useState<string | null>(null) // incidencia id
  const [descargoTexto, setDescargoTexto] = useState('')
  const [saving, setSaving] = useState(false)

  // Dialog para resolución
  const [resolucionDialog, setResolucionDialog] = useState<string | null>(null)
  const [resolucionTexto, setResolucionTexto] = useState('')
  const [resolucionEstado, setResolucionEstado] = useState('RESUELTA')

  const puedeRegistrar = user ? puedeRegistrarIncidencia(user.rol) : false
  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const hayFiltros = tipoFilter || estadoFilter || searchTerm

  function limpiarFiltros() {
    setSearchTerm('')
    setTipoFilter('')
    setEstadoFilter('')
  }

  function formatFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE')
  }

  async function handleDescargo() {
    if (!descargoDialog || !descargoTexto) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/incidencias/${descargoDialog}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descargo_colaborador: descargoTexto }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Descargo registrado correctamente')
      setDescargoDialog(null)
      setDescargoTexto('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar descargo')
    } finally {
      setSaving(false)
    }
  }

  async function handleResolucion() {
    if (!resolucionDialog || !resolucionTexto || !user) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/incidencias/${resolucionDialog}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolucion: resolucionTexto,
          resolucion_por: user.id,
          estado: resolucionEstado,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Incidencia resuelta correctamente')
      setResolucionDialog(null)
      setResolucionTexto('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al resolver incidencia')
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
          <h1 className="text-2xl font-bold tracking-tight">Incidencias Laborales</h1>
          <p className="text-muted-foreground">
            Registro y seguimiento de incidencias disciplinarias
          </p>
        </div>
        {puedeRegistrar && (
          <Button onClick={() => router.push('/rrhh/incidencias/nueva')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Incidencia
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_INCIDENCIA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_INCIDENCIA_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_INCIDENCIA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_INCIDENCIA_LABELS[e]}
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
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Lista de Incidencias</CardTitle>
              <CardDescription>{total} incidencias encontradas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : incidencias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No se encontraron incidencias
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltros ? 'Intenta modificar los filtros' : 'Aún no se han registrado incidencias'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidencias.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{inc.usuario?.nombre_completo || '—'}</p>
                          <p className="text-xs text-muted-foreground">{inc.usuario?.codigo_asesor}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', TIPO_INCIDENCIA_COLORS[inc.tipo as TipoIncidencia])}>
                          {TIPO_INCIDENCIA_LABELS[inc.tipo as TipoIncidencia] || inc.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatFecha(inc.fecha)}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', ESTADO_INCIDENCIA_COLORS[inc.estado as EstadoIncidencia])}>
                          {ESTADO_INCIDENCIA_LABELS[inc.estado as EstadoIncidencia] || inc.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {inc.descripcion || '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(inc.estado === 'NOTIFICADA' || inc.estado === 'REGISTRADA') && (
                              <DropdownMenuItem onClick={() => setDescargoDialog(inc.id)}>
                                Registrar Descargo
                              </DropdownMenuItem>
                            )}
                            {esGestion && inc.estado !== 'RESUELTA' && inc.estado !== 'ANULADA' && (
                              <DropdownMenuItem onClick={() => setResolucionDialog(inc.id)}>
                                Resolver
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog descargo */}
      <Dialog open={!!descargoDialog} onOpenChange={(open) => !open && setDescargoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Descargo</DialogTitle>
            <DialogDescription>
              El colaborador puede presentar su descargo sobre la incidencia
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={descargoTexto}
              onChange={(e) => setDescargoTexto(e.target.value)}
              placeholder="Escriba el descargo del colaborador (mínimo 10 caracteres)..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescargoDialog(null)}>Cancelar</Button>
            <Button onClick={handleDescargo} disabled={saving || descargoTexto.length < 10}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog resolución */}
      <Dialog open={!!resolucionDialog} onOpenChange={(open) => !open && setResolucionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Incidencia</DialogTitle>
            <DialogDescription>
              Registre la resolución final de la incidencia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Estado final</label>
              <Select value={resolucionEstado} onValueChange={setResolucionEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESUELTA">Resuelta</SelectItem>
                  <SelectItem value="ESCALADA">Escalada</SelectItem>
                  <SelectItem value="ANULADA">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Resolución</label>
              <Textarea
                value={resolucionTexto}
                onChange={(e) => setResolucionTexto(e.target.value)}
                placeholder="Describa la resolución..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolucionDialog(null)}>Cancelar</Button>
            <Button onClick={handleResolucion} disabled={saving || !resolucionTexto}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
