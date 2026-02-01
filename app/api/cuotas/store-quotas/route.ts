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

    // Validar año y mes requeridos
    if (!year || !month) {
      return NextResponse.json(
        { error: 'Se requiere año y mes' },
        { status: 400 }
      )
    }

    // Construir query
    let query = supabase
      .from('store_quotas')
      .select(`
        *,
        store:tiendas(id, codigo, nombre),
        import:quota_imports(id, file_name, imported_at),
        approved_by_user:usuarios!store_quotas_approved_by_fkey(nombre_completo),
        hc_quotas(id)
      `)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .order('store(nombre)')

    // Aplicar filtros opcionales
    if (status && status.length > 0) {
      query = query.in('status', status)
    }

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data: quotas, error } = await query

    if (error) {
      console.error('Error obteniendo cuotas de tienda:', error)
      return NextResponse.json(
        { error: 'Error al obtener cuotas de tienda' },
        { status: 500 }
      )
    }

    // Transformar datos
    const quotasWithMeta = quotas?.map(quota => {
      // Contar el número de hc_quotas relacionadas
      const hcCount = Array.isArray(quota.hc_quotas)
        ? quota.hc_quotas.length
        : 0

      return {
        ...quota,
        hc_count: hcCount,
        approved_by_name: quota.approved_by_user?.nombre_completo || null,
        approved_by_user: undefined,
        hc_quotas: undefined,
      }
    }) || []

    return NextResponse.json({
      store_quotas: quotasWithMeta,
      total: quotasWithMeta.length,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Validar campos requeridos
    const { store_id, year, month, ss_quota, quota_breakdown } = body

    if (!store_id || !year || !month || ss_quota === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: store_id, year, month, ss_quota' },
        { status: 400 }
      )
    }

    // Verificar que no exista una cuota para esta tienda/período
    const { data: existing } = await supabase
      .from('store_quotas')
      .select('id')
      .eq('store_id', store_id)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una cuota para esta tienda en este período' },
        { status: 400 }
      )
    }

    // Crear la cuota
    const quotaData = {
      store_id,
      year,
      month,
      ss_quota,
      quota_breakdown: quota_breakdown || {},
      source: body.source || 'manual',
      import_id: body.import_id || null,
      original_store_name: body.original_store_name || null,
      status: 'draft',
      created_by: body.created_by || null,
    }

    const { data: quota, error } = await supabase
      .from('store_quotas')
      .insert(quotaData)
      .select(`
        *,
        store:tiendas(id, codigo, nombre)
      `)
      .single()

    if (error) {
      console.error('Error creando cuota de tienda:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      store_quota: quota,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
