import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { hashPin, pinFormatoValido } from '@/lib/auth/pin'
import { OTP_MAX_INTENTOS } from '@/lib/otp'

// POST /api/auth/pin/establecer — Fija un nuevo PIN validando el OTP recibido.
export async function POST(request: NextRequest) {
  try {
    const { usuario_id, otp, pin } = await request.json()
    if (!usuario_id || !otp || !pin) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
    if (!pinFormatoValido(pin)) {
      return NextResponse.json({ error: 'El PIN debe tener 6 dígitos' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: code } = await supabase
      .from('otp_codes')
      .select('id, code_hash, vence_at, usado_at, intentos')
      .eq('usuario_id', usuario_id)
      .in('proposito', ['ENROLAR_PIN', 'RESET_PIN'])
      .is('usado_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!code) {
      return NextResponse.json(
        { error: 'No hay un código vigente. Solicítalo de nuevo.' },
        { status: 400 }
      )
    }
    if (new Date(code.vence_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'El código expiró. Solicítalo de nuevo.' }, { status: 400 })
    }
    if ((code.intentos ?? 0) >= OTP_MAX_INTENTOS) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Solicita un nuevo código.' },
        { status: 429 }
      )
    }

    const ok = await bcrypt.compare(String(otp), code.code_hash)
    if (!ok) {
      await supabase
        .from('otp_codes')
        .update({ intentos: (code.intentos ?? 0) + 1 })
        .eq('id', code.id)
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
    }

    const pin_hash = await hashPin(pin)
    const nowIso = new Date().toISOString()

    await supabase
      .from('usuarios')
      .update({
        pin_hash,
        pin_actualizado_at: nowIso,
        pin_intentos_fallidos: 0,
        pin_bloqueado_hasta: null,
      })
      .eq('id', usuario_id)

    await supabase.from('otp_codes').update({ usado_at: nowIso }).eq('id', code.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error estableciendo PIN:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
