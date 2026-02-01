'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { UsuarioForm } from '@/components/usuarios/UsuarioForm'
import { ROLES_PUEDEN_CREAR } from '@/lib/validations/usuario'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Usuario, RolUsuario } from '@/types'

export default function NuevoUsuarioPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_PUEDEN_CREAR.includes(usuario.rol as RolUsuario)) {
      router.push('/dashboard/usuarios')
      return
    }
    setUser(usuario)
  }, [router])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Nuevo Usuario</h1>
      </div>

      <UsuarioForm
        mode="crear"
        currentUserRol={user.rol}
        onSuccess={() => router.push('/dashboard/usuarios')}
        onCancel={() => router.back()}
      />
    </div>
  )
}
