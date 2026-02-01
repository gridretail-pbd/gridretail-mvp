import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Actualizar cuota SSNN de una tienda
 * PATCH /api/cuotas/store-quotas/[id]/update-ssnn
 *
 * Body:
 * {
 *   ss_quota: number,
 *   user_id?: string
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { ss_quota, user_id } = body

    if (ss_quota === undefined || ss_quota === null) {
      return NextResponse.json(
        { error: 'Se requiere el campo ss_quota' },
        { status: 400 }
      )
    }

    if (ss_quota < 0) {
      return NextResponse.json(
        { error: 'La cuota no puede ser negativa' },
        { status: 400 }
      )
    }

    // Verificar que la cuota existe y obtener datos actuales
    const { data: existing, error: fetchError } = await supabase
      .from('store_quotas')
      .select(`
        id,
        ss_quota,
        ss_quota_entel,
        status,
        hc_quotas(ss_quota)
      `)
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Cuota de tienda no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que no esté aprobada
    if (existing.status === 'approved') {
      return NextResponse.json(
        { error: 'No se puede modificar una cuota aprobada' },
        { status: 400 }
      )
    }

    // Calcular cuota ya distribuida
    const distributedQuota = (existing.hc_quotas || [])
      .reduce((sum: number, hc: { ss_quota: number }) => sum + (hc.ss_quota || 0), 0)

    // Verificar que la nueva cuota no sea menor que la ya distribuida
    if (ss_quota < distributedQuota) {
      return NextResponse.json(
        {
          error: `La cuota (${ss_quota}) no puede ser menor que la ya distribuida (${distributedQuota})`,
          distributed_quota: distributedQuota
        },
        { status: 400 }
      )
    }

    // Actualizar la cuota
    const { data: updated, error: updateError } = await supabase
      .from('store_quotas')
      .update({
        ss_quota: ss_quota,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        id,
        store_id,
        ss_quota,
        ss_quota_entel,
        status,
        store:tiendas(id, codigo, nombre)
      `)
      .single()

    if (updateError) {
      console.error('Error actualizando cuota:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    // Calcular diferencia
    const ssQuotaEntel = updated.ss_quota_entel || updated.ss_quota
    const diferencia = updated.ss_quota - ssQuotaEntel

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        store_id: updated.store_id,
        ss_quota_entel: ssQuotaEntel,
        ss_quota: updated.ss_quota,
        diferencia: diferencia,
        status: updated.status,
        store: updated.store
      }
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
