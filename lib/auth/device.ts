import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Sesión de DISPOSITIVO (Nivel 1) — ver docs/SPEC_LOGIN_MODO_TIENDA.md.
 *
 * Un equipo se enrola una vez a una tienda. El token crudo se entrega al cliente
 * en la cookie httpOnly `device_token` con el formato `${deviceId}.${rawToken}`;
 * en BD sólo se guarda el hash bcrypt del token. La validación recarga la fila
 * autoritativa de `dispositivos` y compara el hash.
 */

export const DEVICE_COOKIE = 'device_token'
export const DEVICE_TOKEN_MAX_AGE = 60 * 60 * 24 * 90 // 90 días

export interface DispositivoActual {
  id: string
  tienda_id: string
  nombre: string
}

/** Token crudo aleatorio. Se entrega al cliente una sola vez (no se persiste). */
export function generarDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function hashDeviceToken(rawToken: string): Promise<string> {
  return bcrypt.hash(rawToken, 10)
}

/** Valor de la cookie: `${deviceId}.${rawToken}` (el UUID y el hex no contienen '.'). */
export function buildDeviceCookieValue(deviceId: string, rawToken: string): string {
  return `${deviceId}.${rawToken}`
}

export function parseDeviceCookieValue(
  value: string | undefined | null
): { deviceId: string; rawToken: string } | null {
  if (!value) return null
  const idx = value.indexOf('.')
  if (idx <= 0 || idx === value.length - 1) return null
  return { deviceId: value.slice(0, idx), rawToken: value.slice(idx + 1) }
}

/**
 * Valida la cookie de dispositivo contra la BD.
 * Devuelve el dispositivo activo o null (las rutas deben responder 401).
 */
export async function getDispositivoActual(
  supabase: SupabaseServerClient,
  cookieValue: string | undefined | null
): Promise<DispositivoActual | null> {
  const parsed = parseDeviceCookieValue(cookieValue)
  if (!parsed) return null

  const { data } = await supabase
    .from('dispositivos')
    .select('id, tienda_id, nombre, token_hash, activo')
    .eq('id', parsed.deviceId)
    .eq('activo', true)
    .maybeSingle()

  if (!data) return null

  const ok = await bcrypt.compare(parsed.rawToken, (data as { token_hash: string }).token_hash)
  if (!ok) return null

  // Best-effort: marca actividad reciente (no bloquea la respuesta).
  void supabase
    .from('dispositivos')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)

  return { id: data.id, tienda_id: data.tienda_id, nombre: data.nombre }
}
