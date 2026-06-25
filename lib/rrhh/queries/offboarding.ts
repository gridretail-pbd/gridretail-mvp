// lib/rrhh/queries/offboarding.ts
// Funciones de query para offboarding checklist
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { OffboardingChecklist } from '@/lib/rrhh/interfaces'

// ─── Selects ───────────────────────────────────────────────────────────────

const OFFBOARDING_SELECT = `
  *,
  usuario:usuarios_rrhh!offboarding_checklist_usuario_id_fkey(nombre_completo, dni, codigo_asesor)
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosOffboarding {
  estado?: string
  tipo_salida?: string
  search?: string
}

// ─── Fetch lista ───────────────────────────────────────────────────────────

export async function fetchOffboardings(
  supabase: SupabaseClient,
  filtros?: FiltrosOffboarding
): Promise<{ data: OffboardingChecklist[]; error: string | null }> {
  let query = supabase
    .from('offboarding_checklist')
    .select(OFFBOARDING_SELECT)
    .order('created_at', { ascending: false })

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  if (filtros?.tipo_salida) {
    query = query.eq('tipo_salida', filtros.tipo_salida)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching offboardings:', error)
    return { data: [], error: error.message }
  }

  let result = (data as OffboardingChecklist[]) || []

  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (o) =>
        o.usuario?.nombre_completo?.toLowerCase().includes(term) ||
        o.usuario?.codigo_asesor?.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Fetch por ID ──────────────────────────────────────────────────────────

export async function fetchOffboardingById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: OffboardingChecklist | null; error: string | null }> {
  const { data, error } = await supabase
    .from('offboarding_checklist')
    .select(OFFBOARDING_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching offboarding:', error)
    return { data: null, error: error.message }
  }

  return { data: data as OffboardingChecklist, error: null }
}

// ─── Insertar ──────────────────────────────────────────────────────────────

export async function insertOffboarding(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: OffboardingChecklist | null; error: string | null }> {
  const { data, error } = await supabase
    .from('offboarding_checklist')
    .insert(datos)
    .select(OFFBOARDING_SELECT)
    .single()

  if (error) {
    console.error('Error inserting offboarding:', error)
    return { data: null, error: error.message }
  }

  return { data: data as OffboardingChecklist, error: null }
}

// ─── Actualizar (tareas, estado, notas) ────────────────────────────────

export async function updateOffboarding(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: OffboardingChecklist | null; error: string | null }> {
  const { data, error } = await supabase
    .from('offboarding_checklist')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(OFFBOARDING_SELECT)
    .single()

  if (error) {
    console.error('Error updating offboarding:', error)
    return { data: null, error: error.message }
  }

  return { data: data as OffboardingChecklist, error: null }
}
