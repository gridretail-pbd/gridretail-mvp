import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Eliminar cookies server-side para que el middleware no las vea
  response.cookies.set('session', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  })
  response.cookies.set('tienda_activa', '', {
    expires: new Date(0),
    path: '/',
  })

  return response
}
