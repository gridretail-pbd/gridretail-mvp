import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/comisiones/tipos-partida
 * Obtiene el catálogo de tipos de partida activos
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const category = searchParams.get('category')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    let query = supabase
      .from('commission_item_types')
      .select('*')
      .order('display_order')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: itemTypes, error } = await query

    if (error) {
      console.error('Error obteniendo tipos de partida:', error)
      return NextResponse.json(
        { error: 'Error al obtener tipos de partida' },
        { status: 500 }
      )
    }

    // Agrupar por categoría para facilitar uso en UI
    const grouped = {
      principal: itemTypes?.filter(t => t.category === 'principal') || [],
      adicional: itemTypes?.filter(t => t.category === 'adicional') || [],
      pxq: itemTypes?.filter(t => t.category === 'pxq') || [],
      postventa: itemTypes?.filter(t => t.category === 'postventa') || [],
      bono: itemTypes?.filter(t => t.category === 'bono') || [],
    }

    return NextResponse.json({
      itemTypes: itemTypes || [],
      grouped,
      total: itemTypes?.length || 0,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
