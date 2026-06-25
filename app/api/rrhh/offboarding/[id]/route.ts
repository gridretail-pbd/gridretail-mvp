import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchOffboardingById, updateOffboarding } from '@/lib/rrhh/queries/offboarding'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data, error } = await fetchOffboardingById(supabase, id)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Proceso de offboarding no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ offboarding: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    // Verificar que existe
    const { data: existente } = await fetchOffboardingById(supabase, id)
    if (!existente) {
      return NextResponse.json(
        { error: 'Proceso de offboarding no encontrado' },
        { status: 404 }
      )
    }

    // Solo permitir campos específicos
    const camposPermitidos = ['tareas', 'estado', 'notas', 'fecha_cierre']
    const datosUpdate: Record<string, unknown> = {}

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        datosUpdate[campo] = body[campo]
      }
    }

    if (Object.keys(datosUpdate).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      )
    }

    const { data, error } = await updateOffboarding(supabase, id, datosUpdate)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, offboarding: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
