import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeAccederTienda } from '@/lib/auth-server'
import { DEVICE_COOKIE, getDispositivoActual } from '@/lib/auth/device'
import { verifyPin, pinFormatoValido, PIN_MAX_INTENTOS, PIN_BLOQUEO_MINUTOS } from '@/lib/auth/pin'
import { setSessionCookie, setTiendaCookie, type SessionUsuario } from '@/lib/auth/session'

// POST /api/auth/pin-login — Login rápido por PIN sobre un equipo enrolado (Nivel 2).
export async function POST(request: NextRequest) {
  try {
    const { usuario_id, pin } = await request.json()
    if (!usuario_id || !pin) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabase = await createClient()

    const dispositivo = await getDispositivoActual(
      supabase,
      request.cookies.get(DEVICE_COOKIE)?.value
    )
    if (!dispositivo) {
      return NextResponse.json({ error: 'Dispositivo no enrolado' }, { status: 401 })
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select(
        'id, codigo_asesor, nombre_completo, rol, zona, pin_hash, pin_intentos_fallidos, pin_bloqueado_hasta, activo'
      )
      .eq('id', usuario_id)
      .eq('activo', true)
      .maybeSingle()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 401 })
    }

    // El usuario debe pertenecer a la tienda del dispositivo.
    const acceso = await puedeAccederTienda(
      supabase,
      { id: usuario.id, rol: usuario.rol },
      dispositivo.tienda_id
    )
    if (!acceso) {
      return NextResponse.json({ error: 'El usuario no pertenece a esta tienda' }, { status: 403 })
    }

    const ahora = Date.now()
    if (
      usuario.pin_bloqueado_hasta &&
      new Date(usuario.pin_bloqueado_hasta).getTime() > ahora
    ) {
      return NextResponse.json(
        { error: 'PIN bloqueado temporalmente. Usa "Olvidé mi PIN".', bloqueado: true },
        { status: 423 }
      )
    }

    if (!usuario.pin_hash) {
      return NextResponse.json(
        { error: 'PIN no configurado', need_pin_setup: true },
        { status: 409 }
      )
    }

    if (!pinFormatoValido(pin)) {
      return NextResponse.json({ error: 'Formato de PIN inválido' }, { status: 400 })
    }

    const ok = await verifyPin(pin, usuario.pin_hash)
    if (!ok) {
      const intentos = (usuario.pin_intentos_fallidos ?? 0) + 1
      const patch: Record<string, unknown> = { pin_intentos_fallidos: intentos }
      let restantes = PIN_MAX_INTENTOS - intentos
      if (intentos >= PIN_MAX_INTENTOS) {
        patch.pin_bloqueado_hasta = new Date(ahora + PIN_BLOQUEO_MINUTOS * 60_000).toISOString()
        patch.pin_intentos_fallidos = 0
        restantes = 0
      }
      await supabase.from('usuarios').update(patch).eq('id', usuario.id)
      return NextResponse.json(
        { error: 'PIN incorrecto', intentos_restantes: restantes },
        { status: 401 }
      )
    }

    // Éxito: limpiar contadores y abrir sesión corta + tienda derivada del dispositivo.
    await supabase
      .from('usuarios')
      .update({ pin_intentos_fallidos: 0, pin_bloqueado_hasta: null })
      .eq('id', usuario.id)

    const { data: tienda } = await supabase
      .from('tiendas')
      .select('id, codigo, nombre, zona')
      .eq('id', dispositivo.tienda_id)
      .maybeSingle()

    const sessionUser: SessionUsuario = {
      id: usuario.id,
      codigo_asesor: usuario.codigo_asesor,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      zona: usuario.zona,
    }

    const response = NextResponse.json({
      success: true,
      usuario: sessionUser,
      tienda: tienda ?? null,
    })
    setSessionCookie(response, sessionUser)
    if (tienda) setTiendaCookie(response, tienda)
    return response
  } catch (error) {
    console.error('Error en pin-login:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
