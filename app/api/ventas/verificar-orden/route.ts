import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ORDEN_VENTA_PATTERN } from '@/lib/constants/tipos-venta'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orden = searchParams.get('orden')?.trim()
    const fecha = searchParams.get('fecha')

    if (!orden) {
      return NextResponse.json(
        { error: 'Se requiere el número de orden' },
        { status: 400 }
      )
    }

    // Validar formato de orden (9 dígitos, empieza con 7 u 8)
    if (!ORDEN_VENTA_PATTERN.test(orden)) {
      return NextResponse.json(
        { error: 'Formato de orden inválido. Debe ser 9 dígitos y empezar con 7 u 8' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1. Primero buscar en INAR histórico
    const { data: inarExistente, error: inarError } = await supabase
      .from('lineas_inar')
      .select('id, vchtelefono, fecfechaproceso, vchn_plan, vchvendedor_packsim, vchc_contratofs')
      .or(`numnro_orden.eq.${orden},vchdwh_codigoorden.eq.${orden}`)
      .limit(5)

    if (inarError) {
      console.error('Error buscando en INAR:', inarError)
      // Continuar aunque falle INAR
    }

    if (inarExistente && inarExistente.length > 0) {
      return NextResponse.json({
        existeEnInar: true,
        existeEnVentasHoy: false,
        mensaje: 'Esta orden ya fue procesada en el INAR',
        registrosInar: inarExistente.map((r) => ({
          id: r.id,
          telefono: r.vchtelefono,
          fecha: r.fecfechaproceso,
          plan: r.vchn_plan,
          vendedor: r.vchvendedor_packsim,
          contrato: r.vchc_contratofs,
        })),
      })
    }

    // 2. Si no existe en INAR, buscar en ventas del día
    let ventasQuery = supabase
      .from('ventas')
      .select(`
        id,
        telefono_linea,
        tipo_venta,
        rango_horario,
        codigo_asesor,
        nombre_cliente,
        tipo_documento_cliente,
        numero_documento_cliente
      `)
      .eq('orden_venta', orden)

    // Si se especifica fecha, filtrar por ella
    if (fecha) {
      ventasQuery = ventasQuery.eq('fecha', fecha)
    }

    const { data: ventasHoy, error: ventasError } = await ventasQuery.order('created_at', { ascending: true })

    if (ventasError) {
      console.error('Error buscando en ventas:', ventasError)
      return NextResponse.json(
        { error: 'Error al verificar la orden' },
        { status: 500 }
      )
    }

    if (ventasHoy && ventasHoy.length > 0) {
      return NextResponse.json({
        existeEnInar: false,
        existeEnVentasHoy: true,
        mensaje: 'Esta orden tiene líneas registradas hoy',
        lineas: ventasHoy.map((v) => ({
          id: v.id,
          telefono: v.telefono_linea,
          tipo_venta: v.tipo_venta,
          rango_horario: v.rango_horario,
          asesor: v.codigo_asesor || 'N/A',
        })),
        cliente: {
          nombre: ventasHoy[0].nombre_cliente,
          tipo_documento: ventasHoy[0].tipo_documento_cliente,
          numero_documento: ventasHoy[0].numero_documento_cliente,
        },
      })
    }

    // 3. No existe en ningún lado - orden nueva
    return NextResponse.json({
      existeEnInar: false,
      existeEnVentasHoy: false,
      mensaje: 'Orden disponible para registro',
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
