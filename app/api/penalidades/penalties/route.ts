import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Obtener penalidades con filtros
 * GET /api/penalidades/penalties?year=2026&month=1&user_id=...&status=...
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const user_id = searchParams.get('user_id')
    const store_id = searchParams.get('store_id')
    const penalty_type_id = searchParams.get('penalty_type_id')
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    let query = supabase
      .from('hc_penalties')
      .select(`
        *,
        penalty_type:penalty_types(*),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
        store:tiendas(id, nombre, codigo),
        waived_by_user:usuarios!hc_penalties_waived_by_fkey(nombre_completo),
        created_by_user:usuarios!hc_penalties_created_by_fkey(nombre_completo)
      `)
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (year) query = query.eq('year', parseInt(year))
    if (month) query = query.eq('month', parseInt(month))
    if (user_id) query = query.eq('user_id', user_id)
    if (store_id) query = query.eq('store_id', store_id)
    if (penalty_type_id) query = query.eq('penalty_type_id', penalty_type_id)
    if (status) query = query.eq('status', status)
    if (source) query = query.eq('source', source)

    // Paginación
    if (limit) query = query.limit(parseInt(limit))
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || '50') - 1)

    const { data: penalties, error } = await query

    if (error) {
      console.error('Error obteniendo penalidades:', error)
      return NextResponse.json(
        { error: 'Error al obtener penalidades' },
        { status: 500 }
      )
    }

    // Calcular estadísticas básicas
    const stats = {
      total: penalties?.length || 0,
      total_amount: penalties?.reduce((sum, p) => sum + (p.transferred_amount || 0), 0) || 0,
      by_status: {
        pending: penalties?.filter(p => p.status === 'pending').length || 0,
        applied: penalties?.filter(p => p.status === 'applied').length || 0,
        waived: penalties?.filter(p => p.status === 'waived').length || 0,
        disputed: penalties?.filter(p => p.status === 'disputed').length || 0,
      }
    }

    return NextResponse.json({
      penalties,
      stats,
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
 * Crear penalidad manualmente
 * POST /api/penalidades/penalties
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      user_id,
      store_id,
      penalty_type_id,
      year,
      month,
      incident_date,
      quantity,
      original_amount,
      transferred_amount,
      notes,
      created_by,
    } = body

    // Validaciones
    if (!user_id || !penalty_type_id || !year || !month) {
      return NextResponse.json(
        { error: 'Campos requeridos: user_id, penalty_type_id, year, month' },
        { status: 400 }
      )
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'La cantidad debe ser al menos 1' },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, nombre_completo')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el tipo de penalidad existe
    const { data: penaltyType, error: typeError } = await supabase
      .from('penalty_types')
      .select('id, name')
      .eq('id', penalty_type_id)
      .single()

    if (typeError || !penaltyType) {
      return NextResponse.json(
        { error: 'Tipo de penalidad no encontrado' },
        { status: 404 }
      )
    }

    // Crear penalidad
    const { data: penalty, error: insertError } = await supabase
      .from('hc_penalties')
      .insert({
        user_id,
        store_id: store_id || null,
        penalty_type_id,
        year,
        month,
        incident_date: incident_date || null,
        quantity: quantity || 1,
        original_amount: original_amount || null,
        transferred_amount: transferred_amount || null,
        source: 'manual',
        status: 'pending',
        notes: notes || null,
        created_by: created_by || null,
      })
      .select(`
        *,
        penalty_type:penalty_types(*),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
        store:tiendas(id, nombre, codigo)
      `)
      .single()

    if (insertError) {
      console.error('Error creando penalidad:', insertError)
      return NextResponse.json(
        { error: insertError.message },
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
