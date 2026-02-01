import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Condonar una penalidad
 * POST /api/penalidades/penalties/[id]/waive
 *
 * Body:
 * {
 *   waived_reason: string (required),
 *   waived_by: string (user_id),
 *   reassign_to_user_id?: string (optional)
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { waived_reason, waived_by, reassign_to_user_id } = body

    if (!waived_reason || waived_reason.trim() === '') {
      return NextResponse.json(
        { error: 'Se requiere un motivo de condonación' },
        { status: 400 }
      )
    }

    // Verificar que la penalidad existe
    const { data: existing, error: fetchError } = await supabase
      .from('hc_penalties')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Penalidad no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que no esté ya condonada
    if (existing.status === 'waived') {
      return NextResponse.json(
        { error: 'La penalidad ya está condonada' },
        { status: 400 }
      )
    }

    // Condonar la penalidad
    const { data: penalty, error: updateError } = await supabase
      .from('hc_penalties')
      .update({
        status: 'waived',
        waived_reason,
        waived_by: waived_by || null,
        waived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        penalty_type:penalty_types(*),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
        store:tiendas(id, nombre, codigo)
      `)
      .single()

    if (updateError) {
      console.error('Error condonando penalidad:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    // Si se especifica reasignación, crear nueva penalidad
    let reassignedPenalty = null
    if (reassign_to_user_id) {
      // Verificar que el nuevo usuario existe
      const { data: newUser, error: userError } = await supabase
        .from('usuarios')
        .select('id, nombre_completo')
        .eq('id', reassign_to_user_id)
        .single()

      if (userError || !newUser) {
        return NextResponse.json(
          { error: 'Usuario de reasignación no encontrado' },
          { status: 404 }
        )
      }

      // Crear nueva penalidad para el otro usuario
      const { data: newPenalty, error: insertError } = await supabase
        .from('hc_penalties')
        .insert({
          user_id: reassign_to_user_id,
          store_id: existing.store_id,
          penalty_type_id: existing.penalty_type_id,
          year: existing.year,
          month: existing.month,
          incident_date: existing.incident_date,
          quantity: existing.quantity,
          original_amount: existing.original_amount,
          transferred_amount: existing.transferred_amount,
          source: existing.source,
          import_reference: existing.import_reference,
          status: 'pending',
          notes: `Reasignada desde penalidad ${id}. Usuario original: ${existing.user_id}`,
          created_by: waived_by || null,
        })
        .select(`
          *,
          penalty_type:penalty_types(*),
          user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona)
        `)
        .single()

      if (insertError) {
        console.error('Error reasignando penalidad:', insertError)
        // No es crítico, la condonación ya se realizó
      } else {
        reassignedPenalty = newPenalty
      }
    }

    return NextResponse.json({
      success: true,
      penalty,
      reassigned_penalty: reassignedPenalty,
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
 * Revertir condonación
 * DELETE /api/penalidades/penalties/[id]/waive
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar que la penalidad existe y está condonada
    const { data: existing, error: fetchError } = await supabase
      .from('hc_penalties')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Penalidad no encontrada' },
        { status: 404 }
      )
    }

    if (existing.status !== 'waived') {
      return NextResponse.json(
        { error: 'La penalidad no está condonada' },
        { status: 400 }
      )
    }

    // Revertir condonación
    const { data: penalty, error: updateError } = await supabase
      .from('hc_penalties')
      .update({
        status: 'applied',
        waived_reason: null,
        waived_by: null,
        waived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        penalty_type:penalty_types(*),
        user:usuarios!hc_penalties_user_id_fkey(id, nombre_completo, codigo_asesor, rol, zona),
        store:tiendas(id, nombre, codigo)
      `)
      .single()

    if (updateError) {
      console.error('Error revirtiendo condonación:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      penalty,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
