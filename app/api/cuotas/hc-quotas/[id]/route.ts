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
      .from('hc_quotas')
      .select(`
        *,
        user:usuarios!hc_quotas_user_id_fkey(id, codigo_asesor, nombre_completo, rol, zona, dni),
        store:tiendas(id, codigo, nombre),
        store_quota:store_quotas(
          id, ss_quota, quota_breakdown, status,
          store:tiendas(id, codigo, nombre)
        ),
        distributed_by_user:usuarios!hc_quotas_distributed_by_fkey(nombre_completo),
        approved_by_user:usuarios!hc_quotas_approved_by_fkey(nombre_completo)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Cuota de HC no encontrada' },
          { status: 404 }
        )
      }
      console.error('Error obteniendo cuota de HC:', error)
      return NextResponse.json(
        { error: 'Error al obtener cuota de HC' },
        { status: 500 }
      )
    }

    // Transformar datos
    const quotaWithMeta = {
      ...quota,
      distributed_by_name: quota.distributed_by_user?.nombre_completo || null,
      approved_by_name: quota.approved_by_user?.nombre_completo || null,
      distributed_by_user: undefined,
      approved_by_user: undefined,
    }

    return NextResponse.json({
      hc_quota: quotaWithMeta,
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

    // Verificar que la cuota existe
    const { data: existing, error: fetchError } = await supabase
      .from('hc_quotas')
      .select('id, status, store_quota_id, ss_quota')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Cuota de HC no encontrada' },
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
      'start_date',
      'proration_factor',
      'prorated_ss_quota',
      'notes',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Si se actualiza start_date, recalcular prorrateo
    if (body.start_date !== undefined || body.ss_quota !== undefined) {
      // Obtener datos necesarios
      const { data: storeQuota } = await supabase
        .from('store_quotas')
        .select('year, month, ss_quota, quota_breakdown')
        .eq('id', existing.store_quota_id)
        .single()

      if (storeQuota) {
        const ssQuota = body.ss_quota ?? existing.ss_quota
        const daysInMonth = new Date(storeQuota.year, storeQuota.month, 0).getDate()
        const firstDayOfMonth = new Date(storeQuota.year, storeQuota.month - 1, 1)

        if (body.start_date) {
          const startDateObj = new Date(body.start_date)
          if (startDateObj > firstDayOfMonth) {
            const dayOfMonth = startDateObj.getDate()
            const daysWorked = daysInMonth - dayOfMonth + 1
            updateData.proration_factor = Number((daysWorked / daysInMonth).toFixed(4))
            updateData.prorated_ss_quota = Number((ssQuota * (updateData.proration_factor as number)).toFixed(2))
          } else {
            updateData.start_date = null
            updateData.proration_factor = 1.0
            updateData.prorated_ss_quota = null
          }
        } else if (body.start_date === null) {
          updateData.start_date = null
          updateData.proration_factor = 1.0
          updateData.prorated_ss_quota = null
        }

        // Recalcular breakdown si cambió ss_quota
        if (body.ss_quota !== undefined && storeQuota.quota_breakdown) {
          updateData.quota_breakdown = calculateQuotaBreakdown(
            storeQuota.quota_breakdown,
            ssQuota,
            storeQuota.ss_quota
          )
        }
      }
    }

    const { data: quota, error } = await supabase
      .from('hc_quotas')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        user:usuarios!hc_quotas_user_id_fkey(id, codigo_asesor, nombre_completo, rol, zona)
      `)
      .single()

    if (error) {
      console.error('Error actualizando cuota de HC:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      hc_quota: quota,
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
