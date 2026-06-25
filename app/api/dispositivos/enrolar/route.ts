import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { puedeAccederTienda } from '@/lib/auth-server'
import { puedeEnrolarDispositivo } from '@/lib/auth/roles'
import {
  DEVICE_COOKIE,
  DEVICE_TOKEN_MAX_AGE,
  generarDeviceToken,
  hashDeviceToken,
  buildDeviceCookieValue,
} from '@/lib/auth/device'

// POST /api/dispositivos/enrolar — Enrola este equipo a una tienda (Nivel 1).
// Requiere credenciales completas de un supervisor/admin asignado a la tienda.
export async function POST(request: NextRequest) {
  try {
    const { codigo_asesor, password, tienda_id, nombre } = await request.json()

    if (!codigo_asesor || !password || !tienda_id || !nombre) {
      return NextResponse.json({ error: 'Faltan datos para enrolar' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, rol, password_hash, activo')
      .eq('codigo_asesor', codigo_asesor)
      .eq('activo', true)
      .maybeSingle()

    if (!usuario || !usuario.password_hash) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, usuario.password_hash)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    if (!puedeEnrolarDispositivo(usuario.rol)) {
      return NextResponse.json(
        { error: 'Tu rol no está autorizado a enrolar dispositivos' },
        { status: 403 }
      )
    }

    const acceso = await puedeAccederTienda(supabase, { id: usuario.id, rol: usuario.rol }, tienda_id)
    if (!acceso) {
      return NextResponse.json({ error: 'No puedes enrolar un equipo en esa tienda' }, { status: 403 })
    }

    const rawToken = generarDeviceToken()
    const token_hash = await hashDeviceToken(rawToken)

    const { data: dispositivo, error } = await supabase
      .from('dispositivos')
      .insert({ tienda_id, nombre, token_hash, enrolado_por: usuario.id })
      .select('id, tienda_id, nombre')
      .single()

    if (error || !dispositivo) {
      console.error('Error insertando dispositivo:', error)
      return NextResponse.json({ error: error?.message ?? 'No se pudo enrolar' }, { status: 400 })
    }

    const response = NextResponse.json({ success: true, dispositivo })
    response.cookies.set(DEVICE_COOKIE, buildDeviceCookieValue(dispositivo.id, rawToken), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: DEVICE_TOKEN_MAX_AGE,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('Error enrolando dispositivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
