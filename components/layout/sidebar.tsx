'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Usuario } from '@/types'
import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  UserPlus,
  FileUp,
  Target,
  Settings2,
  Calculator,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  user: Usuario
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Array<Usuario['rol']>
}

interface NavSection {
  title: string | null // null = sin header
  items: NavItem[]
}

const navSections: NavSection[] = [
  // Dashboard - sin header
  {
    title: null,
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['ADMIN', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'JEFE_VENTAS', 'SUPERVISOR', 'COORDINADOR', 'ASESOR_REFERENTE', 'ASESOR', 'VALIDADOR_ARRIBOS', 'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA'],
      },
    ],
  },
  // Mi Comisión - sin header, solo para HC
  {
    title: null,
    items: [
      {
        title: 'Mi Comisión',
        href: '/mi-comision',
        icon: Wallet,
        roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR'],
      },
    ],
  },
  // Operaciones
  {
    title: 'Operaciones',
    items: [
      {
        title: 'Tiendas',
        href: '/dashboard/tiendas',
        icon: Store,
        roles: ['ADMIN', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'JEFE_VENTAS', 'SUPERVISOR'],
      },
      {
        title: 'Registrar Arribo',
        href: '/dashboard/arribos/nuevo',
        icon: UserPlus,
        roles: ['ADMIN', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'JEFE_VENTAS', 'SUPERVISOR', 'COORDINADOR', 'ASESOR_REFERENTE', 'ASESOR', 'VALIDADOR_ARRIBOS'],
      },
      {
        title: 'Registrar Venta',
        href: '/dashboard/ventas/nuevo',
        icon: ShoppingCart,
        roles: ['ADMIN', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'JEFE_VENTAS', 'SUPERVISOR', 'COORDINADOR', 'ASESOR_REFERENTE', 'ASESOR'],
      },
    ],
  },
  // Comisiones
  {
    title: 'Comisiones',
    items: [
      {
        title: 'Cuotas',
        href: '/cuotas',
        icon: Target,
        roles: ['BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'],
      },
      {
        title: 'Esquemas',
        href: '/comisiones/esquemas',
        icon: Settings2,
        roles: ['GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'],
      },
      {
        title: 'Penalidades',
        href: '/comisiones/penalidades',
        icon: AlertTriangle,
        roles: ['BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'],
      },
      {
        title: 'Simulador',
        href: '/comisiones/simulador',
        icon: Calculator,
        roles: ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'ADMIN'],
      },
      {
        title: 'Importar INAR',
        href: '/inar/importar',
        icon: FileUp,
        roles: ['BACKOFFICE_OPERACIONES', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'],
      },
    ],
  },
  // Administración
  {
    title: 'Administración',
    items: [
      {
        title: 'Usuarios',
        href: '/dashboard/usuarios',
        icon: Users,
        roles: ['ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_RRHH'],
      },
      {
        title: 'Reportes',
        href: '/dashboard/reportes',
        icon: BarChart3,
        roles: ['ADMIN', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'JEFE_VENTAS', 'SUPERVISOR', 'BACKOFFICE_AUDITORIA'],
      },
      {
        title: 'Configuración',
        href: '/dashboard/configuracion',
        icon: Settings,
        roles: ['ADMIN'],
      },
    ],
  },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  // Filtrar secciones y sus items según el rol del usuario
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.rol)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <aside className="fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 border-r bg-background overflow-y-auto">
      <div className="flex h-full flex-col p-4">
        <nav className="space-y-4">
          {filteredSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-1">
              {/* Header de sección (si existe) */}
              {section.title && (
                <div className="px-3 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                </div>
              )}

              {/* Items de la sección */}
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
