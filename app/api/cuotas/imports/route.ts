import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    // Obtener parámetros de filtro
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const status = searchParams.get('status')?.split(',').filter(Boolean)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Construir query
    let query = supabase
      .from('quota_imports')
      .select(`
        *,
        imported_by_user:usuarios!quota_imports_imported_by_fkey(nombre_completo)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Aplicar filtros
    if (year) {
      query = query.eq('year', parseInt(year))
    }

    if (month) {
      query = query.eq('month', parseInt(month))
    }

    if (status && status.length > 0) {
      query = query.in('status', status)
    }

    const { data: imports, error } = await query

    if (error) {
      console.error('Error obteniendo importaciones:', error)
      return NextResponse.json(
        { error: 'Error al obtener importaciones' },
        { status: 500 }
      )
    }

    // Transformar datos
    const importsWithMeta = imports?.map(imp => ({
      ...imp,
      imported_by_name: imp.imported_by_user?.nombre_completo || null,
      imported_by_user: undefined,
    })) || []

    return NextResponse.json({
      imports: importsWithMeta,
      total: importsWithMeta.length,
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * Crear registro de importación
 * POST /api/cuotas/imports
 *
 * Body:
 * {
 *   file_name: string,
 *   file_url?: string,
 *   file_size?: number,
 *   year: number,
 *   month: number,
 *   imported_by?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { file_name, year, month } = body

    if (!file_name || !year || !month) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: file_name, year, month' },
        { status: 400 }
      )
    }

    // Verificar si ya existe una importación para este período y archivo
    const { data: existing } = await supabase
      .from('quota_imports')
      .select('id, status')
      .eq('year', year)
      .eq('month', month)
      .eq('file_name', file_name)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: 'Ya existe una importación con este archivo para el período',
          existing_import: existing,
        },
        { status: 400 }
      )
    }

    // Crear registro de importación
    const importData = {
      file_name,
      file_url: body.file_url || null,
      file_size: body.file_size || null,
      year,
      month,
      status: 'pending',
      imported_by: body.imported_by || null,
      total_rows: 0,
      imported_rows: 0,
      error_rows: 0,
    }

    const { data: importRecord, error } = await supabase
      .from('quota_imports')
      .insert(importData)
      .select()
      .single()

    if (error) {
      console.error('Error creando importación:', error)
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
