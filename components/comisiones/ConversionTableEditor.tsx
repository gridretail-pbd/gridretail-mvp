'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConversionTableRange } from '@/lib/comisiones/types'

interface ConversionTableEditorProps {
  value: ConversionTableRange[]
  onChange: (ranges: ConversionTableRange[]) => void
  disabled?: boolean
}

const DEFAULT_RANGES: ConversionTableRange[] = [
  { min: 0, max: 59.99, effective: 0, label: 'No comisiona' },
  { min: 60, max: 79.99, effective: 60, label: 'Mínimo' },
  { min: 80, max: 99.99, effective: 80, label: 'Base' },
  { min: 100, max: 120, effective: 100, label: 'Meta' },
]

export function ConversionTableEditor({
  value,
  onChange,
  disabled = false,
}: ConversionTableEditorProps) {
  const ranges = value.length > 0 ? value : DEFAULT_RANGES

  // Initialize with defaults if empty
  if (value.length === 0) {
    onChange(DEFAULT_RANGES)
  }

  const updateRange = (index: number, field: keyof ConversionTableRange, raw: string) => {
    const updated = [...ranges]
    if (field === 'label') {
      updated[index] = { ...updated[index], [field]: raw }
    } else {
      const num = parseFloat(raw)
      if (!isNaN(num)) {
        updated[index] = { ...updated[index], [field]: num }
      }
    }
    onChange(updated)
  }

  const addRange = () => {
    const last = ranges[ranges.length - 1]
    const newMin = last ? Math.round((Number(last.max) + 0.01) * 100) / 100 : 0
    onChange([
      ...ranges,
      { min: newMin, max: newMin + 10, effective: 0, label: '' },
    ])
  }

  const removeRange = (index: number) => {
    onChange(ranges.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-2">Desde (%)</th>
              <th className="pb-2 pr-2">Hasta (%)</th>
              <th className="pb-2 pr-2">% Efectivo</th>
              <th className="pb-2 pr-2">Etiqueta</th>
              <th className="pb-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {ranges.map((range, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={range.min}
                    onChange={(e) => updateRange(i, 'min', e.target.value)}
                    disabled={disabled}
                    className="h-8 w-24"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={range.max}
                    onChange={(e) => updateRange(i, 'max', e.target.value)}
                    disabled={disabled}
                    className="h-8 w-24"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={typeof range.effective === 'number' ? range.effective : range.effective}
                    onChange={(e) => updateRange(i, 'effective', e.target.value)}
                    disabled={disabled}
                    className="h-8 w-24"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="text"
                    value={range.label ?? ''}
                    onChange={(e) => updateRange(i, 'label', e.target.value)}
                    disabled={disabled}
                    className="h-8"
                    placeholder="Opcional"
                  />
                </td>
                <td className="py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeRange(i)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRange}
        disabled={disabled}
      >
        <Plus className="mr-1 h-4 w-4" />
        Rango
      </Button>
    </div>
  )
}
