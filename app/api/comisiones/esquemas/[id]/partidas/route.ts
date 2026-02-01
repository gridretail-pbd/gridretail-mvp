import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/comisiones/esquemas/[id]/partidas
 * Obtiene todas las partidas de un esquema con sus candados y escalas PxQ
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Obtener partidas con tipo de partida, preset y tipos de venta mapeados
    const { data: items, error } = await supabase
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
      .eq('scheme_id', id)
      .order('display_order')

    if (error) {
      console.error('Error obteniendo partidas:', error)
      return NextResponse.json(
        { error: 'Error al obtener partidas' },
        { status: 500 }
      )
    }

    // Para cada partida, obtener sus candados y escalas PxQ
    const itemsWithDetails = await Promise.all(
      (items || []).map(async (item) => {
        // Obtener candados
        const { data: locks } = await supabase
          .from('commission_item_locks')
          .select(`
            *,
            required_item_type:commission_item_types(id, code, name)
          `)
          .eq('scheme_item_id', item.id)

        // Obtener escalas PxQ si aplica
        const { data: pxqScales } = await supabase
          .from('commission_pxq_scales')
          .select('*')
          .eq('scheme_item_id', item.id)
          .order('display_order')

        // Transformar commission_item_ventas a formato más limpio
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

        return {
          ...item,
          tipos_venta: tiposVenta,
          commission_item_ventas: undefined, // Limpiar el campo original
          locks: locks || [],
          pxq_scales: pxqScales || [],
        }
      })
    )

    return NextResponse.json({
      items: itemsWithDetails,
      total: itemsWithDetails.length,
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
 * POST /api/comisiones/esquemas/[id]/partidas
 * Crea una nueva partida en el esquema
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar que el esquema existe y está en draft
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
        { error: 'Solo se pueden agregar partidas a esquemas en estado borrador' },
        { status: 400 }
      )
    }

    // Si tiene item_type_id (partida de catálogo), verificar que no exista duplicado
    if (body.item_type_id) {
      const { data: existingItem } = await supabase
        .from('commission_scheme_items')
        .select('id')
        .eq('scheme_id', id)
        .eq('item_type_id', body.item_type_id)
        .single()

      if (existingItem) {
        return NextResponse.json(
          { error: 'Ya existe una partida de este tipo en el esquema' },
          { status: 400 }
        )
      }
    }

    // Extraer tipos_venta del body antes de crear la partida
    const tiposVentaSelections = body.tipos_venta_ids || []
    delete body.tipos_venta_ids

    // Obtener el siguiente display_order
    const { data: lastItem } = await supabase
      .from('commission_scheme_items')
      .select('display_order')
      .eq('scheme_id', id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (lastItem?.display_order || 0) + 1

    // Crear partida con nuevos campos v2.1
    const itemData = {
      scheme_id: id,
      item_type_id: body.item_type_id || null,
      preset_id: body.preset_id || null,
      custom_name: body.custom_name || null,
      custom_description: body.custom_description || null,
      quota: body.quota ?? null,
      weight: body.weight ?? null,
      mix_factor: body.mix_factor ?? null,
      variable_amount: body.variable_amount ?? 0,
      min_fulfillment: body.min_fulfillment ?? null,
      has_cap: body.has_cap ?? false,
      cap_percentage: body.cap_percentage ?? null,
      cap_amount: body.cap_amount ?? null,
      is_active: body.is_active ?? true,
      display_order: body.display_order ?? nextOrder,
      notes: body.notes ?? null,
    }

    const { data: item, error } = await supabase
      .from('commission_scheme_items')
      .insert(itemData)
      .select(`
        *,
        item_type:commission_item_types(*),
        preset:partition_presets(*)
      `)
      .single()

    if (error) {
      console.error('Error creando partida:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Si hay tipos de venta seleccionados, crear los mapeos en commission_item_ventas
    let tiposVenta: Array<{
      id: string
      tipo_venta_id: string
      codigo?: string
      nombre?: string
      categoria?: string
      cuenta_linea: boolean
      cuenta_equipo: boolean
    }> = []

    if (tiposVentaSelections.length > 0) {
      const ventasData = tiposVentaSelections.map((tv: {
        tipo_venta_id: string
        cuenta_linea?: boolean
        cuenta_equipo?: boolean
      }) => ({
        scheme_item_id: item.id,
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
        console.error('Error creando mapeo de tipos de venta:', ventasError)
        // No fallar la creación de la partida, solo loguear
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

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        tipos_venta: tiposVenta,
        locks: [],
        pxq_scales: [],
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
