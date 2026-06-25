import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Guard de borrado (migración 033 / SPEC_DESACOPLE). Permite eliminar una
 * persona/cuenta SOLO si no tiene historial dependiente. El `ON DELETE RESTRICT`
 * de la BD es la red de seguridad; estos helpers dan el detalle legible.
 */

export interface Dependencia {
  tabla: string
  count: number
}

// Tablas de dominio-persona que referencian usuarios_rrhh(id) (repuntadas en 033).
const TABLAS_FICHA = [
  'contratos',
  'movimientos_personal',
  'usuarios_status_log',
  'asistencia',
  'asignacion_turnos',
  'incidencias_laborales',
  'solicitudes_permiso',
  'offboarding_checklist',
  'documentos_colaborador',
  'renovacion_decisiones',
] as const

// Tablas comerciales/operativas que referencian la CUENTA usuarios(id).
const TABLAS_CUENTA: { tabla: string; col: string }[] = [
  { tabla: 'ventas', col: 'usuario_id' },
  { tabla: 'arribos', col: 'usuario_id' },
  { tabla: 'lineas_inar', col: 'usuario_id' },
  { tabla: 'hc_quotas', col: 'user_id' },
  { tabla: 'commission_hc_assignments', col: 'user_id' },
  { tabla: 'hc_penalties', col: 'user_id' },
  { tabla: 'asesor_incidencias', col: 'usuario_id' },
]

async function contar(
  supabase: SupabaseServerClient,
  tabla: string,
  col: string,
  id: string
): Promise<number> {
  const { count } = await supabase
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq(col, id)
  return count ?? 0
}

/** Dependencias que impiden borrar una FICHA de personal. */
export async function dependenciasDeFicha(
  supabase: SupabaseServerClient,
  fichaId: string
): Promise<Dependencia[]> {
  const out: Dependencia[] = []
  for (const tabla of TABLAS_FICHA) {
    const count = await contar(supabase, tabla, 'usuario_id', fichaId)
    if (count > 0) out.push({ tabla, count })
  }
  return out
}

/** Dependencias que impiden borrar una CUENTA de login. */
export async function dependenciasDeCuenta(
  supabase: SupabaseServerClient,
  usuarioId: string
): Promise<Dependencia[]> {
  const out: Dependencia[] = []
  for (const { tabla, col } of TABLAS_CUENTA) {
    const count = await contar(supabase, tabla, col, usuarioId)
    if (count > 0) out.push({ tabla, count })
  }
  return out
}
