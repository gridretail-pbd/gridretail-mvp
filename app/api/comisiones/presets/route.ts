import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/comisiones/presets
 * Obtiene todos los presets activos con sus tipos de venta mapeados
 * Utiliza la vista vw_partition_presets para obtener datos enriquecidos
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Filtros opcionales
    const group = searchParams.get('group') // 'agrupacion' | 'individual'
    const category = searchParams.get('category') // 'principal' | 'adicional' | etc.

    // Intentar usar la vista primero
    let query = supabase
      .from('vw_partition_presets')
      .select('*')

    if (group) {
      query = query.eq('preset_group', group)
    }

    if (category) {
      query = query.eq('default_category', category)
    }

    const { data: presets, error } = await query
      .order('preset_group')
      .order('display_order')

    if (error) {
      // Si la vista no existe, intentar consulta directa
      if (error.code === '42P01') {
        const directQuery = supabase
          .from('partition_presets')
          .select(`
            *,
            partition_preset_ventas (
              tipo_venta_id,
              cuenta_linea,
              cuenta_equipo,
              display_order,
              tipos_venta (
                id,
                codigo,
                nombre,
                categoria
              )
            )
          `)
          .eq('is_active', true)

        if (group) {
          directQuery.eq('preset_group', group)
        }

        if (category) {
          directQuery.eq('default_category', category)
        }

        const { data: directData, error: directError } = await directQuery
          .order('preset_group')
          .order('display_order')

        if (directError) {
          console.error('Error fetching presets:', directError)
          return NextResponse.json(
            { error: 'Error al obtener presets' },
            { status: 500 }
          )
        }

        // Transformar datos al formato esperado
        const transformedPresets = directData?.map(preset => ({
          id: preset.id,
          code: preset.code,
          name: preset.name,
          short_name: preset.short_name,
          description: preset.description,
          default_category: preset.default_category,
          default_calculation_type: preset.default_calculation_type,
          preset_group: preset.preset_group,
          display_order: preset.display_order,
          is_active: preset.is_active,
          tipos_venta: preset.partition_preset_ventas?.map((pv: {
            tipo_venta_id: string
            cuenta_linea: boolean
            cuenta_equipo: boolean
            tipos_venta: {
              id: string
              codigo: string
              nombre: string
              categoria: string
            }
          }) => ({
            tipo_venta_id: pv.tipo_venta_id,
            codigo: pv.tipos_venta?.codigo,
            nombre: pv.tipos_venta?.nombre,
            categoria: pv.tipos_venta?.categoria,
            cuenta_linea: pv.cuenta_linea,
            cuenta_equipo: pv.cuenta_equipo
          })) || []
        }))

        return NextResponse.json(transformedPresets)
      }

      console.error('Error fetching presets:', error)
      return NextResponse.json(
        { error: 'Error al obtener presets' },
        { status: 500 }
      )
    }

    // La vista retorna preset_id, normalizar a id para el frontend
    const normalizedPresets = presets?.map((preset: Record<string, unknown>) => ({
      id: preset.preset_id || preset.id,
      code: preset.code,
      name: preset.name,
      short_name: preset.short_name,
      description: preset.description,
      default_category: preset.default_category,
      default_calculation_type: preset.default_calculation_type,
      preset_group: preset.preset_group,
      display_order: preset.display_order,
      is_active: preset.is_active,
      tipos_venta: preset.tipos_venta || [],
    }))

    return NextResponse.json(normalizedPresets)
  } catch (error) {
    console.error('Error in presets API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
