// lib/rrhh/queries/movimientos.ts
// Funciones de query para movimientos de personal
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MovimientoPersonal } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const MOVIMIENTOS_SELECT = `
  *,
  usuario:usuarios_rrhh!movimientos_personal_usuario_id_fkey(nombre_completo, dni, codigo_asesor),
  tienda_origen:tiendas!movimientos_personal_tienda_origen_id_fkey(nombre),
  tienda_destino:tiendas!movimientos_personal_tienda_destino_id_fkey(nombre)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosMovimientos {
  usuario_id?: string
  tipo_movimiento?: string
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchMovimientos(
  supabase: SupabaseClient,
  filtros?: FiltrosMovimientos
): Promise<{ data: MovimientoPersonal[]; error: string | null }> {
  let query = supabase
    .from('movimientos_personal')
    .select(MOVIMIENTOS_SELECT)
    .order('fecha_efectiva', { ascending: false })
    .order('created_at', { ascending: false })

  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }

  if (filtros?.tipo_movimiento) {
    query = query.eq('tipo_movimiento', filtros.tipo_movimiento)
  }

  if (filtros?.fecha_desde) {
    query = query.gte('fecha_efectiva', filtros.fecha_desde)
  }

  if (filtros?.fecha_hasta) {
    query = query.lte('fecha_efectiva', filtros.fecha_hasta)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching movimientos:', error)
    return { data: [], error: error.message }
  }

  let result = (data as MovimientoPersonal[]) || []

  // Filtro de búsqueda post-fetch (nombre/código del usuario)
  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (m) =>
        m.usuario?.nombre_completo?.toLowerCase().includes(term) ||
        m.usuario?.codigo_asesor?.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Fetch por ID ──────────────────────────────────────────────────────────

export async function fetchMovimientoById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: MovimientoPersonal | null; error: string | null }> {
  const { data, error } = await supabase
    .from('movimientos_personal')
    .select(MOVIMIENTOS_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching movimiento:', error)
    return { data: null, error: error.message }
  }

  return { data: data as MovimientoPersonal, error: null }
}

// ─── Insertar ──────────────────────────────────────────────────────────────

export async function insertMovimiento(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: MovimientoPersonal | null; error: string | null }> {
  const { data, error } = await supabase
    .from('movimientos_personal')
    .insert(datos)
    .select(MOVIMIENTOS_SELECT)
    .single()

  if (error) {
    console.error('Error inserting movimiento:', error)
    return { data: null, error: error.message }
  }

  return { data: data as MovimientoPersonal, error: null }
}
