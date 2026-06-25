import bcrypt from 'bcryptjs'

/**
 * Credencial de acceso rápido (Nivel 2) — PIN de 6 dígitos.
 * Bloqueo tras PIN_MAX_INTENTOS fallidos durante PIN_BLOQUEO_MINUTOS.
 * Ver docs/SPEC_LOGIN_MODO_TIENDA.md §8.
 */

export const PIN_LENGTH = 6
export const PIN_MAX_INTENTOS = 5
export const PIN_BLOQUEO_MINUTOS = 15

const PIN_REGEX = new RegExp(`^\\d{${PIN_LENGTH}}$`)

export function pinFormatoValido(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_REGEX.test(pin)
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(pin, hash)
}
