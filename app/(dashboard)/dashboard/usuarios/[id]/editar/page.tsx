'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { UsuarioForm } from '@/components/usuarios/UsuarioForm'
import { ROLES_PUEDEN_CREAR } from '@/lib/validations/usuario'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Usuario, RolUsuario, UsuarioConTiendas } from '@/types'

export default function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [usuario, setUsuario] = useState<UsuarioConTiendas | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const u = getUsuarioFromLocalStorage()
    if (!u) { router.push('/login'); return }
    if (!ROLES_PUEDEN_CREAR.includes(u.rol as RolUsuario)) {
      router.push('/dashboard/usuarios'); return
    }
    setUser(u)
  }, [router])

  useEffect(() => {
    if (!user) return
    async function fetchUsuario() {
      try {
        const response = await fetch(`/api/usuarios/${id}`)
        if (response.ok) {
          const data = await response.json()
          setUsuario(data)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUsuario()
  }, [user, id])

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Usuario no encontrado</p>
        <Button variant="link" onClick={() => router.back()}>Volver</Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Usuario</h1>
        <span className="text-muted-foreground">· {usuario.codigo_asesor}</span>
      </div>

      <UsuarioForm
        mode="editar"
        usuario={usuario}
        currentUserRol={user.rol}
        onSuccess={() => router.push(`/dashboard/usuarios/${id}`)}
        onCancel={() => router.back()}
      />
    </div>
  )
}
