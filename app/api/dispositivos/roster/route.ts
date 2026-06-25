import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEVICE_COOKIE, getDispositivoActual } from '@/lib/auth/device'

interface RosterUsuarioRow {
  id: string
  nombre_completo: string | null
  rol: string
  codigo_asesor: string | null
  foto_url: string | null
  pin_hash: string | null
  activo: boolean
}

// GET /api/dispositivos/roster — Usuarios asignados a la tienda del dispositivo.
// Nunca expone pin_hash; sólo `tiene_pin`.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const dispositivo = await getDispositivoActual(
      supabase,
      request.cookies.get(DEVICE_COOKIE)?.value
    )
    if (!dispositivo) {
      return NextResponse.json({ error: 'Dispositivo no enrolado' }, { status: 401 })
    }

    const { data: tienda } = await supabase
      .from('tiendas')
      .select('id, codigo, nombre, zona')
      .eq('id', dispositivo.tienda_id)
      .maybeSingle()

    const { data: rows, error } = await supabase
      .from('usuarios_tiendas')
      .select(
        'usuario:usuarios!inner(id, nombre_completo, rol, codigo_asesor, foto_url, pin_hash, activo)'
      )
      .eq('tienda_id', dispositivo.tienda_id)

    if (error) {
      console.error('Error obteniendo roster:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const usuarios = (rows ?? [])
      .map((r) => (r as unknown as { usuario: RosterUsuarioRow }).usuario)
      .filter((u) => u && u.activo)
      .map((u) => ({
        id: u.id,
        nombre_completo: u.nombre_completo,
        rol: u.rol,
        codigo_asesor: u.codigo_asesor,
        foto_url: u.foto_url,
        tiene_pin: !!u.pin_hash,
      }))

    return NextResponse.json({ dispositivo, tienda: tienda ?? null, usuarios })
  } catch (error) {
    console.error('Error interno en roster:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
