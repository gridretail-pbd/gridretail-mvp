import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/comisiones/tipos-venta
 * Obtiene todos los tipos de venta activos
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Filtros opcionales
    const categoria = searchParams.get('categoria') // 'SS', 'PP', 'PACK', etc.
    const activo = searchParams.get('activo') // 'true' | 'false'

    let query = supabase
      .from('tipos_venta')
      .select('*')

    // Por defecto solo activos
    if (activo !== 'false') {
      query = query.eq('activo', true)
    }

    if (categoria) {
      query = query.eq('categoria', categoria)
    }

    const { data: tiposVenta, error } = await query
      .order('categoria')
      .order('orden')

    if (error) {
      console.error('Error fetching tipos_venta:', error)
      return NextResponse.json(
        { error: 'Error al obtener tipos de venta' },
        { status: 500 }
      )
    }

    // Agrupar por categoría para facilitar uso en UI
    const grouped = tiposVenta?.reduce((acc, tv) => {
      const cat = tv.categoria || 'OTROS'
      if (!acc[cat]) {
        acc[cat] = []
      }
      acc[cat].push(tv)
      return acc
    }, {} as Record<string, typeof tiposVenta>)

    return NextResponse.json({
      items: tiposVenta,
      grouped: grouped
    })
  } catch (error) {
    console.error('Error in tipos-venta API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
