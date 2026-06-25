'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { puedeGestionarOffboarding } from '@/lib/rrhh/utils/permisos-rrhh'
import { useOffboardings } from '@/lib/rrhh/hooks/useOffboarding'
import {
  TIPO_SALIDA, TIPO_SALIDA_LABELS, TIPO_SALIDA_COLORS,
  ESTADO_OFFBOARDING, ESTADO_OFFBOARDING_LABELS, ESTADO_OFFBOARDING_COLORS,
} from '@/lib/rrhh/types'
import type { TipoSalida, EstadoOffboarding } from '@/lib/rrhh/types'
import type { OffboardingTarea } from '@/lib/rrhh/interfaces'
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

import { LogOut, Search, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function OffboardingPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
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

  const { data: offboardings, loading, total, refetch } = useOffboardings({
    estado: estadoFilter || undefined,
    tipo_salida: tipoFilter || undefined,
    search: debouncedSearch || undefined,
  })

  // Dialog para nuevo offboarding
  const [showDialog, setShowDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    usuario_id: '',
    tipo_salida: '',
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
      .eq('activo', true)
      .limit(10)
    setColaboradores(data || [])
    setLoadingColab(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => buscarColaboradores(colaboradorSearch), 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorSearch])

  const esGestion = user ? puedeGestionarOffboarding(user.rol) : false
  const hayFiltros = estadoFilter || tipoFilter || searchTerm

  function limpiarFiltros() {
    setSearchTerm('')
    setEstadoFilter('')
    setTipoFilter('')
  }

  function formatFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE')
  }

  function contarProgreso(tareas: OffboardingTarea[]) {
    const completadas = tareas.filter((t) => t.completada).length
    return `${completadas}/${tareas.length}`
  }

  function resetDialog() {
    setShowDialog(false)
    setFormData({ usuario_id: '', tipo_salida: '', notas: '' })
    setColaboradorSearch('')
    setColaboradores([])
    setSelectedColab('')
  }

  async function handleCrear() {
    if (!formData.usuario_id || !formData.tipo_salida || !user) return
    setSaving(true)
    try {
      const response = await fetch('/api/rrhh/offboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          responsable_id: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Proceso de offboarding iniciado')
      resetDialog()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear offboarding')
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
          <h1 className="text-2xl font-bold tracking-tight">Offboarding</h1>
          <p className="text-muted-foreground">
            Checklist de salida de colaboradores
          </p>
        </div>
        {esGestion && (
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Offboarding
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
                <SelectValue placeholder="Tipo de salida" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_SALIDA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_SALIDA_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_OFFBOARDING.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_OFFBOARDING_LABELS[e]}
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
            <LogOut className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Procesos de Offboarding</CardTitle>
              <CardDescription>{total} procesos encontrados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : offboardings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LogOut className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No se encontraron procesos
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltros ? 'Intenta modificar los filtros' : 'No hay procesos de offboarding activos'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo Salida</TableHead>
                    <TableHead>Fecha Inicio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offboardings.map((ob) => (
                    <TableRow key={ob.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ob.usuario?.nombre_completo || '—'}</p>
                          <p className="text-xs text-muted-foreground">{ob.usuario?.codigo_asesor}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', TIPO_SALIDA_COLORS[ob.tipo_salida as TipoSalida])}>
                          {TIPO_SALIDA_LABELS[ob.tipo_salida as TipoSalida] || ob.tipo_salida}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatFecha(ob.fecha_inicio)}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', ESTADO_OFFBOARDING_COLORS[ob.estado as EstadoOffboarding])}>
                          {ESTADO_OFFBOARDING_LABELS[ob.estado as EstadoOffboarding] || ob.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {contarProgreso(ob.tareas || [])}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/rrhh/offboarding/${ob.id}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog nuevo offboarding */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Iniciar Offboarding</DialogTitle>
            <DialogDescription>
              Se generará automáticamente un checklist según el tipo de salida
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label>Tipo de Salida</Label>
              <Select
                value={formData.tipo_salida}
                onValueChange={(v) => setFormData(prev => ({ ...prev, tipo_salida: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_SALIDA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_SALIDA_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                placeholder="Notas adicionales (opcional)..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Cancelar</Button>
            <Button
              onClick={handleCrear}
              disabled={saving || !formData.usuario_id || !formData.tipo_salida}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Iniciar Proceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
