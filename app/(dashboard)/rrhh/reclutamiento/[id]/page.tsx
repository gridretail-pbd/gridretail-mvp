'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarPipeline, puedeVerPipeline } from '@/lib/rrhh/utils/permisos-rrhh'
import { useCandidato } from '@/lib/rrhh/hooks/useCandidatos'
import {
  FUENTE_CAPTACION_LABELS,
  GENERO_LABELS,
} from '@/lib/rrhh/types'
import type { EtapaPipeline, FuenteCaptacion, Genero } from '@/lib/rrhh/types'
import type { Candidato, CandidatoEtapa, CandidatoEntrevista } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import {
  ETAPA_LABELS, ETAPA_COLORES, ETAPAS_KANBAN, ETAPA_ORDEN, TRANSICIONES_VALIDAS, esEtapaTerminal,
} from '@/lib/rrhh/utils/pipeline'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Briefcase,
  ChevronRight, Ban, Loader2, Clock, User, FileText,
} from 'lucide-react'
import { toast } from 'sonner'

export default function CandidatoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const candidatoId = params.id as string

  const [user, setUser] = useState<Usuario | null>(null)

  // Dialogs
  const [avanzarDialog, setAvanzarDialog] = useState<EtapaPipeline | null>(null)
  const [avanzarNotas, setAvanzarNotas] = useState('')
  const [avanzarLoading, setAvanzarLoading] = useState(false)

  const [descartarOpen, setDescartarOpen] = useState(false)
  const [descartarMotivo, setDescartarMotivo] = useState('')
  const [descartarLoading, setDescartarLoading] = useState(false)

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

  const { data: candidato, loading, refetch } = useCandidato(candidatoId)

  const esGestion = user ? puedeGestionarPipeline(user.rol) : false

  // ─── Acciones ───────────────────────────────────────────────────────────────

  async function handleAvanzar() {
    if (!avanzarDialog || !user || !candidato) return
    setAvanzarLoading(true)
    try {
      const response = await fetch(`/api/rrhh/candidatos/${candidato.id}/avanzar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_destino: avanzarDialog,
          registrado_por: user.id,
          notas: avanzarNotas || null,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success(`Candidato avanzado a ${ETAPA_LABELS[avanzarDialog]}`)
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
    if (!user || !candidato) return
    setDescartarLoading(true)
    try {
      const response = await fetch(`/api/rrhh/candidatos/${candidato.id}/descartar`, {
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
      setDescartarOpen(false)
      setDescartarMotivo('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al descartar')
    } finally {
      setDescartarLoading(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!candidato) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/rrhh/reclutamiento')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al pipeline
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Candidato no encontrado</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const etapa = candidato.etapa_actual as EtapaPipeline
  const esTerminal = esEtapaTerminal(etapa)
  const siguientes = (TRANSICIONES_VALIDAS[etapa] || []).filter((e) => e !== 'DESCARTADO')
  const diasEnPipeline = Math.floor(
    (Date.now() - new Date(candidato.fecha_captacion).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/rrhh/reclutamiento')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{candidato.nombre_completo}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn('text-xs', ETAPA_COLORES[etapa])}>
                {ETAPA_LABELS[etapa]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                DNI: {candidato.dni}
              </span>
              <span className="text-sm text-muted-foreground">
                {diasEnPipeline} días en pipeline
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        {esGestion && !esTerminal && (
          <div className="flex gap-2 shrink-0">
            {siguientes.map((sig) => (
              <Button
                key={sig}
                size="sm"
                onClick={() => { setAvanzarDialog(sig); setAvanzarNotas('') }}
              >
                <ChevronRight className="mr-1 h-4 w-4" />
                {ETAPA_LABELS[sig]}
              </Button>
            ))}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setDescartarOpen(true); setDescartarMotivo('') }}
            >
              <Ban className="mr-1 h-4 w-4" />
              Descartar
            </Button>
          </div>
        )}
      </div>

      {/* Pipeline Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            {ETAPAS_KANBAN.map((e, i) => {
              const orden = ETAPA_ORDEN[e]
              const ordenActual = ETAPA_ORDEN[etapa]
              const completada = !candidato.descartado && orden < ordenActual
              const esActual = e === etapa
              return (
                <div key={e} className="flex items-center">
                  {i > 0 && (
                    <div className={cn(
                      'w-6 h-0.5 mx-1',
                      completada ? 'bg-green-500' : 'bg-muted'
                    )} />
                  )}
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-medium whitespace-nowrap',
                    esActual ? ETAPA_COLORES[e] :
                    completada ? 'bg-green-100 text-green-800' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {ETAPA_LABELS[e]}
                  </div>
                </div>
              )
            })}
            {candidato.descartado && (
              <>
                <div className="w-6 h-0.5 mx-1 bg-red-300" />
                <div className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                  Descartado
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos Personales</TabsTrigger>
          <TabsTrigger value="pipeline">Historial Pipeline</TabsTrigger>
          <TabsTrigger value="entrevistas">
            Entrevistas {candidato.entrevistas?.length ? `(${candidato.entrevistas.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="etapa">Datos de Etapa</TabsTrigger>
        </TabsList>

        {/* Tab: Datos Personales */}
        <TabsContent value="datos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info Personal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Nombre" value={candidato.nombre_completo} />
                <InfoRow label="DNI" value={candidato.dni} />
                <InfoRow label="Teléfono" value={candidato.telefono} icon={<Phone className="h-3.5 w-3.5" />} />
                <InfoRow label="Email" value={candidato.email} icon={<Mail className="h-3.5 w-3.5" />} />
                <InfoRow label="Fecha Nacimiento" value={candidato.fecha_nacimiento ? new Date(candidato.fecha_nacimiento).toLocaleDateString('es-PE') : null} />
                <InfoRow label="Género" value={candidato.genero ? GENERO_LABELS[candidato.genero as Genero] : null} />
                <InfoRow label="Distrito" value={candidato.distrito_residencia} icon={<MapPin className="h-3.5 w-3.5" />} />
                <InfoRow label="Dirección" value={candidato.direccion} />
              </CardContent>
            </Card>

            {/* Experiencia y Pipeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Experiencia y Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Experiencia Telecom" value={candidato.experiencia_telecom ? 'Sí' : 'No'} />
                <InfoRow label="Detalle" value={candidato.experiencia_detalle} />
                <InfoRow label="Disponibilidad" value={candidato.disponibilidad_horario} />
                <InfoRow label="Detalle Disponibilidad" value={candidato.disponibilidad_detalle} />
                <InfoRow label="Fuente" value={FUENTE_CAPTACION_LABELS[candidato.fuente_captacion as FuenteCaptacion]} />
                <InfoRow label="Referido por" value={candidato.referido_por_usuario?.nombre_completo} />
                <InfoRow label="Tienda destino" value={candidato.tienda_destino ? `${candidato.tienda_destino.nombre} (${candidato.tienda_destino.codigo})` : null} />
                <InfoRow
                  label="Fecha captación"
                  value={new Date(candidato.fecha_captacion).toLocaleDateString('es-PE')}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                />
                <InfoRow label="AI Score" value={candidato.ai_score ? String(candidato.ai_score) : null} />
                {candidato.notas && (
                  <InfoRow label="Notas" value={candidato.notas} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Descarte info */}
          {candidato.descartado && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base text-red-800">Candidato Descartado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Etapa de descarte" value={candidato.descarte_etapa ? ETAPA_LABELS[candidato.descarte_etapa as EtapaPipeline] : null} />
                <InfoRow label="Motivo" value={candidato.descarte_motivo} />
                <InfoRow label="Fecha" value={candidato.descarte_fecha ? new Date(candidato.descarte_fecha).toLocaleDateString('es-PE') : null} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Historial Pipeline */}
        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Historial de Etapas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!candidato.etapas || candidato.etapas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin historial de etapas registrado
                </p>
              ) : (
                <div className="space-y-3">
                  {[...candidato.etapas]
                    .sort((a, b) => new Date(b.fecha_entrada).getTime() - new Date(a.fecha_entrada).getTime())
                    .map((etapaHist) => (
                      <EtapaHistorialCard key={etapaHist.id} etapa={etapaHist} />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Entrevistas */}
        <TabsContent value="entrevistas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Entrevistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!candidato.entrevistas || candidato.entrevistas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin entrevistas registradas
                </p>
              ) : (
                <div className="space-y-3">
                  {candidato.entrevistas.map((entrevista) => (
                    <EntrevistaCard key={entrevista.id} entrevista={entrevista} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Datos de Etapa (Entel, Inducción, Sombra) */}
        <TabsContent value="etapa" className="space-y-4">
          {/* Consulta Entel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consulta Entel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Fecha envío" value={candidato.entel_fecha_envio ? new Date(candidato.entel_fecha_envio).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Estado" value={candidato.entel_estado} />
              <InfoRow label="Fecha respuesta" value={candidato.entel_fecha_respuesta ? new Date(candidato.entel_fecha_respuesta).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Observaciones" value={candidato.entel_observaciones} />
            </CardContent>
          </Card>

          {/* Usuario Entel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuario Entel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Fecha solicitud" value={candidato.entel_usuario_fecha_solicitud ? new Date(candidato.entel_usuario_fecha_solicitud).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Estado" value={candidato.entel_usuario_estado} />
              <InfoRow label="Confirmado" value={candidato.entel_usuario_confirmado ? 'Sí' : 'No'} />
            </CardContent>
          </Card>

          {/* Inducción */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inducción</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Fecha inicio" value={candidato.induccion_fecha_inicio ? new Date(candidato.induccion_fecha_inicio).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Fecha fin" value={candidato.induccion_fecha_fin ? new Date(candidato.induccion_fecha_fin).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Evaluación" value={candidato.induccion_evaluacion} />
            </CardContent>
          </Card>

          {/* Sombra */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sombra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Fecha inicio" value={candidato.sombra_fecha_inicio ? new Date(candidato.sombra_fecha_inicio).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Fecha fin" value={candidato.sombra_fecha_fin ? new Date(candidato.sombra_fecha_fin).toLocaleDateString('es-PE') : null} />
              <InfoRow label="Resultado" value={candidato.sombra_resultado} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Avanzar */}
      <Dialog open={!!avanzarDialog} onOpenChange={(open) => !open && setAvanzarDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avanzar candidato</DialogTitle>
            <DialogDescription>
              {avanzarDialog && (
                <>
                  <span className="font-medium">{candidato.nombre_completo}</span>
                  {' — '}
                  {ETAPA_LABELS[etapa]}
                  {' → '}
                  <span className="font-medium">{ETAPA_LABELS[avanzarDialog]}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Textarea
              placeholder="Observaciones sobre el avance..."
              value={avanzarNotas}
              onChange={(e) => setAvanzarNotas(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvanzarDialog(null)}>Cancelar</Button>
            <Button onClick={handleAvanzar} disabled={avanzarLoading}>
              {avanzarLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Descartar */}
      <Dialog open={descartarOpen} onOpenChange={setDescartarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar candidato</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{candidato.nombre_completo}</span>
              {' — actualmente en '}
              {ETAPA_LABELS[etapa]}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Motivo del descarte *</label>
            <Textarea
              placeholder="Explica el motivo del descarte (mínimo 5 caracteres)..."
              value={descartarMotivo}
              onChange={(e) => setDescartarMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescartarOpen(false)}>Cancelar</Button>
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

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}:</span>
      <span className="text-sm">{value || '—'}</span>
    </div>
  )
}

function EtapaHistorialCard({ etapa }: { etapa: CandidatoEtapa }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <Badge className={cn('text-xs mt-0.5 shrink-0', ETAPA_COLORES[etapa.etapa as EtapaPipeline])}>
        {ETAPA_LABELS[etapa.etapa as EtapaPipeline]}
      </Badge>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{new Date(etapa.fecha_entrada).toLocaleDateString('es-PE')}</span>
          {etapa.fecha_salida && (
            <>
              <span>→</span>
              <span>{new Date(etapa.fecha_salida).toLocaleDateString('es-PE')}</span>
            </>
          )}
          {etapa.resultado && (
            <Badge variant={etapa.resultado === 'APROBADO' ? 'default' : 'destructive'} className="text-[10px]">
              {etapa.resultado}
            </Badge>
          )}
        </div>
        {etapa.notas && (
          <p className="text-sm text-muted-foreground">{etapa.notas}</p>
        )}
      </div>
    </div>
  )
}

function EntrevistaCard({ entrevista }: { entrevista: CandidatoEntrevista }) {
  const resultadoColor = entrevista.resultado === 'APROBADO' ? 'bg-green-100 text-green-800' :
    entrevista.resultado === 'RECHAZADO' ? 'bg-red-100 text-red-800' :
    'bg-yellow-100 text-yellow-800'

  return (
    <div className="p-3 rounded-lg border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Nivel {entrevista.nivel}</span>
          {entrevista.entrevistador && (
            <span className="text-sm text-muted-foreground">
              — {entrevista.entrevistador.nombre_completo} ({entrevista.entrevistador.rol})
            </span>
          )}
        </div>
        <Badge className={cn('text-xs', resultadoColor)}>
          {entrevista.resultado}
        </Badge>
      </div>
      {entrevista.fecha_programada && (
        <p className="text-xs text-muted-foreground">
          Programada: {new Date(entrevista.fecha_programada).toLocaleDateString('es-PE')}
        </p>
      )}
      {entrevista.fecha_realizada && (
        <p className="text-xs text-muted-foreground">
          Realizada: {new Date(entrevista.fecha_realizada).toLocaleDateString('es-PE')}
        </p>
      )}
      {entrevista.observaciones && (
        <p className="text-sm text-muted-foreground">{entrevista.observaciones}</p>
      )}
      {entrevista.scorecard && entrevista.scorecard.criterios && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Scorecard:</p>
          {entrevista.scorecard.criterios.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate">{c.nombre}</span>
              <span className="font-mono">{c.puntaje}/5</span>
              {c.observacion && <span className="text-muted-foreground">— {c.observacion}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
