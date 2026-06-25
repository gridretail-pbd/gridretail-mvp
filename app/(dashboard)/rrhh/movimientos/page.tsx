'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useMovimientos } from '@/lib/rrhh/hooks/useMovimientos'
import {
  TIPO_MOVIMIENTO, TIPO_MOVIMIENTO_LABELS, TIPO_MOVIMIENTO_COLORS,
} from '@/lib/rrhh/types'
import type { TipoMovimiento } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

import { ArrowRightLeft, Search, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function MovimientosPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')

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

  const { data: movimientos, loading, total, refetch } = useMovimientos({
    tipo_movimiento: tipoFilter || undefined,
    search: debouncedSearch || undefined,
  })

  // Dialog para nuevo movimiento
  const [showDialog, setShowDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    usuario_id: '',
    tipo_movimiento: '',
    fecha_efectiva: new Date().toISOString().split('T')[0],
    motivo: '',
    tienda_destino_id: '',
    notas: '',
  })

  // Búsqueda de colaboradores
  const [colaboradorSearch, setColaboradorSearch] = useState('')
  const [colaboradores, setColaboradores] = useState<{ id: string; nombre_completo: string; codigo_asesor: string }[]>([])
  const [loadingColab, setLoadingColab] = useState(false)
  const [selectedColab, setSelectedColab] = useState<string>('')

  const supabase = createClient()

  async function buscarColaboradores(term: string) {
    if (term.length < 2) { setColaboradores([]); return }
    setLoadingColab(true)
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, codigo_asesor')
      .or(`nombre_completo.ilike.%${term}%,codigo_asesor.ilike.%${term}%,dni.ilike.%${term}%`)
      .limit(10)
    setColaboradores(data || [])
    setLoadingColab(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => buscarColaboradores(colaboradorSearch), 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorSearch])

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const hayFiltros = tipoFilter || searchTerm
  const esCese = formData.tipo_movimiento.startsWith('CESE_')
  const esTransferencia = formData.tipo_movimiento === 'TRANSFERENCIA'

  function limpiarFiltros() {
    setSearchTerm('')
    setTipoFilter('')
  }

  function formatFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE')
  }

  function resetDialog() {
    setShowDialog(false)
    setFormData({ usuario_id: '', tipo_movimiento: '', fecha_efectiva: new Date().toISOString().split('T')[0], motivo: '', tienda_destino_id: '', notas: '' })
    setColaboradorSearch('')
    setColaboradores([])
    setSelectedColab('')
  }

  async function handleCrear() {
    if (!formData.usuario_id || !formData.tipo_movimiento || !user) return
    setSaving(true)
    try {
      const response = await fetch('/api/rrhh/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tienda_destino_id: formData.tienda_destino_id || null,
          autorizado_por: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Movimiento registrado correctamente')
      resetDialog()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar movimiento')
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
          <h1 className="text-2xl font-bold tracking-tight">Movimientos de Personal</h1>
          <p className="text-muted-foreground">
            Transferencias, promociones, ceses y otros movimientos
          </p>
        </div>
        {esGestion && (
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Movimiento
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
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_MOVIMIENTO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_MOVIMIENTO_LABELS[t]}
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
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Historial de Movimientos</CardTitle>
              <CardDescription>{total} movimientos encontrados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : movimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No se encontraron movimientos
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltros ? 'Intenta modificar los filtros' : 'Aún no se han registrado movimientos'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha Efectiva</TableHead>
                    <TableHead>Tiendas</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{mov.usuario?.nombre_completo || '—'}</p>
                          <p className="text-xs text-muted-foreground">{mov.usuario?.codigo_asesor}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', TIPO_MOVIMIENTO_COLORS[mov.tipo_movimiento as TipoMovimiento])}>
                          {TIPO_MOVIMIENTO_LABELS[mov.tipo_movimiento as TipoMovimiento] || mov.tipo_movimiento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatFecha(mov.fecha_efectiva)}</TableCell>
                      <TableCell className="text-sm">
                        {mov.tienda_origen?.nombre && mov.tienda_destino?.nombre ? (
                          <span>{mov.tienda_origen.nombre} → {mov.tienda_destino.nombre}</span>
                        ) : mov.tienda_destino?.nombre ? (
                          <span>→ {mov.tienda_destino.nombre}</span>
                        ) : mov.tienda_origen?.nombre ? (
                          <span>{mov.tienda_origen.nombre}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {mov.motivo || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog nuevo movimiento */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>
              Registre un nuevo movimiento de personal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Búsqueda de colaborador */}
            <div>
              <Label>Colaborador</Label>
              {selectedColab ? (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-sm">{selectedColab}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectedColab('')
                    setFormData(prev => ({ ...prev, usuario_id: '' }))
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Input
                    placeholder="Buscar por nombre, código o DNI..."
                    value={colaboradorSearch}
                    onChange={(e) => setColaboradorSearch(e.target.value)}
                  />
                  {(colaboradores.length > 0 || loadingColab) && colaboradorSearch.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
                      {loadingColab ? (
                        <div className="p-2 text-sm text-muted-foreground">Buscando...</div>
                      ) : colaboradores.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, usuario_id: c.id }))
                            setSelectedColab(`${c.nombre_completo} (${c.codigo_asesor})`)
                            setColaboradorSearch('')
                            setColaboradores([])
                          }}
                        >
                          {c.nombre_completo} — {c.codigo_asesor}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Tipo de Movimiento</Label>
              <Select
                value={formData.tipo_movimiento}
                onValueChange={(v) => setFormData(prev => ({ ...prev, tipo_movimiento: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_MOVIMIENTO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_MOVIMIENTO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha Efectiva</Label>
              <Input
                type="date"
                value={formData.fecha_efectiva}
                onChange={(e) => setFormData(prev => ({ ...prev, fecha_efectiva: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Motivo {(esCese || esTransferencia) && <span className="text-red-500">*</span>}</Label>
              <Textarea
                value={formData.motivo}
                onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Motivo del movimiento..."
                rows={3}
                className="mt-1"
              />
            </div>

            {formData.notas !== undefined && (
              <div>
                <Label>Notas adicionales</Label>
                <Input
                  value={formData.notas}
                  onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Notas opcionales..."
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Cancelar</Button>
            <Button
              onClick={handleCrear}
              disabled={saving || !formData.usuario_id || !formData.tipo_movimiento}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
