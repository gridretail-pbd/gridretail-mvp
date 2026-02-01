import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== API Arribos: POST ===')

  try {
    const body = await request.json()
    console.log('Body recibido:', body)

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('arribos')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Error insertando arribo:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('Arribo creado exitosamente:', data)
    return NextResponse.json({ success: true, arribo: data })
  } catch (error) {
    console.error('Error en API arribos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
