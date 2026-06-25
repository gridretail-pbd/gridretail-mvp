import { NextResponse } from 'next/server'
import { clearUserCookies } from '@/lib/auth/session'

// POST /api/auth/bloquear — Cierra la sesión de usuario MANTENIENDO el dispositivo
// enrolado (botón "Cambiar usuario" / auto-bloqueo por inactividad).
export async function POST() {
  const response = NextResponse.json({ success: true })
  clearUserCookies(response)
  return response
}
