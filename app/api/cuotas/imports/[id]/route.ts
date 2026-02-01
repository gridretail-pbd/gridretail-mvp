import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: importRecord, error } = await supabase
      .from('quota_imports')
      .select(`
        *,
        imported_by_user:usuarios!quota_imports_imported_by_fkey(nombre_completo),
        store_quotas(
          id, store_id, ss_quota, status,
          store:tiendas(id, codigo, nombre)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Importación no encontrada' },
          { status: 404 }
        )
      }
      console.error('Error obteniendo importación:', error)
      return NextResponse.json(
        { error: 'Error al obtener importación' },
        { status: 500 }
      )
    }

    // Transformar datos
    const importWithMeta = {
      ...importRecord,
      imported_by_name: importRecord.imported_by_user?.nombre_completo || null,
      imported_by_user: undefined,
    }

    return NextResponse.json({
      import: importWithMeta,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que la importación existe
    const { data: existing, error: fetchError } = await supabase
      .from('quota_imports')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Importación no encontrada' },
        { status: 404 }
      )
    }

    // Campos permitidos para actualizar
    const allowedFields = [
      'status',
      'total_rows',
      'imported_rows',
      'error_rows',
      'errors',
      'ai_interpretation_log',
      'column_mapping',
      'imported_at',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data: importRecord, error } = await supabase
      .from('quota_imports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando importación:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      import: importRecord,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar que la importación existe
    const { data: existing, error: fetchError } = await supabase
      .from('quota_imports')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Importación no encontrada' },
        { status: 404 }
      )
    }

    if (existing.status === 'completed') {
      // Verificar si hay store_quotas asociadas que ya fueron aprobadas
      const { data: approvedQuotas } = await supabase
        .from('store_quotas')
        .select('id')
        .eq('import_id', id)
        .eq('status', 'approved')

      if (approvedQuotas && approvedQuotas.length > 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar una importación con cuotas aprobadas' },
          { status: 400 }
        )
      }
    }

    // Eliminar store_quotas asociadas (cascadeará a hc_quotas)
    await supabase
      .from('store_quotas')
      .delete()
      .eq('import_id', id)

    // Eliminar la importación
    const { error } = await supabase
      .from('quota_imports')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando importación:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
