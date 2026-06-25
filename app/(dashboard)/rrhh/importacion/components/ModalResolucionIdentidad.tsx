'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ESTADO_VERIFICACION_IDENTIDAD_LABELS,
  ESTADO_VERIFICACION_IDENTIDAD_COLORS,
} from '@/lib/rrhh/types'
import type { DetalleFilaImportacion } from '@/lib/rrhh/interfaces'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle } from 'lucide-react'

interface ModalResolucionIdentidadProps {
  fila: DetalleFilaImportacion | null
  open: boolean
  onClose: () => void
  onUsarNombreOficial: (filaExcel: number) => void
  onConfirmarManualmente: (filaExcel: number, justificacion: string) => void
}

export default function ModalResolucionIdentidad({
  fila,
  open,
  onClose,
  onUsarNombreOficial,
  onConfirmarManualmente,
}: ModalResolucionIdentidadProps) {
  const [justificacion, setJustificacion] = useState('')
  const [confirmado, setConfirmado] = useState(false)

  if (!fila || !fila.verificacion_identidad) return null

  const { verificacion_identidad } = fila
  const esNoCoincide = verificacion_identidad.estado === 'NOMBRE_NO_COINCIDE'
  const esNoEncontrado = verificacion_identidad.estado === 'NO_ENCONTRADO'

  const handleConfirmar = () => {
    if (!justificacion.trim()) return
    onConfirmarManualmente(fila.fila_excel, justificacion.trim())
    resetAndClose()
  }

  const handleUsarNombre = () => {
    onUsarNombreOficial(fila.fila_excel)
    resetAndClose()
  }

  const resetAndClose = () => {
    setJustificacion('')
    setConfirmado(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && resetAndClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Resolver verificacion de identidad
          </DialogTitle>
          <DialogDescription>
            {esNoCoincide
              ? 'El nombre del Excel no coincide con el nombre oficial de RENIEC.'
              : 'El documento no fue encontrado en los registros oficiales.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current data */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">DNI/CE</Label>
                <p className="font-mono">{fila.dni}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Badge
                  className={cn(
                    'text-xs',
                    ESTADO_VERIFICACION_IDENTIDAD_COLORS[verificacion_identidad.estado],
                  )}
                >
                  {ESTADO_VERIFICACION_IDENTIDAD_LABELS[verificacion_identidad.estado]}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Nombre en Excel</Label>
                <p className="text-sm font-medium">{fila.nombre}</p>
              </div>
              {verificacion_identidad.nombre_oficial && (
                <div>
                  <Label className="text-xs text-muted-foreground">Nombre RENIEC</Label>
                  <p className="text-sm font-medium">{verificacion_identidad.nombre_oficial}</p>
                </div>
              )}
            </div>

            {verificacion_identidad.confianza_nombre !== null && (
              <p className="text-xs text-muted-foreground">
                Coincidencia: {Math.round(verificacion_identidad.confianza_nombre * 100)}%
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Option 1: Use RENIEC name (only for NOMBRE_NO_COINCIDE) */}
            {esNoCoincide && verificacion_identidad.nombre_oficial && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">
                  Opcion 1: Usar nombre de RENIEC
                </p>
                <p className="text-xs text-muted-foreground">
                  Reemplazar &quot;{fila.nombre}&quot; por &quot;{verificacion_identidad.nombre_oficial}&quot;
                </p>
                <Button size="sm" onClick={handleUsarNombre}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Usar nombre RENIEC
                </Button>
              </div>
            )}

            {/* Option 2: Manual confirmation */}
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">
                {esNoCoincide ? 'Opcion 2' : 'Opcion 1'}: Confirmar manualmente
              </p>
              <p className="text-xs text-muted-foreground">
                {esNoCoincide
                  ? 'He verificado que los datos son correctos a pesar de la diferencia de nombres.'
                  : 'He verificado la identidad del colaborador por otros medios.'}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={confirmado}
                    onChange={e => setConfirmado(e.target.checked)}
                  />
                  <Label className="text-xs">He verificado la identidad del colaborador</Label>
                </div>
                {confirmado && (
                  <Textarea
                    placeholder="Justificacion obligatoria..."
                    value={justificacion}
                    onChange={e => setJustificacion(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConfirmar}
                  disabled={!confirmado || !justificacion.trim()}
                >
                  Confirmar manualmente
                </Button>
              </div>
            </div>

            {/* Option 3: Exclude (for NO_ENCONTRADO) */}
            {esNoEncontrado && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">
                  Opcion 2: Excluir de la importacion
                </p>
                <p className="text-xs text-muted-foreground">
                  Puede excluir esta fila en el paso de revision.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={resetAndClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
