'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useLoteRenovacion } from '@/lib/rrhh/hooks/useRenovacion'
import { ESTADO_LOTE_LABELS } from '@/lib/rrhh/types'
import type { EstadoLote, DecisionJV, DecisionKAM, DecisionFinal } from '@/lib/rrhh/types'
import type { RenovacionDecision } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, ArrowRight, Play } from 'lucide-react'
import { toast } from 'sonner'

const DECISION_JV_LABELS: Record<string, string> = {
  RENOVAR: 'Renovar',
  NO_RENOVAR: 'No Renovar',
  PENDIENTE_EVALUAR: 'Pendiente Evaluar',
}

const DECISION_JV_COLORS: Record<string, string> = {
  RENOVAR: 'bg-green-100 text-green-800',
  NO_RENOVAR: 'bg-red-100 text-red-800',
  PENDIENTE_EVALUAR: 'bg-amber-100 text-amber-800',
}

const DECISION_KAM_LABELS: Record<string, string> = {
  CONFIRMAR: 'Confirmado',
  REVERTIR: 'Revertido',
}

const DECISION_KAM_COLORS: Record<string, string> = {
  CONFIRMAR: 'bg-green-100 text-green-800',
  REVERTIR: 'bg-orange-100 text-orange-800',
}

const DECISION_FINAL_LABELS: Record<string, string> = {
  RENOVAR: 'Renovar',
  NO_RENOVAR: 'No Renovar',
}

const DECISION_FINAL_COLORS: Record<string, string> = {
  RENOVAR: 'bg-green-100 text-green-800',
  NO_RENOVAR: 'bg-red-100 text-red-800',
}

const ESTADO_LOTE_COLORS: Record<EstadoLote, string> = {
  GENERADO: 'bg-gray-100 text-gray-800',
  EN_VISADO_JV: 'bg-blue-100 text-blue-800',
  EN_VISADO_KAM: 'bg-indigo-100 text-indigo-800',
  LISTO_PARA_RRHH: 'bg-amber-100 text-amber-800',
  EJECUTADO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-red-100 text-red-800',
}

export default function LoteDetallePage() {
  const router = useRouter()
  const params = useParams()
  const loteId = params.loteId as string
  const [user, setUser] = useState<Usuario | null>(null)
  const [avanzando, setAvanzando] = useState(false)
  const [showEjecutarDialog, setShowEjecutarDialog] = useState(false)
  const [decisionSeleccionada, setDecisionSeleccionada] = useState<RenovacionDecision | null>(null)
  const [decisionFinalValue, setDecisionFinalValue] = useState<string>('')
  const [ejecutando, setEjecutando] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  const { data: lote, decisiones, loading, refetch } = useLoteRenovacion(loteId)

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false

  // Estadísticas
  const totalDecisiones = decisiones.length
  const conVisadoJV = decisiones.filter((d) => d.decision_jv).length
  const conVisadoKAM = decisiones.filter((d) => d.decision_kam).length
  const conDecisionFinal = decisiones.filter((d) => d.decision_final).length

  async function avanzarEstado() {
    if (!lote) return
    const transiciones: Record<string, string> = {
      GENERADO: 'EN_VISADO_JV',
      EN_VISADO_JV: 'EN_VISADO_KAM',
      EN_VISADO_KAM: 'LISTO_PARA_RRHH',
      LISTO_PARA_RRHH: 'EJECUTADO',
    }
    const siguiente = transiciones[lote.estado]
    if (!siguiente) return

    // Validar que todos tengan visado antes de avanzar
    if (lote.estado === 'EN_VISADO_JV' && conVisadoJV < totalDecisiones) {
      toast.error(`Faltan ${totalDecisiones - conVisadoJV} visados de JV`)
      return
    }
    if (lote.estado === 'EN_VISADO_KAM' && conVisadoKAM < totalDecisiones) {
      toast.error(`Faltan ${totalDecisiones - conVisadoKAM} visados de KAM`)
      return
    }
    if (lote.estado === 'LISTO_PARA_RRHH' && conDecisionFinal < totalDecisiones) {
      toast.error(`Faltan ${totalDecisiones - conDecisionFinal} decisiones finales`)
      return
    }

    setAvanzando(true)
    try {
      const response = await fetch(`/api/rrhh/renovacion/${loteId}/avanzar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_destino: siguiente }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success(`Lote avanzado a: ${ESTADO_LOTE_LABELS[siguiente as EstadoLote]}`)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar lote')
    } finally {
      setAvanzando(false)
    }
  }

  async function ejecutarDecision() {
    if (!decisionSeleccionada || !decisionFinalValue || !user) return
    setEjecutando(true)
    try {
      const response = await fetch(`/api/rrhh/renovacion/${loteId}/ejecutar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision_id: decisionSeleccionada.id,
          decision_final: decisionFinalValue,
          ejecutado_por: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success(
        decisionFinalValue === 'RENOVAR'
          ? 'Contrato de renovación generado'
          : 'Marcado como no renovado'
      )
      setShowEjecutarDialog(false)
      setDecisionSeleccionada(null)
      setDecisionFinalValue('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ejecutar decisión')
    } finally {
      setEjecutando(false)
    }
  }

  function formatFecha(fecha: string | null) {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-PE')
  }

  function formatPeriodo(periodo: string) {
    const [year, month] = periodo.split('-')
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${meses[parseInt(month) - 1]} ${year}`
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lote) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/rrhh/contratos/renovacion')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Lotes
        </Button>
        <p className="text-muted-foreground">Lote no encontrado</p>
      </div>
    )
  }

  const puedeAvanzarLote = esGestion && lote.estado !== 'EJECUTADO' && lote.estado !== 'CANCELADO'
  const esListoParaRRHH = lote.estado === 'LISTO_PARA_RRHH'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/rrhh/contratos/renovacion')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Lote {formatPeriodo(lote.periodo)}
            </h1>
            <p className="text-muted-foreground">
              Generado el {formatFecha(lote.fecha_generacion)}
              {lote.fecha_limite_visado && ` — Límite visado: ${formatFecha(lote.fecha_limite_visado)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn('text-sm px-3 py-1', ESTADO_LOTE_COLORS[lote.estado])}>
            {ESTADO_LOTE_LABELS[lote.estado]}
          </Badge>
          {puedeAvanzarLote && (
            <Button onClick={avanzarEstado} disabled={avanzando}>
              {avanzando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Avanzar Estado
            </Button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalDecisiones}</div>
            <p className="text-sm text-muted-foreground">Total colaboradores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{conVisadoJV}/{totalDecisiones}</div>
            <p className="text-sm text-muted-foreground">Visado JV</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-indigo-600">{conVisadoKAM}/{totalDecisiones}</div>
            <p className="text-sm text-muted-foreground">Visado KAM</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{conDecisionFinal}/{totalDecisiones}</div>
            <p className="text-sm text-muted-foreground">Ejecutados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de decisiones */}
      <Card>
        <CardHeader>
          <CardTitle>Decisiones de Renovación</CardTitle>
          <CardDescription>
            {totalDecisiones} colaboradores en este lote
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decisiones.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay decisiones en este lote
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Decisión JV</TableHead>
                    <TableHead>Decisión KAM</TableHead>
                    <TableHead>Decisión Final</TableHead>
                    {esListoParaRRHH && esGestion && (
                      <TableHead className="w-[100px]">Acción</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisiones.map((dec) => (
                    <TableRow key={dec.id}>
                      <TableCell className="font-medium">
                        {dec.usuario?.nombre_completo || '—'}
                      </TableCell>
                      <TableCell>{dec.usuario?.dni || '—'}</TableCell>
                      <TableCell className="text-sm">{dec.usuario?.cuenta?.rol || '—'}</TableCell>
                      <TableCell>
                        {dec.decision_jv ? (
                          <div className="space-y-1">
                            <Badge className={cn('text-xs', DECISION_JV_COLORS[dec.decision_jv])}>
                              {DECISION_JV_LABELS[dec.decision_jv]}
                            </Badge>
                            {dec.decision_jv_motivo && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={dec.decision_jv_motivo}>
                                {dec.decision_jv_motivo}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {dec.decision_kam ? (
                          <div className="space-y-1">
                            <Badge className={cn('text-xs', DECISION_KAM_COLORS[dec.decision_kam])}>
                              {DECISION_KAM_LABELS[dec.decision_kam]}
                            </Badge>
                            {dec.decision_kam_motivo && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={dec.decision_kam_motivo}>
                                {dec.decision_kam_motivo}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {dec.decision_final ? (
                          <Badge className={cn('text-xs', DECISION_FINAL_COLORS[dec.decision_final])}>
                            {DECISION_FINAL_LABELS[dec.decision_final]}
                          </Badge>
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      {esListoParaRRHH && esGestion && (
                        <TableCell>
                          {!dec.decision_final && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDecisionSeleccionada(dec)
                                setShowEjecutarDialog(true)
                              }}
                            >
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Ejecutar
                            </Button>
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

      {/* Dialog: Ejecutar Decisión Final */}
      <Dialog open={showEjecutarDialog} onOpenChange={setShowEjecutarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ejecutar Decisión Final</DialogTitle>
            <DialogDescription>
              {decisionSeleccionada?.usuario?.nombre_completo} — {decisionSeleccionada?.usuario?.dni}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {decisionSeleccionada && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decisión JV:</span>
                  <Badge className={cn('text-xs', DECISION_JV_COLORS[decisionSeleccionada.decision_jv || ''])}>
                    {DECISION_JV_LABELS[decisionSeleccionada.decision_jv || ''] || '—'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decisión KAM:</span>
                  <Badge className={cn('text-xs', DECISION_KAM_COLORS[decisionSeleccionada.decision_kam || ''])}>
                    {DECISION_KAM_LABELS[decisionSeleccionada.decision_kam || ''] || '—'}
                  </Badge>
                </div>
                {decisionSeleccionada.ai_resumen && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium mb-1">Resumen AI:</p>
                    <p className="text-xs">{decisionSeleccionada.ai_resumen}</p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Decisión Final</label>
              <Select value={decisionFinalValue} onValueChange={setDecisionFinalValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar decisión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RENOVAR">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Renovar
                    </span>
                  </SelectItem>
                  <SelectItem value="NO_RENOVAR">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      No Renovar
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEjecutarDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={ejecutarDecision}
              disabled={ejecutando || !decisionFinalValue}
              variant={decisionFinalValue === 'NO_RENOVAR' ? 'destructive' : 'default'}
            >
              {ejecutando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {decisionFinalValue === 'RENOVAR' ? 'Generar Renovación' : decisionFinalValue === 'NO_RENOVAR' ? 'Confirmar No Renovación' : 'Ejecutar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
