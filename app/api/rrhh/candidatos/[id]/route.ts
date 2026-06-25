import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCandidatoById, updateCandidato } from '@/lib/rrhh/queries/candidatos'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await fetchCandidatoById(supabase, id)

    if (error || !data) {
      return NextResponse.json(
        { error: 'Candidato no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ candidato: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que el candidato existe
    const { data: existente } = await supabase
      .from('candidatos')
      .select('id')
      .eq('id', id)
      .single()

    if (!existente) {
      return NextResponse.json(
        { error: 'Candidato no encontrado' },
        { status: 404 }
      )
    }

    // Campos permitidos para actualización
    const camposPermitidos = [
      'nombre_completo', 'telefono', 'email', 'fecha_nacimiento', 'genero',
      'distrito_residencia', 'direccion', 'gps_domicilio_lat', 'gps_domicilio_lng',
      'experiencia_telecom', 'experiencia_detalle',
      'disponibilidad_horario', 'disponibilidad_detalle',
      'fuente_captacion', 'referido_por', 'tienda_destino_id',
      'cv_url', 'foto_url', 'notas',
      // Campos Entel
      'entel_fecha_envio', 'entel_estado', 'entel_fecha_respuesta', 'entel_observaciones',
      'entel_usuario_fecha_solicitud', 'entel_usuario_estado', 'entel_usuario_confirmado',
      // Inducción
      'induccion_fecha_inicio', 'induccion_fecha_fin', 'induccion_capacitador_id',
      'induccion_checklist', 'induccion_evaluacion',
      // Sombra
      'sombra_tienda_id', 'sombra_mentor_id', 'sombra_fecha_inicio', 'sombra_fecha_fin',
      'sombra_evaluacion_mentor', 'sombra_evaluacion_supervisor', 'sombra_resultado',
    ]

    const datosUpdate: Record<string, unknown> = {}
    for (const campo of camposPermitidos) {
      if (campo in body) {
        datosUpdate[campo] = body[campo]
      }
    }

    if (Object.keys(datosUpdate).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      )
    }

    const { data, error } = await updateCandidato(supabase, id, datosUpdate)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
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
