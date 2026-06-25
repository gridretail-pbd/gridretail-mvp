import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchContratos, insertContrato } from '@/lib/rrhh/queries/contratos'
import { contratoCreateSchema } from '@/lib/rrhh/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const estado = searchParams.get('estado')?.split(',').filter(Boolean)
    const tipo_contrato = searchParams.get('tipo_contrato') || undefined
    const usuario_id = searchParams.get('usuario_id') || undefined
    const tienda_asignada_id = searchParams.get('tienda_asignada_id') || undefined
    const search = searchParams.get('search') || undefined
    const proximos_a_vencer = searchParams.get('proximos_a_vencer')
      ? Number(searchParams.get('proximos_a_vencer'))
      : undefined

    const { data, error } = await fetchContratos(supabase, {
      estado,
      tipo_contrato,
      usuario_id,
      tienda_asignada_id,
      search,
      proximos_a_vencer,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ contratos: data, total: data.length })
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

    const parsed = contratoCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verificar que la ficha existe (contratos.usuario_id -> usuarios_rrhh, 033)
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

    // Verificar que no tenga un contrato vigente ya (excepto si es renovación)
    if (!parsed.data.contrato_anterior_id) {
      const { data: contratoActivo } = await supabase
        .from('contratos')
        .select('id')
        .eq('usuario_id', parsed.data.usuario_id)
        .in('estado', ['VIGENTE', 'BORRADOR', 'ENVIADO', 'FIRMADO'])
        .maybeSingle()

      if (contratoActivo) {
        return NextResponse.json(
          { error: 'El usuario ya tiene un contrato activo. Use renovación para crear uno nuevo.' },
          { status: 409 }
        )
      }
    }

    const datosInsert = {
      ...parsed.data,
      estado: 'BORRADOR',
      generado_por: body.generado_por || null,
    }

    const { data, error } = await insertContrato(supabase, datosInsert)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, contrato: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
