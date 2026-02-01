import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Leer tipos de venta desde la tabla tipos_venta
    const { data: tiposVenta, error } = await supabase
      .from('tipos_venta')
      .select('*')
      .eq('activo', true)
      .order('orden')

    if (error) {
      console.error('Error obteniendo tipos de venta:', error)
      return NextResponse.json(
        { error: 'Error al obtener tipos de venta' },
        { status: 500 }
      )
    }

    // Agrupar por categoría para el frontend
    const categorias = new Map<string, typeof tiposVenta>()

    for (const tipo of tiposVenta || []) {
      const categoria = tipo.categoria || 'OTROS'
      if (!categorias.has(categoria)) {
        categorias.set(categoria, [])
      }
      categorias.get(categoria)!.push(tipo)
    }

    // Convertir a formato que espera el frontend
    const tiposAgrupados: Record<string, typeof tiposVenta> = {}
    for (const [categoria, tipos] of categorias) {
      tiposAgrupados[categoria] = tipos
    }

    return NextResponse.json({
      tiposVenta: tiposVenta || [],
      tiposAgrupados,
      categorias: Array.from(categorias.keys()),
    })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
