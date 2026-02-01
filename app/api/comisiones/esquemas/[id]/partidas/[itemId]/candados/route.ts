import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>
}

/**
 * GET /api/comisiones/esquemas/[id]/partidas/[itemId]/candados
 * Obtiene los candados de una partida
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params
    const supabase = await createClient()

    const { data: locks, error } = await supabase
      .from('commission_item_locks')
      .select(`
        *,
        required_item_type:commission_item_types(id, code, name)
      `)
      .eq('scheme_item_id', itemId)

    if (error) {
      console.error('Error obteniendo candados:', error)
      return NextResponse.json(
        { error: 'Error al obtener candados' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      locks: locks || [],
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
 * POST /api/comisiones/esquemas/[id]/partidas/[itemId]/candados
 * Crea un nuevo candado para una partida
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que el esquema está en draft
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
        { error: 'Solo se pueden agregar candados a esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Verificar que la partida existe
    const { data: item } = await supabase
      .from('commission_scheme_items')
      .select('id')
      .eq('id', itemId)
      .eq('scheme_id', id)
      .single()

    if (!item) {
      return NextResponse.json(
        { error: 'Partida no encontrada' },
        { status: 404 }
      )
    }

    // Crear candado
    const lockData = {
      scheme_item_id: itemId,
      ...body,
    }

    const { data: lock, error } = await supabase
      .from('commission_item_locks')
      .insert(lockData)
      .select(`
        *,
        required_item_type:commission_item_types(id, code, name)
      `)
      .single()

    if (error) {
      console.error('Error creando candado:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      lock,
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
 * PUT /api/comisiones/esquemas/[id]/partidas/[itemId]/candados
 * Actualiza un candado existente (usando lock_id en body)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { lock_id, ...updateData } = body

    if (!lock_id) {
      return NextResponse.json(
        { error: 'Se requiere lock_id' },
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
        { error: 'Solo se pueden editar candados de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Actualizar candado
    const { data: lock, error } = await supabase
      .from('commission_item_locks')
      .update(updateData)
      .eq('id', lock_id)
      .select(`
        *,
        required_item_type:commission_item_types(id, code, name)
      `)
      .single()

    if (error) {
      console.error('Error actualizando candado:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      lock,
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
 * DELETE /api/comisiones/esquemas/[id]/partidas/[itemId]/candados
 * Elimina un candado (usando lock_id en query params)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const lockId = request.nextUrl.searchParams.get('lock_id')

    if (!lockId) {
      return NextResponse.json(
        { error: 'Se requiere lock_id' },
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
        { error: 'Solo se pueden eliminar candados de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Eliminar candado
    const { error } = await supabase
      .from('commission_item_locks')
      .delete()
      .eq('id', lockId)

    if (error) {
      console.error('Error eliminando candado:', error)
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
