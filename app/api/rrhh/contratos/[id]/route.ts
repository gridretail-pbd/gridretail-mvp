import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchContratoById, updateContrato } from '@/lib/rrhh/queries/contratos'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await fetchContratoById(supabase, id)

    if (error || !data) {
      return NextResponse.json(
        { error: 'Contrato no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ contrato: data })
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

    // Verificar que el contrato existe
    const { data: existente } = await supabase
      .from('contratos')
      .select('id, estado')
      .eq('id', id)
      .single()

    if (!existente) {
      return NextResponse.json(
        { error: 'Contrato no encontrado' },
        { status: 404 }
      )
    }

    // Campos permitidos para actualización
    const camposPermitidos = [
      'tipo_contrato', 'fecha_inicio', 'fecha_fin', 'cargo', 'remuneracion',
      'tienda_asignada_id', 'estado', 'documento_url', 'notas',
      'motivo_no_renovacion',
      // Firma electrónica
      'firma_colaborador_timestamp', 'firma_colaborador_ip',
      'firma_colaborador_geo', 'firma_colaborador_user_agent',
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

    const { data, error } = await updateContrato(supabase, id, datosUpdate)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, contrato: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
