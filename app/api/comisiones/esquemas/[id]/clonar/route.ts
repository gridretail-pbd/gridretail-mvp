import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/comisiones/esquemas/[id]/clonar
 * Clona un esquema existente (incluyendo partidas, candados y restricciones)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { name, code, created_by } = body

    // Obtener esquema original
    const { data: original, error: fetchError } = await supabase
      .from('commission_schemes')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !original) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    // Validar que el nuevo código no exista
    const { data: existing } = await supabase
      .from('commission_schemes')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un esquema con ese código' },
        { status: 400 }
      )
    }

    // Crear nuevo esquema como clon
    const newSchemeData = {
      name: name || `${original.name} (Copia)`,
      code: code || `${original.code}_COPIA`,
      description: original.description,
      scheme_type: original.scheme_type,
      year: original.year,
      month: original.month,
      status: 'draft',
      source: 'socio',
      parent_scheme_id: id,
      fixed_salary: original.fixed_salary,
      variable_salary: original.variable_salary,
      total_ss_quota: original.total_ss_quota,
      default_min_fulfillment: original.default_min_fulfillment,
      created_by,
    }

    const { data: newScheme, error: createError } = await supabase
      .from('commission_schemes')
      .insert(newSchemeData)
      .select()
      .single()

    if (createError) {
      console.error('Error creando clon:', createError)
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      )
    }

    // Clonar partidas (incluyendo todos los campos v3.x)
    const { data: originalItems } = await supabase
      .from('commission_scheme_items')
      .select('*')
      .eq('scheme_id', id)

    if (originalItems && originalItems.length > 0) {
      const newItems = originalItems.map(item => ({
        scheme_id: newScheme.id,
        item_type_id: item.item_type_id,
        preset_id: item.preset_id,
        custom_name: item.custom_name,
        custom_description: item.custom_description,
        original_label: item.original_label,
        quota: item.quota,
        quota_amount: item.quota_amount,
        weight: item.weight,
        mix_factor: item.mix_factor,
        variable_amount: item.variable_amount,
        min_fulfillment: item.min_fulfillment,
        has_cap: item.has_cap,
        cap_percentage: item.cap_percentage,
        cap_amount: item.cap_amount,
        is_active: item.is_active,
        display_order: item.display_order,
        notes: item.notes,
        // Campos v3.x
        contribution_type: item.contribution_type,
        range_source: item.range_source,
        uses_conversion_table: item.uses_conversion_table,
        accelerator_ranges: item.accelerator_ranges,
        overcompliance_mode: item.overcompliance_mode,
        cap_units: item.cap_units,
        pxq_bonus_amount: item.pxq_bonus_amount,
        overcap_max_units: item.overcap_max_units,
        overcap_max_amount: item.overcap_max_amount,
        measurement_type: item.measurement_type,
        fulfillment_method: item.fulfillment_method,
        measurement_config: item.measurement_config,
        variable_source: item.variable_source,
      }))

      const { data: insertedItems, error: itemsError } = await supabase
        .from('commission_scheme_items')
        .insert(newItems)
        .select()

      if (itemsError) {
        console.error('Error clonando partidas:', itemsError)
      }

      // Crear mapeo de IDs antiguos a nuevos para clonar candados
      if (insertedItems) {
        const itemIdMap = new Map<string, string>()
        for (let i = 0; i < originalItems.length; i++) {
          itemIdMap.set(originalItems[i].id, insertedItems[i].id)
        }

        // Clonar candados
        const { data: originalLocks } = await supabase
          .from('commission_item_locks')
          .select('*')
          .in('scheme_item_id', originalItems.map(i => i.id))

        if (originalLocks && originalLocks.length > 0) {
          const newLocks = originalLocks.map(lock => ({
            scheme_item_id: itemIdMap.get(lock.scheme_item_id),
            lock_type: lock.lock_type,
            required_item_type_id: lock.required_item_type_id,
            required_value: lock.required_value,
            is_active: lock.is_active,
            description: lock.description,
          }))

          await supabase
            .from('commission_item_locks')
            .insert(newLocks)
        }

        // Clonar escalas PxQ
        const { data: originalScales } = await supabase
          .from('commission_pxq_scales')
          .select('*')
          .in('scheme_item_id', originalItems.map(i => i.id))

        if (originalScales && originalScales.length > 0) {
          const newScales = originalScales.map(scale => ({
            scheme_item_id: itemIdMap.get(scale.scheme_item_id),
            min_fulfillment: scale.min_fulfillment,
            max_fulfillment: scale.max_fulfillment,
            amount_per_unit: scale.amount_per_unit,
            display_order: scale.display_order,
          }))

          await supabase
            .from('commission_pxq_scales')
            .insert(newScales)
        }

        // Clonar mapeos de tipos de venta
        const { data: originalVentas } = await supabase
          .from('commission_item_ventas')
          .select('*')
          .in('scheme_item_id', originalItems.map(i => i.id))

        if (originalVentas && originalVentas.length > 0) {
          const newVentas = originalVentas.map(venta => ({
            scheme_item_id: itemIdMap.get(venta.scheme_item_id),
            tipo_venta_id: venta.tipo_venta_id,
            cuenta_linea: venta.cuenta_linea,
            cuenta_equipo: venta.cuenta_equipo,
          }))

          await supabase
            .from('commission_item_ventas')
            .insert(newVentas)
        }

        // Clonar multiplicadores (v3.4)
        const { data: originalMultipliers } = await supabase
          .from('commission_item_multipliers')
          .select('*')
          .in('item_id', originalItems.map(i => i.id))

        if (originalMultipliers && originalMultipliers.length > 0) {
          const newMultipliers = originalMultipliers.map(mult => ({
            item_id: itemIdMap.get(mult.item_id),
            multiplier_type: mult.multiplier_type,
            activation_criteria: mult.activation_criteria,
            source_description: mult.source_description,
            source_item_id: mult.source_item_id,
            threshold_value: mult.threshold_value,
            factor_if_met: mult.factor_if_met,
            factor_if_not_met: mult.factor_if_not_met,
            tiered_ranges: mult.tiered_ranges,
            operator_cedente: mult.operator_cedente,
            measurement_type: mult.measurement_type,
            measurement_config: mult.measurement_config,
            is_active: mult.is_active,
            display_order: mult.display_order,
            notes: mult.notes,
          }))

          await supabase
            .from('commission_item_multipliers')
            .insert(newMultipliers)
        }
      }
    }

    // Clonar restricciones
    const { data: originalRestrictions } = await supabase
      .from('commission_item_restrictions')
      .select('*')
      .eq('scheme_id', id)

    if (originalRestrictions && originalRestrictions.length > 0) {
      const newRestrictions = originalRestrictions.map(rest => ({
        scheme_id: newScheme.id,
        restriction_type: rest.restriction_type,
        plan_code: rest.plan_code,
        operator_code: rest.operator_code,
        max_percentage: rest.max_percentage,
        max_quantity: rest.max_quantity,
        min_percentage: rest.min_percentage,
        scope: rest.scope,
        is_active: rest.is_active,
        description: rest.description,
      }))

      await supabase
        .from('commission_item_restrictions')
        .insert(newRestrictions)
    }

    return NextResponse.json({
      success: true,
      scheme: newScheme,
      message: 'Esquema clonado exitosamente',
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
