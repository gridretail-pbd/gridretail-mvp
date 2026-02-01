'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SalesProfile } from '@/lib/simulador/types'
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS } from '@/lib/simulador/types'

interface ProfileSelectorProps {
  selectedProfile: SalesProfile
  onProfileChange: (profile: SalesProfile) => void
  disabled?: boolean
}

/**
 * Selector de perfil de ventas predefinido
 * Permite elegir entre perfiles como Promedio, Top 20%, Nuevo, etc.
 */
export function ProfileSelector({
  selectedProfile,
  onProfileChange,
  disabled = false,
}: ProfileSelectorProps) {
  const profiles: SalesProfile[] = ['average', 'top20', 'new', 'quota100', 'custom']

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <Tooltip key={profile}>
            <TooltipTrigger asChild>
              <Button
                variant={selectedProfile === profile ? 'default' : 'outline'}
                size="sm"
                onClick={() => onProfileChange(profile)}
                disabled={disabled}
              >
                {PROFILE_LABELS[profile]}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[200px]">{PROFILE_DESCRIPTIONS[profile]}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}

/**
 * Versión con tarjetas para selección más visual
 */
export function ProfileSelectorCards({
  selectedProfile,
  onProfileChange,
  disabled = false,
}: ProfileSelectorProps) {
  const profiles: Array<{
    value: SalesProfile
    label: string
    description: string
    icon: string
  }> = [
    {
      value: 'average',
      label: 'Promedio',
      description: '75% de cada meta',
      icon: '📊',
    },
    {
      value: 'top20',
      label: 'Top 20%',
      description: '115% de metas',
      icon: '🏆',
    },
    {
      value: 'new',
      label: 'Nuevo ingreso',
      description: '50% de metas',
      icon: '🌱',
    },
    {
      value: 'quota100',
      label: 'Cuota 100%',
      description: 'Cumple exacto',
      icon: '🎯',
    },
    {
      value: 'custom',
      label: 'Personalizado',
      description: 'Ingreso manual',
      icon: '✏️',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {profiles.map((profile) => (
        <Card
          key={profile.value}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedProfile === profile.value
              ? 'ring-2 ring-primary shadow-md'
              : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && onProfileChange(profile.value)}
        >
          <CardContent className="p-3 text-center">
            <div className="text-2xl mb-1">{profile.icon}</div>
            <div className="font-medium text-sm">{profile.label}</div>
            <div className="text-xs text-muted-foreground">
              {profile.description}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
