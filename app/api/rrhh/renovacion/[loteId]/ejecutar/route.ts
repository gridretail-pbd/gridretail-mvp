import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ejecutarDecision } from '@/lib/rrhh/queries/contratos'

interface RouteParams {
  params: Promise<{ loteId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { loteId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { decision_id, decision_final, ejecutado_por } = body

    if (!decision_id || !decision_final || !ejecutado_por) {
      return NextResponse.json(
        { error: 'decision_id, decision_final y ejecutado_por son requeridos' },
        { status: 400 }
      )
    }

    if (!['RENOVAR', 'NO_RENOVAR'].includes(decision_final)) {
      return NextResponse.json(
        { error: 'decision_final debe ser RENOVAR o NO_RENOVAR' },
        { status: 400 }
      )
    }

    // Verificar que la decisión pertenece al lote
    const { data: decision } = await supabase
      .from('renovacion_decisiones')
      .select('id, lote_id')
      .eq('id', decision_id)
      .eq('lote_id', loteId)
      .single()

    if (!decision) {
      return NextResponse.json(
        { error: 'Decisión no encontrada en este lote' },
        { status: 404 }
      )
    }

    const { data, error } = await ejecutarDecision(
      supabase,
      decision_id,
      decision_final,
      ejecutado_por
    )

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, decision: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
