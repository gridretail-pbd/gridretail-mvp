import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    // Obtener parámetros de filtro
    const status = searchParams.get('status')?.split(',').filter(Boolean)
    const schemeType = searchParams.get('scheme_type')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const search = searchParams.get('search')

    // Construir query
    let query = supabase
      .from('commission_schemes')
      .select(`
        *,
        created_by_user:usuarios!commission_schemes_created_by_fkey(nombre_completo)
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (status && status.length > 0) {
      query = query.in('status', status)
    }

    if (schemeType) {
      query = query.eq('scheme_type', schemeType)
    }

    if (year) {
      query = query.eq('year', parseInt(year))
    }

    if (month) {
      query = query.eq('month', parseInt(month))
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
    }

    const { data: schemes, error } = await query

    if (error) {
      console.error('Error obteniendo esquemas:', error)
      return NextResponse.json(
        { error: 'Error al obtener esquemas' },
        { status: 500 }
      )
    }

    // Transformar datos para incluir nombre del creador
    const schemesWithMeta = schemes?.map(scheme => ({
      ...scheme,
      created_by_name: scheme.created_by_user?.nombre_completo || null,
      created_by_user: undefined,
    })) || []

    return NextResponse.json({
      schemes: schemesWithMeta,
      total: schemesWithMeta.length,
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

    // Validar que no exista un esquema con el mismo código
    const { data: existing } = await supabase
      .from('commission_schemes')
      .select('id')
      .eq('code', body.code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un esquema con ese código' },
        { status: 400 }
      )
    }

    // Crear el esquema con estado draft
    const schemeData = {
      ...body,
      status: 'draft',
      source: 'socio',
    }

    const { data: scheme, error } = await supabase
      .from('commission_schemes')
      .insert(schemeData)
      .select()
      .single()

    if (error) {
      console.error('Error creando esquema:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      scheme,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
