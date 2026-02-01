import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lista de operadores cedentes por defecto (si no hay tabla en BD)
const OPERADORES_DEFAULT = [
  { id: '1', codigo: 'MOVISTAR', nombre: 'Movistar', activo: true },
  { id: '2', codigo: 'CLARO', nombre: 'Claro', activo: true },
  { id: '3', codigo: 'BITEL', nombre: 'Bitel', activo: true },
  { id: '4', codigo: 'WOM', nombre: 'WOM', activo: true },
]

export async function GET() {
  try {
    const supabase = await createClient()

    // Intentar obtener de la tabla operadores_cedentes
    const { data: operadores, error } = await supabase
      .from('operadores_cedentes')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('nombre')

    if (error) {
      // Si la tabla no existe o hay error, retornar lista por defecto
      console.log('Usando operadores por defecto:', error.message)
      return NextResponse.json({
        operadores: OPERADORES_DEFAULT.map(({ id, codigo, nombre }) => ({
          id,
          codigo,
          nombre,
        })),
      })
    }

    return NextResponse.json({
      operadores: operadores || OPERADORES_DEFAULT,
    })
  } catch (error) {
    console.error('Error obteniendo operadores:', error)
    // En caso de error, retornar lista por defecto
    return NextResponse.json({
      operadores: OPERADORES_DEFAULT.map(({ id, codigo, nombre }) => ({
        id,
        codigo,
        nombre,
      })),
    })
  }
}
