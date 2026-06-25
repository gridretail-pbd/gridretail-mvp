'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ESTADO_VERIFICACION_IDENTIDAD_LABELS,
  ESTADO_VERIFICACION_IDENTIDAD_COLORS,
} from '@/lib/rrhh/types'
import type { DetalleFilaImportacion } from '@/lib/rrhh/interfaces'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Loader2, Shield } from 'lucide-react'

interface VerificacionIdentidadProps {
  filas: DetalleFilaImportacion[]
  ejecutando: boolean
  progreso: { procesados: number; total: number; porcentaje: number }
  resumen: {
    total: number
    verificados: number
    nombre_revisar: number
    nombre_no_coincide: number
    no_encontrado: number
    error_api: number
  } | null
  error: string | null
  onIniciar: () => void
  onReintentarErrores: () => void
  onResolverFila: (filaExcel: number) => void
  puedeContinuar: boolean
  costoEstimado?: string
}

export default function VerificacionIdentidad({
  filas,
  ejecutando,
  progreso,
  resumen,
  error,
  onIniciar,
  onReintentarErrores,
  onResolverFila,
  puedeContinuar,
  costoEstimado,
}: VerificacionIdentidadProps) {
  const filasConVerificacion = filas.filter(f => f.verificacion_identidad)
  const filasVerificables = filas.filter(
    f => f.estado !== 'ERROR' && f.dni && /^\d{8,9}$/.test(f.dni),
  )

  // Count by state
  const counts = {
    verificados: filasConVerificacion.filter(f => f.verificacion_identidad?.estado === 'VERIFICADO').length,
    revisar: filasConVerificacion.filter(f => f.verificacion_identidad?.estado === 'NOMBRE_REVISAR').length,
    no_coincide: filasConVerificacion.filter(
      f => f.verificacion_identidad?.estado === 'NOMBRE_NO_COINCIDE' && !f.verificacion_identidad?.confirmado_manualmente,
    ).length,
    no_encontrado: filasConVerificacion.filter(
      f => f.verificacion_identidad?.estado === 'NO_ENCONTRADO' && !f.verificacion_identidad?.confirmado_manualmente,
    ).length,
    error_api: filasConVerificacion.filter(f => f.verificacion_identidad?.estado === 'ERROR_API').length,
    confirmados: filasConVerificacion.filter(f => f.verificacion_identidad?.confirmado_manualmente).length,
  }

  const requiereAccion = counts.no_coincide > 0 || counts.no_encontrado > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Verificacion de Identidad
          {resumen && !requiereAccion && puedeContinuar && (
            <Badge className="bg-green-100 text-green-800 ml-2">Completado</Badge>
          )}
          {requiereAccion && (
            <Badge className="bg-red-100 text-red-800 ml-2">Accion requerida</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pre-execution state */}
        {!ejecutando && !resumen && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se verificaran {filasVerificables.length} documentos contra RENIEC/Migraciones.
              {costoEstimado && ` Costo estimado: ${costoEstimado}`}
            </p>
            <Button onClick={onIniciar} disabled={filasVerificables.length === 0}>
              <Shield className="h-4 w-4 mr-2" />
              Iniciar verificacion ({filasVerificables.length} documentos)
            </Button>
          </div>
        )}

        {/* Executing - progress bar */}
        {ejecutando && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                Verificando... {progreso.procesados}/{progreso.total}
              </span>
            </div>
            <Progress value={progreso.porcentaje} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Results summary */}
        {resumen && !ejecutando && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <ResultadoItem
                icon={<CheckCircle className="h-4 w-4 text-green-600" />}
                label="Verificados"
                count={counts.verificados}
                color="text-green-800"
              />
              <ResultadoItem
                icon={<AlertTriangle className="h-4 w-4 text-yellow-600" />}
                label="Revisar"
                count={counts.revisar}
                color="text-yellow-800"
              />
              <ResultadoItem
                icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
                label="No coincide"
                count={counts.no_coincide}
                color="text-red-800"
                accion={counts.no_coincide > 0}
              />
              <ResultadoItem
                icon={<XCircle className="h-4 w-4 text-red-600" />}
                label="No encontrado"
                count={counts.no_encontrado}
                color="text-red-800"
                accion={counts.no_encontrado > 0}
              />
              <ResultadoItem
                icon={<RefreshCw className="h-4 w-4 text-gray-600" />}
                label="Error API"
                count={counts.error_api}
                color="text-gray-800"
              />
              {counts.confirmados > 0 && (
                <ResultadoItem
                  icon={<CheckCircle className="h-4 w-4 text-blue-600" />}
                  label="Confirmados manual"
                  count={counts.confirmados}
                  color="text-blue-800"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {counts.error_api > 0 && (
                <Button variant="outline" size="sm" onClick={onReintentarErrores}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reintentar errores ({counts.error_api})
                </Button>
              )}
            </div>

            {/* List of filas requiring action */}
            {requiereAccion && (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {filasConVerificacion
                  .filter(
                    f =>
                      (f.verificacion_identidad?.estado === 'NOMBRE_NO_COINCIDE' ||
                        f.verificacion_identidad?.estado === 'NO_ENCONTRADO') &&
                      !f.verificacion_identidad?.confirmado_manualmente,
                  )
                  .map(fila => (
                    <div
                      key={fila.fila_excel}
                      className="p-2 flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="font-medium">{fila.nombre}</span>
                        <span className="text-muted-foreground ml-2">({fila.dni})</span>
                        <Badge
                          className={cn(
                            'ml-2 text-xs',
                            ESTADO_VERIFICACION_IDENTIDAD_COLORS[
                              fila.verificacion_identidad!.estado
                            ],
                          )}
                        >
                          {ESTADO_VERIFICACION_IDENTIDAD_LABELS[fila.verificacion_identidad!.estado]}
                        </Badge>
                        {fila.verificacion_identidad?.nombre_oficial && (
                          <span className="text-xs text-muted-foreground ml-2">
                            RENIEC: {fila.verificacion_identidad.nombre_oficial}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onResolverFila(fila.fila_excel)}
                      >
                        Resolver
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ResultadoItem({
  icon,
  label,
  count,
  color,
  accion,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
  accion?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg',
        accion ? 'bg-red-50 border border-red-200' : 'bg-gray-50',
      )}
    >
      {icon}
      <div>
        <p className={cn('text-sm font-medium', color)}>{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
