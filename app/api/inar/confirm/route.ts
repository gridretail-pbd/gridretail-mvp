import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { records, fileName, userId } = body

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: 'No hay registros para importar' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Campos que son numéricos en la BD
    const numericFields = [
      'numperiodo',
      'numnro_orden',
      'numrentaigv',
      'numvep_cuota',
      'numvep_pagototal',
      'numvep_cuota_inicial',
      'numflagt0',
      'numflagrft',
      'numrentaigv_neto',
      'numrentaigv_nestructural',
      'numrentaigv_netot',
      'numvalor_desc',
    ]

    // Preparar los registros para inserción (remover el flag isNew y limpiar valores)
    const recordsToInsert = records.map((record: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isNew, ...cleanRecord } = record

      // Convertir strings vacíos a null, especialmente para campos numéricos
      Object.keys(cleanRecord).forEach((key) => {
        const value = cleanRecord[key]
        if (value === '' || value === undefined) {
          cleanRecord[key] = null
        } else if (numericFields.includes(key) && typeof value === 'string') {
          // Convertir strings numéricos a números
          const parsed = parseFloat(value)
          cleanRecord[key] = isNaN(parsed) ? null : parsed
        }
      })

      return cleanRecord
    })

    // Insertar registros en lotes de 100
    const batchSize = 100
    let insertedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize)

      const { data, error } = await supabase
        .from('lineas_inar')
        .insert(batch)
        .select('id')

      if (error) {
        console.error(`Error en lote ${i / batchSize + 1}:`, error)
        errorCount += batch.length
        errors.push(`Lote ${i / batchSize + 1}: ${error.message}`)
      } else {
        insertedCount += data?.length || 0
      }
    }

    // Registrar la importación en el historial
    const { error: historyError } = await supabase
      .from('inar_importaciones')
      .insert({
        archivo_nombre: fileName || 'archivo_inar.xlsx',
        periodo: new Date().getFullYear() * 100 + (new Date().getMonth() + 1), // YYYYMM
        fecha_archivo: new Date().toISOString().split('T')[0],
        registros_en_archivo: records.length,
        registros_nuevos: insertedCount,
        registros_existentes: records.length - insertedCount - errorCount,
        registros_error: errorCount,
        usuario_id: userId || null,
        estado: errorCount === 0 ? 'completado' : 'parcial',
        errores: errors.length > 0 ? errors : null,
      })

    if (historyError) {
      console.error('Error registrando importación:', historyError)
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: records.length,
        inserted: insertedCount,
        errors: errorCount,
        errorDetails: errors,
      },
    })
  } catch (error) {
    console.error('Error en confirmación de importación:', error)
    return NextResponse.json(
      { error: 'Error al confirmar la importación' },
      { status: 500 }
    )
  }
}
