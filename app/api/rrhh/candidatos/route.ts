import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCandidatos, insertCandidato } from '@/lib/rrhh/queries/candidatos'
import { candidatoCreateSchema } from '@/lib/rrhh/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const etapa_actual = searchParams.get('etapa_actual')?.split(',').filter(Boolean)
    const fuente_captacion = searchParams.get('fuente_captacion') || undefined
    const descartadoParam = searchParams.get('descartado')
    const descartado = descartadoParam !== null ? descartadoParam === 'true' : undefined
    const search = searchParams.get('search') || undefined
    const tienda_destino_id = searchParams.get('tienda_destino_id') || undefined

    const { data, error } = await fetchCandidatos(supabase, {
      etapa_actual,
      fuente_captacion,
      descartado,
      search,
      tienda_destino_id,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ candidatos: data, total: data.length })
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

    const parsed = candidatoCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verificar DNI duplicado en candidatos activos (no descartados)
    const { data: existente } = await supabase
      .from('candidatos')
      .select('id, nombre_completo, etapa_actual, descartado')
      .eq('dni', parsed.data.dni)
      .eq('descartado', false)
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        {
          error: `Ya existe un candidato activo con DNI ${parsed.data.dni}: ${existente.nombre_completo} (${existente.etapa_actual})`,
        },
        { status: 409 }
      )
    }

    // registrado_por viene del body (el frontend lo envía)
    const datosInsert = {
      ...parsed.data,
      registrado_por: body.registrado_por,
      etapa_actual: 'CAPTACION',
      fecha_captacion: new Date().toISOString().split('T')[0],
    }

    const { data, error } = await insertCandidato(supabase, datosInsert)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    // Crear primera entrada en historial de etapas
    if (data) {
      await supabase.from('candidatos_etapas').insert({
        candidato_id: data.id,
        etapa: 'CAPTACION',
        registrado_por: body.registrado_por,
      })
    }

    return NextResponse.json({ success: true, candidato: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
