import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual, puedeAccederTienda } from '@/lib/auth-server'

const ZONA_HORARIA = 'America/Lima'

/** Fecha local de Perú (YYYY-MM-DD) calculada desde el reloj del servidor. */
function hoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * GET /api/arribos/vendibles
 *
 * Lista los arribos de una tienda/día para la tabla del formulario de venta
 * (Camino B) y para badges/filtros. El usuario ve TODA la tienda (no solo sus
 * arribos). Adjunta el asesor que atendió y conteos de ventas por estado.
 *
 * Query params:
 *  - tienda_id (uuid, requerido)   — se valida acceso del usuario
 *  - usuario_id (uuid, requerido)  — identidad del solicitante (patrón del repo)
 *  - fecha (date, default hoyLima)
 *  - incluir_posventa (bool, default false) — por defecto excluye POSVENTA
 *  - resultado (string, opcional)  — filtro por estado
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const tiendaId = url.searchParams.get('tienda_id')
    const usuarioId = url.searchParams.get('usuario_id')
    const fecha = url.searchParams.get('fecha') ?? hoyLima()
    const incluirPosventa = url.searchParams.get('incluir_posventa') === 'true'
    const fResultado = url.searchParams.get('resultado')

    if (!tiendaId) {
      return NextResponse.json({ error: 'tienda_id requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    const usuario = await getUsuarioActual(supabase, usuarioId)
    if (!usuario) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!(await puedeAccederTienda(supabase, usuario, tiendaId))) {
      return NextResponse.json({ error: 'Sin acceso a la tienda' }, { status: 403 })
    }

    let q = supabase
      .from('arribos')
      .select(
        'id, hora, tipo_visita, resultado, tipo_documento_cliente, dni_cliente, nombre_cliente, es_cliente_entel, usuario_id, usuarios:usuario_id(nombre_completo)'
      )
      .eq('tienda_id', tiendaId)
      .eq('fecha', fecha)
      .order('hora', { ascending: true })

    if (!incluirPosventa) q = q.eq('tipo_visita', 'VENTA')
    if (fResultado) q = q.eq('resultado', fResultado)

    const { data: arribos, error } = await q
    if (error) {
      console.error('Error listando arribos vendibles:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Conteos de ventas por arribo (agregación en JS; volúmenes de decenas/cientos).
    const ids = (arribos ?? []).map((a) => a.id)
    const conteos: Record<
      string,
      { activas: number; anuladas: number; pendientes: number }
    > = {}

    if (ids.length) {
      const { data: ventas } = await supabase
        .from('ventas')
        .select('arribo_id, estado')
        .in('arribo_id', ids)

      for (const venta of ventas ?? []) {
        const c = (conteos[venta.arribo_id] ??= {
          activas: 0,
          anuladas: 0,
          pendientes: 0,
        })
        if (['registrada', 'aprobada'].includes(venta.estado)) c.activas++
        else if (['anulada', 'rechazada'].includes(venta.estado)) c.anuladas++
        else if (venta.estado === 'pendiente_aprobacion') c.pendientes++
      }
    }

    const result = (arribos ?? []).map((a) => {
      const usuariosRel = (a as { usuarios?: { nombre_completo?: string } | { nombre_completo?: string }[] }).usuarios
      const rel = Array.isArray(usuariosRel) ? usuariosRel[0] : usuariosRel
      return {
        ...a,
        asesor_nombre: rel?.nombre_completo ?? null,
        ventas_activas: conteos[a.id]?.activas ?? 0,
        ventas_anuladas: conteos[a.id]?.anuladas ?? 0,
        ventas_pendientes: conteos[a.id]?.pendientes ?? 0,
      }
    })

    return NextResponse.json({ fecha, tienda_id: tiendaId, arribos: result })
  } catch (error) {
    console.error('Error en API arribos/vendibles:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
