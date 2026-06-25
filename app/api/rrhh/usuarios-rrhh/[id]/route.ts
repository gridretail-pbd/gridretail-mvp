import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUsuarioRRHHById, updateUsuarioRRHH } from '@/lib/rrhh/queries/usuarios-rrhh'
import { getUsuarioActual } from '@/lib/auth-server'
import { dependenciasDeFicha } from '@/lib/rrhh/borrado'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await fetchUsuarioRRHHById(supabase, id)

    if (error || !data) {
      return NextResponse.json(
        { error: 'Ficha RRHH no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ colaborador: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que la ficha existe
    const { data: existente } = await supabase
      .from('usuarios_rrhh')
      .select('id')
      .eq('id', id)
      .single()

    if (!existente) {
      return NextResponse.json(
        { error: 'Ficha RRHH no encontrada' },
        { status: 404 }
      )
    }

    // Campos permitidos para actualización.
    // `usuario_id` NO se permite aquí: se enlaza vía /conceder-acceso (migración 033).
    const camposPermitidos = [
      'nombre_completo', 'dni', 'codigo_asesor',
      'fecha_nacimiento', 'genero', 'estado_civil', 'telefono_personal',
      'direccion_domiciliaria', 'distrito_residencia', 'gps_domicilio_lat', 'gps_domicilio_lng',
      'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_parentesco',
      'banco', 'numero_cuenta', 'cci',
      'fecha_ingreso', 'fecha_fin_contrato', 'tipo_contrato_actual', 'regimen_laboral',
      'cargo_formal', 'area_funcional', 'jefe_directo_id', 'remuneracion_actual', 'status',
      'talla_uniforme', 'tiene_equipo_corporativo', 'equipo_corporativo_detalle',
      'foto_url', 'notas',
    ]

    const datosUpdate: Record<string, unknown> = {}
    for (const campo of camposPermitidos) {
      if (campo in body) {
        datosUpdate[campo] = body[campo]
      }
    }

    if (Object.keys(datosUpdate).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      )
    }

    const { data, error } = await updateUsuarioRRHH(supabase, id, datosUpdate)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, colaborador: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE — Solo ADMIN y solo si la ficha no tiene historial dependiente (033).
// El id del actor llega en ?actor_id= (auth propio por id, sin Supabase Auth).
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const actorId = request.nextUrl.searchParams.get('actor_id')

    const actor = await getUsuarioActual(supabase, actorId)
    if (!actor || actor.rol !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo un ADMIN puede eliminar fichas' },
        { status: 403 }
      )
    }

    const deps = await dependenciasDeFicha(supabase, id)
    if (deps.length > 0) {
      return NextResponse.json(
        {
          error: 'La ficha tiene historial y no puede eliminarse',
          dependencias: deps,
        },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('usuarios_rrhh').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando ficha:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
