import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Obtener resumen de penalidades para un período
 * GET /api/penalidades/summary?year=2026&month=1
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

    // Obtener penalidades del período
    const { data: penalties, error: penaltiesError } = await supabase
      .from('hc_penalties')
      .select(`
        *,
        penalty_type:penalty_types(id, code, name, source),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor),
        store:tiendas(id, nombre, codigo)
      `)
      .eq('year', yearNum)
      .eq('month', monthNum)

    if (penaltiesError) {
      console.error('Error obteniendo penalidades:', penaltiesError)
      return NextResponse.json(
        { error: 'Error al obtener penalidades' },
        { status: 500 }
      )
    }

    const penaltyList = penalties || []

    // Calcular totales generales
    const total_penalties = penaltyList.length
    const total_original_amount = penaltyList.reduce(
      (sum, p) => sum + (p.original_amount || 0), 0
    )
    const total_transferred_amount = penaltyList.reduce(
      (sum, p) => sum + (p.transferred_amount || 0), 0
    )

    // Por origen
    const entelPenalties = penaltyList.filter(p => p.source === 'entel')
    const manualPenalties = penaltyList.filter(p => p.source === 'manual')

    const by_source = {
      entel: {
        count: entelPenalties.length,
        original_amount: entelPenalties.reduce((sum, p) => sum + (p.original_amount || 0), 0),
        transferred_amount: entelPenalties.reduce((sum, p) => sum + (p.transferred_amount || 0), 0),
      },
      internal: {
        count: manualPenalties.length,
        original_amount: manualPenalties.reduce((sum, p) => sum + (p.original_amount || 0), 0),
        transferred_amount: manualPenalties.reduce((sum, p) => sum + (p.transferred_amount || 0), 0),
      }
    }

    // Por estado
    const by_status = {
      pending: calculateStatusTotal(penaltyList, 'pending'),
      applied: calculateStatusTotal(penaltyList, 'applied'),
      waived: calculateStatusTotal(penaltyList, 'waived'),
      disputed: calculateStatusTotal(penaltyList, 'disputed'),
    }

    // Por tipo (top 10)
    const typeMap = new Map<string, {
      penalty_type_id: string
      penalty_code: string
      penalty_name: string
      penalty_source: string
      count: number
      quantity: number
      original_amount: number
      transferred_amount: number
    }>()

    penaltyList.forEach(p => {
      const typeId = p.penalty_type_id
      const existing = typeMap.get(typeId)
      if (existing) {
        existing.count++
        existing.quantity += p.quantity
        existing.original_amount += p.original_amount || 0
        existing.transferred_amount += p.transferred_amount || 0
      } else {
        typeMap.set(typeId, {
          penalty_type_id: typeId,
          penalty_code: p.penalty_type?.code || '',
          penalty_name: p.penalty_type?.name || '',
          penalty_source: p.penalty_type?.source || '',
          count: 1,
          quantity: p.quantity,
          original_amount: p.original_amount || 0,
          transferred_amount: p.transferred_amount || 0
        })
      }
    })

    const by_type = Array.from(typeMap.values())
      .sort((a, b) => b.transferred_amount - a.transferred_amount)
      .slice(0, 10)

    // Por tienda (top 10)
    const storeMap = new Map<string, {
      store_id: string
      store_name: string
      store_code: string
      hc_set: Set<string>
      count: number
      transferred_amount: number
    }>()

    penaltyList.forEach(p => {
      if (!p.store_id) return
      const existing = storeMap.get(p.store_id)
      if (existing) {
        existing.hc_set.add(p.user_id)
        existing.count++
        existing.transferred_amount += p.transferred_amount || 0
      } else {
        const hcSet = new Set<string>()
        hcSet.add(p.user_id)
        storeMap.set(p.store_id, {
          store_id: p.store_id,
          store_name: p.store?.nombre || '',
          store_code: p.store?.codigo || '',
          hc_set: hcSet,
          count: 1,
          transferred_amount: p.transferred_amount || 0
        })
      }
    })

    const by_store = Array.from(storeMap.values())
      .map(s => ({
        store_id: s.store_id,
        store_name: s.store_name,
        store_code: s.store_code,
        hc_count: s.hc_set.size,
        penalty_count: s.count,
        total_amount: s.transferred_amount
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)

    // Top 10 HC con más penalidades
    const hcMap = new Map<string, {
      user_id: string
      nombre_completo: string
      codigo_asesor: string
      store_name: string
      penalty_count: number
      total_amount: number
    }>()

    penaltyList.forEach(p => {
      const existing = hcMap.get(p.user_id)
      if (existing) {
        existing.penalty_count++
        existing.total_amount += p.transferred_amount || 0
      } else {
        hcMap.set(p.user_id, {
          user_id: p.user_id,
          nombre_completo: p.user?.nombre_completo || '',
          codigo_asesor: p.user?.codigo_asesor || '',
          store_name: p.store?.nombre || '',
          penalty_count: 1,
          total_amount: p.transferred_amount || 0
        })
      }
    })

    const top_hc = Array.from(hcMap.values())
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)

    // Obtener últimas importaciones
    const { data: imports } = await supabase
      .from('penalty_imports')
      .select(`
        id,
        file_name,
        imported_at,
        imported_rows,
        status,
        imported_by_user:usuarios!penalty_imports_imported_by_fkey(nombre_completo)
      `)
      .eq('year', yearNum)
      .eq('month', monthNum)
      .order('created_at', { ascending: false })
      .limit(5)

    // Calcular HC afectados
    const uniqueHCCount = new Set(penaltyList.map(p => p.user_id)).size
    const avgPerHC = uniqueHCCount > 0
      ? total_transferred_amount / uniqueHCCount
      : 0
    const maxHC = top_hc[0] || null

    return NextResponse.json({
      period: {
        year: yearNum,
        month: monthNum,
      },
      totals: {
        total_penalties,
        total_original_amount,
        total_transferred_amount,
        hc_affected: uniqueHCCount,
        avg_per_hc: Math.round(avgPerHC * 100) / 100,
        max_hc: maxHC,
      },
      by_source,
      by_status,
      by_type,
      by_store,
      top_hc,
      last_imports: imports || [],
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function calculateStatusTotal(
  penalties: Array<{ status: string; transferred_amount?: number | null }>,
  status: string
): { count: number; amount: number } {
  const filtered = penalties.filter(p => p.status === status)
  return {
    count: filtered.length,
    amount: filtered.reduce((sum, p) => sum + (p.transferred_amount || 0), 0)
  }
}
