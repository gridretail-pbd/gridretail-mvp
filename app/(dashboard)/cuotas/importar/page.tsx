'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  X,
  Search,
  Building,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/types'
import * as XLSX from 'xlsx'

// Roles que pueden importar
const ROLES_IMPORTAR = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Columnas conocidas para mapeo
const KNOWN_COLUMNS = {
  store_name: ['PDVS', 'PDV', 'TIENDA', 'NOMBRE_TIENDA', 'PUNTO_VENTA'],
  ss_quota: ['SS', 'CUOTA_SS', 'LINEAS', 'TOTAL_SS'],
  VR: ['VR', 'VOCE_RENTA'],
  VR_CAPTURA: ['VR_CAPTURA', 'VR CAPTURA'],
  VR_BASE: ['VR_BASE', 'VR BASE'],
  OSS: ['OSS', 'OTROS_SS'],
  OSS_CAPTURA: ['OSS_CAPTURA', 'OSS CAPTURA'],
  OSS_BASE: ['OSS_BASE', 'OSS BASE'],
  OPP: ['OPP', 'OTROS_PP'],
  OPP_CAPTURA: ['OPP_CAPTURA', 'OPP CAPTURA'],
  OPP_BASE: ['OPP_BASE', 'OPP BASE'],
  PACKS: ['PACKS', 'PACK'],
  RENO: ['RENO', 'RENOVACIONES'],
  PREPAGO: ['PREPAGO', 'PP', 'PRE_PAGO'],
  MISS_IN: ['MISS_IN', 'MISS IN', 'MISSIN'],
  ACCESORIOS: ['ACCESORIOS', 'ACC'],
}

interface Store {
  id: string
  codigo: string
  nombre: string
}

interface ParsedRow {
  originalName: string
  matchedStore: Store | null
  matchConfidence: number
  ssQuota: number
  breakdown: Record<string, number>
  selected: boolean
}

interface ColumnMapping {
  [excelColumn: string]: string
}

export default function ImportarCuotasPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const supabase = createClient()

  // Estado del wizard
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')

  // Período
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [replaceExisting, setReplaceExisting] = useState(false)

  // Archivo
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Datos parseados
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])

  // Importación
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported: number
    errors: number
    errorDetails?: Array<{ store_id: string; error: string }>
  } | null>(null)

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_IMPORTAR.includes(usuario.rol)) {
      router.push('/cuotas')
      return
    }
    setUser(usuario)
  }, [router])

  // Cargar tiendas
  useEffect(() => {
    async function loadStores() {
      const { data, error } = await supabase
        .from('tiendas')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('nombre')

      if (error) {
        console.error('Error cargando tiendas:', error)
        return
      }

      if (data) {
        console.log('Tiendas cargadas:', data.length)
        setStores(data)
      }
    }
    loadStores()
  }, [supabase])

  // Auto-detectar mapeo de columnas
  const autoDetectMapping = useCallback((excelHeaders: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {}

    for (const header of excelHeaders) {
      const normalizedHeader = header.toUpperCase().trim()

      for (const [field, aliases] of Object.entries(KNOWN_COLUMNS)) {
        if (aliases.some(alias => normalizedHeader === alias || normalizedHeader.includes(alias))) {
          mapping[header] = field
          break
        }
      }
    }

    return mapping
  }, [])

  // Normalizar nombre para comparación
  const normalizeName = (name: string): string => {
    return name
      .toUpperCase()
      .trim()
      .replace(/^TE\s+/i, '')      // Quitar prefijo "TE "
      .replace(/^TEX\s+/i, '')     // Quitar prefijo "TEX "
      .replace(/^TE_/i, '')        // Quitar prefijo "TE_"
      .replace(/[_\-\.]/g, ' ')    // Reemplazar guiones/puntos por espacios
      .replace(/\s+/g, ' ')        // Normalizar espacios múltiples
      .trim()
  }

  // Match de tiendas
  const matchStore = useCallback((name: string): { store: Store | null; confidence: number } => {
    const normalizedInput = normalizeName(name)
    console.log(`Matching "${name}" -> normalized: "${normalizedInput}"`)

    // Match exacto por nombre normalizado
    const exact = stores.find(s => {
      const normalizedStore = normalizeName(s.nombre)
      const normalizedCode = normalizeName(s.codigo)
      return normalizedStore === normalizedInput || normalizedCode === normalizedInput
    })
    if (exact) {
      console.log(`  -> Match exacto: ${exact.nombre}`)
      return { store: exact, confidence: 1.0 }
    }

    // Match parcial - el nombre de la tienda está contenido
    const partial = stores.find(s => {
      const normalizedStore = normalizeName(s.nombre)
      const normalizedCode = normalizeName(s.codigo)
      return (
        normalizedInput.includes(normalizedStore) ||
        normalizedStore.includes(normalizedInput) ||
        normalizedInput.includes(normalizedCode) ||
        normalizedCode.includes(normalizedInput)
      )
    })
    if (partial) {
      console.log(`  -> Match parcial: ${partial.nombre}`)
      return { store: partial, confidence: 0.8 }
    }

    // Match por palabras clave - al menos 2 palabras coinciden
    const inputWords = normalizedInput.split(' ').filter(w => w.length > 2)
    const bestMatch = stores
      .map(s => {
        const storeWords = normalizeName(s.nombre).split(' ').filter(w => w.length > 2)
        const matchingWords = inputWords.filter(iw =>
          storeWords.some(sw => sw === iw || sw.includes(iw) || iw.includes(sw))
        )
        return { store: s, matchCount: matchingWords.length }
      })
      .filter(m => m.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)[0]

    if (bestMatch && bestMatch.matchCount >= 1) {
      console.log(`  -> Match por palabras (${bestMatch.matchCount}): ${bestMatch.store.nombre}`)
      return { store: bestMatch.store, confidence: 0.6 + (bestMatch.matchCount * 0.1) }
    }

    console.log(`  -> Sin match`)
    return { store: null, confidence: 0 }
  }, [stores])

  // Parsear archivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setParsing(true)
    setParseError(null)

    try {
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })

      // Usar primera hoja o buscar hoja "PBD"
      let sheetName = workbook.SheetNames[0]
      if (workbook.SheetNames.includes('PBD')) {
        sheetName = 'PBD'
      }

      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

      if (jsonData.length === 0) {
        setParseError('El archivo está vacío o no tiene datos válidos')
        return
      }

      // Obtener headers
      const excelHeaders = Object.keys(jsonData[0])
      setHeaders(excelHeaders)

      // Auto-detectar mapeo
      const mapping = autoDetectMapping(excelHeaders)
      setColumnMapping(mapping)

      // Validar que tenemos los campos mínimos
      const storeNameField = Object.entries(mapping).find(([_, v]) => v === 'store_name')?.[0]
      const ssQuotaField = Object.entries(mapping).find(([_, v]) => v === 'ss_quota')?.[0]

      if (!storeNameField || !ssQuotaField) {
        setParseError('No se pudieron detectar las columnas de tienda y cuota SS')
        return
      }

      // Parsear filas
      const rows: ParsedRow[] = jsonData
        .filter(row => {
          const storeName = row[storeNameField]
          return storeName && typeof storeName === 'string' && storeName.trim() !== ''
        })
        .map(row => {
          const storeName = String(row[storeNameField] || '').trim()
          const { store, confidence } = matchStore(storeName)

          // Extraer cuotas
          const ssQuota = Number(row[ssQuotaField]) || 0

          // Extraer breakdown
          const breakdown: Record<string, number> = {}
          for (const [excelCol, field] of Object.entries(mapping)) {
            if (field !== 'store_name' && field !== 'ss_quota') {
              const value = Number(row[excelCol]) || 0
              if (value > 0) {
                breakdown[field] = value
              }
            }
          }

          return {
            originalName: storeName,
            matchedStore: store,
            matchConfidence: confidence,
            ssQuota,
            breakdown,
            selected: store !== null,
          }
        })
        // Filtrar filas con cuota válida
        .filter(row => row.ssQuota > 0)

      setParsedRows(rows)
      setStep('preview')
    } catch (error) {
      console.error('Error parseando archivo:', error)
      setParseError('Error al leer el archivo. Verifica que sea un Excel válido.')
    } finally {
      setParsing(false)
    }
  }

  // Cambiar store match manualmente
  const handleStoreChange = (index: number, storeId: string) => {
    const store = stores.find(s => s.id === storeId) || null
    setParsedRows(prev =>
      prev.map((row, i) =>
        i === index
          ? { ...row, matchedStore: store, matchConfidence: store ? 1.0 : 0 }
          : row
      )
    )
  }

  // Toggle selección
  const handleToggleRow = (index: number) => {
    setParsedRows(prev =>
      prev.map((row, i) =>
        i === index ? { ...row, selected: !row.selected } : row
      )
    )
  }

  // Importar
  const handleImport = async () => {
    if (!user) return

    const selectedRows = parsedRows.filter(r => r.selected && r.matchedStore)
    if (selectedRows.length === 0) {
      setParseError('No hay filas seleccionadas para importar')
      return
    }

    setImporting(true)
    setParseError(null)

    try {
      // 1. Crear registro de importación
      const importResponse = await fetch('/api/cuotas/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file?.name || 'import.xlsx',
          year: selectedYear,
          month: selectedMonth,
          imported_by: user.id,
        }),
      })

      const importData = await importResponse.json()
      if (!importData.success) {
        // Si ya existe, usar el ID existente si replace_existing
        if (importData.existing_import && replaceExisting) {
          // Continuar con el proceso
        } else {
          throw new Error(importData.error || 'Error creando registro de importación')
        }
      }

      const importId = importData.import?.id || importData.existing_import?.id

      // 2. Procesar las cuotas
      const quotas = selectedRows.map(row => ({
        store_id: row.matchedStore!.id,
        store_name: row.originalName,
        ss_quota: row.ssQuota,
        quota_breakdown: row.breakdown,
      }))

      const processResponse = await fetch(`/api/cuotas/imports/${importId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotas,
          column_mapping: columnMapping,
          replace_existing: replaceExisting,
        }),
      })

      const processData = await processResponse.json()

      setImportResult({
        success: processData.success,
        imported: processData.summary?.imported || 0,
        errors: processData.summary?.errors || 0,
        errorDetails: processData.errors,
      })
      setStep('result')
    } catch (error) {
      console.error('Error importando:', error)
      setParseError(error instanceof Error ? error.message : 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  const totalSelected = parsedRows.filter(r => r.selected).length
  const totalMatched = parsedRows.filter(r => r.matchedStore !== null).length
  const totalSS = parsedRows.filter(r => r.selected).reduce((sum, r) => sum + r.ssQuota, 0)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cuotas')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar Cuotas</h1>
          <p className="text-muted-foreground">
            Sube el archivo Excel de cuotas de Entel
          </p>
        </div>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Selector de período */}
          <Card>
            <CardHeader>
              <CardTitle>Paso 1: Seleccionar Período</CardTitle>
              <CardDescription>
                Elige el año y mes para las cuotas a importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Mes</label>
                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(val) => setSelectedMonth(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Año</label>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(val) => setSelectedYear(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="replace"
                  checked={replaceExisting}
                  onCheckedChange={(checked) => setReplaceExisting(checked as boolean)}
                />
                <label htmlFor="replace" className="text-sm">
                  Reemplazar importación existente (si existe)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Paso 2: Subir Archivo</CardTitle>
              <CardDescription>
                Formatos aceptados: .xlsx, .xls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={parsing}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  {parsing ? (
                    <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {parsing ? 'Procesando archivo...' : 'Arrastra el archivo Excel aquí'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      o haz clic para seleccionar
                    </p>
                  </div>
                </label>
              </div>

              {parseError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Resumen */}
          <Card>
            <CardHeader>
              <CardTitle>Preview de Importación - {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
              <CardDescription>
                Archivo: {file?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8">
                <div>
                  <p className="text-2xl font-bold">{parsedRows.length}</p>
                  <p className="text-sm text-muted-foreground">Tiendas detectadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{totalMatched}</p>
                  <p className="text-sm text-muted-foreground">Tiendas reconocidas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {parsedRows.length - totalMatched}
                  </p>
                  <p className="text-sm text-muted-foreground">Requieren match manual</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSS.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total SS seleccionado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de preview */}
          <Card>
            <CardHeader>
              <CardTitle>Cuotas Detectadas</CardTitle>
              <CardDescription>
                {totalSelected} de {parsedRows.length} tiendas seleccionadas para importar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={totalSelected === parsedRows.length}
                          onCheckedChange={(checked) => {
                            setParsedRows(prev =>
                              prev.map(r => ({ ...r, selected: checked as boolean }))
                            )
                          }}
                        />
                      </TableHead>
                      <TableHead>Nombre en Excel</TableHead>
                      <TableHead>Tienda</TableHead>
                      <TableHead className="text-right">SS</TableHead>
                      <TableHead className="text-right">VR</TableHead>
                      <TableHead className="text-right">OSS</TableHead>
                      <TableHead className="text-right">OPP</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, index) => (
                      <TableRow
                        key={index}
                        className={!row.matchedStore ? 'bg-yellow-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={() => handleToggleRow(index)}
                            disabled={!row.matchedStore}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{row.originalName}</TableCell>
                        <TableCell>
                          <Select
                            value={row.matchedStore?.id || ''}
                            onValueChange={(val) => handleStoreChange(index, val)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Seleccionar tienda" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                  {store.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-medium">{row.ssQuota}</TableCell>
                        <TableCell className="text-right">{row.breakdown.VR || 0}</TableCell>
                        <TableCell className="text-right">{row.breakdown.OSS || 0}</TableCell>
                        <TableCell className="text-right">{row.breakdown.OPP || 0}</TableCell>
                        <TableCell>
                          {row.matchedStore ? (
                            <Badge variant={row.matchConfidence === 1 ? 'default' : 'secondary'}>
                              {row.matchConfidence === 1 ? 'Auto' : 'Fuzzy'}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Manual</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {parseError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || totalSelected === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar {totalSelected} tiendas
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && importResult && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                {importResult.success ? (
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                ) : (
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                )}
                <div>
                  <CardTitle>
                    {importResult.success ? 'Importación Completada' : 'Importación con Errores'}
                  </CardTitle>
                  <CardDescription>
                    {MONTHS[selectedMonth - 1]} {selectedYear}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-green-700">Tiendas importadas</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-red-600">{importResult.errors}</p>
                  <p className="text-sm text-red-700">Errores</p>
                </div>
              </div>

              {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Errores de importación</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      {importResult.errorDetails.map((err, i) => (
                        <li key={i}>{err.error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => router.push('/cuotas')}>
                  Volver al Dashboard
                </Button>
                <Button className="flex-1" onClick={() => router.push('/cuotas/distribucion')}>
                  Ir a Distribución
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
