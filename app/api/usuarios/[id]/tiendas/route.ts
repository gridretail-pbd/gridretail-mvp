import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const supabase = await createClient()

    // Obtener usuario para ver su rol
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('Error obteniendo usuario:', userError)
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Si es ADMIN, retornar todas las tiendas activas
    if (usuario?.rol === 'ADMIN') {
      const { data: tiendas, error } = await supabase
        .from('tiendas')
        .select('id, codigo, nombre, zona')
        .eq('activa', true)
        .order('nombre')

      if (error) {
        console.error('Error obteniendo tiendas:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ tiendas: tiendas || [] })
    }

    // Si no es ADMIN, obtener tiendas asignadas via usuarios_tiendas
    const { data: asignaciones, error } = await supabase
      .from('usuarios_tiendas')
      .select(`
        tienda_id,
        tiendas (
          id,
          codigo,
          nombre,
          zona
        )
      `)
      .eq('usuario_id', userId)

    if (error) {
      console.error('Error obteniendo tiendas asignadas:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Extraer tiendas del resultado (filtrando nulls)
    // Supabase returns tiendas as a single object due to many-to-one relationship
    const tiendas = asignaciones
      ?.map((a) => a.tiendas as unknown as { id: string; codigo: string; nombre: string; zona: string } | null)
      .filter((t) => t !== null)
      || []

    return NextResponse.json({ tiendas })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT /api/usuarios/[id]/tiendas — Reemplazar asignaciones de tiendas
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const supabase = await createClient()
    const { tiendas } = await request.json()

    if (!tiendas || !Array.isArray(tiendas) || tiendas.length === 0) {
      return NextResponse.json(
        { error: 'Debe asignar al menos una tienda' },
        { status: 400 }
      )
    }

    // Eliminar asignaciones existentes
    await supabase.from('usuarios_tiendas').delete().eq('usuario_id', userId)

    // Insertar nuevas
    const rows = tiendas.map((t: any) => ({
      usuario_id: userId,
      tienda_id: t.tienda_id,
      es_principal: t.es_principal || false,
    }))

    const { error } = await supabase.from('usuarios_tiendas').insert(rows)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizando tiendas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
