'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, LogOut } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUsuarioFromLocalStorage, setTiendaActiva, logout } from '@/lib/auth-client'
import { Usuario } from '@/types'

interface Tienda {
  id: string
  codigo: string
  nombre: string
  zona: string
}

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

export default function SeleccionarTiendaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()

    if (!usuario) {
      router.push('/login')
      return
    }

    setUser(usuario)

    // Verificar si el rol requiere tienda
    if (ROLES_SIN_TIENDA.includes(usuario.rol)) {
      // No requiere tienda, redirigir directo al dashboard
      router.push('/dashboard')
      return
    }

    // Cargar tiendas asignadas
    loadTiendas(usuario.id)
  }, [router])

  async function loadTiendas(userId: string) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/usuarios/${userId}/tiendas`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar tiendas')
      }

      const tiendasData = data.tiendas as Tienda[]

      if (tiendasData.length === 0) {
        setError('No tienes tiendas asignadas. Contacta al administrador.')
        setTiendas([])
      } else if (tiendasData.length === 1) {
        // Solo una tienda, asignar automáticamente
        handleSelectTienda(tiendasData[0])
      } else {
        setTiendas(tiendasData)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelectTienda(tienda: Tienda) {
    setTiendaActiva({
      id: tienda.id,
      codigo: tienda.codigo,
      nombre: tienda.nombre,
      zona: tienda.zona,
    })
    router.push('/dashboard')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="text-center">
          <Store className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
          <p className="mt-4 text-muted-foreground">Cargando tiendas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              GR
            </div>
            <span className="font-semibold text-lg">GridRetail</span>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.nombre_completo}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {error ? (
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Sin tiendas asignadas</h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button onClick={logout} variant="outline">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">
                  ¿En qué tienda trabajas hoy?
                </h1>
                <p className="text-muted-foreground">
                  Selecciona la tienda donde registrarás tus operaciones
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tiendas.map((tienda) => (
                  <Card
                    key={tienda.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary"
                    onClick={() => handleSelectTienda(tienda)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-3 rounded-lg ${
                            tienda.zona === 'SUR'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          <Store className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{tienda.nombre}</h3>
                          <p className="text-sm text-muted-foreground">
                            {tienda.codigo}
                          </p>
                          <span
                            className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${
                              tienda.zona === 'SUR'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            Zona {tienda.zona}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
