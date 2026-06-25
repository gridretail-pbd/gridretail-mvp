import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPermisoById, aprobarRechazarPermiso } from '@/lib/rrhh/queries/permisos'
import { permisoAprobarSchema } from '@/lib/rrhh/schemas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data, error } = await fetchPermisoById(supabase, id)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Permiso no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ permiso: data })
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

    const parsed = permisoAprobarSchema.safeParse({
      permiso_id: id,
      aprobado: body.aprobado,
      motivo_rechazo: body.motivo_rechazo,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if (!body.aprobado_por) {
      return NextResponse.json(
        { error: 'aprobado_por requerido' },
        { status: 400 }
      )
    }

    const { data, error } = await aprobarRechazarPermiso(
      supabase,
      id,
      parsed.data.aprobado,
      body.aprobado_por,
      parsed.data.motivo_rechazo
    )

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
