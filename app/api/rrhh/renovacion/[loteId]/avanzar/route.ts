import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { avanzarEstadoLote } from '@/lib/rrhh/queries/contratos'
import type { EstadoLote } from '@/lib/rrhh/types'

interface RouteParams {
  params: Promise<{ loteId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { loteId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { estado_destino } = body

    if (!estado_destino) {
      return NextResponse.json(
        { error: 'estado_destino es requerido' },
        { status: 400 }
      )
    }

    const { data, error } = await avanzarEstadoLote(
      supabase,
      loteId,
      estado_destino as EstadoLote
    )

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, lote: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
