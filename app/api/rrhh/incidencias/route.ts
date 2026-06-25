import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchIncidencias, insertIncidencia } from '@/lib/rrhh/queries/incidencias'
import { incidenciaCreateSchema } from '@/lib/rrhh/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchIncidencias(supabase, {
      usuario_id: searchParams.get('usuario_id') || undefined,
      tipo: searchParams.get('tipo') || undefined,
      estado: searchParams.get('estado') || undefined,
      fecha_desde: searchParams.get('fecha_desde') || undefined,
      fecha_hasta: searchParams.get('fecha_hasta') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ incidencias: data, total: data.length })
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

    const parsed = incidenciaCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verificar que la ficha existe (incidencias.usuario_id -> usuarios_rrhh, 033)
    const { data: usuario } = await supabase
      .from('usuarios_rrhh')
      .select('id, nombre_completo')
      .eq('id', parsed.data.usuario_id)
      .single()

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const datosInsert = {
      ...parsed.data,
      registrado_por: body.registrado_por,
      generada_automaticamente: body.generada_automaticamente || false,
    }

    const { data, error } = await insertIncidencia(supabase, datosInsert)

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
