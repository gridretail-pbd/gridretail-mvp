import { createClient } from '@/lib/supabase/server'
import { Usuario } from '@/types'
import { cache } from 'react'

export const getCurrentUser = cache(async (): Promise<Usuario | null> => {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (error || !user) {
    return null
  }

  return user as Usuario
})

// Helper to determine role hierarchy level
export function getRoleLevel(rol: Usuario['rol']): number {
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

// Helper to check if user is admin
export function isAdmin(user: Usuario | null): boolean {
  return user?.rol === 'ADMIN'
}

// Helper to check if user is management (gerente or higher)
export function isManagement(user: Usuario | null): boolean {
  if (!user) return false
  return getRoleLevel(user.rol) >= getRoleLevel('JEFE_VENTAS')
}

// Helper to check if user is backoffice
export function isBackoffice(user: Usuario | null): boolean {
  if (!user) return false
  return ['BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA'].includes(user.rol)
}

// Helper to check if user can manage other users
export function canManageUsers(user: Usuario | null): boolean {
  if (!user) return false
  return getRoleLevel(user.rol) >= getRoleLevel('SUPERVISOR')
}

// Helper to check if user can see all tiendas
export function canSeeAllTiendas(user: Usuario | null): boolean {
  if (!user) return false
  return getRoleLevel(user.rol) >= getRoleLevel('SUPERVISOR') || user.zona === 'AMBAS'
}

export async function hasPermission(
  user: Usuario | null,
  requiredLevel: number
): Promise<boolean> {
  if (!user) return false
  return getRoleLevel(user.rol) >= requiredLevel
}

export async function canAccessTienda(
  user: Usuario | null,
  tiendaId: string
): Promise<boolean> {
  if (!user) return false

  // Admin and high-level management can access all tiendas
  if (canSeeAllTiendas(user)) return true

  // Check if user has access to this tienda via usuarios_tiendas
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuarios_tiendas')
    .select('tienda_id')
    .eq('usuario_id', user.id)
    .eq('tienda_id', tiendaId)
    .single()

  return !!data
}

export async function getUserTiendas(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuarios_tiendas')
    .select('tienda_id')
    .eq('usuario_id', userId)

  return data?.map((row) => row.tienda_id) || []
}

export async function signIn(codigo_asesor: string, password: string) {
  const bcrypt = require('bcryptjs')
  const supabase = await createClient()

  // First, check if user exists in usuarios table
  const { data: usuario, error: userError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('codigo_asesor', codigo_asesor)
    .eq('activo', true)
    .single()

  if (userError || !usuario) {
    return {
      error: 'Usuario no encontrado o inactivo',
      user: null,
    }
  }

  // Compare password with bcrypt
  const passwordMatch = await bcrypt.compare(password, usuario.password_hash)

  if (!passwordMatch) {
    return {
      error: 'Credenciales inválidas',
      user: null,
    }
  }

  // Create session in Supabase Auth (optional - for session management)
  // If you want to use Supabase session management, you need to create the user in auth.users
  // For now, we'll just return the user without creating a Supabase Auth session

  return {
    error: null,
    user: usuario as Usuario,
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

// Helper to get user-friendly role label
export function getRoleLabel(rol: Usuario['rol']): string {
  const labels = {
    ADMIN: 'Administrador',
    GERENTE_GENERAL: 'Gerente General',
    GERENTE_COMERCIAL: 'Gerente Comercial',
    JEFE_VENTAS: 'Jefe de Ventas',
    SUPERVISOR: 'Supervisor',
    COORDINADOR: 'Coordinador',
    ASESOR_REFERENTE: 'Asesor Referente',
    ASESOR: 'Asesor',
    VALIDADOR_ARRIBOS: 'Validador de Arribos',
    BACKOFFICE_AUDITORIA: 'Backoffice Auditoría',
    BACKOFFICE_RRHH: 'Backoffice RRHH',
    BACKOFFICE_OPERACIONES: 'Backoffice Operaciones',
  }
  return labels[rol] || rol
}
