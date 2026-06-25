// lib/rrhh/queries/importacion.ts
// Funciones de query para importaciones RRHH
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportacionRRHH } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const IMPORTACIONES_SELECT = `
  *,
  ejecutado_por_usuario:usuarios!importaciones_rrhh_ejecutado_por_fkey(nombre_completo)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosImportaciones {
  estado?: string
  search?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchImportaciones(
  supabase: SupabaseClient,
  filtros?: FiltrosImportaciones
): Promise<{ data: ImportacionRRHH[]; error: string | null }> {
  let query = supabase
    .from('importaciones_rrhh')
    .select(IMPORTACIONES_SELECT)
    .order('created_at', { ascending: false })

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching importaciones:', error)
    return { data: [], error: error.message }
  }

  let result = (data as ImportacionRRHH[]) || []

  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (i) => i.archivo_nombre.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Fetch por ID ──────────────────────────────────────────────────────────

export async function fetchImportacionById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: ImportacionRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('importaciones_rrhh')
    .select(IMPORTACIONES_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching importacion:', error)
    return { data: null, error: error.message }
  }

  return { data: data as ImportacionRRHH, error: null }
}

// ─── Insertar ──────────────────────────────────────────────────────────────

export async function insertImportacion(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: ImportacionRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('importaciones_rrhh')
    .insert(datos)
    .select(IMPORTACIONES_SELECT)
    .single()

  if (error) {
    console.error('Error inserting importacion:', error)
    return { data: null, error: error.message }
  }

  return { data: data as ImportacionRRHH, error: null }
}

// ─── Actualizar ────────────────────────────────────────────────────────────

export async function updateImportacion(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: ImportacionRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('importaciones_rrhh')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(IMPORTACIONES_SELECT)
    .single()

  if (error) {
    console.error('Error updating importacion:', error)
    return { data: null, error: error.message }
  }

  return { data: data as ImportacionRRHH, error: null }
}
