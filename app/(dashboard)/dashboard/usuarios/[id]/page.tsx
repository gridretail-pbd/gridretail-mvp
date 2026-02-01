'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RolBadge } from '@/components/usuarios/RolBadge'
import { EstadoBadge } from '@/components/usuarios/EstadoBadge'
import { ResetPasswordDialog } from '@/components/usuarios/ResetPasswordDialog'
import { DeleteUsuarioDialog } from '@/components/usuarios/DeleteUsuarioDialog'
import {
  Loader2, ArrowLeft, Pencil, KeyRound, UserX, UserCheck, Store,
} from 'lucide-react'
import {
  ROLES_GESTION_USUARIOS, ROLES_PUEDEN_CREAR, ROLES_PUEDEN_ELIMINAR,
} from '@/lib/validations/usuario'
import type { Usuario, RolUsuario, UsuarioConTiendas } from '@/types'
import { format } from 'date-fns'

export default function DetalleUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [usuario, setUsuario] = useState<UsuarioConTiendas | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    const u = getUsuarioFromLocalStorage()
    if (!u) { router.push('/login'); return }
    if (!ROLES_GESTION_USUARIOS.includes(u.rol as RolUsuario)) {
      router.push('/dashboard'); return
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

  async function toggleActivo() {
    if (!usuario) return
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !usuario.activo }),
      })
      if (response.ok) {
        setUsuario({ ...usuario, activo: !usuario.activo })
      }
    } catch (error) {
      alert('Error al cambiar estado')
    }
  }

  const puedeEditar = user && ROLES_PUEDEN_CREAR.includes(user.rol as RolUsuario)
  const puedeEliminar = user && ROLES_PUEDEN_ELIMINAR.includes(user.rol as RolUsuario)

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/usuarios')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
      </div>

      {/* Info principal */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{usuario.nombre_completo}</h1>
              <p className="text-muted-foreground font-mono">{usuario.codigo_asesor} · DNI: {usuario.dni}</p>
              <div className="flex gap-2 mt-2">
                <RolBadge rol={usuario.rol} />
                <EstadoBadge activo={usuario.activo} />
              </div>
            </div>

            {/* Acciones */}
            {puedeEditar && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/usuarios/${id}/editar`)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetPassword(true)}
                >
                  <KeyRound className="h-4 w-4 mr-1" />
                  Reset Pass
                </Button>
                <Button
                  variant={usuario.activo ? 'outline' : 'default'}
                  size="sm"
                  onClick={toggleActivo}
                >
                  {usuario.activo ? (
                    <><UserX className="h-4 w-4 mr-1" />Desactivar</>
                  ) : (
                    <><UserCheck className="h-4 w-4 mr-1" />Activar</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{usuario.email || 'No registrado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zona</span>
              <span>{usuario.zona || 'Sin zona'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado</span>
              <span>{format(new Date(usuario.created_at), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actualizado</span>
              <span>{format(new Date(usuario.updated_at), 'dd/MM/yyyy HH:mm')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Tiendas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              Tiendas Asignadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usuario.tiendas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin tiendas asignadas</p>
            ) : (
              <div className="space-y-2">
                {usuario.tiendas.map((t) => (
                  <div key={t.tienda_id} className="flex items-center justify-between text-sm">
                    <span>{t.tienda.nombre}</span>
                    {t.es_principal && (
                      <span className="text-xs text-yellow-600">⭐ Principal</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <ResetPasswordDialog
        open={showResetPassword}
        onOpenChange={setShowResetPassword}
        usuarioId={id}
        usuarioNombre={usuario.nombre_completo}
      />

      {puedeEliminar && (
        <DeleteUsuarioDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          usuarioId={id}
          usuarioNombre={usuario.nombre_completo}
          onSuccess={() => router.push('/dashboard/usuarios')}
        />
      )}
    </div>
  )
}
