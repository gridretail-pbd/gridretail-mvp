import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    // Obtener parámetros de filtro
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const status = searchParams.get('status')?.split(',').filter(Boolean)
    const storeId = searchParams.get('store_id')
    const userId = searchParams.get('user_id')
    const storeQuotaId = searchParams.get('store_quota_id')

    // Validar año y mes requeridos (excepto si se busca por user_id específico)
    if (!userId && (!year || !month)) {
      return NextResponse.json(
        { error: 'Se requiere año y mes, o user_id' },
        { status: 400 }
      )
    }

    // Construir query
    let query = supabase
      .from('hc_quotas')
      .select(`
        *,
        user:usuarios!hc_quotas_user_id_fkey(id, codigo_asesor, nombre_completo, rol, zona, dni),
        store:tiendas(id, codigo, nombre),
        store_quota:store_quotas(id, ss_quota, quota_breakdown, status)
      `)

    // Aplicar filtros
    if (year) {
      query = query.eq('year', parseInt(year))
    }

    if (month) {
      query = query.eq('month', parseInt(month))
    }

    if (status && status.length > 0) {
      query = query.in('status', status)
    }

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (storeQuotaId) {
      query = query.eq('store_quota_id', storeQuotaId)
    }

    const { data: quotas, error } = await query

    if (error) {
      console.error('Error obteniendo cuotas de HC:', error)
      return NextResponse.json(
        { error: 'Error al obtener cuotas de HC' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      hc_quotas: quotas || [],
      total: quotas?.length || 0,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
