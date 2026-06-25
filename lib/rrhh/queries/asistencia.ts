// lib/rrhh/queries/asistencia.ts
// Funciones de query para asistencia (marcaciones entrada/salida)
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asistencia } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const ASISTENCIA_SELECT = `
  *,
  usuario:usuarios_rrhh!asistencia_usuario_id_fkey(nombre_completo, dni, codigo_asesor),
  tienda:tiendas!asistencia_tienda_id_fkey(nombre, codigo)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosAsistencia {
  usuario_id?: string
  tienda_id?: string
  fecha_desde?: string
  fecha_hasta?: string
  fecha?: string // fecha exacta
  estado?: string
  tipo?: string
  search?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchAsistencia(
  supabase: SupabaseClient,
  filtros?: FiltrosAsistencia
): Promise<{ data: Asistencia[]; error: string | null }> {
  let query = supabase
    .from('asistencia')
    .select(ASISTENCIA_SELECT)
    .order('fecha', { ascending: false })
    .order('hora_servidor', { ascending: false })

  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }

  if (filtros?.tienda_id) {
    query = query.eq('tienda_id', filtros.tienda_id)
  }

  if (filtros?.fecha) {
    query = query.eq('fecha', filtros.fecha)
  } else {
    if (filtros?.fecha_desde) {
      query = query.gte('fecha', filtros.fecha_desde)
    }
    if (filtros?.fecha_hasta) {
      query = query.lte('fecha', filtros.fecha_hasta)
    }
  }

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  if (filtros?.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching asistencia:', error)
    return { data: [], error: error.message }
  }

  let result = (data as Asistencia[]) || []

  // Filtro de búsqueda post-fetch (nombre/DNI del usuario)
  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (a) =>
        a.usuario?.nombre_completo?.toLowerCase().includes(term) ||
        a.usuario?.codigo_asesor?.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Fetch por ID ──────────────────────────────────────────────────────────

export async function fetchAsistenciaById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: Asistencia | null; error: string | null }> {
  const { data, error } = await supabase
    .from('asistencia')
    .select(ASISTENCIA_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching asistencia:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Asistencia, error: null }
}

// ─── Insertar marcación ────────────────────────────────────────────────────

export async function insertAsistencia(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: Asistencia | null; error: string | null }> {
  const { data, error } = await supabase
    .from('asistencia')
    .insert(datos)
    .select(ASISTENCIA_SELECT)
    .single()

  if (error) {
    console.error('Error inserting asistencia:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Asistencia, error: null }
}

// ─── Actualizar (edición/justificación) ─────────────────────────────────

export async function updateAsistencia(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: Asistencia | null; error: string | null }> {
  const { data, error } = await supabase
    .from('asistencia')
    .update(datos)
    .eq('id', id)
    .select(ASISTENCIA_SELECT)
    .single()

  if (error) {
    console.error('Error updating asistencia:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Asistencia, error: null }
}
