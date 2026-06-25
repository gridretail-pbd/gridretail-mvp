import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchHorariosTienda, upsertHorarioTienda } from '@/lib/rrhh/queries/horarios'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const tiendaId = request.nextUrl.searchParams.get('tienda_id')

    if (!tiendaId) {
      return NextResponse.json(
        { error: 'tienda_id requerido' },
        { status: 400 }
      )
    }

    const { data, error } = await fetchHorariosTienda(supabase, tiendaId)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ horarios: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    if (!body.tienda_id || body.dia_semana === undefined) {
      return NextResponse.json(
        { error: 'tienda_id y dia_semana requeridos' },
        { status: 400 }
      )
    }

    if (body.dia_semana < 0 || body.dia_semana > 6) {
      return NextResponse.json(
        { error: 'dia_semana debe estar entre 0 (Lunes) y 6 (Domingo)' },
        { status: 400 }
      )
    }

    const { data, error } = await upsertHorarioTienda(supabase, {
      tienda_id: body.tienda_id,
      dia_semana: body.dia_semana,
      hora_apertura: body.hora_apertura || '09:00',
      hora_cierre: body.hora_cierre || '21:00',
      activo: body.activo !== undefined ? body.activo : true,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, horario: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
