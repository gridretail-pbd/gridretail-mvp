import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>
}

/**
 * GET /api/comisiones/esquemas/[id]/partidas/[itemId]/multiplicadores
 * Obtiene los multiplicadores de una partida
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params
    const supabase = await createClient()

    const { data: multipliers, error } = await supabase
      .from('commission_item_multipliers')
      .select('*')
      .eq('item_id', itemId)
      .order('display_order')

    if (error) {
      console.error('Error obteniendo multiplicadores:', error)
      return NextResponse.json(
        { error: 'Error al obtener multiplicadores' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      multipliers: multipliers || [],
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
 * POST /api/comisiones/esquemas/[id]/partidas/[itemId]/multiplicadores
 * Crea un nuevo multiplicador para una partida
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
        { error: 'Solo se pueden agregar multiplicadores a esquemas en estado borrador' },
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

    // Obtener siguiente display_order
    const { data: existing } = await supabase
      .from('commission_item_multipliers')
      .select('display_order')
      .eq('item_id', itemId)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0
      ? (existing[0].display_order || 0) + 1
      : 0

    // Crear multiplicador
    const multiplierData = {
      item_id: itemId,
      display_order: nextOrder,
      multiplier_type: body.multiplier_type,
      activation_criteria: body.activation_criteria,
      source_description: body.source_description,
      source_item_id: body.source_item_id,
      threshold_value: body.threshold_value,
      factor_if_met: body.factor_if_met,
      factor_if_not_met: body.factor_if_not_met,
      tiered_ranges: body.tiered_ranges,
      operator_cedente: body.operator_cedente,
      measurement_type: body.measurement_type,
      measurement_config: body.measurement_config,
      is_active: body.is_active ?? true,
      notes: body.notes,
    }

    const { data: multiplier, error } = await supabase
      .from('commission_item_multipliers')
      .insert(multiplierData)
      .select('*')
      .single()

    if (error) {
      console.error('Error creando multiplicador:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      multiplier,
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
 * DELETE /api/comisiones/esquemas/[id]/partidas/[itemId]/multiplicadores
 * Elimina un multiplicador (usando multiplier_id en query params)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params
    const supabase = await createClient()
    const multiplierId = request.nextUrl.searchParams.get('multiplier_id')

    if (!multiplierId) {
      return NextResponse.json(
        { error: 'Se requiere multiplier_id' },
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
        { error: 'Solo se pueden eliminar multiplicadores de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Verificar que el multiplicador pertenece a la partida
    const { data: existing } = await supabase
      .from('commission_item_multipliers')
      .select('id')
      .eq('id', multiplierId)
      .eq('item_id', itemId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Multiplicador no encontrado en esta partida' },
        { status: 404 }
      )
    }

    // Eliminar multiplicador
    const { error } = await supabase
      .from('commission_item_multipliers')
      .delete()
      .eq('id', multiplierId)

    if (error) {
      console.error('Error eliminando multiplicador:', error)
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
