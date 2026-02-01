'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MONTH_NAMES } from '@/lib/penalidades/types'
import * as XLSX from 'xlsx'

interface ParsedRow {
  rowNum: number
  codigo_asesor: string
  tipo_penalidad: string
  cantidad: number
  monto_original: number
  descripcion?: string
  referencia?: string
  isValid: boolean
  errors: string[]
}

interface ImportResult {
  success: boolean
  imported: number
  errors: Array<{ row: number; message: string }>
  warnings: Array<{ row: number; message: string }>
}

type WizardStep = 'upload' | 'preview' | 'importing' | 'complete'

export default function ImportarFichaPage() {
  const router = useRouter()
  const currentDate = new Date()

  const [step, setStep] = useState<WizardStep>('upload')
  const [year, setYear] = useState(currentDate.getFullYear())
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i)

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setParseError(null)
      setFileName(file.name)

      try {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })

        // Get first sheet
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        // Parse to JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: '',
        })

        if (jsonData.length === 0) {
          setParseError('El archivo no contiene datos')
          return
        }

        // Map columns (try to auto-detect)
        const rows: ParsedRow[] = jsonData.map((row, idx) => {
          const errors: string[] = []

          // Try different column name variations
          const codigoAsesor =
            row['CODIGO_ASESOR'] ||
            row['Codigo Asesor'] ||
            row['codigo_asesor'] ||
            row['CODIGO'] ||
            row['Codigo'] ||
            ''

          const tipoPenalidad =
            row['TIPO_PENALIDAD'] ||
            row['Tipo Penalidad'] ||
            row['tipo_penalidad'] ||
            row['TIPO'] ||
            row['Tipo'] ||
            row['CONCEPTO'] ||
            ''

          const cantidad =
            parseFloat(row['CANTIDAD'] || row['Cantidad'] || row['cantidad'] || row['QTY'] || '1') ||
            1

          const montoOriginal =
            parseFloat(
              row['MONTO_ORIGINAL'] ||
                row['Monto Original'] ||
                row['monto_original'] ||
                row['MONTO'] ||
                row['Monto'] ||
                '0'
            ) || 0

          const descripcion =
            row['DESCRIPCION'] || row['Descripcion'] || row['descripcion'] || ''

          const referencia =
            row['REFERENCIA'] || row['Referencia'] || row['referencia'] || row['REF'] || ''

          // Validate
          if (!codigoAsesor) {
            errors.push('Código de asesor vacío')
          }
          if (!tipoPenalidad) {
            errors.push('Tipo de penalidad vacío')
          }

          return {
            rowNum: idx + 2, // Excel row number (1-based, +1 for header)
            codigo_asesor: String(codigoAsesor).trim(),
            tipo_penalidad: String(tipoPenalidad).trim(),
            cantidad,
            monto_original: montoOriginal,
            descripcion: String(descripcion).trim(),
            referencia: String(referencia).trim(),
            isValid: errors.length === 0,
            errors,
          }
        })

        setParsedRows(rows)
        setStep('preview')
      } catch (error) {
        console.error('Error parsing file:', error)
        setParseError('Error al leer el archivo. Asegúrate de que sea un archivo Excel válido.')
      }
    },
    []
  )

  const handleImport = async () => {
    setStep('importing')
    setImporting(true)
    setImportProgress(0)

    try {
      // Filter valid rows
      const validRows = parsedRows
        .filter((r) => r.isValid)
        .map((r) => ({
          codigo_asesor: r.codigo_asesor,
          tipo_penalidad: r.tipo_penalidad,
          cantidad: r.cantidad,
          monto_original: r.monto_original,
          descripcion: r.descripcion,
          referencia: r.referencia,
        }))

      setImportProgress(30)

      const res = await fetch('/api/penalidades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          file_name: fileName,
          rows: validRows,
        }),
      })

      setImportProgress(80)

      if (res.ok) {
        const result = await res.json()
        setImportResult(result)
        setImportProgress(100)
        setStep('complete')
      } else {
        const error = await res.json()
        setImportResult({
          success: false,
          imported: 0,
          errors: [{ row: 0, message: error.error || 'Error en la importación' }],
          warnings: [],
        })
        setStep('complete')
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportResult({
        success: false,
        imported: 0,
        errors: [{ row: 0, message: 'Error de conexión' }],
        warnings: [],
      })
      setStep('complete')
    } finally {
      setImporting(false)
    }
  }

  const resetWizard = () => {
    setStep('upload')
    setFileName('')
    setParsedRows([])
    setImportResult(null)
    setImportProgress(0)
    setParseError(null)
  }

  const validCount = parsedRows.filter((r) => r.isValid).length
  const invalidCount = parsedRows.length - validCount

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/comisiones/penalidades">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Importar FICHA de Penalidades
          </h1>
          <p className="text-muted-foreground">
            Importar penalidades desde archivo Excel de Entel
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[
          { key: 'upload', label: 'Cargar Archivo' },
          { key: 'preview', label: 'Vista Previa' },
          { key: 'importing', label: 'Importando' },
          { key: 'complete', label: 'Completado' },
        ].map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${
                  step === s.key
                    ? 'bg-primary text-primary-foreground'
                    : ['upload', 'preview', 'importing', 'complete'].indexOf(step) >
                      ['upload', 'preview', 'importing', 'complete'].indexOf(s.key)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
            >
              {['upload', 'preview', 'importing', 'complete'].indexOf(step) >
              ['upload', 'preview', 'importing', 'complete'].indexOf(s.key) ? (
                <Check className="h-4 w-4" />
              ) : (
                idx + 1
              )}
            </div>
            {idx < 3 && (
              <div
                className={`w-12 h-1 mx-1 ${
                  ['upload', 'preview', 'importing', 'complete'].indexOf(step) > idx
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>1. Seleccionar Período y Archivo</CardTitle>
            <CardDescription>
              Selecciona el año y mes, luego carga el archivo Excel de FICHA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MONTH_NAMES).map(([num, name]) => (
                      <SelectItem key={num} value={num}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Archivo Excel</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    <Upload className="h-4 w-4" />
                    Seleccionar Archivo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Formatos soportados: .xlsx, .xls
                  </p>
                </div>
              </div>
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Formato Esperado</AlertTitle>
              <AlertDescription>
                El archivo debe contener las columnas: CODIGO_ASESOR, TIPO_PENALIDAD, CANTIDAD,
                MONTO_ORIGINAL. Opcionalmente: DESCRIPCION, REFERENCIA.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>2. Vista Previa de Datos</CardTitle>
            <CardDescription>
              Revisa los datos antes de importar. Archivo: {fileName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {validCount} registros válidos
                </span>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    {invalidCount} registros con errores
                  </span>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Fila</TableHead>
                    <TableHead>Código Asesor</TableHead>
                    <TableHead>Tipo Penalidad</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row) => (
                    <TableRow
                      key={row.rowNum}
                      className={!row.isValid ? 'bg-red-50' : undefined}
                    >
                      <TableCell className="font-mono text-xs">{row.rowNum}</TableCell>
                      <TableCell className="font-mono">{row.codigo_asesor || '-'}</TableCell>
                      <TableCell>{row.tipo_penalidad || '-'}</TableCell>
                      <TableCell className="text-right">{row.cantidad}</TableCell>
                      <TableCell className="text-right">
                        S/ {row.monto_original.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <Badge variant="outline" className="text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            {row.errors.join(', ')}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedRows.length > 100 && (
              <p className="text-sm text-muted-foreground text-center">
                Mostrando primeros 100 de {parsedRows.length} registros
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={resetWizard}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importar {validCount} Registros
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle>3. Importando Datos</CardTitle>
            <CardDescription>Por favor espera mientras se procesan los registros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 py-8">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <Progress value={importProgress} className="w-full" />
            <p className="text-center text-muted-foreground">
              Procesando {validCount} registros...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === 'complete' && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  Importación Completada
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  Importación con Errores
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Results Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-green-800">Importados</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
                <p className="text-sm text-red-800">Errores</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">
                  {importResult.warnings.length}
                </p>
                <p className="text-sm text-yellow-800">Advertencias</p>
              </div>
            </div>

            {/* Errors List */}
            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errores en la importación</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {importResult.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx} className="text-sm">
                        {err.row > 0 ? `Fila ${err.row}: ` : ''}
                        {err.message}
                      </li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li className="text-sm">
                        ... y {importResult.errors.length - 10} errores más
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings List */}
            {importResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Advertencias</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {importResult.warnings.slice(0, 5).map((warn, idx) => (
                      <li key={idx} className="text-sm">
                        Fila {warn.row}: {warn.message}
                      </li>
                    ))}
                    {importResult.warnings.length > 5 && (
                      <li className="text-sm">
                        ... y {importResult.warnings.length - 5} advertencias más
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={resetWizard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Nueva Importación
              </Button>
              <div className="flex gap-2">
                <Link href="/comisiones/penalidades/historial">
                  <Button variant="outline">Ver Historial</Button>
                </Link>
                <Link href="/comisiones/penalidades">
                  <Button>
                    <Check className="h-4 w-4 mr-2" />
                    Finalizar
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
