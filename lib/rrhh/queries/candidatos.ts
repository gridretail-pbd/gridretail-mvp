// lib/rrhh/queries/candidatos.ts
// Funciones de query para las tablas candidatos, candidatos_etapas, candidatos_entrevistas
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Candidato, CandidatoEtapa, CandidatoEntrevista } from '@/lib/rrhh/interfaces'
import type { EtapaPipeline } from '@/lib/rrhh/types'
import { puedeAvanzar } from '@/lib/rrhh/utils/pipeline'

const CANDIDATOS_SELECT = `
  *,
  referido_por_usuario:usuarios!candidatos_referido_por_fkey(nombre_completo),
  tienda_destino:tiendas!candidatos_tienda_destino_id_fkey(nombre, codigo)
`

const CANDIDATO_DETAIL_SELECT = `
  *,
  referido_por_usuario:usuarios!candidatos_referido_por_fkey(nombre_completo),
  tienda_destino:tiendas!candidatos_tienda_destino_id_fkey(nombre, codigo),
  etapas:candidatos_etapas(*, registrado_por_usuario:usuarios!candidatos_etapas_registrado_por_fkey(nombre_completo)),
  entrevistas:candidatos_entrevistas(*, entrevistador:usuarios!candidatos_entrevistas_entrevistador_id_fkey(nombre_completo, rol)),
  documentos:candidatos_documentos(*)
`

// ─── Filtros ────────────────────────────────────────────────────────────────

export interface FiltrosCandidatos {
  etapa_actual?: string[]
  fuente_captacion?: string
  descartado?: boolean
  search?: string
  tienda_destino_id?: string
}

// ─── Fetch lista ────────────────────────────────────────────────────────────

export async function fetchCandidatos(
  supabase: SupabaseClient,
  filtros?: FiltrosCandidatos
): Promise<{ data: Candidato[]; error: string | null }> {
  let query = supabase
    .from('candidatos')
    .select(CANDIDATOS_SELECT)
    .order('fecha_captacion', { ascending: false })

  if (filtros?.etapa_actual && filtros.etapa_actual.length > 0) {
    query = query.in('etapa_actual', filtros.etapa_actual)
  }

  if (filtros?.fuente_captacion) {
    query = query.eq('fuente_captacion', filtros.fuente_captacion)
  }

  if (filtros?.descartado !== undefined) {
    query = query.eq('descartado', filtros.descartado)
  }

  if (filtros?.tienda_destino_id) {
    query = query.eq('tienda_destino_id', filtros.tienda_destino_id)
  }

  if (filtros?.search) {
    query = query.or(
      `nombre_completo.ilike.%${filtros.search}%,dni.ilike.%${filtros.search}%,telefono.ilike.%${filtros.search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching candidatos:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as Candidato[]) || [], error: null }
}

// ─── Fetch por ID (detalle) ─────────────────────────────────────────────────

export async function fetchCandidatoById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: Candidato | null; error: string | null }> {
  const { data, error } = await supabase
    .from('candidatos')
    .select(CANDIDATO_DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching candidato:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Candidato, error: null }
}

// ─── Insertar candidato ─────────────────────────────────────────────────────

export async function insertCandidato(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: Candidato | null; error: string | null }> {
  const { data, error } = await supabase
    .from('candidatos')
    .insert(datos)
    .select(CANDIDATOS_SELECT)
    .single()

  if (error) {
    console.error('Error inserting candidato:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Candidato, error: null }
}

// ─── Actualizar candidato ───────────────────────────────────────────────────

export async function updateCandidato(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: Candidato | null; error: string | null }> {
  const { data, error } = await supabase
    .from('candidatos')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CANDIDATOS_SELECT)
    .single()

  if (error) {
    console.error('Error updating candidato:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Candidato, error: null }
}

// ─── Avanzar etapa ──────────────────────────────────────────────────────────

export async function avanzarEtapa(
  supabase: SupabaseClient,
  candidatoId: string,
  etapaDestino: EtapaPipeline,
  registradoPor: string,
  notas?: string | null
): Promise<{ data: Candidato | null; error: string | null }> {
  // 1. Obtener candidato actual
  const { data: candidato, error: fetchError } = await supabase
    .from('candidatos')
    .select('id, etapa_actual, descartado')
    .eq('id', candidatoId)
    .single()

  if (fetchError || !candidato) {
    return { data: null, error: 'Candidato no encontrado' }
  }

  if (candidato.descartado) {
    return { data: null, error: 'No se puede avanzar un candidato descartado' }
  }

  // 2. Validar transición
  const etapaActual = candidato.etapa_actual as EtapaPipeline
  if (!puedeAvanzar(etapaActual, etapaDestino)) {
    return { data: null, error: `Transición no válida: ${etapaActual} → ${etapaDestino}` }
  }

  // 3. Cerrar etapa actual en historial
  await supabase
    .from('candidatos_etapas')
    .update({ fecha_salida: new Date().toISOString(), resultado: 'APROBADO' })
    .eq('candidato_id', candidatoId)
    .eq('etapa', etapaActual)
    .is('fecha_salida', null)

  // 4. Crear entrada en historial para nueva etapa
  await supabase
    .from('candidatos_etapas')
    .insert({
      candidato_id: candidatoId,
      etapa: etapaDestino,
      notas,
      registrado_por: registradoPor,
    })

  // 5. Actualizar candidato
  const { data: updated, error: updateError } = await supabase
    .from('candidatos')
    .update({
      etapa_actual: etapaDestino,
      fecha_ultima_actualizacion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidatoId)
    .select(CANDIDATOS_SELECT)
    .single()

  if (updateError) {
    console.error('Error avanzando etapa:', updateError)
    return { data: null, error: updateError.message }
  }

  return { data: updated as Candidato, error: null }
}

// ─── Descartar candidato ────────────────────────────────────────────────────

export async function descartarCandidato(
  supabase: SupabaseClient,
  candidatoId: string,
  descartadoPor: string,
  motivo: string
): Promise<{ data: Candidato | null; error: string | null }> {
  // 1. Obtener candidato actual
  const { data: candidato, error: fetchError } = await supabase
    .from('candidatos')
    .select('id, etapa_actual, descartado')
    .eq('id', candidatoId)
    .single()

  if (fetchError || !candidato) {
    return { data: null, error: 'Candidato no encontrado' }
  }

  if (candidato.descartado) {
    return { data: null, error: 'El candidato ya está descartado' }
  }

  const etapaActual = candidato.etapa_actual as EtapaPipeline

  // 2. Cerrar etapa actual en historial
  await supabase
    .from('candidatos_etapas')
    .update({ fecha_salida: new Date().toISOString(), resultado: 'RECHAZADO' })
    .eq('candidato_id', candidatoId)
    .eq('etapa', etapaActual)
    .is('fecha_salida', null)

  // 3. Crear entrada DESCARTADO en historial
  await supabase
    .from('candidatos_etapas')
    .insert({
      candidato_id: candidatoId,
      etapa: 'DESCARTADO',
      notas: motivo,
      registrado_por: descartadoPor,
    })

  // 4. Actualizar candidato
  const { data: updated, error: updateError } = await supabase
    .from('candidatos')
    .update({
      etapa_actual: 'DESCARTADO',
      descartado: true,
      descarte_etapa: etapaActual,
      descarte_motivo: motivo,
      descarte_fecha: new Date().toISOString().split('T')[0],
      descartado_por: descartadoPor,
      fecha_ultima_actualizacion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidatoId)
    .select(CANDIDATOS_SELECT)
    .single()

  if (updateError) {
    console.error('Error descartando candidato:', updateError)
    return { data: null, error: updateError.message }
  }

  return { data: updated as Candidato, error: null }
}
