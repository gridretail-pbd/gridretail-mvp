'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useAlertas } from '@/lib/rrhh/hooks/useAlertas'
import {
  TIPO_ALERTA, TIPO_ALERTA_LABELS,
  NIVEL_ALERTA, NIVEL_ALERTA_COLORS,
  ESTADO_ALERTA, ESTADO_ALERTA_LABELS, ESTADO_ALERTA_COLORS,
} from '@/lib/rrhh/types'
import type { TipoAlerta, NivelAlerta, EstadoAlerta } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

import {
  Bell, Search, X, Loader2, AlertTriangle, Info,
  AlertCircle, Eye, CheckCircle, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

function getNivelIcon(nivel: string) {
  switch (nivel) {
    case 'CRITICAL': return <AlertCircle className="h-5 w-5 text-red-500" />
    case 'WARNING': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    default: return <Info className="h-5 w-5 text-blue-500" />
  }
}

export default function AlertasPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [nivelFilter, setNivelFilter] = useState('')
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

  const { data: alertas, loading, total, refetch } = useAlertas({
    nivel: nivelFilter || undefined,
    estado: estadoFilter || undefined,
    search: debouncedSearch || undefined,
  })

  // Dialog para accionar
  const [accionDialog, setAccionDialog] = useState<string | null>(null)
  const [accionTexto, setAccionTexto] = useState('')
  const [saving, setSaving] = useState(false)

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const hayFiltros = nivelFilter || estadoFilter || searchTerm

  function limpiarFiltros() {
    setSearchTerm('')
    setNivelFilter('')
    setEstadoFilter('')
  }

  function formatFechaHora(fecha: string) {
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  async function marcarLeida(alertaId: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/alertas/${alertaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'LEIDA' }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Alerta marcada como leída')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function descartarAlerta(alertaId: string) {
    if (!user) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/alertas/${alertaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'DESCARTADA', accion_por: user.id }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Alerta descartada')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAccionar() {
    if (!accionDialog || !accionTexto || !user) return
    setSaving(true)
    try {
      const response = await fetch(`/api/rrhh/alertas/${accionDialog}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'ACCIONADA',
          accion_tomada: accionTexto,
          accion_por: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Acción registrada')
      setAccionDialog(null)
      setAccionTexto('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar acción')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  // Conteos por nivel
  const criticalCount = alertas.filter(a => a.nivel === 'CRITICAL' && a.estado === 'PENDIENTE').length
  const warningCount = alertas.filter(a => a.nivel === 'WARNING' && a.estado === 'PENDIENTE').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alertas RRHH</h1>
        <p className="text-muted-foreground">
          Alertas y notificaciones del módulo de Recursos Humanos
        </p>
      </div>

      {/* KPI cards */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {criticalCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-800">{criticalCount}</p>
                  <p className="text-sm text-red-600">alertas críticas pendientes</p>
                </div>
              </CardContent>
            </Card>
          )}
          {warningCount > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-800">{warningCount}</p>
                  <p className="text-sm text-yellow-600">advertencias pendientes</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en alertas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={nivelFilter} onValueChange={setNivelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                {NIVEL_ALERTA.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_ALERTA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_ALERTA_LABELS[e]}
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

      {/* Lista de alertas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Alertas</CardTitle>
              <CardDescription>{total} alertas encontradas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No hay alertas
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltros ? 'Intenta modificar los filtros' : 'No se han generado alertas'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-lg border transition-colors',
                    alerta.estado === 'PENDIENTE' && alerta.nivel === 'CRITICAL' && 'border-red-200 bg-red-50/50',
                    alerta.estado === 'PENDIENTE' && alerta.nivel === 'WARNING' && 'border-yellow-200 bg-yellow-50/50',
                    alerta.estado === 'PENDIENTE' && alerta.nivel === 'INFO' && 'border-blue-200 bg-blue-50/50',
                    alerta.estado !== 'PENDIENTE' && 'bg-muted/30',
                  )}
                >
                  <div className="mt-0.5">{getNivelIcon(alerta.nivel)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{alerta.titulo}</p>
                      <Badge className={cn('text-[10px]', ESTADO_ALERTA_COLORS[alerta.estado as EstadoAlerta])}>
                        {ESTADO_ALERTA_LABELS[alerta.estado as EstadoAlerta]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {TIPO_ALERTA_LABELS[alerta.tipo as TipoAlerta] || alerta.tipo}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alerta.mensaje}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatFechaHora(alerta.created_at)}</p>

                    {alerta.accion_tomada && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
                        <span className="font-medium">Acción:</span> {alerta.accion_tomada}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {alerta.estado === 'PENDIENTE' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Marcar como leída"
                        onClick={() => marcarLeida(alerta.id)}
                        disabled={saving}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {esGestion && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            title="Registrar acción"
                            onClick={() => setAccionDialog(alerta.id)}
                            disabled={saving}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            title="Descartar"
                            onClick={() => descartarAlerta(alerta.id)}
                            disabled={saving}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {alerta.estado === 'LEIDA' && esGestion && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        title="Registrar acción"
                        onClick={() => setAccionDialog(alerta.id)}
                        disabled={saving}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        title="Descartar"
                        onClick={() => descartarAlerta(alerta.id)}
                        disabled={saving}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog accionar */}
      <Dialog open={!!accionDialog} onOpenChange={(open) => !open && setAccionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Acción</DialogTitle>
            <DialogDescription>
              Describa la acción tomada en respuesta a esta alerta
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={accionTexto}
              onChange={(e) => setAccionTexto(e.target.value)}
              placeholder="Describa la acción tomada..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAccionDialog(null); setAccionTexto('') }}>Cancelar</Button>
            <Button onClick={handleAccionar} disabled={saving || !accionTexto}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
