'use client'

import { useState, useEffect } from 'react'
import { Store, ChevronDown, Check } from 'lucide-react'
import { Usuario } from '@/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  logout,
  getTiendaActiva,
  setTiendaActiva,
  TiendaActiva,
} from '@/lib/auth-client'

interface NavbarProps {
  user: Usuario
}

interface Tienda {
  id: string
  codigo: string
  nombre: string
  zona: string
}

const roleLabels: Record<Usuario['rol'], string> = {
  ADMIN: 'Administrador',
  GERENTE_GENERAL: 'Gerente General',
  GERENTE_COMERCIAL: 'Gerente Comercial',
  JEFE_VENTAS: 'Jefe de Ventas',
  SUPERVISOR: 'Supervisor',
  COORDINADOR: 'Coordinador',
  ASESOR_REFERENTE: 'Asesor Referente',
  ASESOR: 'Asesor',
  VALIDADOR_ARRIBOS: 'Validador de Arribos',
  BACKOFFICE_OPERACIONES: 'Backoffice Operaciones',
  BACKOFFICE_RRHH: 'Backoffice RRHH',
  BACKOFFICE_AUDITORIA: 'Backoffice Auditoría',
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

export function Navbar({ user }: NavbarProps) {
  const [tiendaActiva, setTiendaActivaState] = useState<TiendaActiva | null>(null)
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingTienda, setPendingTienda] = useState<Tienda | null>(null)

  const showTiendaSelector = !ROLES_SIN_TIENDA.includes(user.rol)

  useEffect(() => {
    // Load current tienda from localStorage
    const tienda = getTiendaActiva()
    setTiendaActivaState(tienda)

    // Load user's tiendas if they need store selection
    if (showTiendaSelector && user.id) {
      loadTiendas()
    }
  }, [user.id, showTiendaSelector])

  async function loadTiendas() {
    try {
      const response = await fetch(`/api/usuarios/${user.id}/tiendas`)
      const data = await response.json()
      if (data.tiendas) {
        setTiendas(data.tiendas)
      }
    } catch (error) {
      console.error('Error loading tiendas:', error)
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  const handleTiendaClick = (tienda: Tienda) => {
    if (tienda.id === tiendaActiva?.id) return
    setPendingTienda(tienda)
    setShowConfirmDialog(true)
  }

  const handleConfirmChange = () => {
    if (pendingTienda) {
      const newTienda: TiendaActiva = {
        id: pendingTienda.id,
        codigo: pendingTienda.codigo,
        nombre: pendingTienda.nombre,
        zona: pendingTienda.zona,
      }
      setTiendaActiva(newTienda)
      setTiendaActivaState(newTienda)
    }
    setShowConfirmDialog(false)
    setPendingTienda(null)
  }

  const getRoleLabel = (rol: Usuario['rol']) => {
    return roleLabels[rol] || rol
  }

  const getRoleBadgeColor = (rol: Usuario['rol']) => {
    // Admin
    if (rol === 'ADMIN') return 'bg-red-100 text-red-800'

    // Management
    if (['GERENTE_GENERAL', 'GERENTE_COMERCIAL'].includes(rol))
      return 'bg-purple-100 text-purple-800'

    // Supervisors and coordinators
    if (['JEFE_VENTAS', 'SUPERVISOR', 'COORDINADOR'].includes(rol))
      return 'bg-blue-100 text-blue-800'

    // Sales team
    if (['ASESOR_REFERENTE', 'ASESOR'].includes(rol))
      return 'bg-green-100 text-green-800'

    // Backoffice
    if (rol.startsWith('BACKOFFICE_'))
      return 'bg-yellow-100 text-yellow-800'

    // Others
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">GR</span>
            </div>
            <span className="hidden font-bold sm:inline-block">GridRetail</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Store Selector */}
            {showTiendaSelector && tiendaActiva && tiendas.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Store className="h-4 w-4" />
                    <span className="hidden sm:inline">{tiendaActiva.nombre}</span>
                    <span className="sm:hidden">{tiendaActiva.codigo}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {tiendas.map((tienda) => (
                    <DropdownMenuItem
                      key={tienda.id}
                      onClick={() => handleTiendaClick(tienda)}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{tienda.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {tienda.codigo} · Zona {tienda.zona}
                        </div>
                      </div>
                      {tienda.id === tiendaActiva.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Single store display (no dropdown) */}
            {showTiendaSelector && tiendaActiva && tiendas.length === 1 && (
              <div className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">{tiendaActiva.nombre}</span>
                <span className="sm:hidden">{tiendaActiva.codigo}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="hidden text-right text-sm md:block">
                <div className="font-medium">{user.nombre_completo}</div>
                <div className="text-xs text-muted-foreground">
                  {user.codigo_asesor}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeColor(user.rol)}`}
              >
                {getRoleLabel(user.rol)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar de tienda?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas cambiar a <strong>{pendingTienda?.nombre}</strong>?
              Los nuevos registros se harán en esta tienda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
