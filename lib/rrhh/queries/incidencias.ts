// lib/rrhh/queries/incidencias.ts
// Funciones de query para incidencias laborales
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { IncidenciaLaboral } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const INCIDENCIAS_SELECT = `
  *,
  usuario:usuarios_rrhh!incidencias_laborales_usuario_id_fkey(nombre_completo, dni, codigo_asesor)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosIncidencias {
  usuario_id?: string
  tipo?: string
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchIncidencias(
  supabase: SupabaseClient,
  filtros?: FiltrosIncidencias
): Promise<{ data: IncidenciaLaboral[]; error: string | null }> {
  let query = supabase
    .from('incidencias_laborales')
    .select(INCIDENCIAS_SELECT)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }

  if (filtros?.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  if (filtros?.fecha_desde) {
    query = query.gte('fecha', filtros.fecha_desde)
  }

  if (filtros?.fecha_hasta) {
    query = query.lte('fecha', filtros.fecha_hasta)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching incidencias:', error)
    return { data: [], error: error.message }
  }

  let result = (data as IncidenciaLaboral[]) || []

  // Filtro de búsqueda post-fetch (nombre/DNI del usuario)
  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (i) =>
        i.usuario?.nombre_completo?.toLowerCase().includes(term) ||
        i.usuario?.codigo_asesor?.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Fetch por ID ──────────────────────────────────────────────────────────

export async function fetchIncidenciaById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: IncidenciaLaboral | null; error: string | null }> {
  const { data, error } = await supabase
    .from('incidencias_laborales')
    .select(INCIDENCIAS_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching incidencia:', error)
    return { data: null, error: error.message }
  }

  return { data: data as IncidenciaLaboral, error: null }
}

// ─── Insertar ──────────────────────────────────────────────────────────────

export async function insertIncidencia(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: IncidenciaLaboral | null; error: string | null }> {
  const { data, error } = await supabase
    .from('incidencias_laborales')
    .insert(datos)
    .select(INCIDENCIAS_SELECT)
    .single()

  if (error) {
    console.error('Error inserting incidencia:', error)
    return { data: null, error: error.message }
  }

  return { data: data as IncidenciaLaboral, error: null }
}

// ─── Actualizar (descargo, resolución, estado) ─────────────────────────

export async function updateIncidencia(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: IncidenciaLaboral | null; error: string | null }> {
  const { data, error } = await supabase
    .from('incidencias_laborales')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(INCIDENCIAS_SELECT)
    .single()

  if (error) {
    console.error('Error updating incidencia:', error)
    return { data: null, error: error.message }
  }

  return { data: data as IncidenciaLaboral, error: null }
}
