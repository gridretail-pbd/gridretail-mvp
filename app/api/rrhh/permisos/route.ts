import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPermisos, insertPermiso } from '@/lib/rrhh/queries/permisos'
import { permisoCreateSchema } from '@/lib/rrhh/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchPermisos(supabase, {
      usuario_id: searchParams.get('usuario_id') || undefined,
      tipo: searchParams.get('tipo') || undefined,
      estado: searchParams.get('estado') || undefined,
      fecha_desde: searchParams.get('fecha_desde') || undefined,
      fecha_hasta: searchParams.get('fecha_hasta') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ permisos: data, total: data.length })
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

    const parsed = permisoCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const usuarioId = body.usuario_id
    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 })
    }

    // Verificar que la ficha existe (solicitudes_permiso.usuario_id -> usuarios_rrhh, 033)
    const { data: usuario } = await supabase
      .from('usuarios_rrhh')
      .select('id, nombre_completo')
      .eq('id', usuarioId)
      .single()

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const datosInsert = {
      usuario_id: usuarioId,
      tipo: parsed.data.tipo,
      fecha_inicio: parsed.data.fecha_inicio,
      fecha_fin: parsed.data.fecha_fin,
      horas_solicitadas: parsed.data.horas_solicitadas || null,
      motivo: parsed.data.motivo,
    }

    const { data, error } = await insertPermiso(supabase, datosInsert)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, permiso: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
