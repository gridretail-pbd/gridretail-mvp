import { type NextRequest, NextResponse } from 'next/server'

// Roles que NO requieren seleccionar tienda
const ROLES_SIN_TIENDA = [
  'ADMIN',
  'GERENTE_GENERAL',
  'GERENTE_COMERCIAL',
  'BACKOFFICE_OPERACIONES',
  'BACKOFFICE_RRHH',
  'BACKOFFICE_AUDITORIA',
  'CAPACITADOR',
  'VALIDADOR_ARRIBOS',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require a user session.
  // /modo-tienda y /enrolar-dispositivo son el flujo de equipos compartidos (Nivel 1/2).
  const publicRoutes = ['/login', '/modo-tienda', '/enrolar-dispositivo']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // Routes that don't require store selection
  const rutasSinTienda = ['/login', '/seleccionar-tienda', '/modo-tienda', '/enrolar-dispositivo']
  const isRutaSinTienda = rutasSinTienda.some((route) => pathname.startsWith(route))

  // Get our custom session cookie
  const sessionCookie = request.cookies.get('session')
  const hasSession = !!sessionCookie?.value

  // Get tienda_activa cookie
  const tiendaCookie = request.cookies.get('tienda_activa')
  const hasTienda = !!tiendaCookie?.value

  // Get device enrollment cookie (Nivel 1: equipo atado a una tienda)
  const deviceCookie = request.cookies.get('device_token')
  const hasDevice = !!deviceCookie?.value

  // Get user role from session cookie
  let userRole: string | null = null
  if (sessionCookie?.value) {
    try {
      const sessionData = JSON.parse(sessionCookie.value)
      userRole = sessionData.rol || null
    } catch {
      userRole = null
    }
  }

  console.log(
    'Middleware - Path:', pathname,
    '- Has session:', hasSession,
    '- Has tienda:', hasTienda,
    '- Has device:', hasDevice,
    '- Role:', userRole
  )

  // Sin sesión en ruta protegida: a Modo Tienda si el equipo está enrolado, si no a Login.
  if (!hasSession && !isPublicRoute && pathname !== '/') {
    const dest = hasDevice ? '/modo-tienda' : '/login'
    console.log(`Middleware - Redirecting to ${dest} (no session)`)
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Con sesión en una pantalla de acceso: enviar a la app.
  if (hasSession && isPublicRoute) {
    console.log('Middleware - Redirecting to seleccionar-tienda (has session)')
    return NextResponse.redirect(new URL('/seleccionar-tienda', request.url))
  }

  // Raíz
  if (pathname === '/') {
    const dest = hasSession ? '/seleccionar-tienda' : hasDevice ? '/modo-tienda' : '/login'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Sesión activa pero sin tienda seleccionada (y el rol la requiere).
  if (hasSession && !isRutaSinTienda && !hasTienda) {
    const requiresTienda = userRole && !ROLES_SIN_TIENDA.includes(userRole)
    if (requiresTienda) {
      // En equipos enrolados la tienda se deriva del dispositivo (Modo Tienda).
      const dest = hasDevice ? '/modo-tienda' : '/seleccionar-tienda'
      console.log(`Middleware - Redirecting to ${dest} (no tienda selected)`)
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
