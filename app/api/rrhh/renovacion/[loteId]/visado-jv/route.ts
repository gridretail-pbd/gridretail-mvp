import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { visadoJV } from '@/lib/rrhh/queries/contratos'
import { renovacionVisadoJVSchema } from '@/lib/rrhh/schemas'

interface RouteParams {
  params: Promise<{ loteId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { loteId } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Validar con Zod
    const parsed = renovacionVisadoJVSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verificar que la decisión pertenece al lote
    const { data: decision } = await supabase
      .from('renovacion_decisiones')
      .select('id, lote_id')
      .eq('id', parsed.data.decision_id)
      .eq('lote_id', loteId)
      .single()

    if (!decision) {
      return NextResponse.json(
        { error: 'Decisión no encontrada en este lote' },
        { status: 404 }
      )
    }

    const { data, error } = await visadoJV(
      supabase,
      parsed.data.decision_id,
      parsed.data.decision,
      body.jv_id, // ID del JV que visa
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
