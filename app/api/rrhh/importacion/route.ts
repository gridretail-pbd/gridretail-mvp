import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchImportaciones, fetchImportacionById, insertImportacion, updateImportacion } from '@/lib/rrhh/queries/importacion'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    // Si viene un ID, retornar detalle individual
    const id = searchParams.get('id')
    if (id) {
      const { data, error } = await fetchImportacionById(supabase, id)
      if (error) {
        return NextResponse.json({ error }, { status: 500 })
      }
      return NextResponse.json({ importacion: data })
    }

    // Sino, retornar lista con filtros
    const { data, error } = await fetchImportaciones(supabase, {
      estado: searchParams.get('estado') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ importaciones: data, total: data.length })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await insertImportacion(supabase, {
      archivo_nombre: body.archivo_nombre,
      archivo_url: body.archivo_url,
      archivo_tipo: body.archivo_tipo,
      archivo_tamano_bytes: body.archivo_tamano_bytes,
      total_filas_datos: body.total_filas_datos,
      hoja_procesada: body.hoja_procesada,
      fila_encabezados: body.fila_encabezados,
      estado: 'ANALIZADO',
      mapeo_columnas: {},
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ importacion: data }, { status: 201 })
  } catch (error) {
    console.error('Error creando importacion:', error)
    return NextResponse.json({ error: 'Error al crear la importación' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 })
    }

    const body = await request.json()

    const allowedFields = [
      'mapeo_columnas', 'mapeo_ai_task_id', 'mapeo_confianza_promedio',
      'estado', 'hoja_procesada', 'fila_encabezados',
      'total_validos', 'total_warnings', 'total_errores',
      'total_importados', 'total_actualizados', 'total_saltados',
      'total_activos_importados', 'total_cesados_importados',
      'reporte_brechas', 'reporte_brechas_url', 'completitud_promedio',
      'total_alertas_generadas', 'alerta_resumen_id', 'detalle_filas',
      'ejecutado_por', 'fecha_ejecucion', 'notas',
    ]

    const datos: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        datos[key] = body[key]
      }
    }

    const { data, error } = await updateImportacion(supabase, id, datos)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ importacion: data })
  } catch (error) {
    console.error('Error actualizando importacion:', error)
    return NextResponse.json({ error: 'Error al actualizar la importación' }, { status: 500 })
  }
}
