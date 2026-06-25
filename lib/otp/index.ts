import crypto from 'crypto'

/**
 * OTP de un solo uso para enrolar/resetear PIN y step-up.
 * Ver docs/SPEC_LOGIN_MODO_TIENDA.md §6.4.
 *
 * FASE 0: el envío es un STUB que registra el código en consola. La Fase 3
 * reemplaza `enviarOtp` por el proveedor real (Twilio MVP → Meta Cloud API)
 * sin cambiar los endpoints que lo consumen.
 */

export const OTP_LENGTH = 6
export const OTP_VIGENCIA_MINUTOS = 10
export const OTP_MAX_INTENTOS = 5

export type OtpProposito = 'ENROLAR_PIN' | 'RESET_PIN' | 'STEP_UP'

/** Código numérico de 6 dígitos criptográficamente aleatorio. */
export function generarOtpCodigo(): string {
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH)
  return n.toString().padStart(OTP_LENGTH, '0')
}

export interface EnviarOtpParams {
  telefono: string
  codigo: string
  proposito: OtpProposito
  canal?: 'WHATSAPP' | 'SMS'
}

export async function enviarOtp(params: EnviarOtpParams): Promise<{ ok: boolean }> {
  // TODO (Fase 3): integrar proveedor real de WhatsApp/SMS.
  console.log(
    `[OTP STUB] canal=${params.canal ?? 'WHATSAPP'} -> ${params.telefono} ` +
      `proposito=${params.proposito} codigo=${params.codigo}`
  )
  return { ok: true }
}

/** En desarrollo se devuelve el código para facilitar pruebas sin proveedor real. */
export function debugCodigo(codigo: string): string | undefined {
  return process.env.NODE_ENV === 'production' ? undefined : codigo
}
