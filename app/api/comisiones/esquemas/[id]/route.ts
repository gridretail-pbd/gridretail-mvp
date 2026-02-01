import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Obtener esquema con sus relaciones
    const { data: scheme, error } = await supabase
      .from('commission_schemes')
      .select(`
        *,
        created_by_user:usuarios!commission_schemes_created_by_fkey(id, nombre_completo),
        approved_by_user:usuarios!commission_schemes_approved_by_fkey(id, nombre_completo)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo esquema:', error)
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    // Obtener partidas del esquema
    const { data: items } = await supabase
      .from('commission_scheme_items')
      .select(`
        *,
        item_type:commission_item_types(*)
      `)
      .eq('scheme_id', id)
      .order('display_order')

    // Obtener restricciones del esquema
    const { data: restrictions } = await supabase
      .from('commission_item_restrictions')
      .select(`
        *,
        affected_item_type:commission_item_types(*)
      `)
      .eq('scheme_id', id)

    return NextResponse.json({
      scheme: {
        ...scheme,
        created_by_name: scheme.created_by_user?.nombre_completo || null,
        approved_by_name: scheme.approved_by_user?.nombre_completo || null,
      },
      items: items || [],
      restrictions: restrictions || [],
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que el esquema existe y está en draft
    const { data: existing } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden editar esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Actualizar esquema
    const { data: scheme, error } = await supabase
      .from('commission_schemes')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando esquema:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      scheme,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar que el esquema existe y está en draft
    const { data: existing } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Eliminar esquema (cascade eliminará items y restricciones)
    const { error } = await supabase
      .from('commission_schemes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando esquema:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
