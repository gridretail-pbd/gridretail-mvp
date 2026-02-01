import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Obtener detalle de una penalidad
 * GET /api/penalidades/penalties/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: penalty, error } = await supabase
      .from('hc_penalties')
      .select(`
        *,
        penalty_type:penalty_types(*),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
        store:tiendas(id, nombre, codigo),
        waived_by_user:usuarios!hc_penalties_waived_by_fkey(nombre_completo),
        created_by_user:usuarios!hc_penalties_created_by_fkey(nombre_completo)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Penalidad no encontrada' },
          { status: 404 }
        )
      }
      console.error('Error obteniendo penalidad:', error)
      return NextResponse.json(
        { error: 'Error al obtener penalidad' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      penalty,
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
 * Actualizar penalidad
 * PATCH /api/penalidades/penalties/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que la penalidad existe
    const { data: existing, error: fetchError } = await supabase
      .from('hc_penalties')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Penalidad no encontrada' },
        { status: 404 }
      )
    }

    // Campos permitidos para actualizar
    const allowedFields = [
      'quantity',
      'original_amount',
      'transferred_amount',
      'incident_date',
      'notes',
      'status',
    ]

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data: penalty, error: updateError } = await supabase
      .from('hc_penalties')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        penalty_type:penalty_types(*),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
        store:tiendas(id, nombre, codigo)
      `)
      .single()

    if (updateError) {
      console.error('Error actualizando penalidad:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      penalty,
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
 * Eliminar penalidad
 * DELETE /api/penalidades/penalties/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar que la penalidad existe y no está aplicada
    const { data: existing, error: fetchError } = await supabase
      .from('hc_penalties')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Penalidad no encontrada' },
        { status: 404 }
      )
    }

    if (existing.status === 'applied') {
      return NextResponse.json(
        { error: 'No se puede eliminar una penalidad aplicada' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('hc_penalties')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error eliminando penalidad:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
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
