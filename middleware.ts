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

  // Public routes that don't require authentication
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Routes that don't require store selection
  const rutasSinTienda = ['/login', '/seleccionar-tienda']
  const isRutaSinTienda = rutasSinTienda.some((route) =>
    pathname.startsWith(route)
  )

  // Get our custom session cookie
  const sessionCookie = request.cookies.get('session')
  const hasSession = !!sessionCookie?.value

  // Get tienda_activa cookie
  const tiendaCookie = request.cookies.get('tienda_activa')
  const hasTienda = !!tiendaCookie?.value

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

  console.log('Middleware - Path:', pathname, '- Has session:', hasSession, '- Has tienda:', hasTienda, '- Role:', userRole)

  // Redirect to login if trying to access protected route without session
  if (!hasSession && !isPublicRoute && pathname !== '/') {
    console.log('Middleware - Redirecting to login (no session)')
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to seleccionar-tienda if logged in and trying to access login
  if (hasSession && isPublicRoute) {
    console.log('Middleware - Redirecting to seleccionar-tienda (has session)')
    const redirectUrl = new URL('/seleccionar-tienda', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect root to seleccionar-tienda if logged in, otherwise to login
  if (pathname === '/') {
    const redirectUrl = new URL(hasSession ? '/seleccionar-tienda' : '/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Check if user needs store but doesn't have one selected
  if (hasSession && !isRutaSinTienda && !hasTienda) {
    // Check if user role requires store selection
    const requiresTienda = userRole && !ROLES_SIN_TIENDA.includes(userRole)

    if (requiresTienda) {
      console.log('Middleware - Redirecting to seleccionar-tienda (no tienda selected)')
      const redirectUrl = new URL('/seleccionar-tienda', request.url)
      return NextResponse.redirect(redirectUrl)
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
