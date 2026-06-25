// lib/rrhh/queries/horarios.ts
// Funciones de query para horarios_tienda, turnos y asignacion_turnos
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { HorarioTienda, Turno, AsignacionTurno } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const ASIGNACION_SELECT = `
  *,
  usuario:usuarios_rrhh!asignacion_turnos_usuario_id_fkey(nombre_completo, codigo_asesor),
  tienda:tiendas!asignacion_turnos_tienda_id_fkey(nombre),
  turno:turnos!asignacion_turnos_turno_id_fkey(*)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosAsignacion {
  tienda_id?: string
  usuario_id?: string
  fecha_desde?: string
  fecha_hasta?: string
}

// ─── Horarios Tienda ───────────────────────────────────────────────────────

export async function fetchHorariosTienda(
  supabase: SupabaseClient,
  tiendaId: string
): Promise<{ data: HorarioTienda[]; error: string | null }> {
  const { data, error } = await supabase
    .from('horarios_tienda')
    .select('*')
    .eq('tienda_id', tiendaId)
    .order('dia_semana', { ascending: true })

  if (error) {
    console.error('Error fetching horarios tienda:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as HorarioTienda[]) || [], error: null }
}

export async function upsertHorarioTienda(
  supabase: SupabaseClient,
  datos: {
    tienda_id: string
    dia_semana: number
    hora_apertura: string
    hora_cierre: string
    activo: boolean
  }
): Promise<{ data: HorarioTienda | null; error: string | null }> {
  const { data, error } = await supabase
    .from('horarios_tienda')
    .upsert(
      { ...datos, updated_at: new Date().toISOString() },
      { onConflict: 'tienda_id,dia_semana' }
    )
    .select('*')
    .single()

  if (error) {
    console.error('Error upserting horario:', error)
    return { data: null, error: error.message }
  }

  return { data: data as HorarioTienda, error: null }
}

// ─── Turnos (catálogo) ────────────────────────────────────────────────────

export async function fetchTurnos(
  supabase: SupabaseClient
): Promise<{ data: Turno[]; error: string | null }> {
  const { data, error } = await supabase
    .from('turnos')
    .select('*')
    .eq('activo', true)
    .order('codigo', { ascending: true })

  if (error) {
    console.error('Error fetching turnos:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as Turno[]) || [], error: null }
}

// ─── Asignación de Turnos ─────────────────────────────────────────────────

export async function fetchAsignacionTurnos(
  supabase: SupabaseClient,
  filtros?: FiltrosAsignacion
): Promise<{ data: AsignacionTurno[]; error: string | null }> {
  let query = supabase
    .from('asignacion_turnos')
    .select(ASIGNACION_SELECT)
    .order('fecha', { ascending: true })

  if (filtros?.tienda_id) {
    query = query.eq('tienda_id', filtros.tienda_id)
  }

  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }

  if (filtros?.fecha_desde) {
    query = query.gte('fecha', filtros.fecha_desde)
  }

  if (filtros?.fecha_hasta) {
    query = query.lte('fecha', filtros.fecha_hasta)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching asignacion turnos:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as AsignacionTurno[]) || [], error: null }
}

export async function insertAsignacionTurno(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: AsignacionTurno | null; error: string | null }> {
  const { data, error } = await supabase
    .from('asignacion_turnos')
    .insert(datos)
    .select(ASIGNACION_SELECT)
    .single()

  if (error) {
    console.error('Error inserting asignacion turno:', error)
    return { data: null, error: error.message }
  }

  return { data: data as AsignacionTurno, error: null }
}

export async function insertAsignacionTurnosBulk(
  supabase: SupabaseClient,
  datos: Record<string, unknown>[]
): Promise<{ data: AsignacionTurno[]; error: string | null }> {
  const { data, error } = await supabase
    .from('asignacion_turnos')
    .upsert(datos, { onConflict: 'usuario_id,fecha' })
    .select(ASIGNACION_SELECT)

  if (error) {
    console.error('Error bulk inserting asignacion turnos:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as AsignacionTurno[]) || [], error: null }
}

export async function updateAsignacionTurno(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: AsignacionTurno | null; error: string | null }> {
  const { data, error } = await supabase
    .from('asignacion_turnos')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ASIGNACION_SELECT)
    .single()

  if (error) {
    console.error('Error updating asignacion turno:', error)
    return { data: null, error: error.message }
  }

  return { data: data as AsignacionTurno, error: null }
}

export async function deleteAsignacionTurno(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('asignacion_turnos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting asignacion turno:', error)
    return { error: error.message }
  }

  return { error: null }
}
