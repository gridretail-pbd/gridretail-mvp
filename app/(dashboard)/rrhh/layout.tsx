'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH, puedeVerDashboardRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { Usuario } from '@/types'
import { cn } from '@/lib/utils'
import {
  Users,
  UserPlus,
  FileText,
  Clock,
  Calendar,
  AlertTriangle,
  CalendarCheck,
  ArrowRightLeft,
  LogOut,
  Bell,
  LayoutDashboard,
  Upload,
} from 'lucide-react'

interface RRHHNavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiereGestion?: boolean // solo visible para RRHH/ADMIN
}

const rrhhNavItems: RRHHNavItem[] = [
  { title: 'Dashboard', href: '/rrhh', icon: LayoutDashboard },
  { title: 'Colaboradores', href: '/rrhh/colaboradores', icon: Users },
  { title: 'Reclutamiento', href: '/rrhh/reclutamiento', icon: UserPlus, requiereGestion: true },
  { title: 'Contratos', href: '/rrhh/contratos', icon: FileText, requiereGestion: true },
  { title: 'Asistencia', href: '/rrhh/asistencia', icon: Clock },
  { title: 'Horarios', href: '/rrhh/horarios', icon: Calendar },
  { title: 'Incidencias', href: '/rrhh/incidencias', icon: AlertTriangle },
  { title: 'Permisos', href: '/rrhh/permisos', icon: CalendarCheck },
  { title: 'Movimientos', href: '/rrhh/movimientos', icon: ArrowRightLeft, requiereGestion: true },
  { title: 'Offboarding', href: '/rrhh/offboarding', icon: LogOut, requiereGestion: true },
  { title: 'Alertas', href: '/rrhh/alertas', icon: Bell },
  { title: 'Importación', href: '/rrhh/importacion', icon: Upload, requiereGestion: true },
]

export default function RRHHLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<Usuario | null>(null)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    // Verificar que el usuario tiene acceso al módulo
    if (!puedeVerDashboardRRHH(usuario.rol) && !puedeGestionarRRHH(usuario.rol)) {
      router.push('/dashboard')
      return
    }
    setUser(usuario)
  }, [router])

  if (!user) return null

  const esGestionRRHH = puedeGestionarRRHH(user.rol)

  const itemsVisibles = rrhhNavItems.filter(
    (item) => !item.requiereGestion || esGestionRRHH
  )

  return (
    <div>
      {/* Sub-navegación horizontal del módulo RRHH */}
      <div className="border-b bg-muted/30 -mx-6 -mt-6 px-6 mb-6">
        <nav className="flex gap-1 overflow-x-auto py-2">
          {itemsVisibles.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/rrhh'
                ? pathname === '/rrhh'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>

      {children}
    </div>
  )
}
