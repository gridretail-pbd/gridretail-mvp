import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual, puedeAccederTienda } from '@/lib/auth-server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/arribos/[id]?usuario_id=...
 *
 * Relee un arribo por id para el Camino A (el form de venta navega a una página
 * nueva con ?arribo_id=... y pierde el estado, por lo que necesita refetch).
 * La identidad del solicitante viaja como query param `usuario_id` (patrón del
 * repo: no hay sesión Supabase).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const usuarioId = new URL(request.url).searchParams.get('usuario_id')

    const supabase = await createClient()

    const usuario = await getUsuarioActual(supabase, usuarioId)
    if (!usuario) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: arribo, error } = await supabase
      .from('arribos')
      .select(
        'id, tienda_id, fecha, hora, tipo_visita, resultado, tipo_documento_cliente, dni_cliente, nombre_cliente, es_cliente_entel, usuario_id'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!arribo) {
      return NextResponse.json({ error: 'Arribo no encontrado' }, { status: 404 })
    }

    if (!(await puedeAccederTienda(supabase, usuario, arribo.tienda_id))) {
      return NextResponse.json(
        { error: 'Sin acceso a la tienda del arribo' },
        { status: 403 }
      )
    }

    return NextResponse.json({ arribo })
  } catch (error) {
    console.error('Error en API arribos/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
