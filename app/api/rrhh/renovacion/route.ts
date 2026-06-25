import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchLotesRenovacion, insertLoteRenovacion } from '@/lib/rrhh/queries/contratos'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const estado = searchParams.get('estado') || undefined

    const { data, error } = await fetchLotesRenovacion(supabase, { estado })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ lotes: data, total: data.length })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { periodo, fecha_limite_visado, generado_por } = body

    if (!periodo || !generado_por) {
      return NextResponse.json(
        { error: 'periodo y generado_por son requeridos' },
        { status: 400 }
      )
    }

    // Validar formato del periodo YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return NextResponse.json(
        { error: 'Formato de periodo inválido. Use YYYY-MM' },
        { status: 400 }
      )
    }

    const { data, error } = await insertLoteRenovacion(supabase, {
      periodo,
      fecha_limite_visado,
      generado_por,
    })

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
