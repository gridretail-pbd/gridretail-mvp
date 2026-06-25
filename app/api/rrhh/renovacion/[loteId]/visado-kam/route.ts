import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { visadoKAM } from '@/lib/rrhh/queries/contratos'
import { renovacionVisadoKAMSchema } from '@/lib/rrhh/schemas'

interface RouteParams {
  params: Promise<{ loteId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { loteId } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Validar con Zod
    const parsed = renovacionVisadoKAMSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verificar que la decisión pertenece al lote
    const { data: decision } = await supabase
      .from('renovacion_decisiones')
      .select('id, lote_id, decision_jv')
      .eq('id', parsed.data.decision_id)
      .eq('lote_id', loteId)
      .single()

    if (!decision) {
      return NextResponse.json(
        { error: 'Decisión no encontrada en este lote' },
        { status: 404 }
      )
    }

    // Verificar que el JV ya visó
    if (!decision.decision_jv) {
      return NextResponse.json(
        { error: 'El Jefe de Ventas aún no ha completado su visado para esta decisión' },
        { status: 400 }
      )
    }

    const { data, error } = await visadoKAM(
      supabase,
      parsed.data.decision_id,
      parsed.data.decision,
      body.kam_id, // ID del KAM que visa
      parsed.data.motivo
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
