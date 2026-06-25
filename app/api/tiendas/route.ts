import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/tiendas — Catálogo de tiendas activas (id, codigo, nombre, zona).
// Usado por la pantalla de enrolamiento de dispositivos.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tiendas')
      .select('id, codigo, nombre, zona')
      .eq('activa', true)
      .order('nombre')

    if (error) {
      console.error('Error obteniendo tiendas:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ tiendas: data ?? [] })
  } catch (error) {
    console.error('Error interno en tiendas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
