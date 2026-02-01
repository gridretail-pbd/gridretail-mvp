import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  console.log('=== LOGIN API ===')

  try {
    const { codigo_asesor, password } = await request.json()
    console.log('Código asesor:', codigo_asesor)

    if (!codigo_asesor || !password) {
      return NextResponse.json(
        { error: 'Faltan credenciales' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar usuario
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('codigo_asesor', codigo_asesor)
      .eq('activo', true)
      .single()

    if (error || !usuario) {
      console.log('Usuario no encontrado')
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    console.log('Usuario encontrado:', usuario.nombre_completo)

    // Verificar password
    const passwordMatch = await bcrypt.compare(password, usuario.password_hash)
    console.log('Password match:', passwordMatch)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Login exitoso - retornar usuario sin password
    const { password_hash, ...userWithoutPassword } = usuario

    console.log('Login exitoso!')

    // Crear respuesta con cookie de sesión simple
    const response = NextResponse.json({
      success: true,
      usuario: userWithoutPassword,
      message: 'Login exitoso'
    })

    // Guardar sesión en cookie (simple para MVP)
    response.cookies.set('session', JSON.stringify({
      id: usuario.id,
      codigo_asesor: usuario.codigo_asesor,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      zona: usuario.zona
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 días
    })

    return response

  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
