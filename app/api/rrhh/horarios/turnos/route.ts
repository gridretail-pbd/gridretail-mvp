import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTurnos } from '@/lib/rrhh/queries/horarios'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await fetchTurnos(supabase)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ turnos: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
