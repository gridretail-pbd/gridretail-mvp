'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarPipeline, puedeVerPipeline } from '@/lib/rrhh/utils/permisos-rrhh'
import { useCandidatos } from '@/lib/rrhh/hooks/useCandidatos'
import {
  ETAPA_PIPELINE,
  FUENTE_CAPTACION, FUENTE_CAPTACION_LABELS,
} from '@/lib/rrhh/types'
import type { EtapaPipeline } from '@/lib/rrhh/types'
import type { Candidato } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import {
  ETAPA_LABELS, ETAPA_COLORES, ETAPAS_KANBAN, TRANSICIONES_VALIDAS,
} from '@/lib/rrhh/utils/pipeline'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  UserPlus, Search, X, Loader2, Phone, Calendar,
  ChevronRight, Ban, Users, Eye,
} from 'lucide-react'
import { toast } from 'sonner'

export default function ReclutamientoPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [fuenteFilter, setFuenteFilter] = useState('')
  const [vistaLista, setVistaLista] = useState(false)

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Dialog para descartar
  const [descartarDialog, setDescartarDialog] = useState<{ candidato: Candidato } | null>(null)
  const [descartarMotivo, setDescartarMotivo] = useState('')
  const [descartarLoading, setDescartarLoading] = useState(false)

  // Dialog para avanzar
  const [avanzarDialog, setAvanzarDialog] = useState<{ candidato: Candidato; etapaDestino: EtapaPipeline } | null>(null)
  const [avanzarNotas, setAvanzarNotas] = useState('')
  const [avanzarLoading, setAvanzarLoading] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!puedeVerPipeline(usuario.rol)) {
      router.push('/rrhh')
      return
    }
    setUser(usuario)
  }, [router])

  const { data: candidatos, loading, refetch } = useCandidatos({
    descartado: false,
    search: debouncedSearch || undefined,
    fuente_captacion: fuenteFilter || undefined,
  })

  const esGestion = user ? puedeGestionarPipeline(user.rol) : false

  // Agrupar candidatos por etapa para Kanban
  const candidatosPorEtapa: Record<string, Candidato[]> = {}
  for (const etapa of ETAPAS_KANBAN) {
    candidatosPorEtapa[etapa] = []
  }
  for (const c of candidatos) {
    if (candidatosPorEtapa[c.etapa_actual]) {
      candidatosPorEtapa[c.etapa_actual].push(c)
    }
  }

  // ─── Acciones ───────────────────────────────────────────────────────────────

  async function handleAvanzar() {
    if (!avanzarDialog || !user) return
    setAvanzarLoading(true)
    try {
      const response = await fetch(`/api/rrhh/candidatos/${avanzarDialog.candidato.id}/avanzar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_destino: avanzarDialog.etapaDestino,
          registrado_por: user.id,
          notas: avanzarNotas || null,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success(`Candidato avanzado a ${ETAPA_LABELS[avanzarDialog.etapaDestino]}`)
      setAvanzarDialog(null)
      setAvanzarNotas('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar etapa')
    } finally {
      setAvanzarLoading(false)
    }
  }

  async function handleDescartar() {
    if (!descartarDialog || !user) return
    setDescartarLoading(true)
    try {
      const response = await fetch(`/api/rrhh/candidatos/${descartarDialog.candidato.id}/descartar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descartado_por: user.id,
          motivo: descartarMotivo,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success('Candidato descartado')
      setDescartarDialog(null)
      setDescartarMotivo('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al descartar')
    } finally {
      setDescartarLoading(false)
    }
  }

  const hayFiltrosActivos = searchTerm || fuenteFilter

  function limpiarFiltros() {
    setSearchTerm('')
    setFuenteFilter('')
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline de Reclutamiento</h1>
          <p className="text-muted-foreground">
            {candidatos.length} candidatos activos en el pipeline
          </p>
        </div>
        {esGestion && (
          <Button onClick={() => router.push('/rrhh/reclutamiento/nuevo')}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo Candidato
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, DNI o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={fuenteFilter} onValueChange={setFuenteFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Fuente" />
              </SelectTrigger>
              <SelectContent>
                {FUENTE_CAPTACION.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FUENTE_CAPTACION_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}

            <div className="ml-auto flex gap-1">
              <Button
                variant={!vistaLista ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setVistaLista(false)}
              >
                Kanban
              </Button>
              <Button
                variant={vistaLista ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setVistaLista(true)}
              >
                Lista
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : vistaLista ? (
        /* Vista Lista */
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Todos los candidatos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {candidatos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground text-lg font-medium">
                  No hay candidatos en el pipeline
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {candidatos.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/rrhh/reclutamiento/${c.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.nombre_completo}</p>
                      <p className="text-sm text-muted-foreground">
                        DNI: {c.dni} | {c.telefono}
                      </p>
                    </div>
                    <Badge className={cn('text-xs shrink-0', ETAPA_COLORES[c.etapa_actual as EtapaPipeline])}>
                      {ETAPA_LABELS[c.etapa_actual as EtapaPipeline]}
                    </Badge>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {FUENTE_CAPTACION_LABELS[c.fuente_captacion]}
                    </Badge>
                    {c.ai_score && (
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        AI: {c.ai_score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Vista Kanban */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS_KANBAN.map((etapa) => {
            const items = candidatosPorEtapa[etapa] || []
            return (
              <div key={etapa} className="flex-shrink-0 w-[280px]">
                <div className="mb-3 flex items-center gap-2">
                  <Badge className={cn('text-xs', ETAPA_COLORES[etapa])}>
                    {ETAPA_LABELS[etapa]}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-medium">
                    {items.length}
                  </span>
                </div>
                <ScrollArea className="h-[calc(100vh-340px)]">
                  <div className="space-y-2 pr-2">
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <p className="text-xs text-muted-foreground">Sin candidatos</p>
                      </div>
                    ) : (
                      items.map((c) => (
                        <KanbanCard
                          key={c.id}
                          candidato={c}
                          esGestion={esGestion}
                          onVerDetalle={() => router.push(`/rrhh/reclutamiento/${c.id}`)}
                          onAvanzar={(etapaDestino) => {
                            setAvanzarDialog({ candidato: c, etapaDestino })
                            setAvanzarNotas('')
                          }}
                          onDescartar={() => {
                            setDescartarDialog({ candidato: c })
                            setDescartarMotivo('')
                          }}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog Avanzar Etapa */}
      <Dialog open={!!avanzarDialog} onOpenChange={(open) => !open && setAvanzarDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avanzar candidato</DialogTitle>
            <DialogDescription>
              {avanzarDialog && (
                <>
                  <span className="font-medium">{avanzarDialog.candidato.nombre_completo}</span>
                  {' — '}
                  {ETAPA_LABELS[avanzarDialog.candidato.etapa_actual as EtapaPipeline]}
                  {' → '}
                  <span className="font-medium">{ETAPA_LABELS[avanzarDialog.etapaDestino]}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                placeholder="Observaciones sobre el avance..."
                value={avanzarNotas}
                onChange={(e) => setAvanzarNotas(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvanzarDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAvanzar} disabled={avanzarLoading}>
              {avanzarLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Avance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Descartar */}
      <Dialog open={!!descartarDialog} onOpenChange={(open) => !open && setDescartarDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar candidato</DialogTitle>
            <DialogDescription>
              {descartarDialog && (
                <>
                  <span className="font-medium">{descartarDialog.candidato.nombre_completo}</span>
                  {' — actualmente en '}
                  {ETAPA_LABELS[descartarDialog.candidato.etapa_actual as EtapaPipeline]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo del descarte *</label>
              <Textarea
                placeholder="Explica el motivo del descarte (mínimo 5 caracteres)..."
                value={descartarMotivo}
                onChange={(e) => setDescartarMotivo(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescartarDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDescartar}
              disabled={descartarLoading || descartarMotivo.length < 5}
            >
              {descartarLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Kanban Card Component ──────────────────────────────────────────────────

interface KanbanCardProps {
  candidato: Candidato
  esGestion: boolean
  onVerDetalle: () => void
  onAvanzar: (etapaDestino: EtapaPipeline) => void
  onDescartar: () => void
}

function KanbanCard({ candidato, esGestion, onVerDetalle, onAvanzar, onDescartar }: KanbanCardProps) {
  const etapa = candidato.etapa_actual as EtapaPipeline
  const siguientes = ETAPAS_KANBAN.includes(etapa)
    ? getSiguientesNoDescartado(etapa)
    : []

  const diasEnPipeline = Math.floor(
    (Date.now() - new Date(candidato.fecha_captacion).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        {/* Nombre y score */}
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={onVerDetalle}
            className="text-sm font-medium text-left hover:underline truncate"
          >
            {candidato.nombre_completo}
          </button>
          {candidato.ai_score && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs shrink-0 font-mono">
                    {candidato.ai_score}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>AI Score</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {candidato.telefono}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {diasEnPipeline}d en pipeline
          </p>
        </div>

        {/* Fuente */}
        <Badge variant="outline" className="text-[10px]">
          {FUENTE_CAPTACION_LABELS[candidato.fuente_captacion]}
        </Badge>

        {/* Acciones */}
        {esGestion && (
          <div className="flex gap-1 pt-1 border-t">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onVerDetalle}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver detalle</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {siguientes.map((sig) => (
              <TooltipProvider key={sig}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700"
                      onClick={() => onAvanzar(sig)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Avanzar a {ETAPA_LABELS[sig]}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 ml-auto"
                    onClick={onDescartar}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Descartar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Obtiene las siguientes etapas excluyendo DESCARTADO (eso va por botón aparte) */
function getSiguientesNoDescartado(etapa: EtapaPipeline): EtapaPipeline[] {
  const todas: EtapaPipeline[] = TRANSICIONES_VALIDAS[etapa] || []
  return todas.filter((e) => e !== 'DESCARTADO')
}
