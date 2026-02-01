import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Obtener tipos de penalidad
 * GET /api/penalidades/types?active_only=true&source=entel
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const activeOnly = searchParams.get('active_only') !== 'false'
    const source = searchParams.get('source')

    let query = supabase
      .from('penalty_types')
      .select('*')
      .order('display_order')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (source) {
      query = query.eq('source', source)
    }

    const { data: types, error } = await query

    if (error) {
      console.error('Error obteniendo tipos:', error)
      return NextResponse.json(
        { error: 'Error al obtener tipos de penalidad' },
        { status: 500 }
      )
    }

    // Agrupar por origen
    const bySource = {
      entel: types?.filter(t => t.source === 'entel') || [],
      internal: types?.filter(t => t.source === 'internal') || [],
    }

    return NextResponse.json({
      types,
      by_source: bySource,
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
 * Crear tipo de penalidad (solo internas)
 * POST /api/penalidades/types
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      code,
      name,
      short_name,
      base_amount_ssnn,
      description,
      is_predictable,
    } = body

    // Validaciones
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Se requiere código y nombre' },
        { status: 400 }
      )
    }

    // Verificar que no exista ya
    const { data: existing } = await supabase
      .from('penalty_types')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de penalidad con ese código' },
        { status: 400 }
      )
    }

    // Obtener el mayor display_order
    const { data: maxOrder } = await supabase
      .from('penalty_types')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const newOrder = (maxOrder?.display_order || 0) + 1

    // Crear tipo (siempre interno para nuevos tipos)
    const { data: penaltyType, error: insertError } = await supabase
      .from('penalty_types')
      .insert({
        code,
        name,
        short_name: short_name || null,
        source: 'internal',
        base_amount_ssnn: base_amount_ssnn || null,
        identified_by: 'user',
        description: description || null,
        is_predictable: is_predictable ?? true,
        is_active: true,
        display_order: newOrder,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creando tipo:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      penalty_type: penaltyType,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
