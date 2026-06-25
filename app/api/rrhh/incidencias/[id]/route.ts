import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchIncidenciaById, updateIncidencia } from '@/lib/rrhh/queries/incidencias'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data, error } = await fetchIncidenciaById(supabase, id)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ incidencia: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    const camposPermitidos = [
      'estado', 'descripcion',
      'descargo_colaborador', 'descargo_fecha',
      'resolucion', 'resolucion_por', 'resolucion_fecha',
      'documento_url',
    ]

    const datosUpdate: Record<string, unknown> = {}
    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        datosUpdate[campo] = body[campo]
      }
    }

    if (Object.keys(datosUpdate).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      )
    }

    // Si se registra descargo, actualizar estado
    if (datosUpdate.descargo_colaborador && !datosUpdate.estado) {
      datosUpdate.estado = 'EN_DESCARGO'
      datosUpdate.descargo_fecha = new Date().toISOString()
    }

    // Si se resuelve, agregar timestamp
    if (datosUpdate.resolucion && datosUpdate.resolucion_por) {
      datosUpdate.resolucion_fecha = new Date().toISOString()
      if (!datosUpdate.estado) {
        datosUpdate.estado = 'RESUELTA'
      }
    }

    const { data, error } = await updateIncidencia(supabase, id, datosUpdate)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, incidencia: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
