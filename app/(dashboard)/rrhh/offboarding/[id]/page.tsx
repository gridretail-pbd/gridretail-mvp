'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarOffboarding } from '@/lib/rrhh/utils/permisos-rrhh'
import {
  TIPO_SALIDA_LABELS, TIPO_SALIDA_COLORS,
  ESTADO_OFFBOARDING_LABELS, ESTADO_OFFBOARDING_COLORS,
} from '@/lib/rrhh/types'
import type { TipoSalida, EstadoOffboarding } from '@/lib/rrhh/types'
import type { OffboardingChecklist, OffboardingTarea } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

import { ArrowLeft, LogOut, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function OffboardingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [user, setUser] = useState<Usuario | null>(null)
  const [offboarding, setOffboarding] = useState<OffboardingChecklist | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notasEdit, setNotasEdit] = useState('')
  const [showNotas, setShowNotas] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/rrhh/offboarding/${id}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      setOffboarding(json.offboarding)
      setNotasEdit(json.offboarding?.notas || '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar offboarding')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (user) fetchDetail()
  }, [user, fetchDetail])

  const esGestion = user ? puedeGestionarOffboarding(user.rol) : false

  async function toggleTarea(tareaId: string, completada: boolean) {
    if (!offboarding || !user) return
    setSaving(true)

    const tareasActualizadas = offboarding.tareas.map((t) =>
      t.id === tareaId
        ? {
            ...t,
            completada,
            completada_por: completada ? user.id : undefined,
            completada_fecha: completada ? new Date().toISOString().split('T')[0] : undefined,
          }
        : t
    )

    try {
      const response = await fetch(`/api/rrhh/offboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tareas: tareasActualizadas }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      setOffboarding(json.offboarding)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar tarea')
    } finally {
      setSaving(false)
    }
  }

  async function completarOffboarding() {
    if (!offboarding) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/offboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'COMPLETADO',
          fecha_cierre: new Date().toISOString().split('T')[0],
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Offboarding completado')
      setOffboarding(json.offboarding)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al completar')
    } finally {
      setSaving(false)
    }
  }

  async function guardarNotas() {
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/offboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: notasEdit }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Notas guardadas')
      setOffboarding(json.offboarding)
      setShowNotas(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar notas')
    } finally {
      setSaving(false)
    }
  }

  function formatFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE')
  }

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!offboarding) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Proceso de offboarding no encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/rrhh/offboarding')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    )
  }

  const tareasCompletadas = offboarding.tareas.filter((t) => t.completada).length
  const totalTareas = offboarding.tareas.length
  const todasCompletas = tareasCompletadas === totalTareas && totalTareas > 0
  const esEnProceso = offboarding.estado === 'EN_PROCESO'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/rrhh/offboarding')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Offboarding — {offboarding.usuario?.nombre_completo || '—'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={cn('text-xs', TIPO_SALIDA_COLORS[offboarding.tipo_salida as TipoSalida])}>
              {TIPO_SALIDA_LABELS[offboarding.tipo_salida as TipoSalida]}
            </Badge>
            <Badge className={cn('text-xs', ESTADO_OFFBOARDING_COLORS[offboarding.estado as EstadoOffboarding])}>
              {ESTADO_OFFBOARDING_LABELS[offboarding.estado as EstadoOffboarding]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {offboarding.usuario?.codigo_asesor}
            </span>
          </div>
        </div>
        {esGestion && esEnProceso && todasCompletas && (
          <Button onClick={completarOffboarding} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Completar Offboarding
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Checklist de Salida ({tareasCompletadas}/{totalTareas})
              </CardTitle>
              <CardDescription>
                Marque las tareas completadas
              </CardDescription>
              {/* Barra de progreso */}
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: totalTareas > 0 ? `${(tareasCompletadas / totalTareas) * 100}%` : '0%' }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {offboarding.tareas
                  .sort((a, b) => a.orden - b.orden)
                  .map((tarea) => (
                    <div
                      key={tarea.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                        tarea.completada ? 'bg-green-50 border-green-200' : 'bg-background'
                      )}
                    >
                      <Checkbox
                        checked={tarea.completada}
                        disabled={!esGestion || !esEnProceso || saving}
                        onCheckedChange={(checked) => toggleTarea(tarea.id, !!checked)}
                      />
                      <div className="flex-1">
                        <p className={cn(
                          'text-sm font-medium',
                          tarea.completada && 'line-through text-muted-foreground'
                        )}>
                          {tarea.titulo}
                        </p>
                        {tarea.completada_fecha && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Completada el {formatFecha(tarea.completada_fecha)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Colaborador</p>
                <p className="text-sm font-medium">{offboarding.usuario?.nombre_completo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="text-sm">{offboarding.usuario?.codigo_asesor}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Salida</p>
                <Badge className={cn('text-xs', TIPO_SALIDA_COLORS[offboarding.tipo_salida as TipoSalida])}>
                  {TIPO_SALIDA_LABELS[offboarding.tipo_salida as TipoSalida]}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha Inicio</p>
                <p className="text-sm">{formatFecha(offboarding.fecha_inicio)}</p>
              </div>
              {offboarding.fecha_cierre && (
                <div>
                  <p className="text-xs text-muted-foreground">Fecha Cierre</p>
                  <p className="text-sm">{formatFecha(offboarding.fecha_cierre)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Notas</CardTitle>
                {esGestion && esEnProceso && (
                  <Button variant="ghost" size="sm" onClick={() => setShowNotas(!showNotas)}>
                    {showNotas ? 'Cancelar' : 'Editar'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showNotas ? (
                <div className="space-y-2">
                  <Textarea
                    value={notasEdit}
                    onChange={(e) => setNotasEdit(e.target.value)}
                    rows={4}
                  />
                  <Button size="sm" onClick={guardarNotas} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Guardar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {offboarding.notas || 'Sin notas'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
