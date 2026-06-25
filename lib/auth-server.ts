import type { createClient } from '@/lib/supabase/server'
import { ROLES_FECHA_LIBRE, ROLES_SIN_TIENDA } from '@/lib/constants/tipos-venta'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Helpers de autorización server-side para las rutas de arribos/ventas.
 *
 * GridRetail NO usa Supabase Auth: la identidad del usuario viaja en el body
 * (`usuario_id`), guardada en localStorage por el cliente. Para no confiar en
 * el rol/codigo enviados por el cliente, estos helpers vuelven a leer la fila
 * autoritativa de `usuarios` por id y derivan permisos a partir de ella.
 */

export interface UsuarioActual {
  id: string
  rol: string
  codigo_asesor: string | null
  dni: string | null
  nombre_completo: string | null
}

/**
 * Carga la fila autoritativa del usuario por id (solo usuarios activos).
 * Devuelve null si no existe / está inactivo (las rutas deben responder 401).
 */
export async function getUsuarioActual(
  supabase: SupabaseServerClient,
  usuarioId: string | null | undefined
): Promise<UsuarioActual | null> {
  if (!usuarioId) return null
  const { data } = await supabase
    .from('usuarios')
    .select('id, rol, codigo_asesor, dni, nombre_completo')
    .eq('id', usuarioId)
    .eq('activo', true)
    .maybeSingle()
  return (data as UsuarioActual | null) ?? null
}

/**
 * Roles con "fecha libre": pueden registrar ventas de fecha anterior sin pasar
 * por aprobación (no generan `pendiente_aprobacion`).
 */
export function tieneFechaLibre(rol: string): boolean {
  return (ROLES_FECHA_LIBRE as readonly string[]).includes(rol)
}

/**
 * true si el usuario puede operar sobre esa tienda.
 * Los roles sin tienda (admin/gerencias/backoffice) acceden a todas; el resto
 * debe tener la relación en `usuarios_tiendas`.
 */
export async function puedeAccederTienda(
  supabase: SupabaseServerClient,
  usuario: Pick<UsuarioActual, 'id' | 'rol'>,
  tiendaId: string
): Promise<boolean> {
  if ((ROLES_SIN_TIENDA as readonly string[]).includes(usuario.rol)) return true
  const { data } = await supabase
    .from('usuarios_tiendas')
    .select('tienda_id')
    .eq('usuario_id', usuario.id)
    .eq('tienda_id', tiendaId)
    .maybeSingle()
  return !!data
}
