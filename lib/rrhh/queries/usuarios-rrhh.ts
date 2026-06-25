// lib/rrhh/queries/usuarios-rrhh.ts
// Funciones de query para la tabla usuarios_rrhh
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UsuarioRRHH } from '@/lib/rrhh/interfaces'

// `usuario` = la cuenta de login enlazada (puede ser null: personal solo-RRHH).
// La identidad básica (nombre/dni/código) ahora vive en usuarios_rrhh.
const USUARIOS_RRHH_SELECT = `
  *,
  usuario:usuarios!usuarios_rrhh_usuario_id_fkey(id, codigo_asesor, nombre_completo, dni, rol, activo, zona),
  jefe_directo:usuarios!usuarios_rrhh_jefe_directo_id_fkey(nombre_completo)
`

export interface FiltrosUsuariosRRHH {
  status?: string[]
  area_funcional?: string
  search?: string
  jefe_directo_id?: string
}

export async function fetchUsuariosRRHH(
  supabase: SupabaseClient,
  filtros?: FiltrosUsuariosRRHH
): Promise<{ data: UsuarioRRHH[]; error: string | null }> {
  let query = supabase
    .from('usuarios_rrhh')
    .select(USUARIOS_RRHH_SELECT)
    .order('fecha_ingreso', { ascending: false })

  if (filtros?.status && filtros.status.length > 0) {
    query = query.in('status', filtros.status)
  }

  if (filtros?.area_funcional) {
    query = query.eq('area_funcional', filtros.area_funcional)
  }

  if (filtros?.jefe_directo_id) {
    query = query.eq('jefe_directo_id', filtros.jefe_directo_id)
  }

  if (filtros?.search) {
    // Buscar por la identidad propia de la ficha (incluye personal solo-RRHH)
    query = query.or(
      `nombre_completo.ilike.%${filtros.search}%,dni.ilike.%${filtros.search}%,codigo_asesor.ilike.%${filtros.search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching usuarios_rrhh:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as UsuarioRRHH[]) || [], error: null }
}

export async function fetchUsuarioRRHHById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: UsuarioRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('usuarios_rrhh')
    .select(USUARIOS_RRHH_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching usuario_rrhh:', error)
    return { data: null, error: error.message }
  }

  return { data: data as UsuarioRRHH, error: null }
}

export async function insertUsuarioRRHH(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: UsuarioRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('usuarios_rrhh')
    .insert(datos)
    .select(USUARIOS_RRHH_SELECT)
    .single()

  if (error) {
    console.error('Error inserting usuario_rrhh:', error)
    return { data: null, error: error.message }
  }

  return { data: data as UsuarioRRHH, error: null }
}

export async function updateUsuarioRRHH(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: UsuarioRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('usuarios_rrhh')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(USUARIOS_RRHH_SELECT)
    .single()

  if (error) {
    console.error('Error updating usuario_rrhh:', error)
    return { data: null, error: error.message }
  }

  return { data: data as UsuarioRRHH, error: null }
}
