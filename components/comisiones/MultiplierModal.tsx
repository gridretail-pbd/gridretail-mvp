'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { multiplierFormSchema, type MultiplierFormValues, type MultiplierFormInput } from '@/lib/comisiones/validations'
import {
  type MultiplierType,
  type TieredRange,
  MULTIPLIER_TYPE_LABELS,
  MULTIPLIER_TYPE_ICONS,
  ACTIVATION_CRITERIA_LABELS,
} from '@/lib/comisiones/types'

interface MultiplierModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schemeItems: Array<{ id: string; custom_name?: string | null; preset?: { name: string } | null }>
  onSubmit: (values: MultiplierFormValues) => Promise<void>
  isLoading?: boolean
}

const TYPES_FOR_UI: MultiplierType[] = ['LOCK', 'ACCELERATOR', 'CROSS_PRODUCT', 'TIERED']

const DEFAULT_CRITERIA: Record<string, string> = {
  LOCK: 'MIN_QUANTITY',
  ACCELERATOR: 'OWN_ATTAINMENT',
  DECELERATOR: 'OWN_ATTAINMENT',
  PROPORTIONAL: 'OWN_ATTAINMENT',
  CROSS_PRODUCT: 'OTHER_ATTAINMENT',
  TIERED: 'ATTAINMENT_RANGE',
}

const DEFAULT_FACTORS: Record<string, { met: number; notMet: number }> = {
  LOCK: { met: 1.0, notMet: 0.0 },
  ACCELERATOR: { met: 1.2, notMet: 1.0 },
  DECELERATOR: { met: 1.0, notMet: 0.8 },
  CROSS_PRODUCT: { met: 1.1, notMet: 1.0 },
  TIERED: { met: 1.0, notMet: 1.0 },
}

export function MultiplierModal({
  open,
  onOpenChange,
  schemeItems,
  onSubmit,
  isLoading,
}: MultiplierModalProps) {
  const [tieredRanges, setTieredRanges] = useState<TieredRange[]>([
    { min: 70, max: 79.99, factor: 0.70, label: '' },
    { min: 80, max: 94.99, factor: 0.80, label: '' },
    { min: 95, max: 100, factor: 1.00, label: 'Meta' },
    { min: 100.01, max: 999999, factor: 1.10, label: '' },
  ])

  const form = useForm<MultiplierFormInput, unknown, MultiplierFormValues>({
    resolver: zodResolver(multiplierFormSchema),
    defaultValues: {
      multiplier_type: 'LOCK',
      activation_criteria: 'MIN_QUANTITY',
      source_description: '',
      source_item_id: null,
      threshold_value: null,
      factor_if_met: 1.0,
      factor_if_not_met: 0.0,
      tiered_ranges: null,
      operator_cedente: null,
      measurement_type: 'UNIT_COUNT',
      measurement_config: null,
      is_active: true,
    },
  })

  const selectedType = form.watch('multiplier_type')

  const handleTypeSelect = (type: MultiplierType) => {
    form.setValue('multiplier_type', type)
    form.setValue('activation_criteria', DEFAULT_CRITERIA[type] as any)
    form.setValue('factor_if_met', DEFAULT_FACTORS[type].met)
    form.setValue('factor_if_not_met', DEFAULT_FACTORS[type].notMet)
    if (type === 'CROSS_PRODUCT') {
      form.setValue('activation_criteria', 'OTHER_ATTAINMENT')
    }
  }

  const handleSubmit = async (values: MultiplierFormValues) => {
    if (values.multiplier_type === 'TIERED') {
      values.tiered_ranges = tieredRanges
    }
    await onSubmit(values)
    form.reset()
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    form.reset()
  }

  const updateTieredRange = (index: number, field: keyof TieredRange, value: number | string) => {
    const updated = [...tieredRanges]
    updated[index] = { ...updated[index], [field]: value }
    setTieredRanges(updated)
  }

  const addTieredRange = () => {
    const last = tieredRanges[tieredRanges.length - 1]
    setTieredRanges([...tieredRanges, {
      min: last ? last.max + 0.01 : 0,
      max: last ? last.max + 10 : 100,
      factor: 1.0,
      label: '',
    }])
  }

  const removeTieredRange = (index: number) => {
    setTieredRanges(tieredRanges.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Agregar Multiplicador</DialogTitle>
          <DialogDescription>
            Configura un factor que modifica el resultado de esta partida
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-6 py-2">
                {/* Type selector */}
                <div className="space-y-2">
                  <FormLabel>Tipo</FormLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {TYPES_FOR_UI.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleTypeSelect(type)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors",
                          selectedType === type
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="text-lg">{MULTIPLIER_TYPE_ICONS[type]}</span>
                        <span className="font-medium">{MULTIPLIER_TYPE_LABELS[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source description */}
                <FormField
                  control={form.control}
                  name="source_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Vender ≥2 seguros MEP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Activation criteria */}
                {selectedType !== 'TIERED' && (
                  <FormField
                    control={form.control}
                    name="activation_criteria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Criterio de activación</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(ACTIVATION_CRITERIA_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Source item (for CROSS_PRODUCT) */}
                {selectedType === 'CROSS_PRODUCT' && (
                  <FormField
                    control={form.control}
                    name="source_item_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partida origen</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar partida" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {schemeItems.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.custom_name || item.preset?.name || 'Sin nombre'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Otra partida del esquema cuyo cumplimiento se evalúa</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Threshold */}
                {selectedType !== 'TIERED' && (
                  <FormField
                    control={form.control}
                    name="threshold_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {selectedType === 'LOCK' && form.watch('activation_criteria') === 'MIN_QUANTITY'
                            ? 'Cantidad mínima'
                            : 'Umbral (%)'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={selectedType === 'LOCK' ? '2' : '100'}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Factors (for non-LOCK, non-TIERED) */}
                {selectedType !== 'LOCK' && selectedType !== 'TIERED' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="factor_if_met"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Factor si cumple</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormDescription>Ej: 1.2 = +20%</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="factor_if_not_met"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Factor si no cumple</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>Ej: 1.0 = sin efecto</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Tiered ranges editor */}
                {selectedType === 'TIERED' && (
                  <div className="space-y-3">
                    <FormLabel>Rangos</FormLabel>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Desde %</th>
                            <th className="px-3 py-2 text-left font-medium">Hasta %</th>
                            <th className="px-3 py-2 text-left font-medium">Factor</th>
                            <th className="px-3 py-2 text-left font-medium">Etiqueta</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tieredRanges.map((range, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-2 py-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={range.min}
                                  onChange={e => updateTieredRange(idx, 'min', parseFloat(e.target.value) || 0)}
                                  className="h-8"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={range.max}
                                  onChange={e => updateTieredRange(idx, 'max', parseFloat(e.target.value) || 0)}
                                  className="h-8"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={range.factor}
                                  onChange={e => updateTieredRange(idx, 'factor', parseFloat(e.target.value) || 0)}
                                  className="h-8"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  value={range.label || ''}
                                  onChange={e => updateTieredRange(idx, 'label', e.target.value)}
                                  className="h-8"
                                  placeholder="Opcional"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeTieredRange(idx)}
                                >
                                  <span className="text-destructive text-xs">✕</span>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addTieredRange}>
                      + Rango
                    </Button>
                  </div>
                )}

                {/* Active */}
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Multiplicador activo</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-background">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
