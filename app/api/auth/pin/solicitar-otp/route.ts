import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import {
  generarOtpCodigo,
  enviarOtp,
  debugCodigo,
  OTP_VIGENCIA_MINUTOS,
  type OtpProposito,
} from '@/lib/otp'

// POST /api/auth/pin/solicitar-otp — Envía un OTP por WhatsApp para enrolar/resetear el PIN.
export async function POST(request: NextRequest) {
  try {
    const { usuario_id, proposito } = await request.json()
    if (!usuario_id) {
      return NextResponse.json({ error: 'Falta usuario_id' }, { status: 400 })
    }
    const prop: OtpProposito = proposito === 'RESET_PIN' ? 'RESET_PIN' : 'ENROLAR_PIN'

    const supabase = await createClient()

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, activo')
      .eq('id', usuario_id)
      .eq('activo', true)
      .maybeSingle()
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // La ficha se enlaza a la cuenta por usuario_id (migración 033). Teléfono OTP.
    const { data: rrhh } = await supabase
      .from('usuarios_rrhh')
      .select('telefono_personal')
      .eq('usuario_id', usuario_id)
      .maybeSingle()

    const telefono = rrhh?.telefono_personal
    if (!telefono) {
      return NextResponse.json(
        { error: 'El usuario no tiene teléfono registrado para recibir el código' },
        { status: 422 }
      )
    }

    // Invalida OTPs previos no usados del mismo propósito.
    await supabase
      .from('otp_codes')
      .update({ usado_at: new Date().toISOString() })
      .eq('usuario_id', usuario_id)
      .eq('proposito', prop)
      .is('usado_at', null)

    const codigo = generarOtpCodigo()
    const code_hash = await bcrypt.hash(codigo, 10)
    const vence_at = new Date(Date.now() + OTP_VIGENCIA_MINUTOS * 60_000).toISOString()

    const { error } = await supabase
      .from('otp_codes')
      .insert({ usuario_id, code_hash, proposito: prop, vence_at })
    if (error) {
      console.error('Error guardando OTP:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await enviarOtp({ telefono, codigo, proposito: prop })

    return NextResponse.json({ success: true, debug_codigo: debugCodigo(codigo) })
  } catch (error) {
    console.error('Error solicitando OTP:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
