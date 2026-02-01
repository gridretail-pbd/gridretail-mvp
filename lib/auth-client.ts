'use client'

import { Usuario } from '@/types'

// Interface para la tienda activa
export interface TiendaActiva {
  id: string
  codigo: string
  nombre: string
  zona: string
}

export function getUsuarioFromLocalStorage(): Usuario | null {
  if (typeof window === 'undefined') return null

  const userStr = localStorage.getItem('user')
  if (!userStr) return null

  try {
    return JSON.parse(userStr) as Usuario
  } catch {
    return null
  }
}

export function getTiendaActiva(): TiendaActiva | null {
  if (typeof window === 'undefined') return null

  const tiendaStr = localStorage.getItem('tienda_activa')
  if (!tiendaStr) return null

  try {
    return JSON.parse(tiendaStr) as TiendaActiva
  } catch {
    return null
  }
}

export function setTiendaActiva(tienda: TiendaActiva) {
  localStorage.setItem('tienda_activa', JSON.stringify(tienda))
  // También guardar en cookie para el middleware
  document.cookie = `tienda_activa=${JSON.stringify(tienda)}; path=/; max-age=${60 * 60 * 24 * 7}`
}

export function clearTiendaActiva() {
  localStorage.removeItem('tienda_activa')
  document.cookie = 'tienda_activa=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
}

export async function logout() {
  localStorage.removeItem('user')
  localStorage.removeItem('tienda_activa')

  // Eliminar cookies server-side para que el middleware no redirija a seleccionar-tienda
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Fallback: borrar client-side
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'tienda_activa=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }

  window.location.href = '/login'
}

// Role hierarchy helper
function getRoleLevel(rol: Usuario['rol']): number {
  const hierarchy = {
    ADMIN: 100,
    GERENTE_GENERAL: 90,
    GERENTE_COMERCIAL: 80,
    JEFE_VENTAS: 70,
    SUPERVISOR: 60,
    COORDINADOR: 50,
    ASESOR_REFERENTE: 40,
    ASESOR: 30,
    VALIDADOR_ARRIBOS: 25,
    BACKOFFICE_AUDITORIA: 20,
    BACKOFFICE_RRHH: 20,
    BACKOFFICE_OPERACIONES: 20,
  }
  return hierarchy[rol] || 0
}

// Helper to check if user can see all tiendas
export function canSeeAllTiendas(user: Usuario | null): boolean {
  if (!user) return false
  return getRoleLevel(user.rol) >= getRoleLevel('SUPERVISOR') || user.zona === 'AMBAS'
}
