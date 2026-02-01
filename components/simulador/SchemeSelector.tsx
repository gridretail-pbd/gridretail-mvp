'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { SchemeForSimulation } from '@/lib/simulador/types'
import { formatPeriod } from '@/lib/simulador/formatters'
import { SCHEME_STATUS_COLORS, SCHEME_TYPE_LABELS } from '@/lib/comisiones/types'

interface SchemeSelectorProps {
  schemes: SchemeForSimulation[]
  selectedSchemeId: string | null
  onSchemeChange: (schemeId: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Selector de esquema de comisiones
 * Muestra los esquemas disponibles para simular
 */
export function SchemeSelector({
  schemes,
  selectedSchemeId,
  onSchemeChange,
  disabled = false,
  placeholder = 'Seleccionar esquema...',
}: SchemeSelectorProps) {
  const selectedScheme = schemes.find((s) => s.id === selectedSchemeId)

  return (
    <Select
      value={selectedSchemeId || undefined}
      onValueChange={onSchemeChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedScheme && (
            <div className="flex items-center gap-2">
              <span>{selectedScheme.name}</span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  SCHEME_STATUS_COLORS[
                    selectedScheme.status as keyof typeof SCHEME_STATUS_COLORS
                  ] || ''
                }`}
              >
                {selectedScheme.status}
              </Badge>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {schemes.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground text-center">
            No hay esquemas disponibles
          </div>
        ) : (
          schemes.map((scheme) => (
            <SelectItem key={scheme.id} value={scheme.id}>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{scheme.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      SCHEME_STATUS_COLORS[
                        scheme.status as keyof typeof SCHEME_STATUS_COLORS
                      ] || ''
                    }`}
                  >
                    {scheme.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>
                    {
                      SCHEME_TYPE_LABELS[
                        scheme.scheme_type as keyof typeof SCHEME_TYPE_LABELS
                      ]
                    }
                  </span>
                  <span>•</span>
                  <span>{formatPeriod(scheme.year, scheme.month)}</span>
                </div>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
