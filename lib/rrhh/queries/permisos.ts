// lib/rrhh/queries/permisos.ts
// Funciones de query para solicitudes de permiso y vacaciones
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SolicitudPermiso } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const PERMISOS_SELECT = `
  *,
  usuario:usuarios_rrhh!solicitudes_permiso_usuario_id_fkey(nombre_completo, dni, codigo_asesor)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosPermisos {
  usuario_id?: string
  tipo?: string
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchPermisos(
  supabase: SupabaseClient,
  filtros?: FiltrosPermisos
): Promise<{ data: SolicitudPermiso[]; error: string | null }> {
  let query = supabase
    .from('solicitudes_permiso')
    .select(PERMISOS_SELECT)
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
    query = query.gte('fecha_inicio', filtros.fecha_desde)
  }

  if (filtros?.fecha_hasta) {
    query = query.lte('fecha_fin', filtros.fecha_hasta)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching permisos:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as SolicitudPermiso[]) || [], error: null }
}

// ─── Fetch por ID ──────────────────────────────────────────────────────────

export async function fetchPermisoById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: SolicitudPermiso | null; error: string | null }> {
  const { data, error } = await supabase
    .from('solicitudes_permiso')
    .select(PERMISOS_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching permiso:', error)
    return { data: null, error: error.message }
  }

  return { data: data as SolicitudPermiso, error: null }
}

// ─── Insertar ──────────────────────────────────────────────────────────────

export async function insertPermiso(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: SolicitudPermiso | null; error: string | null }> {
  const { data, error } = await supabase
    .from('solicitudes_permiso')
    .insert(datos)
    .select(PERMISOS_SELECT)
    .single()

  if (error) {
    console.error('Error inserting permiso:', error)
    return { data: null, error: error.message }
  }

  return { data: data as SolicitudPermiso, error: null }
}

// ─── Aprobar / Rechazar ────────────────────────────────────────────────────

export async function aprobarRechazarPermiso(
  supabase: SupabaseClient,
  id: string,
  aprobado: boolean,
  aprobadoPor: string,
  motivoRechazo?: string | null
): Promise<{ data: SolicitudPermiso | null; error: string | null }> {
  const updateData: Record<string, unknown> = {
    estado: aprobado ? 'APROBADO' : 'RECHAZADO',
    aprobado_por: aprobadoPor,
    aprobado_fecha: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (!aprobado && motivoRechazo) {
    updateData.motivo_rechazo = motivoRechazo
  }

  const { data, error } = await supabase
    .from('solicitudes_permiso')
    .update(updateData)
    .eq('id', id)
    .eq('estado', 'PENDIENTE') // Solo se puede aprobar/rechazar si está pendiente
    .select(PERMISOS_SELECT)
    .single()

  if (error) {
    console.error('Error aprobando/rechazando permiso:', error)
    return { data: null, error: error.message }
  }

  return { data: data as SolicitudPermiso, error: null }
}
