import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase con service_role para acceder a system_config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validar que las variables de entorno existan
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[consulta-documento] Variables de entorno faltantes:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
  })
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Cache simple para no consultar BD en cada request
let configCache: { token: string; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

async function getApiToken(): Promise<{ token: string | null; error: string | null }> {
  // Verificar que supabaseAdmin exista
  if (!supabaseAdmin) {
    return { 
      token: null, 
      error: 'Supabase no configurado - verificar NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY' 
    }
  }

  // Verificar cache
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL) {
    return { token: configCache.token, error: null }
  }

  try {
    // Consultar BD
    const { data, error } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'JSON_PE_TOKEN')
      .single()

    if (error) {
      console.error('[consulta-documento] Error obteniendo token de BD:', error)
      return { token: null, error: `Error BD: ${error.message} (${error.code})` }
    }

    if (!data || !data.value) {
      return { token: null, error: 'Token JSON_PE_TOKEN no encontrado en system_config' }
    }

    if (data.value === 'REEMPLAZAR_CON_TOKEN_REAL') {
      return { token: null, error: 'Token tiene valor placeholder' }
    }

    // Actualizar cache
    configCache = {
      token: data.value,
      timestamp: Date.now(),
    }

    return { token: configCache.token, error: null }
  } catch (e) {
    console.error('[consulta-documento] Excepción obteniendo token:', e)
    return { token: null, error: `Excepción: ${e}` }
  }
}

// Configuración de endpoints por tipo de documento
const API_CONFIG = {
  DNI: {
    url: 'https://api.json.pe/api/dni',
    bodyKey: 'dni',
    longitudEsperada: 8,
  },
  CE: {
    url: 'https://api.json.pe/api/cee',
    bodyKey: 'cee',
    longitudEsperada: 9,
  },
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') as 'DNI' | 'CE' | null
    const numero = searchParams.get('numero')

    // Validar parámetros
    if (!tipo || !numero) {
      return NextResponse.json(
        { success: false, message: 'Tipo y número son requeridos' },
        { status: 400 }
      )
    }

    // Validar tipo de documento
    if (tipo !== 'DNI' && tipo !== 'CE') {
      return NextResponse.json(
        { success: false, message: 'Tipo de documento no soportado para consulta' },
        { status: 400 }
      )
    }

    const config = API_CONFIG[tipo]

    // Validar formato del número
    const regex = new RegExp(`^\\d{${config.longitudEsperada}}$`)
    if (!regex.test(numero)) {
      return NextResponse.json(
        {
          success: false,
          message: `${tipo} debe tener ${config.longitudEsperada} dígitos`,
        },
        { status: 400 }
      )
    }

    // Obtener token de la BD
    const { token, error: tokenError } = await getApiToken()

    if (tokenError || !token) {
      console.error(`[consulta-documento] Error de token: ${tokenError}`)
      return NextResponse.json(
        { success: false, message: 'Error de configuración API', debug: tokenError },
        { status: 500 }
      )
    }

    // Construir body según el tipo de documento
    const body = { [config.bodyKey]: numero }

    // Consultar la API de json.pe
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      if (response.status === 404 || response.status === 422 || response.status === 400) {
        return NextResponse.json({
          success: false,
          message: 'Documento no encontrado',
        })
      }

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { success: false, message: 'Error de autenticación con API' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Error consultando documento' },
        { status: response.status }
      )
    }

    const responseData = await response.json()

    // =====================================================
    // FIX: json.pe retorna estructura anidada:
    // { success: true, data: { nombres, apellido_paterno, ... } }
    // =====================================================
    
    if (responseData && responseData.success && responseData.data) {
      const personData = responseData.data
      
      // Extraer campos (json.pe usa snake_case)
      const nombres = personData.nombres || personData.nombre || ''
      const apellidoPaterno = personData.apellido_paterno || personData.apellidoPaterno || ''
      const apellidoMaterno = personData.apellido_materno || personData.apellidoMaterno || ''

      if (nombres) {
        return NextResponse.json({
          success: true,
          data: {
            nombres: nombres,
            apellido_paterno: apellidoPaterno,
            apellido_materno: apellidoMaterno,
          },
        })
      }
    }

    // Si no hay datos válidos
    return NextResponse.json({
      success: false,
      message: 'Documento no encontrado',
    })
  } catch (error) {
    console.error('[consulta-documento] Error general:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
