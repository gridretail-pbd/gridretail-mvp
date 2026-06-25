import type { NextResponse } from 'next/server'

/**
 * Sesión de USUARIO (Nivel 2). Cookie httpOnly `session` corta + `tienda_activa`
 * derivada del dispositivo. Ver docs/SPEC_LOGIN_MODO_TIENDA.md §5.
 *
 * El login tradicional (app/api/auth/login) mantiene su cookie de 7 días; estos
 * helpers se usan en el flujo de Modo Tienda (login por PIN), con duración corta.
 */

export const SESSION_COOKIE = 'session'
export const TIENDA_COOKIE = 'tienda_activa'
export const SESSION_MAX_AGE = 60 * 60 * 12 // 12 h (un turno)

export interface SessionUsuario {
  id: string
  codigo_asesor: string | null
  nombre_completo: string | null
  rol: string
  zona: string | null
}

export interface TiendaCookieData {
  id: string
  codigo: string
  nombre: string
  zona: string | null
}

export function setSessionCookie(response: NextResponse, u: SessionUsuario) {
  response.cookies.set(
    SESSION_COOKIE,
    JSON.stringify({
      id: u.id,
      codigo_asesor: u.codigo_asesor,
      nombre_completo: u.nombre_completo,
      rol: u.rol,
      zona: u.zona,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
    }
  )
}

/** `tienda_activa` se deja legible (no httpOnly) para coherencia con el flujo actual. */
export function setTiendaCookie(response: NextResponse, tienda: TiendaCookieData) {
  response.cookies.set(TIENDA_COOKIE, JSON.stringify(tienda), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
  })
}

/** Limpia la sesión de usuario manteniendo el `device_token` (botón "Cambiar usuario"). */
export function clearUserCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
  response.cookies.set(TIENDA_COOKIE, '', { maxAge: 0, path: '/' })
}
