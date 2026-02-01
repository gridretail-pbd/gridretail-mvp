import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Distribuir cuota de tienda a HCs
 * POST /api/cuotas/store-quotas/[id]/distribute
 *
 * Body:
 * {
 *   distributions: [
 *     { user_id: string, ss_quota: number, start_date?: string }
 *   ],
 *   distributed_by?: string
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { distributions, distributed_by } = body

    if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de distribuciones' },
        { status: 400 }
      )
    }

    // Obtener la cuota de tienda
    const { data: storeQuota, error: fetchError } = await supabase
      .from('store_quotas')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !storeQuota) {
      return NextResponse.json(
        { error: 'Cuota de tienda no encontrada' },
        { status: 404 }
      )
    }

    if (storeQuota.status === 'approved') {
      return NextResponse.json(
        { error: 'No se puede redistribuir una cuota ya aprobada' },
        { status: 400 }
      )
    }

    // Calcular días del mes
    const daysInMonth = new Date(storeQuota.year, storeQuota.month, 0).getDate()
    const firstDayOfMonth = new Date(storeQuota.year, storeQuota.month - 1, 1)

    // Validar suma de cuotas
    const totalDistributed = distributions.reduce(
      (sum: number, d: { ss_quota: number }) => sum + d.ss_quota,
      0
    )

    if (totalDistributed !== storeQuota.ss_quota) {
      return NextResponse.json(
        {
          error: `La suma de cuotas (${totalDistributed}) no coincide con la cuota de tienda (${storeQuota.ss_quota})`,
          total_distributed: totalDistributed,
          store_quota: storeQuota.ss_quota,
        },
        { status: 400 }
      )
    }

    // Eliminar distribuciones previas (solo draft)
    await supabase
      .from('hc_quotas')
      .delete()
      .eq('store_quota_id', id)
      .eq('status', 'draft')

    // Crear nuevas distribuciones
    const hcQuotas = distributions.map((dist: {
      user_id: string
      ss_quota: number
      start_date?: string
    }) => {
      // Calcular prorrateo si hay fecha de inicio
      let prorationFactor = 1.0
      let proratedSSQuota = null
      let startDate = null

      if (dist.start_date) {
        const startDateObj = new Date(dist.start_date)
        if (startDateObj > firstDayOfMonth) {
          startDate = dist.start_date
          const dayOfMonth = startDateObj.getDate()
          const daysWorked = daysInMonth - dayOfMonth + 1
          prorationFactor = Number((daysWorked / daysInMonth).toFixed(4))
          proratedSSQuota = Number((dist.ss_quota * prorationFactor).toFixed(2))
        }
      }

      // Calcular breakdown proporcional
      const quotaBreakdown = calculateQuotaBreakdown(
        storeQuota.quota_breakdown || {},
        dist.ss_quota,
        storeQuota.ss_quota
      )

      return {
        user_id: dist.user_id,
        store_quota_id: id,
        store_id: storeQuota.store_id,
        year: storeQuota.year,
        month: storeQuota.month,
        ss_quota: dist.ss_quota,
        quota_breakdown: quotaBreakdown,
        start_date: startDate,
        proration_factor: prorationFactor,
        prorated_ss_quota: proratedSSQuota,
        status: 'draft',
        distributed_by: distributed_by || null,
        distributed_at: new Date().toISOString(),
      }
    })

    const { data: createdQuotas, error: insertError } = await supabase
      .from('hc_quotas')
      .insert(hcQuotas)
      .select(`
        *,
        user:usuarios!hc_quotas_user_id_fkey(id, codigo_asesor, nombre_completo, rol, zona)
      `)

    if (insertError) {
      console.error('Error creando cuotas de HC:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    // Actualizar estado de la cuota de tienda
    await supabase
      .from('store_quotas')
      .update({ status: 'draft' })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      hc_quotas: createdQuotas,
      total_distributed: totalDistributed,
      store_quota: storeQuota.ss_quota,
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
 * Calcular breakdown proporcional
 */
function calculateQuotaBreakdown(
  storeBreakdown: Record<string, number>,
  hcQuota: number,
  storeQuota: number
): Record<string, number> {
  if (storeQuota === 0) return {}

  const ratio = hcQuota / storeQuota
  const result: Record<string, number> = {}

  for (const [key, value] of Object.entries(storeBreakdown)) {
    if (typeof value === 'number') {
      result[key] = Math.round(value * ratio)
    }
  }

  return result
}
