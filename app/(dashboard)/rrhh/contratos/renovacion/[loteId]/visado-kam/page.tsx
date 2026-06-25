'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeVisarRenovacion } from '@/lib/rrhh/utils/permisos-rrhh'
import { useLoteRenovacion } from '@/lib/rrhh/hooks/useRenovacion'
import type { RenovacionDecision } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

import { ArrowLeft, Loader2, CheckCircle2, RotateCcw, Clock } from 'lucide-react'
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

export default function VisadoKAMPage() {
  const router = useRouter()
  const params = useParams()
  const loteId = params.loteId as string
  const [user, setUser] = useState<Usuario | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [decisionSeleccionada, setDecisionSeleccionada] = useState<RenovacionDecision | null>(null)
  const [decisionValue, setDecisionValue] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!puedeVisarRenovacion(usuario.rol)) {
      router.push('/rrhh/contratos/renovacion')
      return
    }
    setUser(usuario)
  }, [router])

  const { data: lote, decisiones, loading, refetch } = useLoteRenovacion(loteId)

  // Solo decisiones que ya tienen visado JV
  const conVisadoJV = decisiones.filter((d) => d.decision_jv)
  const pendientes = conVisadoJV.filter((d) => !d.decision_kam)
  const completadas = conVisadoJV.filter((d) => d.decision_kam)

  function abrirDialog(dec: RenovacionDecision, decision: string) {
    setDecisionSeleccionada(dec)
    setDecisionValue(decision)
    setMotivo('')
    setShowDialog(true)
  }

  async function guardarVisado() {
    if (!decisionSeleccionada || !decisionValue || !user) return
    if (decisionValue === 'REVERTIR' && (!motivo || motivo.length < 5)) {
      toast.error('Motivo obligatorio (mínimo 5 caracteres) al revertir decisión')
      return
    }

    setGuardando(true)
    try {
      const response = await fetch(`/api/rrhh/renovacion/${loteId}/visado-kam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision_id: decisionSeleccionada.id,
          decision: decisionValue,
          motivo: motivo || null,
          kam_id: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success(`Visado KAM registrado para ${decisionSeleccionada.usuario?.nombre_completo}`)
      setShowDialog(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar visado')
    } finally {
      setGuardando(false)
    }
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
          Volver
        </Button>
        <p className="text-muted-foreground">Lote no encontrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/rrhh/contratos/renovacion')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Visado KAM — {formatPeriodo(lote.periodo)}
          </h1>
          <p className="text-muted-foreground">
            {pendientes.length} pendientes de {conVisadoJV.length} con visado JV
          </p>
        </div>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pendientes de Visado KAM ({pendientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Decisión JV</TableHead>
                    <TableHead>Motivo JV</TableHead>
                    <TableHead className="w-[220px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map((dec) => (
                    <TableRow key={dec.id}>
                      <TableCell className="font-medium">
                        {dec.usuario?.nombre_completo || '—'}
                      </TableCell>
                      <TableCell>{dec.usuario?.dni || '—'}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', DECISION_JV_COLORS[dec.decision_jv || ''])}>
                          {DECISION_JV_LABELS[dec.decision_jv || ''] || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {dec.decision_jv_motivo || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => abrirDialog(dec, 'CONFIRMAR')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-700 border-orange-200 hover:bg-orange-50"
                            onClick={() => abrirDialog(dec, 'REVERTIR')}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Revertir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completadas */}
      {completadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Visados KAM Completados ({completadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Decisión JV</TableHead>
                    <TableHead>Decisión KAM</TableHead>
                    <TableHead>Motivo KAM</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completadas.map((dec) => (
                    <TableRow key={dec.id}>
                      <TableCell className="font-medium">
                        {dec.usuario?.nombre_completo || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', DECISION_JV_COLORS[dec.decision_jv || ''])}>
                          {DECISION_JV_LABELS[dec.decision_jv || ''] || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs',
                          dec.decision_kam === 'CONFIRMAR' ? 'bg-green-100 text-green-800' :
                          'bg-orange-100 text-orange-800'
                        )}>
                          {dec.decision_kam === 'CONFIRMAR' ? 'Confirmado' : 'Revertido'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {dec.decision_kam_motivo || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dec.decision_kam_fecha
                          ? new Date(dec.decision_kam_fecha).toLocaleDateString('es-PE')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Registrar Visado KAM */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionValue === 'CONFIRMAR' ? 'Confirmar Decisión JV' : 'Revertir Decisión JV'}
              {' — '}{decisionSeleccionada?.usuario?.nombre_completo}
            </DialogTitle>
            <DialogDescription>
              Decisión JV: {DECISION_JV_LABELS[decisionSeleccionada?.decision_jv || '']}
              {decisionSeleccionada?.decision_jv_motivo && ` — ${decisionSeleccionada.decision_jv_motivo}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {decisionSeleccionada?.ai_resumen && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">Resumen AI:</p>
                <p className="text-sm">{decisionSeleccionada.ai_resumen}</p>
              </div>
            )}
            {decisionValue === 'REVERTIR' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Motivo de reversión <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Justifique por qué revierte la decisión del JV..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                />
                {motivo.length > 0 && motivo.length < 5 && (
                  <p className="text-xs text-red-500">Mínimo 5 caracteres</p>
                )}
              </div>
            )}
            {decisionValue === 'CONFIRMAR' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Observaciones (opcional)</label>
                <Textarea
                  placeholder="Agregar observaciones adicionales..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={guardarVisado}
              disabled={guardando}
              variant={decisionValue === 'REVERTIR' ? 'destructive' : 'default'}
            >
              {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {decisionValue === 'CONFIRMAR' ? 'Confirmar' : 'Revertir Decisión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
