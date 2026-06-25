import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAsignacionTurnos,
  insertAsignacionTurno,
  insertAsignacionTurnosBulk,
} from '@/lib/rrhh/queries/horarios'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchAsignacionTurnos(supabase, {
      tienda_id: searchParams.get('tienda_id') || undefined,
      usuario_id: searchParams.get('usuario_id') || undefined,
      fecha_desde: searchParams.get('fecha_desde') || undefined,
      fecha_hasta: searchParams.get('fecha_hasta') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ asignaciones: data, total: data.length })
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

    // Bulk insert si viene array
    if (Array.isArray(body.asignaciones)) {
      const items = body.asignaciones.map((a: Record<string, unknown>) => ({
        usuario_id: a.usuario_id,
        tienda_id: a.tienda_id,
        turno_id: a.turno_id,
        fecha: a.fecha,
        es_dia_descanso: a.es_dia_descanso || false,
        es_feriado: a.es_feriado || false,
        notas: a.notas || null,
        asignado_por: a.asignado_por || body.asignado_por || null,
      }))

      const { data, error } = await insertAsignacionTurnosBulk(supabase, items)

      if (error) {
        return NextResponse.json({ error }, { status: 400 })
      }

      return NextResponse.json({ success: true, asignaciones: data })
    }

    // Single insert
    if (!body.usuario_id || !body.tienda_id || !body.turno_id || !body.fecha) {
      return NextResponse.json(
        { error: 'usuario_id, tienda_id, turno_id y fecha son requeridos' },
        { status: 400 }
      )
    }

    const datosInsert = {
      usuario_id: body.usuario_id,
      tienda_id: body.tienda_id,
      turno_id: body.turno_id,
      fecha: body.fecha,
      es_dia_descanso: body.es_dia_descanso || false,
      es_feriado: body.es_feriado || false,
      notas: body.notas || null,
      asignado_por: body.asignado_por || null,
    }

    const { data, error } = await insertAsignacionTurno(supabase, datosInsert)

    if (error) {
      if (error.includes('asignacion_unique')) {
        return NextResponse.json(
          { error: 'Ya existe una asignación para este usuario en esta fecha' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, asignacion: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
