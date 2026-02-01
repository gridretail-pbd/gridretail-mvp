import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/usuarios/verificar-disponibilidad
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { campo, valor, excluir_id } = await request.json()

    if (!campo || !valor) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    if (!['codigo_asesor', 'dni', 'email'].includes(campo)) {
      return NextResponse.json({ error: 'Campo inválido' }, { status: 400 })
    }

    // Buscar por campo dinámico usando queries separadas para evitar deep type inference
    const { data } = excluir_id
      ? await supabase.from('usuarios').select('id').eq(campo as 'id', valor).neq('id', excluir_id).maybeSingle()
      : await supabase.from('usuarios').select('id').eq(campo as 'id', valor).maybeSingle()

    return NextResponse.json({
      disponible: !data,
      mensaje: data ? `Este ${campo === 'codigo_asesor' ? 'código' : campo} ya está en uso` : null,
    })
  } catch (error) {
    console.error('Error verificando disponibilidad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
