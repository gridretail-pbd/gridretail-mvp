'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SchemeForm } from '@/components/comisiones/SchemeForm'
import { type SchemeFormValues } from '@/lib/comisiones/validations'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'
import { toast } from 'sonner'

// Roles que pueden crear esquemas
const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

export default function NuevoEsquemaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_EDICION.includes(usuario.rol)) {
      router.push('/comisiones/esquemas')
      return
    }
    setUser(usuario)
  }, [router])

  const handleSubmit = async (values: SchemeFormValues) => {
    try {
      setIsLoading(true)

      const response = await fetch('/api/comisiones/esquemas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          created_by: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear esquema')
      }

      toast.success('Esquema creado exitosamente')

      // Redirigir al editor de partidas
      router.push(`/comisiones/esquemas/${data.scheme.id}/partidas`)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear esquema')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/comisiones/esquemas')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Esquema</h1>
          <p className="text-muted-foreground">
            Configura los datos generales del esquema de comisiones
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="max-w-2xl">
        <SchemeForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Guardar y Continuar"
        />
      </div>
    </div>
  )
}
