import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface ColumnaDetectadaResponse {
  indice: number
  nombre_original: string
  tipo_inferido: 'texto' | 'numero' | 'fecha' | 'booleano' | 'email' | 'telefono'
  valores_muestra: string[]
  porcentaje_lleno: number
  valores_unicos: number
}

/** Detect column type from sample values */
function inferirTipo(valores: string[]): 'texto' | 'numero' | 'fecha' | 'booleano' | 'email' | 'telefono' {
  const nonEmpty = valores.filter(v => v !== '' && v != null)
  if (nonEmpty.length === 0) return 'texto'

  // Email: check for @ pattern
  const emailCount = nonEmpty.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))).length
  if (emailCount / nonEmpty.length > 0.5) return 'email'

  // Phone: 9 digits starting with 9 (Peru mobile)
  const phoneCount = nonEmpty.filter(v => /^9\d{8}$/.test(String(v).replace(/\s|-/g, ''))).length
  if (phoneCount / nonEmpty.length > 0.5) return 'telefono'

  // Boolean: si/no, true/false, 1/0
  const boolValues = new Set(nonEmpty.map(v => String(v).toLowerCase().trim()))
  const boolPatterns = new Set(['si', 'no', 'sí', 'true', 'false', '1', '0', 'x', ''])
  if (nonEmpty.length > 0 && [...boolValues].every(v => boolPatterns.has(v))) return 'booleano'

  // Date: check common date patterns or Excel serial numbers
  const dateCount = nonEmpty.filter(v => {
    const s = String(v)
    // DD/MM/YYYY or MM/DD/YYYY
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)) return true
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true
    // Excel serial number (30000-50000 range = ~1982-2036)
    const num = Number(s)
    if (!isNaN(num) && num > 30000 && num < 60000 && Number.isInteger(num)) return true
    return false
  }).length
  if (dateCount / nonEmpty.length > 0.5) return 'fecha'

  // Number
  const numCount = nonEmpty.filter(v => !isNaN(Number(String(v).replace(/,/g, '')))).length
  if (numCount / nonEmpty.length > 0.7) return 'numero'

  return 'texto'
}

/** Check if a row is likely a subtotal or empty row */
function esFilaVaciaOSubtotal(row: Record<string, unknown>, totalCols: number): boolean {
  const values = Object.values(row)
  const nonEmpty = values.filter(v => v !== '' && v != null && v !== undefined)
  // Less than 20% filled = empty row
  if (nonEmpty.length / totalCols < 0.2) return true
  // Contains typical subtotal keywords
  const joined = values.map(v => String(v || '').toLowerCase()).join(' ')
  if (/\b(total|subtotal|resumen|suma)\b/.test(joined)) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const hojaParam = formData.get('hoja') as string | null
    const filaEncabezadosParam = formData.get('fila_encabezados') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json({ error: 'Formato no soportado. Use .xlsx, .xls o .csv' }, { status: 400 })
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10MB' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })

    const hojas = workbook.SheetNames
    if (hojas.length === 0) {
      return NextResponse.json({ error: 'El archivo no contiene hojas' }, { status: 400 })
    }

    // Select sheet: parameter > first sheet
    const hojaSeleccionada = hojaParam && hojas.includes(hojaParam) ? hojaParam : hojas[0]
    const worksheet = workbook.Sheets[hojaSeleccionada]

    // Detect header row: try first 5 rows, pick the one with most text columns
    const rawAllRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][]

    if (rawAllRows.length < 2) {
      return NextResponse.json({ error: 'El archivo debe tener al menos 1 fila de encabezados y 1 fila de datos' }, { status: 400 })
    }

    let filaEncabezados = filaEncabezadosParam ? parseInt(filaEncabezadosParam) : 0

    // Auto-detect header row if not specified
    if (!filaEncabezadosParam) {
      let maxScore = 0
      for (let i = 0; i < Math.min(5, rawAllRows.length); i++) {
        const row = rawAllRows[i] as unknown[]
        if (!row) continue
        const score = row.filter(cell => {
          const s = String(cell || '').trim()
          return s.length > 0 && s.length < 60 && isNaN(Number(s))
        }).length
        if (score > maxScore) {
          maxScore = score
          filaEncabezados = i
        }
      }
    }

    // Extract headers from detected row
    const headerRow = (rawAllRows[filaEncabezados] as unknown[]) || []
    const headers = headerRow.map((h, i) => {
      const val = String(h || '').trim()
      return val || `Columna_${i + 1}`
    })

    // Extract data rows (after header), filtering empty/subtotal rows
    const dataRows: Record<string, unknown>[] = []
    for (let i = filaEncabezados + 1; i < rawAllRows.length; i++) {
      const rawRow = rawAllRows[i] as unknown[]
      if (!rawRow) continue
      const row: Record<string, unknown> = {}
      headers.forEach((h, idx) => {
        row[h] = rawRow[idx] != null ? rawRow[idx] : ''
      })
      if (!esFilaVaciaOSubtotal(row, headers.length)) {
        dataRows.push(row)
      }
    }

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'No se encontraron filas de datos válidas' }, { status: 400 })
    }

    // Analyze each column
    const columnas: ColumnaDetectadaResponse[] = headers.map((nombre, indice) => {
      const valores = dataRows.map(row => String(row[nombre] ?? ''))
      const nonEmpty = valores.filter(v => v !== '')
      const uniqueSet = new Set(nonEmpty)
      const muestra = [...uniqueSet].slice(0, 5)

      return {
        indice,
        nombre_original: nombre,
        tipo_inferido: inferirTipo(nonEmpty.slice(0, 50)),
        valores_muestra: muestra,
        porcentaje_lleno: Math.round((nonEmpty.length / valores.length) * 100),
        valores_unicos: uniqueSet.size,
      }
    })

    // Preview: first 10 data rows
    const preview = dataRows.slice(0, 10)

    return NextResponse.json({
      hojas,
      hoja_seleccionada: hojaSeleccionada,
      fila_encabezados: filaEncabezados,
      total_filas_datos: dataRows.length,
      columnas_detectadas: columnas,
      preview_datos: preview,
    })
  } catch (error) {
    console.error('Error analizando Excel:', error)
    return NextResponse.json({ error: 'Error al analizar el archivo' }, { status: 500 })
  }
}
