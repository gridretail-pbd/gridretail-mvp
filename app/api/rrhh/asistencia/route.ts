import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAsistencia, insertAsistencia } from '@/lib/rrhh/queries/asistencia'
import { asistenciaMarcacionSchema } from '@/lib/rrhh/schemas'
import { calcularDistanciaMetros } from '@/lib/rrhh/utils/gps'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchAsistencia(supabase, {
      usuario_id: searchParams.get('usuario_id') || undefined,
      tienda_id: searchParams.get('tienda_id') || undefined,
      fecha: searchParams.get('fecha') || undefined,
      fecha_desde: searchParams.get('fecha_desde') || undefined,
      fecha_hasta: searchParams.get('fecha_hasta') || undefined,
      estado: searchParams.get('estado') || undefined,
      tipo: searchParams.get('tipo') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ asistencia: data, total: data.length })
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

    const parsed = asistenciaMarcacionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const usuarioId = body.usuario_id
    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 })
    }

    // asistencia.usuario_id apunta a la FICHA (usuarios_rrhh) tras la migración 033.
    // Resolvemos a id de ficha aceptando tanto id de cuenta como id de ficha.
    const { data: ficha } = await supabase
      .from('usuarios_rrhh')
      .select('id')
      .or(`id.eq.${usuarioId},usuario_id.eq.${usuarioId}`)
      .maybeSingle()

    if (!ficha) {
      return NextResponse.json(
        { error: 'El colaborador no tiene ficha RRHH' },
        { status: 404 }
      )
    }
    const fichaId = ficha.id

    // Obtener coordenadas de la tienda para validar radio GPS
    const { data: tienda } = await supabase
      .from('tiendas')
      .select('id, nombre, gps_lat, gps_lng')
      .eq('id', parsed.data.tienda_id)
      .single()

    if (!tienda) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    // Calcular distancia y validar radio
    let dentro_radio: boolean | null = null
    let distancia_tienda_metros: number | null = null
    if (tienda.gps_lat && tienda.gps_lng && parsed.data.gps_lat && parsed.data.gps_lng) {
      distancia_tienda_metros = calcularDistanciaMetros(
        parsed.data.gps_lat,
        parsed.data.gps_lng,
        tienda.gps_lat,
        tienda.gps_lng
      )
      dentro_radio = distancia_tienda_metros <= 100 // 100m de radio
    }

    // Determinar estado según validaciones
    let estado = 'VALIDO'
    if (parsed.data.mock_location_detectado) {
      estado = 'RECHAZADO'
    } else if (dentro_radio === false) {
      estado = 'OBSERVADO'
    }

    const datosInsert = {
      usuario_id: fichaId,
      tienda_id: parsed.data.tienda_id,
      tipo: parsed.data.tipo,
      hora_dispositivo: parsed.data.hora_dispositivo,
      foto_url: parsed.data.foto_url || null,
      gps_lat: parsed.data.gps_lat,
      gps_lng: parsed.data.gps_lng,
      gps_accuracy: parsed.data.gps_accuracy || null,
      mock_location_detectado: parsed.data.mock_location_detectado || false,
      dentro_radio,
      distancia_tienda_metros,
      estado,
    }

    const { data, error } = await insertAsistencia(supabase, datosInsert)

    if (error) {
      // Unique constraint violation = ya marcó ese tipo en esa fecha/tienda
      if (error.includes('asistencia_unique_marcacion')) {
        return NextResponse.json(
          { error: `Ya existe una marcación de ${parsed.data.tipo} para este día en esta tienda` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, asistencia: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
