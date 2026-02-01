import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Aprobar cuotas de tienda (y sus HC) masivamente
 * POST /api/cuotas/approve
 *
 * Body:
 * {
 *   store_quota_ids: string[],
 *   approved_by: string,
 *   approval_notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { store_quota_ids, approved_by, approval_notes } = body

    if (!store_quota_ids || !Array.isArray(store_quota_ids) || store_quota_ids.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de store_quota_ids' },
        { status: 400 }
      )
    }

    if (!approved_by) {
      return NextResponse.json(
        { error: 'Se requiere approved_by' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Verificar que todas las cuotas existen y están en estado pending_approval o draft
    const { data: quotas, error: fetchError } = await supabase
      .from('store_quotas')
      .select('id, status')
      .in('id', store_quota_ids)

    if (fetchError) {
      console.error('Error verificando cuotas:', fetchError)
      return NextResponse.json(
        { error: 'Error al verificar cuotas' },
        { status: 500 }
      )
    }

    if (!quotas || quotas.length !== store_quota_ids.length) {
      return NextResponse.json(
        { error: 'Algunas cuotas no fueron encontradas' },
        { status: 404 }
      )
    }

    const alreadyApproved = quotas.filter(q => q.status === 'approved')
    if (alreadyApproved.length > 0) {
      return NextResponse.json(
        {
          error: 'Algunas cuotas ya están aprobadas',
          already_approved: alreadyApproved.map(q => q.id),
        },
        { status: 400 }
      )
    }

    // Aprobar cuotas de tienda
    const { error: updateStoreError } = await supabase
      .from('store_quotas')
      .update({
        status: 'approved',
        approved_by,
        approved_at: now,
        approval_notes: approval_notes || null,
      })
      .in('id', store_quota_ids)

    if (updateStoreError) {
      console.error('Error aprobando cuotas de tienda:', updateStoreError)
      return NextResponse.json(
        { error: updateStoreError.message },
        { status: 400 }
      )
    }

    // Aprobar todas las cuotas de HC asociadas
    const { error: updateHCError } = await supabase
      .from('hc_quotas')
      .update({
        status: 'approved',
        approved_by,
        approved_at: now,
      })
      .in('store_quota_id', store_quota_ids)
      .in('status', ['draft', 'pending_approval'])

    if (updateHCError) {
      console.error('Error aprobando cuotas de HC:', updateHCError)
      return NextResponse.json(
        { error: updateHCError.message },
        { status: 400 }
      )
    }

    // Obtener resumen de lo aprobado
    const { data: approvedQuotas } = await supabase
      .from('store_quotas')
      .select(`
        id,
        store:tiendas(nombre),
        ss_quota,
        hc_quotas(count)
      `)
      .in('id', store_quota_ids)

    return NextResponse.json({
      success: true,
      approved_count: store_quota_ids.length,
      approved_quotas: approvedQuotas?.map(q => {
        // El join puede retornar un array o un objeto
        const store = Array.isArray(q.store) ? q.store[0] : q.store
        return {
          id: q.id,
          store_name: store?.nombre,
          ss_quota: q.ss_quota,
          hc_count: Array.isArray(q.hc_quotas) ? q.hc_quotas[0]?.count || 0 : 0,
        }
      }),
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
