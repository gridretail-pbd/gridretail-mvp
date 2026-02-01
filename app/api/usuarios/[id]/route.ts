import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/usuarios/[id] — Detalle con tiendas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id, codigo_asesor, dni, nombre_completo, email, rol, zona, activo, created_at, updated_at,
        usuarios_tiendas (
          id, tienda_id, es_principal,
          tiendas ( id, codigo, nombre )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Transformar
    const { usuarios_tiendas, ...usuario } = data as any
    const result = {
      ...usuario,
      tiendas: (usuarios_tiendas || []).map((ut: any) => ({
        id: ut.id,
        tienda_id: ut.tienda_id,
        es_principal: ut.es_principal,
        tienda: ut.tiendas,
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error obteniendo usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT /api/usuarios/[id] — Actualizar usuario
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { codigo_asesor, dni, nombre_completo, email, rol, zona, activo, tiendas } = body

    // Verificar unicidad de código (excluyendo el usuario actual)
    if (codigo_asesor) {
      const { data: existeCodigo } = await supabase
        .from('usuarios')
        .select('id')
        .eq('codigo_asesor', codigo_asesor)
        .neq('id', id)
        .maybeSingle()

      if (existeCodigo) {
        return NextResponse.json({ error: 'Este código de asesor ya existe' }, { status: 409 })
      }
    }

    // Verificar unicidad de DNI (excluyendo el usuario actual)
    if (dni) {
      const { data: existeDni } = await supabase
        .from('usuarios')
        .select('id')
        .eq('dni', dni)
        .neq('id', id)
        .maybeSingle()

      if (existeDni) {
        return NextResponse.json({ error: 'Este DNI ya está registrado' }, { status: 409 })
      }
    }

    // Actualizar usuario
    const updateData: any = {}
    if (codigo_asesor !== undefined) updateData.codigo_asesor = codigo_asesor
    if (dni !== undefined) updateData.dni = dni
    if (nombre_completo !== undefined) updateData.nombre_completo = nombre_completo
    if (email !== undefined) updateData.email = email || null
    if (rol !== undefined) updateData.rol = rol
    if (zona !== undefined) updateData.zona = zona || null
    if (activo !== undefined) updateData.activo = activo
    updateData.updated_at = new Date().toISOString()

    const { data: usuario, error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select('id, codigo_asesor, dni, nombre_completo, email, rol, zona, activo, created_at, updated_at')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Actualizar tiendas si se proporcionan
    if (tiendas !== undefined) {
      // Eliminar asignaciones existentes
      await supabase.from('usuarios_tiendas').delete().eq('usuario_id', id)

      // Insertar nuevas asignaciones
      if (tiendas.length > 0) {
        const tiendaRows = tiendas.map((t: any) => ({
          usuario_id: id,
          tienda_id: t.tienda_id,
          es_principal: t.es_principal || false,
        }))

        const { error: tiendasError } = await supabase
          .from('usuarios_tiendas')
          .insert(tiendaRows)

        if (tiendasError) {
          return NextResponse.json(
            { error: 'Error actualizando tiendas: ' + tiendasError.message },
            { status: 400 }
          )
        }
      }
    }

    return NextResponse.json({ success: true, usuario })
  } catch (error) {
    console.error('Error actualizando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/usuarios/[id] — Soft delete (desactivar)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('usuarios')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Usuario desactivado' })
  } catch (error) {
    console.error('Error eliminando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
