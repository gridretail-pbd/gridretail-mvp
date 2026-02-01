import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/comisiones/esquemas/[id]/restricciones
 * Obtiene todas las restricciones de un esquema
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: restrictions, error } = await supabase
      .from('commission_item_restrictions')
      .select('*')
      .eq('scheme_id', id)
      .order('created_at')

    if (error) {
      console.error('Error obteniendo restricciones:', error)
      return NextResponse.json(
        { error: 'Error al obtener restricciones' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      restrictions: restrictions || [],
      total: restrictions?.length || 0,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/comisiones/esquemas/[id]/restricciones
 * Crea una nueva restricción en el esquema
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que el esquema existe y está en draft
    const { data: scheme } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!scheme) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (scheme.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden agregar restricciones a esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Crear restricción
    const restrictionData = {
      scheme_id: id,
      ...body,
    }

    const { data: restriction, error } = await supabase
      .from('commission_item_restrictions')
      .insert(restrictionData)
      .select()
      .single()

    if (error) {
      console.error('Error creando restricción:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      restriction,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/comisiones/esquemas/[id]/restricciones
 * Actualiza una restricción existente (usando restriction_id en body)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { restriction_id, ...updateData } = body

    if (!restriction_id) {
      return NextResponse.json(
        { error: 'Se requiere restriction_id' },
        { status: 400 }
      )
    }

    // Verificar que el esquema está en draft
    const { data: scheme } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!scheme || scheme.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden editar restricciones de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Actualizar restricción
    const { data: restriction, error } = await supabase
      .from('commission_item_restrictions')
      .update(updateData)
      .eq('id', restriction_id)
      .eq('scheme_id', id)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando restricción:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      restriction,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/comisiones/esquemas/[id]/restricciones
 * Elimina una restricción (usando restriction_id en query params)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const restrictionId = request.nextUrl.searchParams.get('restriction_id')

    if (!restrictionId) {
      return NextResponse.json(
        { error: 'Se requiere restriction_id' },
        { status: 400 }
      )
    }

    // Verificar que el esquema está en draft
    const { data: scheme } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!scheme || scheme.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar restricciones de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Eliminar restricción
    const { error } = await supabase
      .from('commission_item_restrictions')
      .delete()
      .eq('id', restrictionId)
      .eq('scheme_id', id)

    if (error) {
      console.error('Error eliminando restricción:', error)
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
