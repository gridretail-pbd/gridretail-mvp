import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Los 49 campos que extraemos del Excel INAR
const INAR_COLUMNS = [
  'VCHID_PDV',
  'NUMPERIODO',
  'FECFECHAPROCESO',
  'VCHRAZONSOCIAL',
  'VCHC_CONTRATO',
  'VCHIMEI',
  'VCHIMEI_BSCS',
  'VCHTELEFONO',
  'VCHMODELOEQUIPO',
  'VCHN_PLAN',
  'VCHTIPODOCUMENTO',
  'VCHDOCUMENTO',
  'NUMNRO_ORDEN',
  'NUMRENTAIGV',
  'VCHMODOPAGO',
  'VCHVENDEDOR_PACKSIM',
  'VCHDWH_CODIGOORDEN',
  'VCHPORTA_MODOPAGOORIGEN',
  'VCHPORTA_CEDENTE',
  'VCHTERMINAL_GAMA',
  'VCHTERMINAL_MARCA',
  'VCHTERMINAL_TIPOEQUIPO',
  'VCHTERMINAL_NOMBREEQUIPO',
  'VCHSINCRITERIOBASE',
  'NUMVEP_CUOTA',
  'NUMVEP_PAGOTOTAL',
  'NUMVEP_CUOTA_INICIAL',
  'VCHCICLOFACTURACION',
  'VCHC_CONTRATOFS',
  'VCHLLAA_BASE_CAPTURA',
  'VCHVENDEDORDNI',
  'NUMFLAGT0',
  'NUMFLAGRFT',
  'VCHFLAG_LLA_RENO',
  'VCHFLAG_UPSELLING',
  'VCHFLAG_VEP2',
  'NUMRENTAIGV_NETO',
  'NUMRENTAIGV_NESTRUCTURAL',
  'NUMRENTAIGV_NETOT',
  'VCHDIST_ENTREGA_OL',
  'VCHFLAG_RENODIARIO',
  'VCHFLAG_SINTERES',
  'VCHCONCEPTO_DESC',
  'NUMVALOR_DESC',
  'VCHDEPARTAMENTO_CLI',
  'VCHCIUDAD_CLI',
  'VCHDISTRITO_CLI',
  'VCHDESC_DSC_PROM',
  'VCHPO_DSC_PROM',
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No se recibió ningún archivo' },
        { status: 400 }
      )
    }

    // Leer el archivo Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // Tomar la primera hoja
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convertir a JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[]

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'El archivo Excel está vacío' },
        { status: 400 }
      )
    }

    // Extraer solo los campos que necesitamos y convertir a minúsculas
    const records = rawData.map((row: Record<string, unknown>) => {
      const record: Record<string, unknown> = {}
      INAR_COLUMNS.forEach((col) => {
        const value = row[col] ?? row[col.toLowerCase()] ?? ''
        record[col.toLowerCase()] = value
      })
      return record
    })

    // Obtener los vchc_contratofs para verificar existentes
    const contratosFS = records
      .map((r) => r.vchc_contratofs as string)
      .filter((c) => c && c.trim() !== '')

    if (contratosFS.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron registros con VCHC_CONTRATOFS válido' },
        { status: 400 }
      )
    }

    // Consultar registros existentes en la base de datos EN LOTES
    const supabase = await createClient()
    const existingSet = new Set<string>()
    const batchSize = 100 // Consultar en lotes de 100 para evitar overflow

    for (let i = 0; i < contratosFS.length; i += batchSize) {
      const batch = contratosFS.slice(i, i + batchSize)

      const { data: existingRecords, error: dbError } = await supabase
        .from('lineas_inar')
        .select('vchc_contratofs')
        .in('vchc_contratofs', batch)

      if (dbError) {
        console.error('Error consultando BD en lote:', dbError)
        // Continuar con el siguiente lote en lugar de fallar
        continue
      }

      // Agregar al set de existentes
      if (existingRecords) {
        existingRecords.forEach((r) => existingSet.add(r.vchc_contratofs))
      }
    }

    // Marcar cada registro como nuevo o existente
    const recordsWithStatus = records.map((record) => ({
      ...record,
      isNew: !existingSet.has(record.vchc_contratofs as string),
    }))

    // Calcular estadísticas
    const newRecords = recordsWithStatus.filter((r) => r.isNew)
    const existingCount = recordsWithStatus.filter((r) => !r.isNew).length

    // Retornar preview con los primeros 10 registros
    return NextResponse.json({
      success: true,
      stats: {
        totalInFile: records.length,
        newRecords: newRecords.length,
        existingRecords: existingCount,
      },
      preview: recordsWithStatus.slice(0, 10),
      allNewRecords: newRecords, // Para usar en la confirmación
    })
  } catch (error) {
    console.error('Error procesando archivo:', error)
    return NextResponse.json(
      { error: 'Error al procesar el archivo Excel' },
      { status: 500 }
    )
  }
}
