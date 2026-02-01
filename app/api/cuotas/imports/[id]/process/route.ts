import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface StoreQuotaInput {
  store_id: string
  store_name?: string
  ss_quota: number
  quota_breakdown: Record<string, number>
}

/**
 * Procesar importación y crear store_quotas
 * POST /api/cuotas/imports/[id]/process
 *
 * Body:
 * {
 *   quotas: [
 *     {
 *       store_id: string,
 *       store_name?: string,
 *       ss_quota: number,
 *       quota_breakdown: { VR: 75, OSS: 68, ... }
 *     }
 *   ],
 *   column_mapping?: object,
 *   replace_existing?: boolean
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { quotas, column_mapping, replace_existing = false } = body

    if (!quotas || !Array.isArray(quotas) || quotas.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de cuotas' },
        { status: 400 }
      )
    }

    // Obtener la importación
    const { data: importRecord, error: fetchError } = await supabase
      .from('quota_imports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !importRecord) {
      return NextResponse.json(
        { error: 'Importación no encontrada' },
        { status: 404 }
      )
    }

    if (importRecord.status === 'completed' && !replace_existing) {
      return NextResponse.json(
        { error: 'Esta importación ya fue procesada. Use replace_existing: true para reemplazar.' },
        { status: 400 }
      )
    }

    // Actualizar estado a processing
    await supabase
      .from('quota_imports')
      .update({ status: 'processing' })
      .eq('id', id)

    const errors: Array<{ store_id: string; error: string }> = []
    const created: Array<{ store_id: string; ss_quota: number }> = []

    // Si replace_existing, eliminar store_quotas anteriores de esta importación
    if (replace_existing) {
      await supabase
        .from('store_quotas')
        .delete()
        .eq('import_id', id)
    }

    // Verificar si ya existen cuotas para el período (no de esta importación)
    const { data: existingQuotas } = await supabase
      .from('store_quotas')
      .select('store_id')
      .eq('year', importRecord.year)
      .eq('month', importRecord.month)
      .neq('import_id', id)

    const existingStoreIds = new Set(existingQuotas?.map(q => q.store_id) || [])

    // Crear store_quotas
    for (const quota of quotas as StoreQuotaInput[]) {
      if (!quota.store_id || quota.ss_quota === undefined) {
        errors.push({
          store_id: quota.store_id || 'unknown',
          error: 'Faltan campos requeridos: store_id, ss_quota',
        })
        continue
      }

      // Verificar si ya existe una cuota para esta tienda (de otra importación)
      if (existingStoreIds.has(quota.store_id)) {
        errors.push({
          store_id: quota.store_id,
          error: 'Ya existe una cuota para esta tienda en este período',
        })
        continue
      }

      // Crear la cuota
      const { error: insertError } = await supabase
        .from('store_quotas')
        .insert({
          store_id: quota.store_id,
          year: importRecord.year,
          month: importRecord.month,
          ss_quota: quota.ss_quota,
          quota_breakdown: quota.quota_breakdown || {},
          source: 'entel',
          import_id: id,
          original_store_name: quota.store_name || null,
          status: 'draft',
          created_by: importRecord.imported_by,
        })

      if (insertError) {
        errors.push({
          store_id: quota.store_id,
          error: insertError.message,
        })
      } else {
        created.push({
          store_id: quota.store_id,
          ss_quota: quota.ss_quota,
        })
      }
    }

    // Actualizar importación con resultados
    const finalStatus = errors.length === 0 ? 'completed' : 'completed'
    const { error: updateError } = await supabase
      .from('quota_imports')
      .update({
        status: finalStatus,
        total_rows: quotas.length,
        imported_rows: created.length,
        error_rows: errors.length,
        errors: errors.length > 0 ? errors : null,
        column_mapping: column_mapping || null,
        imported_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error actualizando importación:', updateError)
    }

    // Obtener las cuotas creadas con datos de tienda
    const { data: createdQuotas } = await supabase
      .from('store_quotas')
      .select(`
        *,
        store:tiendas(id, codigo, nombre)
      `)
      .eq('import_id', id)

    return NextResponse.json({
      success: true,
      summary: {
        total: quotas.length,
        imported: created.length,
        errors: errors.length,
      },
      created_quotas: createdQuotas,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error interno:', error)

    // Intentar marcar la importación como fallida
    try {
      const { id } = await params
      const supabase = await createClient()
      await supabase
        .from('quota_imports')
        .update({ status: 'failed' })
        .eq('id', id)
    } catch {
      // Ignorar error al actualizar
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
