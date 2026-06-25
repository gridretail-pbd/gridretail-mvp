'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AcceleratorRange } from '@/lib/comisiones/types'

interface AcceleratorRangesEditorProps {
  value: AcceleratorRange[]
  onChange: (ranges: AcceleratorRange[]) => void
  variableSalary?: number
  disabled?: boolean
}

export function AcceleratorRangesEditor({
  value,
  onChange,
  variableSalary,
  disabled = false,
}: AcceleratorRangesEditorProps) {
  const handleAdd = () => {
    const lastMax = value.length > 0 ? value[value.length - 1].max : 0
    onChange([
      ...value,
      { min: lastMax, max: lastMax + 10, pct_effect: 0, label: '' },
    ])
  }

  const handleUpdate = (
    index: number,
    field: keyof AcceleratorRange,
    rawValue: string
  ) => {
    const updated = value.map((range, i) => {
      if (i !== index) return range
      if (field === 'label') {
        return { ...range, label: rawValue }
      }
      return { ...range, [field]: parseFloat(rawValue) || 0 }
    })
    onChange(updated)
  }

  const handleDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  // Calculate monetary impact range
  let minEffect = 0
  let maxEffect = 0
  if (variableSalary && value.length > 0) {
    const effects = value.map((r) => r.pct_effect)
    minEffect = Math.min(...effects)
    maxEffect = Math.max(...effects)
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">Desde (%)</th>
                <th className="pb-2 pr-2 font-medium">Hasta (%)</th>
                <th className="pb-2 pr-2 font-medium">Efecto (%)</th>
                <th className="pb-2 pr-2 font-medium">Etiqueta</th>
                <th className="pb-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {value.map((range, index) => (
                <tr key={index} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={range.min}
                      onChange={(e) => handleUpdate(index, 'min', e.target.value)}
                      disabled={disabled}
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={range.max}
                      onChange={(e) => handleUpdate(index, 'max', e.target.value)}
                      disabled={disabled}
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={range.pct_effect}
                      onChange={(e) =>
                        handleUpdate(index, 'pct_effect', e.target.value)
                      }
                      disabled={disabled}
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="text"
                      value={range.label ?? ''}
                      onChange={(e) =>
                        handleUpdate(index, 'label', e.target.value)
                      }
                      disabled={disabled}
                      placeholder="Ej: Bajo"
                      className="h-8"
                    />
                  </td>
                  <td className="py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(index)}
                      disabled={disabled}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled}
      >
        <Plus className="mr-1 h-4 w-4" />
        Rango
      </Button>

      {variableSalary != null && variableSalary > 0 && value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Rango de efecto:{' '}
          <span className="font-medium">
            {minEffect < 0 ? '-' : '+'}S/.
            {Math.abs((variableSalary * minEffect) / 100).toFixed(2)}
          </span>{' '}
          a{' '}
          <span className="font-medium">
            {maxEffect < 0 ? '-' : '+'}S/.
            {Math.abs((variableSalary * maxEffect) / 100).toFixed(2)}
          </span>
        </p>
      )}
    </div>
  )
}
