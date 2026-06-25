import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { puedeEnrolarDispositivo } from '@/lib/auth/roles'
import { DEVICE_COOKIE, getDispositivoActual } from '@/lib/auth/device'
import { clearUserCookies } from '@/lib/auth/session'

// POST /api/dispositivos/des-enrolar — Invalida el enrolamiento de este equipo.
// Step-up (Fase 0): exige credenciales de un supervisor/admin.
export async function POST(request: NextRequest) {
  try {
    const { codigo_asesor, password } = await request.json()
    if (!codigo_asesor || !password) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 })
    }

    const supabase = await createClient()

    const dispositivo = await getDispositivoActual(
      supabase,
      request.cookies.get(DEVICE_COOKIE)?.value
    )
    if (!dispositivo) {
      return NextResponse.json({ error: 'Este equipo no está enrolado' }, { status: 400 })
    }

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
        { error: 'Tu rol no está autorizado a des-enrolar dispositivos' },
        { status: 403 }
      )
    }

    await supabase.from('dispositivos').update({ activo: false }).eq('id', dispositivo.id)

    const response = NextResponse.json({ success: true })
    response.cookies.set(DEVICE_COOKIE, '', { maxAge: 0, path: '/' })
    clearUserCookies(response)
    return response
  } catch (error) {
    console.error('Error des-enrolando dispositivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
