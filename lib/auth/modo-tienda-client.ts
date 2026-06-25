'use client'

import { setTiendaActiva, type TiendaActiva } from '@/lib/auth-client'

/**
 * Cliente del flujo Modo Tienda (Fase 1). Envuelve los endpoints de Fase 0 y
 * sincroniza localStorage (`user` / `tienda_activa`) como hace el login tradicional.
 * Ver docs/SPEC_LOGIN_MODO_TIENDA.md.
 */

export interface RosterUsuario {
  id: string
  nombre_completo: string | null
  rol: string
  codigo_asesor: string | null
  foto_url: string | null
  tiene_pin: boolean
}

export interface RosterTienda {
  id: string
  codigo: string
  nombre: string
  zona: string | null
}

export interface RosterResponse {
  dispositivo: { id: string; tienda_id: string; nombre: string }
  tienda: RosterTienda | null
  usuarios: RosterUsuario[]
}

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || 'Error de servidor') as Error & {
      status?: number
      payload?: unknown
    }
    err.status = res.status
    err.payload = data
    throw err
  }
  return data
}

/** Roster de la tienda del dispositivo enrolado. 401 si el equipo no está enrolado. */
export async function fetchRoster(): Promise<RosterResponse> {
  return parse(await fetch('/api/dispositivos/roster', { cache: 'no-store' }))
}

/**
 * Login por PIN. En éxito persiste user + tienda en localStorage/cookies y
 * devuelve el usuario. Lanza Error con `.status`/`.payload` en fallo
 * (409 need_pin_setup, 423 bloqueado, 401 intentos_restantes).
 */
export async function pinLogin(
  usuario_id: string,
  pin: string
): Promise<{ usuario: { rol: string; nombre_completo: string | null }; tienda: TiendaActiva | null }> {
  const data = await parse(
    await fetch('/api/auth/pin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, pin }),
    })
  )

  if (data.usuario) {
    localStorage.setItem('user', JSON.stringify(data.usuario))
    // Marca la sesión como "modo tienda" (equipo compartido) para que el
    // dashboard active el banner de identidad y el auto-bloqueo por inactividad.
    localStorage.setItem('modo_tienda', '1')
  }
  if (data.tienda) {
    setTiendaActiva({
      id: data.tienda.id,
      codigo: data.tienda.codigo,
      nombre: data.tienda.nombre,
      zona: data.tienda.zona ?? '',
    })
  }
  return { usuario: data.usuario, tienda: data.tienda ?? null }
}

/** Cierra la sesión de usuario manteniendo el dispositivo (vuelve al roster). */
export async function bloquearSesion(): Promise<void> {
  await fetch('/api/auth/bloquear', { method: 'POST' })
  localStorage.removeItem('user')
  localStorage.removeItem('tienda_activa')
  localStorage.removeItem('modo_tienda')
}

/** Solicita OTP por WhatsApp para enrolar/resetear el PIN. */
export async function solicitarOtp(
  usuario_id: string,
  proposito: 'ENROLAR_PIN' | 'RESET_PIN'
): Promise<{ debug_codigo?: string }> {
  return parse(
    await fetch('/api/auth/pin/solicitar-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, proposito }),
    })
  )
}

/** Fija un nuevo PIN validando el OTP. */
export async function establecerPin(
  usuario_id: string,
  otp: string,
  pin: string
): Promise<void> {
  await parse(
    await fetch('/api/auth/pin/establecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, otp, pin }),
    })
  )
}
