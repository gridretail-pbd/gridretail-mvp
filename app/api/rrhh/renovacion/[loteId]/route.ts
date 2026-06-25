import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchLoteById } from '@/lib/rrhh/queries/contratos'

interface RouteParams {
  params: Promise<{ loteId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { loteId } = await params
    const supabase = await createClient()

    const { data, error } = await fetchLoteById(supabase, loteId)

    if (error || !data) {
      return NextResponse.json(
        { error: 'Lote no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ lote: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
