import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Obtener equivalencias de penalidades
 * GET /api/penalidades/equivalences?valid_date=2026-01-27
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const validDate = searchParams.get('valid_date')
    const penaltyTypeId = searchParams.get('penalty_type_id')

    let query = supabase
      .from('penalty_equivalences')
      .select(`
        *,
        penalty_type:penalty_types(*),
        created_by_user:usuarios!penalty_equivalences_created_by_fkey(nombre_completo)
      `)
      .order('valid_from', { ascending: false })

    // Filtrar por tipo
    if (penaltyTypeId) {
      query = query.eq('penalty_type_id', penaltyTypeId)
    }

    // Filtrar vigentes a una fecha específica
    if (validDate) {
      query = query
        .lte('valid_from', validDate)
        .or(`valid_to.is.null,valid_to.gte.${validDate}`)
    }

    const { data: equivalences, error } = await query

    if (error) {
      console.error('Error obteniendo equivalencias:', error)
      return NextResponse.json(
        { error: 'Error al obtener equivalencias' },
        { status: 500 }
      )
    }

    // Agrupar por tipo de penalidad (solo vigentes)
    const currentDate = validDate || new Date().toISOString().split('T')[0]
    const vigentes = equivalences?.filter(e => {
      const fromOk = e.valid_from <= currentDate
      const toOk = !e.valid_to || e.valid_to >= currentDate
      return fromOk && toOk
    })

    const byType = new Map<string, typeof equivalences[0]>()
    vigentes?.forEach(e => {
      const existing = byType.get(e.penalty_type_id)
      // Mantener la más reciente
      if (!existing || e.valid_from > existing.valid_from) {
        byType.set(e.penalty_type_id, e)
      }
    })

    return NextResponse.json({
      equivalences,
      current: Array.from(byType.values()),
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
 * Crear nueva equivalencia
 * POST /api/penalidades/equivalences
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      penalty_type_id,
      valid_from,
      transfer_type,
      transfer_percentage,
      transfer_fixed_amount,
      max_incidents,
      notes,
      created_by,
    } = body

    // Validaciones
    if (!penalty_type_id || !valid_from || !transfer_type) {
      return NextResponse.json(
        { error: 'Campos requeridos: penalty_type_id, valid_from, transfer_type' },
        { status: 400 }
      )
    }

    const validTransferTypes = ['none', 'full', 'percentage', 'fixed', 'partial_count']
    if (!validTransferTypes.includes(transfer_type)) {
      return NextResponse.json(
        { error: 'Tipo de traslado inválido' },
        { status: 400 }
      )
    }

    // Validar que el tipo de penalidad existe
    const { data: penaltyType, error: typeError } = await supabase
      .from('penalty_types')
      .select('id, name')
      .eq('id', penalty_type_id)
      .single()

    if (typeError || !penaltyType) {
      return NextResponse.json(
        { error: 'Tipo de penalidad no encontrado' },
        { status: 404 }
      )
    }

    // Cerrar equivalencia anterior si existe
    const { error: closeError } = await supabase
      .from('penalty_equivalences')
      .update({
        valid_to: valid_from,
        updated_at: new Date().toISOString(),
      })
      .eq('penalty_type_id', penalty_type_id)
      .is('valid_to', null)

    if (closeError) {
      console.error('Error cerrando equivalencia anterior:', closeError)
      // No es crítico, continuar
    }

    // Crear nueva equivalencia
    const { data: equivalence, error: insertError } = await supabase
      .from('penalty_equivalences')
      .insert({
        penalty_type_id,
        valid_from,
        valid_to: null,
        transfer_type,
        transfer_percentage: transfer_type === 'percentage' ? transfer_percentage : null,
        transfer_fixed_amount: ['fixed', 'partial_count'].includes(transfer_type) ? transfer_fixed_amount : null,
        max_incidents: max_incidents || null,
        notes: notes || null,
        created_by: created_by || null,
      })
      .select(`
        *,
        penalty_type:penalty_types(*)
      `)
      .single()

    if (insertError) {
      console.error('Error creando equivalencia:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      equivalence,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
