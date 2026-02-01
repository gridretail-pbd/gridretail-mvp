import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

// GET /api/usuarios — Lista con filtros y paginación
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || ''
    const rol = searchParams.get('rol') || ''
    const tienda_id = searchParams.get('tienda_id') || ''
    const activo = searchParams.get('activo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const offset = (page - 1) * limit

    // Query base: usuarios con tiendas
    let query = supabase
      .from('usuarios')
      .select(`
        id, codigo_asesor, dni, nombre_completo, email, rol, zona, activo, created_at, updated_at,
        usuarios_tiendas (
          id, tienda_id, es_principal,
          tiendas ( id, codigo, nombre )
        )
      `, { count: 'exact' })

    // Filtros
    if (search) {
      query = query.or(`codigo_asesor.ilike.%${search}%,nombre_completo.ilike.%${search}%,dni.ilike.%${search}%`)
    }

    if (rol) {
      query = query.eq('rol', rol)
    }

    if (activo !== null && activo !== undefined && activo !== '') {
      query = query.eq('activo', activo === 'true')
    }

    // Ordenar y paginar
    query = query.order('nombre_completo', { ascending: true })
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Si hay filtro por tienda, filtrar en memoria (supabase no filtra por relación fácilmente)
    let filtered = data || []
    if (tienda_id) {
      filtered = filtered.filter((u: any) =>
        u.usuarios_tiendas?.some((ut: any) => ut.tienda_id === tienda_id)
      )
    }

    // Transformar datos para incluir tiendas de forma más limpia
    const usuarios = filtered.map((u: any) => {
      const { usuarios_tiendas, ...usuario } = u
      return {
        ...usuario,
        tiendas: (usuarios_tiendas || []).map((ut: any) => ({
          id: ut.id,
          tienda_id: ut.tienda_id,
          es_principal: ut.es_principal,
          tienda: ut.tiendas,
        })),
      }
    })

    return NextResponse.json({
      data: usuarios,
      pagination: {
        total: tienda_id ? filtered.length : (count || 0),
        page,
        limit,
        totalPages: Math.ceil((tienda_id ? filtered.length : (count || 0)) / limit),
      },
    })
  } catch (error) {
    console.error('Error listando usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/usuarios — Crear usuario
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      codigo_asesor, dni, nombre_completo, email, rol, zona, activo,
      password, tiendas
    } = body

    // Validar campos requeridos
    if (!codigo_asesor || !dni || !nombre_completo || !rol || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Verificar unicidad de código
    const { data: existeCodigo } = await supabase
      .from('usuarios')
      .select('id')
      .eq('codigo_asesor', codigo_asesor)
      .maybeSingle()

    if (existeCodigo) {
      return NextResponse.json(
        { error: 'Este código de asesor ya existe' },
        { status: 409 }
      )
    }

    // Verificar unicidad de DNI
    const { data: existeDni } = await supabase
      .from('usuarios')
      .select('id')
      .eq('dni', dni)
      .maybeSingle()

    if (existeDni) {
      return NextResponse.json(
        { error: 'Este DNI ya está registrado' },
        { status: 409 }
      )
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // Insertar usuario
    const { data: usuario, error: insertError } = await supabase
      .from('usuarios')
      .insert({
        codigo_asesor,
        dni,
        nombre_completo,
        email: email || null,
        rol,
        zona: zona || null,
        activo: activo !== false,
        password_hash,
      })
      .select('id, codigo_asesor, dni, nombre_completo, email, rol, zona, activo, created_at, updated_at')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // Insertar asignaciones de tiendas
    if (tiendas && tiendas.length > 0) {
      const tiendaRows = tiendas.map((t: any) => ({
        usuario_id: usuario.id,
        tienda_id: t.tienda_id,
        es_principal: t.es_principal || false,
      }))

      const { error: tiendasError } = await supabase
        .from('usuarios_tiendas')
        .insert(tiendaRows)

      if (tiendasError) {
        // Rollback: eliminar usuario recién creado
        await supabase.from('usuarios').delete().eq('id', usuario.id)
        return NextResponse.json(
          { error: 'Error asignando tiendas: ' + tiendasError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true, usuario }, { status: 201 })
  } catch (error) {
    console.error('Error creando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
