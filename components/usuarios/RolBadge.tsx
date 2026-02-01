import { ROL_COLORS, ROLES_LABELS } from '@/lib/validations/usuario'
import type { RolUsuario } from '@/types'

interface RolBadgeProps {
  rol: RolUsuario
}

export function RolBadge({ rol }: RolBadgeProps) {
  const colors = ROL_COLORS[rol] || 'bg-gray-100 text-gray-800'
  const label = ROLES_LABELS[rol] || rol

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  )
}
