import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUsuariosRRHH, insertUsuarioRRHH } from '@/lib/rrhh/queries/usuarios-rrhh'
import { usuarioRRHHCreateSchema } from '@/lib/rrhh/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const status = searchParams.get('status')?.split(',').filter(Boolean)
    const area_funcional = searchParams.get('area_funcional') || undefined
    const search = searchParams.get('search') || undefined
    const jefe_directo_id = searchParams.get('jefe_directo_id') || undefined

    const { data, error } = await fetchUsuariosRRHH(supabase, {
      status,
      area_funcional,
      search,
      jefe_directo_id,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ colaboradores: data, total: data.length })
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

    const parsed = usuarioRRHHCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Si se enlaza una cuenta de login, validar que exista y no tenga ya ficha.
    // (Personal solo-RRHH se crea sin usuario_id.)
    if (parsed.data.usuario_id) {
      const { data: cuenta } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', parsed.data.usuario_id)
        .maybeSingle()

      if (!cuenta) {
        return NextResponse.json(
          { error: 'La cuenta de usuario indicada no existe' },
          { status: 404 }
        )
      }

      const { data: yaLinkeada } = await supabase
        .from('usuarios_rrhh')
        .select('id')
        .eq('usuario_id', parsed.data.usuario_id)
        .maybeSingle()

      if (yaLinkeada) {
        return NextResponse.json(
          { error: 'Esa cuenta ya tiene una ficha RRHH' },
          { status: 409 }
        )
      }
    }

    const { data, error } = await insertUsuarioRRHH(supabase, parsed.data)

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
