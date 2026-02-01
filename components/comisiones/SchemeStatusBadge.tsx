'use client'

import { Badge } from '@/components/ui/badge'
import { SchemeStatus, SCHEME_STATUS_LABELS } from '@/lib/comisiones'

interface SchemeStatusBadgeProps {
  status: SchemeStatus
  className?: string
}

export function SchemeStatusBadge({ status, className }: SchemeStatusBadgeProps) {
  const variants: Record<SchemeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    oficial: 'default',
    draft: 'secondary',
    aprobado: 'default',
    archivado: 'outline',
  }

  const colors: Record<SchemeStatus, string> = {
    oficial: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    draft: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    aprobado: 'bg-green-100 text-green-800 hover:bg-green-100',
    archivado: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  }

  return (
    <Badge
      variant={variants[status]}
      className={`${colors[status]} ${className || ''}`}
    >
      {SCHEME_STATUS_LABELS[status]}
    </Badge>
  )
}
