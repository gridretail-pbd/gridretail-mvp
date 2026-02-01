import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Registrando venta:', body)

    const supabase = await createClient()

    // Verificar que orden_venta no exista
    const { data: existingVenta } = await supabase
      .from('ventas')
      .select('id')
      .eq('orden_venta', body.orden_venta)
      .single()

    if (existingVenta) {
      return NextResponse.json(
        { error: 'La orden de venta ya existe' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('ventas')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Error al guardar venta:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, venta: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
