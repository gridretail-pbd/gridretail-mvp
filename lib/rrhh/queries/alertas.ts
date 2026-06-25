// lib/rrhh/queries/alertas.ts
// Funciones de query para alertas RRHH
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertaRRHH } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const ALERTAS_SELECT = `*`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosAlertas {
  tipo?: string
  nivel?: string
  estado?: string
  destinatario_id?: string
  destinatario_rol?: string
  search?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchAlertas(
  supabase: SupabaseClient,
  filtros?: FiltrosAlertas
): Promise<{ data: AlertaRRHH[]; error: string | null }> {
  let query = supabase
    .from('alertas_rrhh')
    .select(ALERTAS_SELECT)
    .order('created_at', { ascending: false })

  if (filtros?.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  if (filtros?.nivel) {
    query = query.eq('nivel', filtros.nivel)
  }

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  if (filtros?.destinatario_id) {
    query = query.eq('destinatario_id', filtros.destinatario_id)
  }

  if (filtros?.destinatario_rol) {
    query = query.eq('destinatario_rol', filtros.destinatario_rol)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching alertas:', error)
    return { data: [], error: error.message }
  }

  let result = (data as AlertaRRHH[]) || []

  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (a) =>
        a.titulo.toLowerCase().includes(term) ||
        a.mensaje.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Actualizar (marcar leída, accionar, descartar) ────────────────────

export async function updateAlerta(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: AlertaRRHH | null; error: string | null }> {
  const { data, error } = await supabase
    .from('alertas_rrhh')
    .update(datos)
    .eq('id', id)
    .select(ALERTAS_SELECT)
    .single()

  if (error) {
    console.error('Error updating alerta:', error)
    return { data: null, error: error.message }
  }

  return { data: data as AlertaRRHH, error: null }
}
