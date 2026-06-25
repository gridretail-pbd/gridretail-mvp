'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Store, ChevronDown, Check, Clock, RefreshCw } from 'lucide-react'
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
import { bloquearSesion } from '@/lib/auth/modo-tienda-client'
import { useInactivityLock } from '@/lib/auth/use-inactivity-lock'
import { cn } from '@/lib/utils'

interface NavbarProps {
  user: Usuario
}

interface Tienda {
  id: string
  codigo: string
  nombre: string
  zona: string
}

// Auto-bloqueo por inactividad en modo tienda (equipo compartido).
const INACTIVITY_MS = 3 * 60 * 1000

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

function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  const first = partes[0]?.[0] ?? ''
  const last = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function getRoleBadgeColor(rol: Usuario['rol']) {
  if (rol === 'ADMIN') return 'bg-red-100 text-red-800'
  if (['GERENTE_GENERAL', 'GERENTE_COMERCIAL'].includes(rol))
    return 'bg-purple-100 text-purple-800'
  if (['JEFE_VENTAS', 'SUPERVISOR', 'COORDINADOR'].includes(rol))
    return 'bg-blue-100 text-blue-800'
  if (['ASESOR_REFERENTE', 'ASESOR'].includes(rol)) return 'bg-green-100 text-green-800'
  if (rol.startsWith('BACKOFFICE_')) return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-800'
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter()
  const [tiendaActiva, setTiendaActivaState] = useState<TiendaActiva | null>(null)
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingTienda, setPendingTienda] = useState<Tienda | null>(null)
  const [modoTienda, setModoTienda] = useState(false)

  const showTiendaSelector = !ROLES_SIN_TIENDA.includes(user.rol)

  useEffect(() => {
    setTiendaActivaState(getTiendaActiva())
    setModoTienda(localStorage.getItem('modo_tienda') === '1')
  }, [])

  useEffect(() => {
    // En modo tienda la tienda la fija el dispositivo: no se ofrece cambio.
    if (showTiendaSelector && user.id && localStorage.getItem('modo_tienda') !== '1') {
      loadTiendas()
    }
  }, [user.id, showTiendaSelector])

  async function loadTiendas() {
    try {
      const response = await fetch(`/api/usuarios/${user.id}/tiendas`)
      const data = await response.json()
      if (data.tiendas) setTiendas(data.tiendas)
    } catch (error) {
      console.error('Error loading tiendas:', error)
    }
  }

  // "Cambiar usuario" (modo tienda) y auto-bloqueo: cierran la sesión de usuario
  // manteniendo el dispositivo enrolado, y vuelven al roster.
  const cambiarUsuario = useCallback(async () => {
    await bloquearSesion()
    router.push('/modo-tienda')
    router.refresh()
  }, [router])

  const { remaining } = useInactivityLock({
    enabled: modoTienda,
    timeoutMs: INACTIVITY_MS,
    onLock: cambiarUsuario,
  })

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

  const getRoleLabel = (rol: Usuario['rol']) => roleLabels[rol] || rol

  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const countdown = `${mm}:${ss.toString().padStart(2, '0')}`
  const porBloquear = remaining <= 30000

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

          {modoTienda ? (
            // ===== MODO TIENDA: identidad prominente + inactividad + cambiar usuario =====
            <div className="ml-auto flex items-center gap-3">
              {tiendaActiva && (
                <div className="hidden items-center gap-2 text-sm md:flex">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span>{tiendaActiva.nombre}</span>
                </div>
              )}

              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-1 py-1 pr-3',
                  getRoleBadgeColor(user.rol)
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-sm font-bold">
                  {iniciales(user.nombre_completo)}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-bold">{user.nombre_completo}</div>
                  <div className="text-[11px] font-medium opacity-80">
                    {getRoleLabel(user.rol)}
                  </div>
                </div>
              </div>

              <span
                className={cn(
                  'hidden items-center gap-1 rounded-full px-2 py-1 text-xs font-medium sm:flex',
                  porBloquear ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'
                )}
                title="Bloqueo automático por inactividad"
              >
                <Clock className="h-3.5 w-3.5" />
                {countdown}
              </span>

              <Button size="sm" onClick={cambiarUsuario} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Cambiar usuario
              </Button>
            </div>
          ) : (
            // ===== MODO TRADICIONAL (backoffice/admin o equipo no enrolado) =====
            <div className="ml-auto flex items-center gap-4">
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
                  <div className="text-xs text-muted-foreground">{user.codigo_asesor}</div>
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
          )}
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
