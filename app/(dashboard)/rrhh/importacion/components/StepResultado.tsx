'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, Users, UserMinus, AlertTriangle,
  Bell, RefreshCw, ArrowRight, Download,
} from 'lucide-react'

interface ResultadoData {
  totalImportados: number
  totalActualizados: number
  totalSaltados: number
  totalActivos: number
  totalCesados: number
  alertasGeneradas: number
  reporteUrl: string | null
}

interface StepResultadoProps {
  resultado: ResultadoData
  importacionId: string | null
  onNuevaImportacion: () => void
  onIrAlertAs: () => void
  onIrColaboradores: () => void
}

export function StepResultado({
  resultado,
  importacionId,
  onNuevaImportacion,
  onIrAlertAs,
  onIrColaboradores,
}: StepResultadoProps) {
  const totalProcesados = resultado.totalImportados + resultado.totalActualizados

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center space-y-3 py-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-green-800">Importación Completada</h2>
        <p className="text-sm text-gray-500">
          Los colaboradores han sido importados exitosamente al sistema.
        </p>
      </div>

      {/* Results KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-1 text-blue-600" />
            <p className="text-3xl font-bold text-blue-600">{totalProcesados}</p>
            <p className="text-xs text-gray-500">Procesados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-600" />
            <p className="text-3xl font-bold text-green-600">{resultado.totalImportados}</p>
            <p className="text-xs text-gray-500">Nuevos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <RefreshCw className="w-6 h-6 mx-auto mb-1 text-indigo-600" />
            <p className="text-3xl font-bold text-indigo-600">{resultado.totalActualizados}</p>
            <p className="text-xs text-gray-500">Actualizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Desglose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600" />
              <span className="text-sm">Colaboradores activos</span>
            </div>
            <Badge className="bg-green-100 text-green-800">{resultado.totalActivos}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-gray-500" />
              <span className="text-sm">Colaboradores cesados</span>
            </div>
            <Badge className="bg-gray-100 text-gray-800">{resultado.totalCesados}</Badge>
          </div>
          {resultado.totalSaltados > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm">Saltados (errores)</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">{resultado.totalSaltados}</Badge>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-600" />
              <span className="text-sm">Alertas generadas</span>
            </div>
            <Badge className="bg-purple-100 text-purple-800">{resultado.alertasGeneradas}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <Button
            className="w-full justify-between"
            variant="outline"
            onClick={onIrColaboradores}
          >
            Ver colaboradores importados
            <ArrowRight className="w-4 h-4" />
          </Button>

          {resultado.alertasGeneradas > 0 && (
            <Button
              className="w-full justify-between"
              variant="outline"
              onClick={onIrAlertAs}
            >
              Revisar alertas generadas ({resultado.alertasGeneradas})
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          {importacionId && (
            <Button
              className="w-full justify-between"
              variant="outline"
              onClick={() => {
                window.open(`/api/rrhh/importacion/reporte?importacion_id=${importacionId}`, '_blank')
              }}
            >
              Descargar reporte de brechas (Excel)
              <Download className="w-4 h-4" />
            </Button>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={onNuevaImportacion}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Nueva importación
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
