import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ventaInsertSchema } from '@/lib/ventas/validations'
import { getUsuarioActual, puedeAccederTienda, tieneFechaLibre } from '@/lib/auth-server'

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

/** Normaliza strings opcionales: '' → null. */
function nz(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t.length ? t : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 2. Validar body (incluye arribo_id requerido y doc estricto de 5 tipos).
    const parsed = ventaInsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const v = parsed.data

    const supabase = await createClient()

    // 1. Auth: usuario autoritativo (identidad en el body, recargada de BD).
    const usuario = await getUsuarioActual(supabase, v.usuario_id)
    if (!usuario) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 3. Cargar el arribo.
    const { data: arribo, error: eArribo } = await supabase
      .from('arribos')
      .select('id, tienda_id, fecha, tipo_visita')
      .eq('id', v.arribo_id)
      .maybeSingle()

    if (eArribo) {
      return NextResponse.json({ error: eArribo.message }, { status: 400 })
    }
    if (!arribo) {
      return NextResponse.json({ error: 'Arribo no encontrado' }, { status: 404 })
    }
    if (arribo.tipo_visita !== 'VENTA') {
      return NextResponse.json(
        { error: 'No se puede registrar venta sobre un arribo de POSVENTA' },
        { status: 422 }
      )
    }

    // 4. Acceso a la tienda del arribo.
    if (!(await puedeAccederTienda(supabase, usuario, arribo.tienda_id))) {
      return NextResponse.json(
        { error: 'Sin acceso a la tienda del arribo' },
        { status: 403 }
      )
    }

    // 7. Rezago / estado: la fecha proviene del arribo (no del cliente).
    const esRezagada = arribo.fecha !== hoyLima()
    let estado: 'registrada' | 'pendiente_aprobacion' = 'registrada'
    if (esRezagada && !tieneFechaLibre(usuario.rol)) {
      if (!nz(v.motivo_rezago) || !nz(v.rango_horario)) {
        return NextResponse.json(
          {
            error:
              'Venta de fecha anterior requiere motivo_rezago y rango_horario',
          },
          { status: 400 }
        )
      }
      estado = 'pendiente_aprobacion'
    }

    // 9. Insertar la venta (lista blanca). El trigger fija arribos.resultado;
    //    NO se setea a mano. Vendedor = usuario actual (no arribo.usuario_id).
    const row = {
      arribo_id: arribo.id,
      tienda_id: arribo.tienda_id,
      fecha: arribo.fecha,
      usuario_id: usuario.id,
      codigo_asesor: usuario.codigo_asesor,
      dni_asesor: usuario.dni,
      registrado_por: usuario.id,
      es_venta_rezagada: esRezagada,
      motivo_rezago: esRezagada ? nz(v.motivo_rezago) : null,
      rango_horario: nz(v.rango_horario),
      estado,
      estado_cruce: 'PENDIENTE',
      monto_liquidado: 0,
      // Identificación y clasificación
      orden_venta: v.orden_venta,
      telefono_linea: v.telefono_linea,
      tipo_documento_cliente: v.tipo_documento_cliente,
      numero_documento_cliente: v.numero_documento_cliente,
      nombre_cliente: v.nombre_cliente,
      tipo_venta: v.tipo_venta,
      categoria_venta: nz(v.categoria_venta),
      operador_cedente: nz(v.operador_cedente),
      imei_equipo: nz(v.imei_equipo),
      modelo_equipo: nz(v.modelo_equipo),
      iccid_chip: nz(v.iccid_chip),
      incluye_seguro: v.incluye_seguro ?? false,
      incluye_accesorios: v.incluye_accesorios ?? false,
      descripcion_accesorios: v.incluye_accesorios ? nz(v.descripcion_accesorios) : null,
      notas: nz(v.notas),
    }

    const { data: venta, error: eVenta } = await supabase
      .from('ventas')
      .insert(row)
      .select()
      .single()

    if (eVenta) {
      console.error('Error al guardar venta:', eVenta)
      // orden_venta duplicada (UNIQUE) → 409 con mensaje claro.
      if (eVenta.code === '23505') {
        return NextResponse.json(
          { error: 'La orden de venta ya existe' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: eVenta.message }, { status: 400 })
    }

    // 10. Enriquecer el arribo con los datos validados del cliente (best-effort).
    //     Si falla, la venta ya quedó registrada y enlazada (resultado lo fija
    //     el trigger); solo no se enriquece el arribo (inconsistencia menor).
    const { error: eUpdate } = await supabase
      .from('arribos')
      .update({
        tipo_documento_cliente: v.tipo_documento_cliente,
        dni_cliente: v.numero_documento_cliente,
        nombre_cliente: v.nombre_cliente,
      })
      .eq('id', arribo.id)

    if (eUpdate) {
      console.warn('No se pudo enriquecer el arribo:', eUpdate.message)
    }

    return NextResponse.json({ success: true, venta })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
