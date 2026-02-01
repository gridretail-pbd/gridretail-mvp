import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: quota, error } = await supabase
      .from('store_quotas')
      .select(`
        *,
        store:tiendas(id, codigo, nombre),
        import:quota_imports(id, file_name, imported_at),
        approved_by_user:usuarios!store_quotas_approved_by_fkey(nombre_completo),
        created_by_user:usuarios!store_quotas_created_by_fkey(nombre_completo),
        hc_quotas(
          id, user_id, ss_quota, proration_factor, prorated_ss_quota, status, start_date,
          user:usuarios!hc_quotas_user_id_fkey(id, codigo_asesor, nombre_completo, rol, zona)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Cuota de tienda no encontrada' },
          { status: 404 }
        )
      }
      console.error('Error obteniendo cuota de tienda:', error)
      return NextResponse.json(
        { error: 'Error al obtener cuota de tienda' },
        { status: 500 }
      )
    }

    // Transformar datos
    const quotaWithMeta = {
      ...quota,
      approved_by_name: quota.approved_by_user?.nombre_completo || null,
      created_by_name: quota.created_by_user?.nombre_completo || null,
      approved_by_user: undefined,
      created_by_user: undefined,
    }

    return NextResponse.json({
      store_quota: quotaWithMeta,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que la cuota existe y no está aprobada
    const { data: existing, error: fetchError } = await supabase
      .from('store_quotas')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Cuota de tienda no encontrada' },
        { status: 404 }
      )
    }

    if (existing.status === 'approved') {
      return NextResponse.json(
        { error: 'No se puede modificar una cuota aprobada' },
        { status: 400 }
      )
    }

    // Campos permitidos para actualizar
    const allowedFields = [
      'ss_quota',
      'quota_breakdown',
      'source',
      'original_store_name',
      'status',
      'approval_notes',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data: quota, error } = await supabase
      .from('store_quotas')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        store:tiendas(id, codigo, nombre)
      `)
      .single()

    if (error) {
      console.error('Error actualizando cuota de tienda:', error)
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar que la cuota existe y no está aprobada
    const { data: existing, error: fetchError } = await supabase
      .from('store_quotas')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Cuota de tienda no encontrada' },
        { status: 404 }
      )
    }

    if (existing.status === 'approved') {
      return NextResponse.json(
        { error: 'No se puede eliminar una cuota aprobada' },
        { status: 400 }
      )
    }

    // Eliminar (cascadea a hc_quotas)
    const { error } = await supabase
      .from('store_quotas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando cuota de tienda:', error)
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
