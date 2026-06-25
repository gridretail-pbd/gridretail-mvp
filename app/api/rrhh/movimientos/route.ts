import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMovimientos, insertMovimiento } from '@/lib/rrhh/queries/movimientos'
import { movimientoCreateSchema } from '@/lib/rrhh/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchMovimientos(supabase, {
      usuario_id: searchParams.get('usuario_id') || undefined,
      tipo_movimiento: searchParams.get('tipo_movimiento') || undefined,
      fecha_desde: searchParams.get('fecha_desde') || undefined,
      fecha_hasta: searchParams.get('fecha_hasta') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ movimientos: data, total: data.length })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const parsed = movimientoCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // movimientos_personal.usuario_id apunta a la FICHA (usuarios_rrhh) tras la
    // migración 033. El body envía el id de ficha.
    const { data: ficha } = await supabase
      .from('usuarios_rrhh')
      .select('id, usuario_id, cargo_formal, area_funcional, remuneracion_actual, status')
      .eq('id', parsed.data.usuario_id)
      .maybeSingle()

    if (!ficha) {
      return NextResponse.json(
        { error: 'Colaborador no encontrado' },
        { status: 404 }
      )
    }

    // Datos de la cuenta (rol/zona/activo) solo si la persona tiene login
    let cuenta: { rol: string | null; zona: string | null; activo: boolean | null } | null = null
    let tiendaActual: { tienda_id: string } | null = null
    if (ficha.usuario_id) {
      const { data: c } = await supabase
        .from('usuarios')
        .select('rol, zona, activo')
        .eq('id', ficha.usuario_id)
        .maybeSingle()
      cuenta = c
      // usuarios_tiendas usa el id de cuenta
      const { data: t } = await supabase
        .from('usuarios_tiendas')
        .select('tienda_id')
        .eq('usuario_id', ficha.usuario_id)
        .limit(1)
        .maybeSingle()
      tiendaActual = t
    }

    const datosAnteriores = {
      rol: cuenta?.rol ?? null,
      zona: cuenta?.zona ?? null,
      activo: cuenta?.activo ?? null,
      cargo_formal: ficha.cargo_formal,
      area_funcional: ficha.area_funcional,
      remuneracion_actual: ficha.remuneracion_actual,
      status: ficha.status,
      tienda_id: tiendaActual?.tienda_id,
    }

    const datosInsert = {
      ...parsed.data,
      datos_anteriores: datosAnteriores,
      datos_nuevos: body.datos_nuevos || null,
      tienda_origen_id: tiendaActual?.tienda_id || null,
      tienda_destino_id: parsed.data.tienda_destino_id || null,
      autorizado_por: body.autorizado_por,
      documento_url: body.documento_url || null,
    }

    const { data, error } = await insertMovimiento(supabase, datosInsert)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, movimiento: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
