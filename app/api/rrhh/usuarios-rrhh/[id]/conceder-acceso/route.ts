import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/rrhh/usuarios-rrhh/[id]/conceder-acceso
// Crea la CUENTA de login para una ficha de personal existente y las enlaza
// (usuarios_rrhh.usuario_id). El PIN se configura aparte vía el flujo de Modo
// Tienda (solicitar-otp + establecer). Ver migración 033 / SPEC_DESACOPLE.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: fichaId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { rol, zona, email, password, tiendas } = body
    const codigo_asesor_in = body.codigo_asesor as string | undefined

    if (!rol) {
      return NextResponse.json({ error: 'El rol es requerido' }, { status: 400 })
    }

    // 1) Cargar la ficha y validar que no tenga ya cuenta
    const { data: ficha } = await supabase
      .from('usuarios_rrhh')
      .select('id, usuario_id, nombre_completo, dni, codigo_asesor')
      .eq('id', fichaId)
      .maybeSingle()

    if (!ficha) {
      return NextResponse.json({ error: 'Ficha RRHH no encontrada' }, { status: 404 })
    }
    if (ficha.usuario_id) {
      return NextResponse.json(
        { error: 'Esta persona ya tiene una cuenta de acceso' },
        { status: 409 }
      )
    }

    const codigo_asesor = codigo_asesor_in || ficha.codigo_asesor
    if (!codigo_asesor) {
      return NextResponse.json(
        { error: 'Falta el código de asesor (no está en la ficha)' },
        { status: 400 }
      )
    }
    if (!ficha.nombre_completo) {
      return NextResponse.json(
        { error: 'La ficha no tiene nombre completo' },
        { status: 400 }
      )
    }

    // 2) Unicidad de código y DNI en cuentas
    const { data: existeCodigo } = await supabase
      .from('usuarios')
      .select('id')
      .eq('codigo_asesor', codigo_asesor)
      .maybeSingle()
    if (existeCodigo) {
      return NextResponse.json({ error: 'Ese código de asesor ya existe' }, { status: 409 })
    }
    if (ficha.dni) {
      const { data: existeDni } = await supabase
        .from('usuarios')
        .select('id')
        .eq('dni', ficha.dni)
        .maybeSingle()
      if (existeDni) {
        return NextResponse.json({ error: 'Ese DNI ya tiene cuenta' }, { status: 409 })
      }
    }

    // 3) Crear la cuenta. El acceso real se da con PIN (Modo Tienda); el password
    //    queda nulo salvo que se provea uno para login tradicional.
    const password_hash = password ? await bcrypt.hash(password, 12) : null

    const { data: cuenta, error: insertError } = await supabase
      .from('usuarios')
      .insert({
        codigo_asesor,
        dni: ficha.dni,
        nombre_completo: ficha.nombre_completo,
        email: email || null,
        rol,
        zona: zona || null,
        activo: true,
        password_hash,
      })
      .select('id, codigo_asesor, nombre_completo, rol, zona')
      .single()

    if (insertError || !cuenta) {
      return NextResponse.json(
        { error: insertError?.message ?? 'No se pudo crear la cuenta' },
        { status: 400 }
      )
    }

    // 4) Enlazar la ficha con la cuenta
    const { error: linkError } = await supabase
      .from('usuarios_rrhh')
      .update({ usuario_id: cuenta.id, codigo_asesor })
      .eq('id', fichaId)

    if (linkError) {
      // Rollback de la cuenta recién creada
      await supabase.from('usuarios').delete().eq('id', cuenta.id)
      return NextResponse.json(
        { error: 'No se pudo enlazar la cuenta con la ficha: ' + linkError.message },
        { status: 400 }
      )
    }

    // 5) Asignar tiendas (opcional)
    if (Array.isArray(tiendas) && tiendas.length > 0) {
      const rows = tiendas.map((t: { tienda_id: string; es_principal?: boolean }) => ({
        usuario_id: cuenta.id,
        tienda_id: t.tienda_id,
        es_principal: t.es_principal || false,
      }))
      await supabase.from('usuarios_tiendas').insert(rows)
    }

    return NextResponse.json({ success: true, usuario: cuenta }, { status: 201 })
  } catch (error) {
    console.error('Error concediendo acceso:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
