import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateAlerta } from '@/lib/rrhh/queries/alertas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    // Solo permitir campos específicos
    const datosUpdate: Record<string, unknown> = {}

    // Marcar como leída
    if (body.estado === 'LEIDA') {
      datosUpdate.estado = 'LEIDA'
      datosUpdate.leida_at = new Date().toISOString()
    }

    // Accionar alerta
    if (body.estado === 'ACCIONADA') {
      datosUpdate.estado = 'ACCIONADA'
      datosUpdate.accion_tomada = body.accion_tomada || null
      datosUpdate.accion_por = body.accion_por || null
      datosUpdate.accion_at = new Date().toISOString()
      if (!datosUpdate.leida_at) {
        datosUpdate.leida_at = new Date().toISOString()
      }
    }

    // Descartar alerta
    if (body.estado === 'DESCARTADA') {
      datosUpdate.estado = 'DESCARTADA'
      datosUpdate.accion_por = body.accion_por || null
      datosUpdate.accion_at = new Date().toISOString()
    }

    if (Object.keys(datosUpdate).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionó una acción válida' },
        { status: 400 }
      )
    }

    const { data, error } = await updateAlerta(supabase, id, datosUpdate)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, alerta: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
