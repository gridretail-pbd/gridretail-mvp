import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { avanzarEtapa } from '@/lib/rrhh/queries/candidatos'
import { candidatoAvanzarEtapaSchema } from '@/lib/rrhh/schemas'
import type { EtapaPipeline } from '@/lib/rrhh/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const parsed = candidatoAvanzarEtapaSchema.safeParse({
      candidato_id: id,
      ...body,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { data, error } = await avanzarEtapa(
      supabase,
      id,
      parsed.data.etapa_destino as EtapaPipeline,
      body.registrado_por,
      parsed.data.notas
    )

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
