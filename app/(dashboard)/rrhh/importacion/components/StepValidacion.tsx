'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2, AlertTriangle, XCircle, Users,
  TrendingUp, BarChart3,
} from 'lucide-react'
import {
  NIVEL_COMPLETITUD_LABELS, NIVEL_COMPLETITUD_COLORS,
  CAMPOS_DESTINO,
} from '@/lib/rrhh/types'
import type { NivelCompletitud } from '@/lib/rrhh/types'
import type { DetalleFilaImportacion, ReporteBrechas } from '@/lib/rrhh/interfaces'
import { cn } from '@/lib/utils'
import VerificacionIdentidad from './VerificacionIdentidad'

interface StepValidacionProps {
  detalleFilas: DetalleFilaImportacion[]
  reporteBrechas: ReporteBrechas | null
  onPrev: () => void
  onNext: () => void
  loading: boolean
  // RENIEC verification props
  verificacion?: {
    ejecutando: boolean
    progreso: { procesados: number; total: number; porcentaje: number }
    resumen: {
      total: number; verificados: number; nombre_revisar: number
      nombre_no_coincide: number; no_encontrado: number; error_api: number
    } | null
    error: string | null
    onIniciar: () => void
    onReintentarErrores: () => void
    onResolverFila: (filaExcel: number) => void
    puedeContinuar: boolean
  }
}

export function StepValidacion({
  detalleFilas,
  reporteBrechas,
  onPrev,
  onNext,
  loading,
  verificacion,
}: StepValidacionProps) {
  const totales = useMemo(() => ({
    total: detalleFilas.length,
    validos: detalleFilas.filter(f => f.estado === 'VALIDO').length,
    warnings: detalleFilas.filter(f => f.estado === 'WARNING').length,
    errores: detalleFilas.filter(f => f.estado === 'ERROR').length,
    activos: detalleFilas.filter(f => !f.es_cesado).length,
    cesados: detalleFilas.filter(f => f.es_cesado).length,
  }), [detalleFilas])

  const importables = totales.validos + totales.warnings

  const campoLabel = (campo: string): string => {
    const def = CAMPOS_DESTINO.find(c => c.campo === campo)
    return def?.label || campo.split('.').pop() || campo
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Validación y Análisis de Brechas</h2>
        <p className="text-sm text-gray-500">
          Revisa los resultados de validación antes de continuar a la revisión.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="w-7 h-7 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{totales.total}</p>
              <p className="text-xs text-gray-500">Total filas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{totales.validos}</p>
              <p className="text-xs text-gray-500">Válidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-7 h-7 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">{totales.warnings}</p>
              <p className="text-xs text-gray-500">Advertencias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="w-7 h-7 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-600">{totales.errores}</p>
              <p className="text-xs text-gray-500">Errores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activos vs Cesados */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-green-700">{totales.activos}</p>
            <p className="text-xs text-gray-500">Activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-gray-500">{totales.cesados}</p>
            <p className="text-xs text-gray-500">Cesados</p>
          </CardContent>
        </Card>
      </div>

      {/* RENIEC Verification (sub-step 4b) */}
      {verificacion && (
        <VerificacionIdentidad
          filas={detalleFilas}
          ejecutando={verificacion.ejecutando}
          progreso={verificacion.progreso}
          resumen={verificacion.resumen}
          error={verificacion.error}
          onIniciar={verificacion.onIniciar}
          onReintentarErrores={verificacion.onReintentarErrores}
          onResolverFila={verificacion.onResolverFila}
          puedeContinuar={verificacion.puedeContinuar}
        />
      )}

      {/* Completitud Distribution */}
      {reporteBrechas && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Distribución de Completitud
              </CardTitle>
              <Badge variant="secondary">
                Promedio: {reporteBrechas.completitud_promedio}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.entries(reporteBrechas.distribucion_completitud) as [NivelCompletitud, number][])
              .filter(([, count]) => count > 0)
              .map(([nivel, count]) => (
                <div key={nivel} className="flex items-center gap-3">
                  <Badge className={cn('min-w-[90px] justify-center', NIVEL_COMPLETITUD_COLORS[nivel])}>
                    {NIVEL_COMPLETITUD_LABELS[nivel]}
                  </Badge>
                  <div className="flex-1">
                    <Progress
                      value={(count / detalleFilas.length) * 100}
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Top Missing Fields */}
      {reporteBrechas && reporteBrechas.top_campos_faltantes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Campos más faltantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reporteBrechas.top_campos_faltantes.slice(0, 8).map(({ campo, cantidad }) => (
                <div key={campo} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{campoLabel(campo)}</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(cantidad / detalleFilas.length) * 100}
                      className="w-24 h-1.5"
                    />
                    <span className="text-gray-500 w-16 text-right">
                      {cantidad}/{detalleFilas.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors/Warnings Summary */}
      {totales.errores > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-sm text-red-700">
              Filas con errores ({totales.errores}) — No se importarán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {detalleFilas
                .filter(f => f.estado === 'ERROR')
                .slice(0, 20)
                .map(fila => (
                  <div key={fila.fila_excel} className="text-sm p-2 bg-red-50 rounded">
                    <span className="font-medium">Fila {fila.fila_excel}</span>
                    {fila.dni && <span className="text-gray-500"> — DNI: {fila.dni}</span>}
                    {fila.nombre && <span className="text-gray-500"> — {fila.nombre}</span>}
                    <div className="mt-1 space-y-0.5">
                      {fila.errores.filter(e => e.tipo === 'ERROR').map((e, i) => (
                        <p key={i} className="text-red-600 text-xs">
                          {campoLabel(e.campo)}: {e.mensaje}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary message */}
      <div className={cn(
        'p-4 rounded-lg text-sm',
        importables > 0
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800',
      )}>
        {importables > 0 ? (
          <p>
            <strong>{importables}</strong> filas pueden ser importadas
            ({totales.validos} válidas + {totales.warnings} con advertencias).
            {totales.errores > 0 && ` ${totales.errores} filas con errores serán excluidas.`}
          </p>
        ) : (
          <p>No hay filas importables. Revisa los errores y corrige el archivo.</p>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>Anterior</Button>
        <Button
          onClick={onNext}
          disabled={loading || importables === 0 || (verificacion ? !verificacion.puedeContinuar : false)}
        >
          {loading ? 'Procesando...' : 'Revisar y Confirmar'}
        </Button>
      </div>
    </div>
  )
}
