import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAlertas } from '@/lib/rrhh/queries/alertas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchAlertas(supabase, {
      tipo: searchParams.get('tipo') || undefined,
      nivel: searchParams.get('nivel') || undefined,
      estado: searchParams.get('estado') || undefined,
      destinatario_id: searchParams.get('destinatario_id') || undefined,
      destinatario_rol: searchParams.get('destinatario_rol') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ alertas: data, total: data.length })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
