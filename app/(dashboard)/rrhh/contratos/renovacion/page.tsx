'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH, puedeVisarRenovacion } from '@/lib/rrhh/utils/permisos-rrhh'
import { useLotesRenovacion } from '@/lib/rrhh/hooks/useRenovacion'
import { ESTADO_LOTE, ESTADO_LOTE_LABELS } from '@/lib/rrhh/types'
import type { EstadoLote } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { RefreshCw, Plus, Loader2, ArrowLeft, Eye } from 'lucide-react'
import { toast } from 'sonner'

const ESTADO_LOTE_COLORS: Record<EstadoLote, string> = {
  GENERADO: 'bg-gray-100 text-gray-800',
  EN_VISADO_JV: 'bg-blue-100 text-blue-800',
  EN_VISADO_KAM: 'bg-indigo-100 text-indigo-800',
  LISTO_PARA_RRHH: 'bg-amber-100 text-amber-800',
  EJECUTADO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-red-100 text-red-800',
}

export default function RenovacionLotesPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [estadoFilter, setEstadoFilter] = useState<string>('')
  const [showCrearDialog, setShowCrearDialog] = useState(false)
  const [nuevoPeriodo, setNuevoPeriodo] = useState('')
  const [nuevaFechaLimite, setNuevaFechaLimite] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  const { data: lotes, loading, total, refetch } = useLotesRenovacion({
    estado: estadoFilter || undefined,
  })

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const puedeVisar = user ? puedeVisarRenovacion(user.rol) : false

  async function crearLote() {
    if (!nuevoPeriodo || !user) return
    setCreando(true)
    try {
      const response = await fetch('/api/rrhh/renovacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo: nuevoPeriodo,
          fecha_limite_visado: nuevaFechaLimite || null,
          generado_por: user.id,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      toast.success(`Lote ${nuevoPeriodo} creado con ${json.lote?.total_colaboradores || 0} colaboradores`)
      setShowCrearDialog(false)
      setNuevoPeriodo('')
      setNuevaFechaLimite('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear lote')
    } finally {
      setCreando(false)
    }
  }

  function formatFecha(fecha: string | null) {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-PE')
  }

  function formatPeriodo(periodo: string) {
    const [year, month] = periodo.split('-')
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${meses[parseInt(month) - 1]} ${year}`
  }

  function getLoteUrl(loteId: string, estado: EstadoLote) {
    // JV va directo a su vista de visado, KAM a la suya, RRHH/Admin al detalle general
    if (user?.rol === 'JEFE_VENTAS' && estado === 'EN_VISADO_JV') {
      return `/rrhh/contratos/renovacion/${loteId}/visado-jv`
    }
    if ((user?.rol === 'GERENTE_COMERCIAL' || user?.rol === 'ADMIN') && estado === 'EN_VISADO_KAM') {
      return `/rrhh/contratos/renovacion/${loteId}/visado-kam`
    }
    return `/rrhh/contratos/renovacion/${loteId}`
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/rrhh/contratos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lotes de Renovación</h1>
            <p className="text-muted-foreground">
              Ciclos mensuales de renovación con flujo de visado JV / KAM / RRHH
            </p>
          </div>
        </div>
        {esGestion && (
          <Button onClick={() => setShowCrearDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generar Lote
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_LOTE.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_LOTE_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {estadoFilter && (
              <Button variant="ghost" size="sm" onClick={() => setEstadoFilter('')}>
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
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Lotes</CardTitle>
              <CardDescription>{total} lotes encontrados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No se encontraron lotes de renovación
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {esGestion
                  ? 'Usa el botón "Generar Lote" para crear uno nuevo'
                  : 'Aún no hay lotes de renovación generados'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Fecha Generación</TableHead>
                    <TableHead>Fecha Límite Visado</TableHead>
                    <TableHead>Colaboradores</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => (
                    <TableRow
                      key={lote.id}
                      className="cursor-pointer"
                      onClick={() => router.push(getLoteUrl(lote.id, lote.estado))}
                    >
                      <TableCell className="font-medium">
                        {formatPeriodo(lote.periodo)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFecha(lote.fecha_generacion)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFecha(lote.fecha_limite_visado)}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {lote.total_colaboradores}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', ESTADO_LOTE_COLORS[lote.estado])}>
                          {ESTADO_LOTE_LABELS[lote.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(getLoteUrl(lote.id, lote.estado))
                          }}
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Dialog: Crear Lote */}
      <Dialog open={showCrearDialog} onOpenChange={setShowCrearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar Lote de Renovación</DialogTitle>
            <DialogDescription>
              Se generará un lote con todos los contratos vigentes que vencen en el periodo seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="periodo">Periodo (YYYY-MM)</Label>
              <Input
                id="periodo"
                placeholder="2026-03"
                value={nuevoPeriodo}
                onChange={(e) => setNuevoPeriodo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_limite">Fecha límite de visado (opcional)</Label>
              <Input
                id="fecha_limite"
                type="date"
                value={nuevaFechaLimite}
                onChange={(e) => setNuevaFechaLimite(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCrearDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={crearLote} disabled={creando || !nuevoPeriodo}>
              {creando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                'Generar Lote'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
