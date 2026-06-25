import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { arriboInsertSchema, derivarResultado } from '@/lib/arribos/validations'
import { getUsuarioActual, puedeAccederTienda } from '@/lib/auth-server'

const ZONA_HORARIA = 'America/Lima'

/**
 * Fecha y hora actuales en zona horaria de Perú (UTC-5), calculadas desde el
 * reloj del servidor. No depende del dispositivo del cliente.
 */
function ahoraEnLima(): { fecha: string; hora: string } {
  const now = new Date()
  // en-CA -> 'YYYY-MM-DD'
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  // hourCycle h23 -> '00'..'23' (evita el bug de '24:00' a medianoche)
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return { fecha, hora }
}

export async function POST(request: NextRequest) {
  console.log('=== API Arribos: POST ===')

  try {
    const body = await request.json()

    // Validación server-side: no confiar en el frontend.
    const parsed = arriboInsertSchema.safeParse(body)
    if (!parsed.success) {
      console.warn('Arribo inválido:', parsed.error.flatten())
      return NextResponse.json(
        {
          error: 'Datos de arribo inválidos',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }
    const v = parsed.data

    const supabase = await createClient()

    // Usuario autoritativo (la identidad viaja en el body; se recarga de BD).
    const usuario = await getUsuarioActual(supabase, v.usuario_id)
    if (!usuario) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await puedeAccederTienda(supabase, usuario, v.tienda_id))) {
      return NextResponse.json({ error: 'Sin acceso a la tienda' }, { status: 403 })
    }

    // El `resultado` se DERIVA en el servidor a partir de la declaración
    // (se_vendio). La columna se_vendio ya no existe (migración 029): NO se
    // persiste. Lista blanca de columnas + fecha/hora autoritativas (Lima).
    const resultado = derivarResultado(v.tipo_visita, v.se_vendio)
    const { fecha, hora } = ahoraEnLima()

    const arribo = {
      fecha,
      hora,
      tienda_id: v.tienda_id,
      usuario_id: usuario.id,
      registrado_por: usuario.id,
      tipo_documento_cliente: v.tipo_documento_cliente ?? null,
      dni_cliente: v.dni_cliente ?? null,
      nombre_cliente: v.nombre_cliente ?? null,
      es_cliente_entel: v.es_cliente_entel ?? null,
      tipo_visita: v.tipo_visita,
      concreto_operacion: v.concreto_operacion,
      motivo_no_venta: v.motivo_no_venta ?? null,
      resultado,
    }

    const { data, error } = await supabase
      .from('arribos')
      .insert(arribo)
      .select()
      .single()

    if (error) {
      console.error('Error insertando arribo:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('Arribo creado exitosamente:', data.id)
    return NextResponse.json({ success: true, arribo: data })
  } catch (error) {
    console.error('Error en API arribos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
