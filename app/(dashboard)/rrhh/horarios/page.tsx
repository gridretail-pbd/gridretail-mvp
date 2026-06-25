'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeVerAsistenciaEquipo, puedeAsignarTurnos } from '@/lib/rrhh/utils/permisos-rrhh'
import { useTurnos, useAsignacionTurnos } from '@/lib/rrhh/hooks/useHorarios'
import { DIA_SEMANA_SHORT } from '@/lib/rrhh/types'
import type { Turno } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Colores por turno
const TURNO_COLORS: Record<string, string> = {
  APERTURA: 'bg-blue-100 text-blue-800 border-blue-200',
  CIERRE: 'bg-purple-100 text-purple-800 border-purple-200',
  COMPLETO: 'bg-green-100 text-green-800 border-green-200',
  PARTIDO: 'bg-orange-100 text-orange-800 border-orange-200',
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export default function HorariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [tiendas, setTiendas] = useState<{ id: string; nombre: string; codigo: string }[]>([])
  const [tiendaId, setTiendaId] = useState('')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))

  // Dialog para asignar turno
  const [assignDialog, setAssignDialog] = useState<{
    usuario_id: string
    nombre: string
    fecha: string
    asignacion_id?: string
  } | null>(null)
  const [selectedTurno, setSelectedTurno] = useState('')
  const [esDescanso, setEsDescanso] = useState(false)
  const [saving, setSaving] = useState(false)

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

    // Cargar tiendas
    fetch('/api/rrhh/horarios/turnos') // Dummy call to ensure API works
    fetch('/api/rrhh/asistencia?fecha=' + formatDateISO(new Date()))
      .catch(() => {})

    // Fetch tiendas
    async function loadTiendas() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('tiendas')
          .select('id, nombre, codigo')
          .eq('activo', true)
          .order('nombre')
        if (data && data.length > 0) {
          setTiendas(data)
          setTiendaId(data[0].id)
        }
      } catch { /* ignore */ }
    }
    loadTiendas()
  }, [router])

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 6)
    return d
  }, [weekStart])

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const { data: turnos } = useTurnos()
  const { data: asignaciones, loading, refetch } = useAsignacionTurnos({
    tienda_id: tiendaId || undefined,
    fecha_desde: formatDateISO(weekStart),
    fecha_hasta: formatDateISO(weekEnd),
  })

  const puedeAsignar = user ? puedeAsignarTurnos(user.rol) : false

  // Agrupar asignaciones por usuario
  const usuariosMap = useMemo(() => {
    const map = new Map<string, {
      usuario_id: string
      nombre: string
      codigo: string
      asignaciones: Map<string, typeof asignaciones[number]>
    }>()

    for (const a of asignaciones) {
      if (!map.has(a.usuario_id)) {
        map.set(a.usuario_id, {
          usuario_id: a.usuario_id,
          nombre: a.usuario?.nombre_completo || '—',
          codigo: a.usuario?.codigo_asesor || '',
          asignaciones: new Map(),
        })
      }
      map.get(a.usuario_id)!.asignaciones.set(a.fecha, a)
    }

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [asignaciones])

  function prevWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  function nextWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  function thisWeek() {
    setWeekStart(getMonday(new Date()))
  }

  async function handleGuardarAsignacion() {
    if (!assignDialog || !user || !tiendaId) return

    setSaving(true)
    try {
      if (assignDialog.asignacion_id && esDescanso) {
        // Update existing to descanso
        const response = await fetch(`/api/rrhh/horarios/asignacion/${assignDialog.asignacion_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ es_dia_descanso: true }),
        })
        if (!response.ok) {
          const json = await response.json()
          throw new Error(json.error)
        }
      } else if (!esDescanso && selectedTurno) {
        // Create or update
        const response = await fetch('/api/rrhh/horarios/asignacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: assignDialog.usuario_id,
            tienda_id: tiendaId,
            turno_id: selectedTurno,
            fecha: assignDialog.fecha,
            es_dia_descanso: false,
            asignado_por: user.id,
          }),
        })
        if (!response.ok) {
          const json = await response.json()
          throw new Error(json.error)
        }
      }

      toast.success('Turno asignado correctamente')
      setAssignDialog(null)
      setSelectedTurno('')
      setEsDescanso(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar turno')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Horarios y Turnos</h1>
        <p className="text-muted-foreground">
          Programación semanal de turnos por tienda
        </p>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={tiendaId} onValueChange={setTiendaId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Seleccionar tienda" />
              </SelectTrigger>
              <SelectContent>
                {tiendas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre} ({t.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={thisWeek}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <span className="text-sm text-muted-foreground">
              {weekStart.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} — {weekEnd.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grilla semanal */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Programación Semanal</CardTitle>
              <CardDescription>{usuariosMap.length} colaboradores asignados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !tiendaId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Seleccione una tienda para ver los horarios</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium min-w-[180px]">Colaborador</th>
                    {weekDates.map((d, i) => {
                      const isToday = formatDateISO(d) === formatDateISO(new Date())
                      return (
                        <th
                          key={i}
                          className={cn(
                            'text-center px-2 py-2 font-medium min-w-[100px]',
                            isToday && 'bg-primary/10'
                          )}
                        >
                          <div>{DIA_SEMANA_SHORT[i]}</div>
                          <div className="text-xs text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {usuariosMap.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay asignaciones para esta semana
                      </td>
                    </tr>
                  ) : (
                    usuariosMap.map((usuario) => (
                      <tr key={usuario.usuario_id} className="border-b">
                        <td className="px-3 py-2">
                          <div className="font-medium">{usuario.nombre}</div>
                          <div className="text-xs text-muted-foreground">{usuario.codigo}</div>
                        </td>
                        {weekDates.map((d, i) => {
                          const fechaStr = formatDateISO(d)
                          const asignacion = usuario.asignaciones.get(fechaStr)
                          const turno = asignacion?.turno as Turno | undefined
                          const isToday = fechaStr === formatDateISO(new Date())

                          return (
                            <td
                              key={i}
                              className={cn(
                                'text-center px-1 py-1',
                                isToday && 'bg-primary/5',
                                puedeAsignar && 'cursor-pointer hover:bg-muted/50'
                              )}
                              onClick={() => {
                                if (!puedeAsignar) return
                                setAssignDialog({
                                  usuario_id: usuario.usuario_id,
                                  nombre: usuario.nombre,
                                  fecha: fechaStr,
                                  asignacion_id: asignacion?.id,
                                })
                                setSelectedTurno(asignacion?.turno_id || '')
                                setEsDescanso(asignacion?.es_dia_descanso || false)
                              }}
                            >
                              {asignacion?.es_dia_descanso ? (
                                <span className="inline-block px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">
                                  Descanso
                                </span>
                              ) : turno ? (
                                <span className={cn(
                                  'inline-block px-2 py-1 rounded text-xs border',
                                  TURNO_COLORS[turno.codigo] || 'bg-gray-100 text-gray-800'
                                )}>
                                  {turno.nombre.replace('Turno ', '')}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 mt-4">
            {turnos.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs">
                <span className={cn(
                  'inline-block w-3 h-3 rounded',
                  TURNO_COLORS[t.codigo]?.split(' ')[0] || 'bg-gray-100'
                )} />
                <span>{t.nombre}: {t.hora_inicio} - {t.hora_fin}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog asignar turno */}
      <Dialog open={!!assignDialog} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Turno</DialogTitle>
            <DialogDescription>
              {assignDialog?.nombre} — {assignDialog?.fecha && new Date(assignDialog.fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="esDescanso"
                checked={esDescanso}
                onChange={(e) => setEsDescanso(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="esDescanso" className="text-sm">Día de descanso</label>
            </div>

            {!esDescanso && (
              <div>
                <label className="text-sm font-medium">Turno</label>
                <Select value={selectedTurno} onValueChange={setSelectedTurno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {turnos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre} ({t.hora_inicio} - {t.hora_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardarAsignacion}
              disabled={saving || (!esDescanso && !selectedTurno)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
