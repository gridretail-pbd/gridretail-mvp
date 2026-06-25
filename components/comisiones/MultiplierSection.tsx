'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  type CommissionItemMultiplier,
  MULTIPLIER_TYPE_LABELS,
  MULTIPLIER_TYPE_ICONS,
} from '@/lib/comisiones/types'

interface MultiplierSectionProps {
  multipliers: CommissionItemMultiplier[]
  onAdd: () => void
  onDelete: (multiplierId: string) => Promise<void>
  disabled?: boolean
}

export function MultiplierSection({
  multipliers,
  onAdd,
  onDelete,
  disabled,
}: MultiplierSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  const activeMultipliers = multipliers.filter(m => m.is_active)
  const combinedFactorMet = activeMultipliers.reduce((acc, m) => acc * m.factor_if_met, 1)
  const hasLock = activeMultipliers.some(m => m.multiplier_type === 'LOCK')
  const minFactor = hasLock ? 0 : activeMultipliers.reduce((acc, m) => acc * m.factor_if_not_met, 1)

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">Candados y Multiplicadores</h4>

      {multipliers.length > 0 && (
        <div className="space-y-2">
          {multipliers.map((mult) => (
            <div
              key={mult.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span>{MULTIPLIER_TYPE_ICONS[mult.multiplier_type]}</span>
                <div>
                  <p className="text-sm font-medium">
                    {MULTIPLIER_TYPE_LABELS[mult.multiplier_type]}: {mult.source_description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mult.multiplier_type === 'LOCK'
                      ? `Si NO cumple: comisión = 0`
                      : mult.multiplier_type === 'TIERED'
                        ? `${mult.tiered_ranges?.length || 0} rangos configurados`
                        : `Factor: x${mult.factor_if_met}`}
                  </p>
                </div>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(mult.id)}
                  disabled={deletingId === mult.id}
                >
                  {deletingId === mult.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeMultipliers.length > 1 && (
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          <p>Factor combinado: x{combinedFactorMet.toFixed(2)} (si todo se cumple)</p>
          <p>Factor mínimo: x{minFactor.toFixed(2)} {hasLock ? '(si candado no se cumple)' : ''}</p>
        </div>
      )}

      {!disabled && (
        <Button variant="outline" size="sm" className="w-full" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar multiplicador
        </Button>
      )}

      {multipliers.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Sin multiplicadores configurados
        </p>
      )}
    </div>
  )
}
