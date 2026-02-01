import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Obtener resumen de cuotas para un período
 * GET /api/cuotas/summary?year=2026&month=1
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json(
        { error: 'Se requiere año y mes' },
        { status: 400 }
      )
    }

    const yearNum = parseInt(year)
    const monthNum = parseInt(month)

    // Obtener resumen del período usando RPC
    const { data: periodSummary, error: summaryError } = await supabase
      .rpc('get_quota_period_summary', {
        p_year: yearNum,
        p_month: monthNum
      })

    // Obtener cuotas de tienda con conteo de HCs
    const { data: storeQuotas, error: storeError } = await supabase
      .from('store_quotas')
      .select(`
        id,
        store_id,
        ss_quota,
        ss_quota_entel,
        quota_breakdown,
        status,
        store:tiendas(id, codigo, nombre),
        hc_quotas(
          id,
          ss_quota,
          proration_factor,
          prorated_ss_quota,
          status
        )
      `)
      .eq('year', yearNum)
      .eq('month', monthNum)

    if (storeError) {
      console.error('Error obteniendo cuotas:', storeError)
      return NextResponse.json(
        { error: 'Error al obtener cuotas' },
        { status: 500 }
      )
    }

    // Obtener total de tiendas activas
    const { count: totalStores } = await supabase
      .from('tiendas')
      .select('id', { count: 'exact', head: true })
      .eq('activa', true)

    // Obtener última importación
    const { data: lastImport } = await supabase
      .from('quota_imports')
      .select('*')
      .eq('year', yearNum)
      .eq('month', monthNum)
      .eq('status', 'completed')
      .order('imported_at', { ascending: false })
      .limit(1)
      .single()

    // Calcular resumen
    let totalSSQuotaEntel = 0
    let totalSSQuotaSSNN = 0
    let totalHCQuota = 0
    let storesWithQuotas = 0
    let storesDistributed = 0
    let storesApproved = 0
    let totalHCs = 0
    let hcsWithQuotas = 0

    const byStatus = {
      draft: 0,
      pending_approval: 0,
      approved: 0,
      archived: 0,
    }

    const storesSummary = storeQuotas?.map(sq => {
      totalSSQuotaEntel += sq.ss_quota_entel || sq.ss_quota
      totalSSQuotaSSNN += sq.ss_quota
      storesWithQuotas++
      byStatus[sq.status as keyof typeof byStatus]++

      if (sq.status === 'approved') storesApproved++

      const hcList = sq.hc_quotas || []
      const hcCount = hcList.length
      const hcTotalQuota = hcList.reduce((sum, hc) => sum + (hc.ss_quota || 0), 0)

      totalHCs += hcCount
      totalHCQuota += hcTotalQuota

      if (hcCount > 0) {
        storesDistributed++
        hcsWithQuotas += hcCount
      }

      // El join puede retornar un array o un objeto
      const store = Array.isArray(sq.store) ? sq.store[0] : sq.store

      // Calcular diferencia entre SSNN y Entel
      const ssQuotaEntel = sq.ss_quota_entel || sq.ss_quota
      const diferencia = sq.ss_quota - ssQuotaEntel

      return {
        store_quota_id: sq.id,
        store_id: sq.store_id,
        store_code: store?.codigo,
        store_name: store?.nombre,
        ss_quota_entel: ssQuotaEntel,
        ss_quota: sq.ss_quota,
        diferencia: diferencia,
        status: sq.status,
        hc_count: hcCount,
        hc_quota_total: hcTotalQuota,
        is_distributed: hcCount > 0 && hcTotalQuota === sq.ss_quota,
        distribution_diff: sq.ss_quota - hcTotalQuota,
      }
    }) || []

    // Determinar estado general del período
    let periodStatus: 'no_import' | 'imported' | 'distributing' | 'pending_approval' | 'approved'

    if (storesWithQuotas === 0) {
      periodStatus = 'no_import'
    } else if (storesApproved === storesWithQuotas) {
      periodStatus = 'approved'
    } else if (storesDistributed === storesWithQuotas) {
      periodStatus = 'pending_approval'
    } else if (storesDistributed > 0) {
      periodStatus = 'distributing'
    } else {
      periodStatus = 'imported'
    }

    // Usar RPC si está disponible, sino usar cálculo local
    const rpcSummary = periodSummary && !summaryError ? periodSummary : null

    return NextResponse.json({
      period: {
        year: yearNum,
        month: monthNum,
        status: periodStatus,
      },
      totals: {
        ss_quota_entel: rpcSummary?.total_ss_quota_entel ?? totalSSQuotaEntel,
        ss_quota_ssnn: rpcSummary?.total_ss_quota_ssnn ?? totalSSQuotaSSNN,
        ss_quota_diferencia: (rpcSummary?.total_ss_quota_ssnn ?? totalSSQuotaSSNN) - (rpcSummary?.total_ss_quota_entel ?? totalSSQuotaEntel),
        ss_quota: totalSSQuotaSSNN, // Mantener por compatibilidad
        hc_quota: totalHCQuota,
        stores_total: rpcSummary?.total_stores ?? totalStores ?? 0,
        stores_with_quotas: rpcSummary?.stores_with_quota ?? storesWithQuotas,
        stores_distributed: rpcSummary?.stores_distributed ?? storesDistributed,
        stores_approved: storesApproved,
        hcs_total: totalHCs,
        hcs_with_quotas: rpcSummary?.total_hc_assigned ?? hcsWithQuotas,
        total_ss_distributed: rpcSummary?.total_ss_distributed ?? totalHCQuota,
      },
      by_status: byStatus,
      stores: storesSummary,
      last_import: lastImport ? {
        id: lastImport.id,
        file_name: lastImport.file_name,
        imported_at: lastImport.imported_at,
        imported_rows: lastImport.imported_rows,
      } : null,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
