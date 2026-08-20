import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { puedeAccederTienda } from '@/lib/auth-server'
import { puedeEnrolarDispositivo } from '@/lib/auth/roles'
import { DEVICE_COOKIE, getDispositivoActual } from '@/lib/auth/device'
import { hashPin, pinFormatoValido } from '@/lib/auth/pin'

// POST /api/auth/pin/establecer-supervisor
// Fija el PIN de un asesor con AUTORIZACIÓN de un supervisor/admin presente
// (step-up con sus credenciales), sin depender del OTP de WhatsApp.
// Ver docs/SPEC_LOGIN_MODO_TIENDA.md (camino interino mientras Fase 3).
export async function POST(request: NextRequest) {
  try {
    const { usuario_id, pin, supervisor_codigo, supervisor_password } = await request.json()

    if (!usuario_id || !pin || !supervisor_codigo || !supervisor_password) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
    if (!pinFormatoValido(pin)) {
      return NextResponse.json({ error: 'El PIN debe tener 6 dígitos' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1) Validar al supervisor/admin
    const { data: sup } = await supabase
      .from('usuarios')
      .select('id, rol, password_hash, activo')
      .eq('codigo_asesor', supervisor_codigo)
      .eq('activo', true)
      .maybeSingle()

    if (!sup || !sup.password_hash) {
      return NextResponse.json({ error: 'Credenciales de supervisor inválidas' }, { status: 401 })
    }
    const passwordOk = await bcrypt.compare(supervisor_password, sup.password_hash)
    if (!passwordOk) {
      return NextResponse.json({ error: 'Credenciales de supervisor inválidas' }, { status: 401 })
    }
    if (!puedeEnrolarDispositivo(sup.rol)) {
      return NextResponse.json(
        { error: 'Tu rol no está autorizado a configurar PINs' },
        { status: 403 }
      )
    }

    // 2) El asesor objetivo debe existir y, si el equipo está enrolado,
    //    pertenecer a la tienda del dispositivo.
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', usuario_id)
      .eq('activo', true)
      .maybeSingle()
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 404 })
    }

    const dispositivo = await getDispositivoActual(
      supabase,
      request.cookies.get(DEVICE_COOKIE)?.value
    )
    if (dispositivo) {
      // El supervisor que autoriza debe poder operar en la tienda del equipo
      // (admins/gerencias pasan por ser rol sin tienda).
      const supAccede = await puedeAccederTienda(
        supabase,
        { id: sup.id, rol: sup.rol },
        dispositivo.tienda_id
      )
      if (!supAccede) {
        return NextResponse.json(
          { error: 'No puedes autorizar PINs en esta tienda' },
          { status: 403 }
        )
      }
      const pertenece = await puedeAccederTienda(
        supabase,
        { id: usuario.id, rol: usuario.rol },
        dispositivo.tienda_id
      )
      if (!pertenece) {
        return NextResponse.json(
          { error: 'El usuario no pertenece a esta tienda' },
          { status: 403 }
        )
      }
    }

    // 3) Fijar el PIN
    const pin_hash = await hashPin(pin)
    const { error } = await supabase
      .from('usuarios')
      .update({
        pin_hash,
        pin_actualizado_at: new Date().toISOString(),
        pin_intentos_fallidos: 0,
        pin_bloqueado_hasta: null,
      })
      .eq('id', usuario_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error estableciendo PIN (supervisor):', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
