'use client'

import { KeyRound, UserPlus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RosterUsuario } from '@/lib/auth/modo-tienda-client'

/**
 * Roster de avatares de la tienda del dispositivo. El asesor toca su tarjeta
 * para autenticarse. Marca quién aún no configuró su PIN.
 */

interface RosterTiendaProps {
  usuarios: RosterUsuario[]
  onSelect: (usuario: RosterUsuario) => void
  disabled?: boolean
}

function iniciales(nombre: string | null): string {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  const first = partes[0]?.[0] ?? ''
  const last = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (first + last).toUpperCase()
}

const ROL_LABELS: Record<string, string> = {
  ASESOR: 'Asesor',
  ASESOR_REFERENTE: 'Asesor Referente',
  COORDINADOR: 'Coordinador',
  SUPERVISOR: 'Supervisor',
  JEFE_VENTAS: 'Jefe de Ventas',
}

export function RosterTienda({ usuarios, onSelect, disabled }: RosterTiendaProps) {
  if (usuarios.length === 0) {
    return (
      <p className="text-center text-muted-foreground">
        No hay usuarios asignados a esta tienda.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {usuarios.map((u) => (
        <Card
          key={u.id}
          role="button"
          tabIndex={0}
          onClick={() => !disabled && onSelect(u)}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onSelect(u)
            }
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 p-5 text-center transition-all',
            'hover:border-primary hover:shadow-lg active:scale-[0.98]',
            disabled && 'pointer-events-none opacity-60'
          )}
        >
          <div className="relative">
            {u.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.foto_url}
                alt={u.nombre_completo ?? ''}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {iniciales(u.nombre_completo)}
              </div>
            )}
            <span
              className={cn(
                'absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background',
                u.tiene_pin ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              )}
              title={u.tiene_pin ? 'PIN configurado' : 'Configurar PIN'}
            >
              {u.tiene_pin ? (
                <KeyRound className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
            </span>
          </div>

          <div className="space-y-1">
            <p className="font-semibold leading-tight">{u.nombre_completo}</p>
            <Badge variant="secondary" className="text-xs font-normal">
              {ROL_LABELS[u.rol] ?? u.rol}
            </Badge>
            {!u.tiene_pin && (
              <p className="text-xs text-amber-600">Configurar PIN</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
