import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/comisiones/esquemas/[id]/aprobar
 * Aprueba un esquema en estado draft
 * Al aprobar, archiva automáticamente otros esquemas aprobados del mismo período
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { approved_by, approval_notes } = body

    // Verificar que el esquema existe y está en draft
    const { data: scheme, error: fetchError } = await supabase
      .from('commission_schemes')
      .select('id, status, scheme_type, year, month')
      .eq('id', id)
      .single()

    if (fetchError || !scheme) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (scheme.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Verificar que tenga al menos una partida
    const { count: itemsCount } = await supabase
      .from('commission_scheme_items')
      .select('*', { count: 'exact', head: true })
      .eq('scheme_id', id)

    if (!itemsCount || itemsCount === 0) {
      return NextResponse.json(
        { error: 'El esquema debe tener al menos una partida para ser aprobado' },
        { status: 400 }
      )
    }

    // Archivar otros esquemas aprobados del mismo tipo y período
    const { error: archiveError } = await supabase
      .from('commission_schemes')
      .update({ status: 'archivado' })
      .eq('scheme_type', scheme.scheme_type)
      .eq('year', scheme.year)
      .eq('month', scheme.month)
      .eq('status', 'aprobado')
      .neq('id', id)

    if (archiveError) {
      console.error('Error archivando esquemas anteriores:', archiveError)
    }

    // Aprobar el esquema
    const { data: updatedScheme, error: updateError } = await supabase
      .from('commission_schemes')
      .update({
        status: 'aprobado',
        approved_by,
        approved_at: new Date().toISOString(),
        approval_notes,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error aprobando esquema:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      scheme: updatedScheme,
      message: 'Esquema aprobado exitosamente',
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
