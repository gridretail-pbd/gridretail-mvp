import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ImportRow {
  codigo_asesor: string
  tipo_penalidad: string
  cantidad: number
  monto_original: number
  descripcion?: string
  referencia?: string
}

interface ImportResult {
  success: boolean
  imported: number
  errors: Array<{
    row: number
    message: string
  }>
  warnings: Array<{
    row: number
    message: string
  }>
}

/**
 * POST /api/penalidades/import
 * Importar penalidades desde archivo FICHA
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      year,
      month,
      file_name,
      rows,
    }: {
      year: number
      month: number
      file_name: string
      rows: ImportRow[]
    } = body

    if (!year || !month || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Datos de importación inválidos' },
        { status: 400 }
      )
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      errors: [],
      warnings: [],
    }

    // Get all penalty types (entel source)
    const { data: penaltyTypes } = await supabase
      .from('penalty_types')
      .select('id, code, name, base_amount_ssnn')
      .eq('source', 'entel')
      .eq('is_active', true)

    const typeMap = new Map(penaltyTypes?.map((t) => [t.code.toUpperCase(), t]) || [])

    // Get all active users with their codes
    const { data: users } = await supabase
      .from('usuarios')
      .select('id, codigo_asesor, tienda_id')
      .eq('estado', 'ACTIVO')

    const userMap = new Map(
      users?.map((u) => [u.codigo_asesor?.toUpperCase(), u]) || []
    )

    // Get equivalences for transfer calculation
    const { data: equivalences } = await supabase
      .from('penalty_equivalences')
      .select('*')
      .is('valid_to', null)

    const equivMap = new Map(equivalences?.map((e) => [e.penalty_type_id, e]) || [])

    // Process each row
    const penaltiesToInsert: Array<{
      user_id: string
      store_id: string | null
      penalty_type_id: string
      year: number
      month: number
      quantity: number
      original_amount: number
      transferred_amount: number
      status: string
      source: string
      description: string | null
      reference: string | null
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row (header is row 1)

      // Validate codigo_asesor
      if (!row.codigo_asesor) {
        result.errors.push({ row: rowNum, message: 'Código de asesor vacío' })
        continue
      }

      const user = userMap.get(row.codigo_asesor.toUpperCase())
      if (!user) {
        result.errors.push({
          row: rowNum,
          message: `Usuario no encontrado: ${row.codigo_asesor}`,
        })
        continue
      }

      // Validate penalty type
      if (!row.tipo_penalidad) {
        result.errors.push({ row: rowNum, message: 'Tipo de penalidad vacío' })
        continue
      }

      const penaltyType = typeMap.get(row.tipo_penalidad.toUpperCase())
      if (!penaltyType) {
        result.warnings.push({
          row: rowNum,
          message: `Tipo de penalidad no reconocido: ${row.tipo_penalidad}`,
        })
        continue
      }

      // Calculate transferred amount
      const equivalence = equivMap.get(penaltyType.id)
      let transferredAmount = 0

      if (equivalence) {
        const originalAmount = row.monto_original || penaltyType.base_amount_ssnn || 0
        const quantity = row.cantidad || 1

        switch (equivalence.transfer_type) {
          case 'none':
            transferredAmount = 0
            break
          case 'full':
            transferredAmount = originalAmount * quantity
            break
          case 'percentage':
            transferredAmount =
              originalAmount * quantity * ((equivalence.transfer_percentage || 100) / 100)
            break
          case 'fixed':
            transferredAmount = (equivalence.transfer_fixed_amount || 0) * quantity
            break
          case 'partial_count':
            const maxIncidents = equivalence.max_incidents_per_month || quantity
            const effectiveQuantity = Math.min(quantity, maxIncidents)
            transferredAmount = originalAmount * effectiveQuantity
            break
          default:
            transferredAmount = originalAmount * quantity
        }
      } else {
        // No equivalence configured, default to full transfer
        const originalAmount = row.monto_original || penaltyType.base_amount_ssnn || 0
        transferredAmount = originalAmount * (row.cantidad || 1)
      }

      penaltiesToInsert.push({
        user_id: user.id,
        store_id: user.tienda_id,
        penalty_type_id: penaltyType.id,
        year,
        month,
        quantity: row.cantidad || 1,
        original_amount: row.monto_original || penaltyType.base_amount_ssnn || 0,
        transferred_amount: Math.round(transferredAmount * 100) / 100,
        status: 'pending',
        source: 'entel',
        description: row.descripcion || null,
        reference: row.referencia || null,
      })
    }

    // Insert penalties in batches
    if (penaltiesToInsert.length > 0) {
      const batchSize = 100
      for (let i = 0; i < penaltiesToInsert.length; i += batchSize) {
        const batch = penaltiesToInsert.slice(i, i + batchSize)
        const { error } = await supabase.from('hc_penalties').insert(batch)

        if (error) {
          console.error('Error inserting batch:', error)
          result.errors.push({
            row: 0,
            message: `Error al insertar registros ${i + 1}-${i + batch.length}: ${error.message}`,
          })
        } else {
          result.imported += batch.length
        }
      }
    }

    // Create import record
    const { data: currentUser } = await supabase.auth.getUser()

    await supabase.from('penalty_imports').insert({
      year,
      month,
      file_name: file_name || 'import.xlsx',
      imported_rows: result.imported,
      error_rows: result.errors.length,
      status: result.errors.length === 0 ? 'completed' : 'completed_with_errors',
      imported_by: currentUser?.user?.id || null,
      imported_at: new Date().toISOString(),
      import_log: {
        total_rows: rows.length,
        imported: result.imported,
        errors: result.errors,
        warnings: result.warnings,
      },
    })

    result.success = result.imported > 0

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en importación:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/penalidades/import
 * Obtener historial de importaciones
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const limit = parseInt(searchParams.get('limit') || '10')

    let query = supabase
      .from('penalty_imports')
      .select(`
        *,
        imported_by_user:usuarios!penalty_imports_imported_by_fkey(id, nombre_completo)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (year) {
      query = query.eq('year', parseInt(year))
    }

    if (month) {
      query = query.eq('month', parseInt(month))
    }

    const { data, error } = await query

    if (error) {
      console.error('Error obteniendo importaciones:', error)
      return NextResponse.json(
        { error: 'Error al obtener importaciones' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
