'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileSpreadsheet, Columns, Rows3, Info } from 'lucide-react'
import { TablaPreview } from './TablaPreview'
import type { AnalisisExcel } from '../hooks/useWizardImportacion'

interface StepAnalisisProps {
  analisis: AnalisisExcel
  onHojaChange?: (hoja: string) => void
  onPrev: () => void
  onNext: () => void
  loading: boolean
}

const TIPO_COLOR: Record<string, string> = {
  texto: 'bg-gray-100 text-gray-700',
  numero: 'bg-blue-100 text-blue-700',
  fecha: 'bg-purple-100 text-purple-700',
  booleano: 'bg-yellow-100 text-yellow-700',
  email: 'bg-green-100 text-green-700',
  telefono: 'bg-cyan-100 text-cyan-700',
}

export function StepAnalisis({ analisis, onHojaChange, onPrev, onNext, loading }: StepAnalisisProps) {
  const columnas = analisis.columnas_detectadas

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Análisis del Archivo</h2>
        <p className="text-sm text-gray-500">
          Revisa que los datos detectados sean correctos antes de continuar al mapeo.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{analisis.hojas.length}</p>
              <p className="text-xs text-gray-500">{analisis.hojas.length === 1 ? 'Hoja' : 'Hojas'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Columns className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-2xl font-bold">{columnas.length}</p>
              <p className="text-xs text-gray-500">Columnas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Rows3 className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{analisis.total_filas_datos}</p>
              <p className="text-xs text-gray-500">Filas de datos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sheet selector (if multiple sheets) */}
      {analisis.hojas.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Hoja activa:</span>
          <Select value={analisis.hoja_seleccionada} onValueChange={onHojaChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {analisis.hojas.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Columns detected */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Columnas Detectadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {columnas.map(col => (
              <div key={col.indice} className="flex items-center justify-between p-2 rounded border text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{col.nombre_original}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant="secondary" className={TIPO_COLOR[col.tipo_inferido] || ''}>
                    {col.tipo_inferido}
                  </Badge>
                  <span className="text-xs text-gray-400">{col.porcentaje_lleno}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Preview de Datos</CardTitle>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Info className="w-3 h-3" />
              Fila de encabezados: {analisis.fila_encabezados + 1}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TablaPreview
            columnas={columnas.map(c => c.nombre_original)}
            datos={analisis.preview_datos}
          />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>Anterior</Button>
        <Button onClick={onNext} disabled={loading}>
          {loading ? 'Mapeando columnas...' : 'Continuar al Mapeo'}
        </Button>
      </div>
    </div>
  )
}
