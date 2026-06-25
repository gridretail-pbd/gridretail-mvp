// lib/rrhh/queries/contratos.ts
// Funciones de query para contratos, renovacion_lotes, renovacion_decisiones
// Reciben SupabaseClient para ser usadas tanto en API routes (server) como en cliente (browser)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contrato, RenovacionLote, RenovacionDecision } from '@/lib/rrhh/interfaces'
import type { EstadoLote } from '@/lib/rrhh/types'

// ─── Selects ───────────────────────────────────────────────────────────────

const CONTRATOS_SELECT = `
  *,
  usuario:usuarios_rrhh!contratos_usuario_id_fkey(nombre_completo, dni, codigo_asesor),
  tienda_asignada:tiendas!contratos_tienda_asignada_id_fkey(nombre, codigo)
`

const CONTRATO_DETAIL_SELECT = `
  *,
  usuario:usuarios_rrhh!contratos_usuario_id_fkey(nombre_completo, dni, codigo_asesor),
  tienda_asignada:tiendas!contratos_tienda_asignada_id_fkey(nombre, codigo)
`

const LOTES_SELECT = `
  *
`

const LOTE_DETAIL_SELECT = `
  *,
  decisiones:renovacion_decisiones(
    *,
    usuario:usuarios_rrhh!renovacion_decisiones_usuario_id_fkey(nombre_completo, dni, codigo_asesor, cuenta:usuarios!usuarios_rrhh_usuario_id_fkey(rol))
  )
`

const DECISIONES_SELECT = `
  *,
  usuario:usuarios_rrhh!renovacion_decisiones_usuario_id_fkey(nombre_completo, dni, codigo_asesor, cuenta:usuarios!usuarios_rrhh_usuario_id_fkey(rol))
`

// ─── Filtros ───────────────────────────────────────────────────────────────

export interface FiltrosContratos {
  estado?: string[]
  tipo_contrato?: string
  usuario_id?: string
  tienda_asignada_id?: string
  search?: string
  proximos_a_vencer?: number // días para vencer
}

export interface FiltrosLotes {
  estado?: string
  search?: string
}

// ─── Contratos: Fetch lista ────────────────────────────────────────────────

export async function fetchContratos(
  supabase: SupabaseClient,
  filtros?: FiltrosContratos
): Promise<{ data: Contrato[]; error: string | null }> {
  let query = supabase
    .from('contratos')
    .select(CONTRATOS_SELECT)
    .order('created_at', { ascending: false })

  if (filtros?.estado && filtros.estado.length > 0) {
    query = query.in('estado', filtros.estado)
  }

  if (filtros?.tipo_contrato) {
    query = query.eq('tipo_contrato', filtros.tipo_contrato)
  }

  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }

  if (filtros?.tienda_asignada_id) {
    query = query.eq('tienda_asignada_id', filtros.tienda_asignada_id)
  }

  if (filtros?.proximos_a_vencer) {
    const hoy = new Date()
    const limite = new Date(hoy)
    limite.setDate(hoy.getDate() + filtros.proximos_a_vencer)
    query = query
      .gte('fecha_fin', hoy.toISOString().split('T')[0])
      .lte('fecha_fin', limite.toISOString().split('T')[0])
      .eq('estado', 'VIGENTE')
  }

  if (filtros?.search) {
    // Búsqueda por nombre o DNI del usuario asociado requiere un approach diferente.
    // Hacemos filter por usuario_id con subquery no es posible directamente.
    // Usaremos textSearch en el frontend o un rpc. Por ahora filtramos post-fetch.
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching contratos:', error)
    return { data: [], error: error.message }
  }

  let result = (data as Contrato[]) || []

  // Filtro de búsqueda post-fetch (nombre/DNI del usuario)
  if (filtros?.search) {
    const term = filtros.search.toLowerCase()
    result = result.filter(
      (c) =>
        c.usuario?.nombre_completo?.toLowerCase().includes(term) ||
        c.usuario?.dni?.includes(term) ||
        c.usuario?.codigo_asesor?.toLowerCase().includes(term)
    )
  }

  return { data: result, error: null }
}

// ─── Contratos: Fetch por ID ──────────────────────────────────────────────

export async function fetchContratoById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: Contrato | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contratos')
    .select(CONTRATO_DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching contrato:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Contrato, error: null }
}

// ─── Contratos: Insertar ──────────────────────────────────────────────────

export async function insertContrato(
  supabase: SupabaseClient,
  datos: Record<string, unknown>
): Promise<{ data: Contrato | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contratos')
    .insert(datos)
    .select(CONTRATOS_SELECT)
    .single()

  if (error) {
    console.error('Error inserting contrato:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Contrato, error: null }
}

// ─── Contratos: Actualizar ────────────────────────────────────────────────

export async function updateContrato(
  supabase: SupabaseClient,
  id: string,
  datos: Record<string, unknown>
): Promise<{ data: Contrato | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contratos')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CONTRATOS_SELECT)
    .single()

  if (error) {
    console.error('Error updating contrato:', error)
    return { data: null, error: error.message }
  }

  return { data: data as Contrato, error: null }
}

// ─── Lotes: Fetch lista ───────────────────────────────────────────────────

export async function fetchLotesRenovacion(
  supabase: SupabaseClient,
  filtros?: FiltrosLotes
): Promise<{ data: RenovacionLote[]; error: string | null }> {
  let query = supabase
    .from('renovacion_lotes')
    .select(LOTES_SELECT)
    .order('periodo', { ascending: false })

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching lotes:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as RenovacionLote[]) || [], error: null }
}

// ─── Lotes: Fetch por ID (con decisiones) ─────────────────────────────────

export async function fetchLoteById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: RenovacionLote | null; error: string | null }> {
  const { data, error } = await supabase
    .from('renovacion_lotes')
    .select(LOTE_DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching lote:', error)
    return { data: null, error: error.message }
  }

  return { data: data as RenovacionLote, error: null }
}

// ─── Lotes: Crear ─────────────────────────────────────────────────────────

export async function insertLoteRenovacion(
  supabase: SupabaseClient,
  datos: { periodo: string; fecha_limite_visado?: string; generado_por: string }
): Promise<{ data: RenovacionLote | null; error: string | null }> {
  // 1. Verificar que no existe un lote para ese periodo
  const { data: existente } = await supabase
    .from('renovacion_lotes')
    .select('id, periodo')
    .eq('periodo', datos.periodo)
    .maybeSingle()

  if (existente) {
    return { data: null, error: `Ya existe un lote para el periodo ${datos.periodo}` }
  }

  // 2. Buscar contratos vigentes que vencen en ese periodo
  const [year, month] = datos.periodo.split('-').map(Number)
  const primerDia = `${datos.periodo}-01`
  const ultimoDia = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: contratosVencen, error: contratosError } = await supabase
    .from('contratos')
    .select('id, usuario_id')
    .eq('estado', 'VIGENTE')
    .gte('fecha_fin', primerDia)
    .lte('fecha_fin', ultimoDia)

  if (contratosError) {
    return { data: null, error: contratosError.message }
  }

  // 3. Crear lote
  const { data: lote, error: loteError } = await supabase
    .from('renovacion_lotes')
    .insert({
      periodo: datos.periodo,
      fecha_limite_visado: datos.fecha_limite_visado || null,
      total_colaboradores: contratosVencen?.length || 0,
      generado_por: datos.generado_por,
    })
    .select('*')
    .single()

  if (loteError) {
    console.error('Error creating lote:', loteError)
    return { data: null, error: loteError.message }
  }

  // 4. Crear decisiones para cada contrato que vence
  if (contratosVencen && contratosVencen.length > 0) {
    const decisiones = contratosVencen.map((c) => ({
      lote_id: lote.id,
      usuario_id: c.usuario_id,
      contrato_actual_id: c.id,
    }))

    const { error: decisionesError } = await supabase
      .from('renovacion_decisiones')
      .insert(decisiones)

    if (decisionesError) {
      console.error('Error creating decisiones:', decisionesError)
      // El lote ya se creó, loggeamos pero no fallamos
    }
  }

  return { data: lote as RenovacionLote, error: null }
}

// ─── Lotes: Avanzar estado ────────────────────────────────────────────────

const TRANSICIONES_LOTE: Record<string, string> = {
  GENERADO: 'EN_VISADO_JV',
  EN_VISADO_JV: 'EN_VISADO_KAM',
  EN_VISADO_KAM: 'LISTO_PARA_RRHH',
  LISTO_PARA_RRHH: 'EJECUTADO',
}

export async function avanzarEstadoLote(
  supabase: SupabaseClient,
  loteId: string,
  estadoDestino: EstadoLote
): Promise<{ data: RenovacionLote | null; error: string | null }> {
  // Obtener estado actual
  const { data: lote, error: fetchError } = await supabase
    .from('renovacion_lotes')
    .select('id, estado')
    .eq('id', loteId)
    .single()

  if (fetchError || !lote) {
    return { data: null, error: 'Lote no encontrado' }
  }

  // Validar transición
  const siguienteEstado = TRANSICIONES_LOTE[lote.estado]
  if (siguienteEstado !== estadoDestino) {
    return { data: null, error: `Transición no válida: ${lote.estado} → ${estadoDestino}` }
  }

  const { data: updated, error: updateError } = await supabase
    .from('renovacion_lotes')
    .update({ estado: estadoDestino, updated_at: new Date().toISOString() })
    .eq('id', loteId)
    .select('*')
    .single()

  if (updateError) {
    console.error('Error avanzando lote:', updateError)
    return { data: null, error: updateError.message }
  }

  return { data: updated as RenovacionLote, error: null }
}

// ─── Decisiones: Visado JV ────────────────────────────────────────────────

export async function visadoJV(
  supabase: SupabaseClient,
  decisionId: string,
  decision: 'RENOVAR' | 'NO_RENOVAR' | 'PENDIENTE_EVALUAR',
  jvId: string,
  motivo?: string | null
): Promise<{ data: RenovacionDecision | null; error: string | null }> {
  const { data, error } = await supabase
    .from('renovacion_decisiones')
    .update({
      decision_jv: decision,
      decision_jv_motivo: motivo || null,
      decision_jv_id: jvId,
      decision_jv_fecha: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .select(DECISIONES_SELECT)
    .single()

  if (error) {
    console.error('Error visado JV:', error)
    return { data: null, error: error.message }
  }

  return { data: data as RenovacionDecision, error: null }
}

// ─── Decisiones: Visado KAM ──────────────────────────────────────────────

export async function visadoKAM(
  supabase: SupabaseClient,
  decisionId: string,
  decision: 'CONFIRMAR' | 'REVERTIR',
  kamId: string,
  motivo?: string | null
): Promise<{ data: RenovacionDecision | null; error: string | null }> {
  const { data, error } = await supabase
    .from('renovacion_decisiones')
    .update({
      decision_kam: decision,
      decision_kam_motivo: motivo || null,
      decision_kam_id: kamId,
      decision_kam_fecha: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .select(DECISIONES_SELECT)
    .single()

  if (error) {
    console.error('Error visado KAM:', error)
    return { data: null, error: error.message }
  }

  return { data: data as RenovacionDecision, error: null }
}

// ─── Decisiones: Ejecutar decisión final (RRHH) ──────────────────────────

export async function ejecutarDecision(
  supabase: SupabaseClient,
  decisionId: string,
  decisionFinal: 'RENOVAR' | 'NO_RENOVAR',
  ejecutadoPor: string
): Promise<{ data: RenovacionDecision | null; error: string | null }> {
  // 1. Obtener decisión actual
  const { data: dec, error: fetchError } = await supabase
    .from('renovacion_decisiones')
    .select('*, contrato_actual:contratos!renovacion_decisiones_contrato_actual_id_fkey(id, usuario_id, tipo_contrato, cargo, remuneracion, tienda_asignada_id)')
    .eq('id', decisionId)
    .single()

  if (fetchError || !dec) {
    return { data: null, error: 'Decisión no encontrada' }
  }

  // Verificar que tiene visados completos
  if (!dec.decision_jv || !dec.decision_kam) {
    return { data: null, error: 'Faltan visados de JV y/o KAM' }
  }

  let contratoNuevoId: string | null = null

  // 2. Si se renueva, crear nuevo contrato
  if (decisionFinal === 'RENOVAR' && dec.contrato_actual) {
    const contratoActual = dec.contrato_actual as Record<string, unknown>
    const fechaFinActual = dec.contrato_actual_id ? new Date() : new Date()
    // Nuevo contrato: inicia al día siguiente del fin del actual
    const nuevaFechaInicio = new Date()
    nuevaFechaInicio.setDate(nuevaFechaInicio.getDate() + 1)
    const nuevaFechaFin = new Date(nuevaFechaInicio)
    nuevaFechaFin.setMonth(nuevaFechaFin.getMonth() + 1)

    const { data: nuevoContrato, error: contratoError } = await supabase
      .from('contratos')
      .insert({
        usuario_id: dec.usuario_id,
        tipo_contrato: contratoActual.tipo_contrato || 'PLAZO_FIJO',
        fecha_inicio: nuevaFechaInicio.toISOString().split('T')[0],
        fecha_fin: nuevaFechaFin.toISOString().split('T')[0],
        cargo: contratoActual.cargo || '',
        remuneracion: contratoActual.remuneracion || 0,
        tienda_asignada_id: contratoActual.tienda_asignada_id || null,
        estado: 'BORRADOR',
        contrato_anterior_id: dec.contrato_actual_id,
        lote_renovacion_id: dec.lote_id,
        generado_por: ejecutadoPor,
      })
      .select('id')
      .single()

    if (!contratoError && nuevoContrato) {
      contratoNuevoId = nuevoContrato.id
    }
  }

  // 3. Si no se renueva, marcar contrato actual como NO_RENOVADO
  if (decisionFinal === 'NO_RENOVAR' && dec.contrato_actual_id) {
    await supabase
      .from('contratos')
      .update({
        estado: 'NO_RENOVADO',
        motivo_no_renovacion: dec.decision_jv_motivo || dec.decision_kam_motivo || 'Decisión de no renovación',
        updated_at: new Date().toISOString(),
      })
      .eq('id', dec.contrato_actual_id)
  }

  // 4. Actualizar decisión
  const { data: updated, error: updateError } = await supabase
    .from('renovacion_decisiones')
    .update({
      decision_final: decisionFinal,
      ejecutado_por: ejecutadoPor,
      ejecutado_fecha: new Date().toISOString(),
      contrato_nuevo_id: contratoNuevoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .select(DECISIONES_SELECT)
    .single()

  if (updateError) {
    console.error('Error ejecutando decisión:', updateError)
    return { data: null, error: updateError.message }
  }

  return { data: updated as RenovacionDecision, error: null }
}

// ─── Decisiones: Fetch por lote ───────────────────────────────────────────

export async function fetchDecisionesByLote(
  supabase: SupabaseClient,
  loteId: string
): Promise<{ data: RenovacionDecision[]; error: string | null }> {
  const { data, error } = await supabase
    .from('renovacion_decisiones')
    .select(DECISIONES_SELECT)
    .eq('lote_id', loteId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching decisiones:', error)
    return { data: [], error: error.message }
  }

  return { data: (data as RenovacionDecision[]) || [], error: null }
}
