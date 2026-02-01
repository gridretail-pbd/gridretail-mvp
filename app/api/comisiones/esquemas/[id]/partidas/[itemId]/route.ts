import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>
}

/**
 * GET /api/comisiones/esquemas/[id]/partidas/[itemId]
 * Obtiene una partida específica con sus candados y escalas
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params
    const supabase = await createClient()

    // Obtener partida con preset y tipos de venta
    const { data: item, error } = await supabase
      .from('commission_scheme_items')
      .select(`
        *,
        item_type:commission_item_types(*),
        preset:partition_presets(*),
        commission_item_ventas(
          id,
          tipo_venta_id,
          cuenta_linea,
          cuenta_equipo,
          tipos_venta:tipos_venta(id, codigo, nombre, categoria)
        )
      `)
      .eq('id', itemId)
      .eq('scheme_id', id)
      .single()

    if (error || !item) {
      return NextResponse.json(
        { error: 'Partida no encontrada' },
        { status: 404 }
      )
    }

    // Obtener candados
    const { data: locks } = await supabase
      .from('commission_item_locks')
      .select(`
        *,
        required_item_type:commission_item_types(id, code, name)
      `)
      .eq('scheme_item_id', itemId)

    // Obtener escalas PxQ
    const { data: pxqScales } = await supabase
      .from('commission_pxq_scales')
      .select('*')
      .eq('scheme_item_id', itemId)
      .order('display_order')

    // Transformar tipos de venta a formato limpio
    const tiposVenta = (item.commission_item_ventas || []).map((civ: {
      id: string
      tipo_venta_id: string
      cuenta_linea: boolean
      cuenta_equipo: boolean
      tipos_venta: { id: string; codigo: string; nombre: string; categoria: string } | null
    }) => ({
      id: civ.id,
      tipo_venta_id: civ.tipo_venta_id,
      codigo: civ.tipos_venta?.codigo,
      nombre: civ.tipos_venta?.nombre,
      categoria: civ.tipos_venta?.categoria,
      cuenta_linea: civ.cuenta_linea,
      cuenta_equipo: civ.cuenta_equipo,
    }))

    return NextResponse.json({
      item: {
        ...item,
        tipos_venta: tiposVenta,
        commission_item_ventas: undefined,
        locks: locks || [],
        pxq_scales: pxqScales || [],
      },
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
 * PUT /api/comisiones/esquemas/[id]/partidas/[itemId]
 * Actualiza una partida
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que el esquema está en draft
    const { data: scheme } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!scheme) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (scheme.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden editar partidas de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Extraer tipos_venta del body antes de actualizar
    const tiposVentaSelections = body.tipos_venta_ids
    delete body.tipos_venta_ids

    // Preparar datos para actualización
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'item_type_id', 'preset_id', 'custom_name', 'custom_description',
      'quota', 'weight', 'mix_factor', 'variable_amount', 'min_fulfillment',
      'has_cap', 'cap_percentage', 'cap_amount', 'is_active', 'display_order', 'notes'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Actualizar partida
    const { data: item, error } = await supabase
      .from('commission_scheme_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('scheme_id', id)
      .select(`
        *,
        item_type:commission_item_types(*),
        preset:partition_presets(*)
      `)
      .single()

    if (error) {
      console.error('Error actualizando partida:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Si se proporcionaron tipos_venta, actualizar los mapeos
    let tiposVenta: Array<{
      id: string
      tipo_venta_id: string
      codigo?: string
      nombre?: string
      categoria?: string
      cuenta_linea: boolean
      cuenta_equipo: boolean
    }> = []

    if (tiposVentaSelections !== undefined) {
      // Eliminar mapeos existentes
      await supabase
        .from('commission_item_ventas')
        .delete()
        .eq('scheme_item_id', itemId)

      // Crear nuevos mapeos si hay selecciones
      if (tiposVentaSelections && tiposVentaSelections.length > 0) {
        const ventasData = tiposVentaSelections.map((tv: {
          tipo_venta_id: string
          cuenta_linea?: boolean
          cuenta_equipo?: boolean
        }) => ({
          scheme_item_id: itemId,
          tipo_venta_id: tv.tipo_venta_id,
          cuenta_linea: tv.cuenta_linea ?? true,
          cuenta_equipo: tv.cuenta_equipo ?? false,
        }))

        const { data: insertedVentas, error: ventasError } = await supabase
          .from('commission_item_ventas')
          .insert(ventasData)
          .select(`
            id,
            tipo_venta_id,
            cuenta_linea,
            cuenta_equipo,
            tipos_venta:tipos_venta(id, codigo, nombre, categoria)
          `)

        if (ventasError) {
          console.error('Error actualizando tipos de venta:', ventasError)
        } else {
          tiposVenta = (insertedVentas || []).map((civ) => ({
            id: civ.id,
            tipo_venta_id: civ.tipo_venta_id,
            codigo: (civ.tipos_venta as { codigo?: string })?.codigo,
            nombre: (civ.tipos_venta as { nombre?: string })?.nombre,
            categoria: (civ.tipos_venta as { categoria?: string })?.categoria,
            cuenta_linea: civ.cuenta_linea,
            cuenta_equipo: civ.cuenta_equipo,
          }))
        }
      }
    } else {
      // Obtener tipos de venta existentes
      const { data: existingVentas } = await supabase
        .from('commission_item_ventas')
        .select(`
          id,
          tipo_venta_id,
          cuenta_linea,
          cuenta_equipo,
          tipos_venta:tipos_venta(id, codigo, nombre, categoria)
        `)
        .eq('scheme_item_id', itemId)

      tiposVenta = (existingVentas || []).map((civ) => ({
        id: civ.id,
        tipo_venta_id: civ.tipo_venta_id,
        codigo: (civ.tipos_venta as { codigo?: string })?.codigo,
        nombre: (civ.tipos_venta as { nombre?: string })?.nombre,
        categoria: (civ.tipos_venta as { categoria?: string })?.categoria,
        cuenta_linea: civ.cuenta_linea,
        cuenta_equipo: civ.cuenta_equipo,
      }))
    }

    // Obtener candados actualizados
    const { data: locks } = await supabase
      .from('commission_item_locks')
      .select(`
        *,
        required_item_type:commission_item_types(id, code, name)
      `)
      .eq('scheme_item_id', itemId)

    // Obtener escalas PxQ
    const { data: pxqScales } = await supabase
      .from('commission_pxq_scales')
      .select('*')
      .eq('scheme_item_id', itemId)
      .order('display_order')

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        tipos_venta: tiposVenta,
        locks: locks || [],
        pxq_scales: pxqScales || [],
      },
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
 * DELETE /api/comisiones/esquemas/[id]/partidas/[itemId]
 * Elimina una partida y sus candados/escalas asociados
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params
    const supabase = await createClient()

    // Verificar que el esquema está en draft
    const { data: scheme } = await supabase
      .from('commission_schemes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!scheme) {
      return NextResponse.json(
        { error: 'Esquema no encontrado' },
        { status: 404 }
      )
    }

    if (scheme.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar partidas de esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Eliminar partida (CASCADE eliminará candados y escalas)
    const { error } = await supabase
      .from('commission_scheme_items')
      .delete()
      .eq('id', itemId)
      .eq('scheme_id', id)

    if (error) {
      console.error('Error eliminando partida:', error)
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
