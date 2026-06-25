import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Obtener esquema con sus relaciones
    const { data: scheme, error } = await supabase
      .from('commission_schemes')
      .select(`
        *,
        created_by_user:usuarios!commission_schemes_created_by_fkey(id, nombre_completo),
        approved_by_user:usuarios!commission_schemes_approved_by_fkey(id, nombre_completo)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo esquema:', error)
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    // Obtener partidas del esquema
    const { data: items } = await supabase
      .from('commission_scheme_items')
      .select(`
        *,
        item_type:commission_item_types(*),
        preset:partition_presets(id, code, name, default_category, default_calculation_type)
      `)
      .eq('scheme_id', id)
      .order('display_order')

    // Obtener restricciones del esquema
    const { data: restrictions } = await supabase
      .from('commission_item_restrictions')
      .select(`
        *,
        affected_item_type:commission_item_types(*)
      `)
      .eq('scheme_id', id)

    return NextResponse.json({
      scheme: {
        ...scheme,
        created_by_name: scheme.created_by_user?.nombre_completo || null,
        approved_by_name: scheme.approved_by_user?.nombre_completo || null,
      },
      items: items || [],
      restrictions: restrictions || [],
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
    const { redistribute_quotas, ...updateData } = body

    // Verificar que el esquema existe y está en draft
    const { data: existing } = await supabase
      .from('commission_schemes')
      .select('id, status, total_ss_quota')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden editar esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Redistribución de cuotas: se activa cuando el usuario marca el checkbox
    // Usa el nuevo total_ss_quota, o el existente si no cambió
    const targetTotalQuota = updateData.total_ss_quota ?? existing.total_ss_quota
    const shouldRedistribute = redistribute_quotas && targetTotalQuota > 0
    let quotasWereRedistributed = false

    if (shouldRedistribute) {
      // Obtener partidas activas con nombres para identificar principales
      const { data: items } = await supabase
        .from('commission_scheme_items')
        .select(`
          id,
          quota,
          custom_name,
          preset:partition_presets(name),
          item_type:commission_item_types(name, code)
        `)
        .eq('scheme_id', id)
        .eq('is_active', true)

      if (items && items.length > 0) {
        // Las partidas principales son OSS, OPP, VR - identificadas por nombre/código
        const ssPatterns = ['OSS', 'OPP', 'VR_', 'VR ']
        const principalItems = items.filter(item => {
          const name = (
            item.custom_name ||
            (item.preset as any)?.name ||
            (item.item_type as any)?.name ||
            (item.item_type as any)?.code ||
            ''
          ).toUpperCase()
          return ssPatterns.some(pattern => name.includes(pattern))
        })

        // Calcular suma actual de cuotas principales
        const currentSum = principalItems.reduce((sum, item) => sum + (item.quota || 0), 0)

        // Solo redistribuir si hay desajuste (suma actual != target)
        if (currentSum > 0 && currentSum !== targetTotalQuota) {
          // Calcular factor de redistribución
          const factor = targetTotalQuota / currentSum

          // Actualizar cada partida principal proporcionalmente
          for (const item of principalItems) {
            if (item.quota) {
              const newQuota = Math.round(item.quota * factor)
              await supabase
                .from('commission_scheme_items')
                .update({ quota: newQuota })
                .eq('id', item.id)
            }
          }
          quotasWereRedistributed = true
        }
      }
    }

    // Actualizar esquema
    const { data: scheme, error } = await supabase
      .from('commission_schemes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando esquema:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      scheme,
      quotas_redistributed: quotasWereRedistributed,
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

    // Verificar que el esquema existe y está en draft
    const { data: existing } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Eliminar esquema (cascade eliminará items y restricciones)
    const { error } = await supabase
      .from('commission_schemes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando esquema:', error)
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
