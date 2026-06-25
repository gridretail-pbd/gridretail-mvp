'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { schemeFormSchema, type SchemeFormValues } from '@/lib/comisiones/validations'
import { MONTHS, SCHEME_TYPE_LABELS, type SchemeType, generateSchemeCode, ACCELERATOR_BASE_LABELS } from '@/lib/comisiones'
import { ConversionTableEditor } from './ConversionTableEditor'
import { useEffect } from 'react'

interface SchemeFormProps {
  defaultValues?: Partial<SchemeFormValues>
  onSubmit: (values: SchemeFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function SchemeForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = 'Guardar',
}: SchemeFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(!!defaultValues?.conversion_table || !!defaultValues?.accelerator_base)
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  const form = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      scheme_type: 'asesor',
      year: currentYear,
      month: currentMonth,
      fixed_salary: 1050,
      variable_salary: 1025,
      total_ss_quota: 70,
      default_min_fulfillment: 0.5,
      ...defaultValues,
    },
  })

  const schemeType = form.watch('scheme_type')
  const year = form.watch('year')
  const month = form.watch('month')

  // Autogenerar código cuando cambian tipo, año o mes
  useEffect(() => {
    if (!defaultValues?.code && schemeType && year && month) {
      const suggestedCode = generateSchemeCode(schemeType as SchemeType, year, month)
      form.setValue('code', suggestedCode)
    }
  }, [schemeType, year, month, form, defaultValues?.code])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del esquema</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Esquema Asesor Febrero 2026"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ESQ_ASE_0226"
                      {...field}
                      className="font-mono uppercase"
                    />
                  </FormControl>
                  <FormDescription>
                    Código único. Solo mayúsculas, números y guión bajo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="scheme_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de esquema</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SCHEME_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Año" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mes</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales sobre el esquema..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Montos Base */}
        <Card>
          <CardHeader>
            <CardTitle>Montos Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fixed_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sueldo Fijo (S/.)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1050.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Monto fijo mensual
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="variable_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sueldo Variable (S/.)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1025.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Máximo variable alcanzable
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_ss_quota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuota SS Total</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="70"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Meta total de líneas SS
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_min_fulfillment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cumplimiento Mínimo Global (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        placeholder="50"
                        value={(field.value || 0.5) * 100}
                        onChange={(e) => field.onChange((parseFloat(e.target.value) || 50) / 100)}
                      />
                    </FormControl>
                    <FormDescription>
                      Porcentaje mínimo para comisionar (50% por defecto)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuración Avanzada */}
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              Configuración Avanzada
              {advancedOpen ? (
                <ChevronDown className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronRight className="h-4 w-4 ml-auto" />
              )}
            </CardTitle>
          </CardHeader>
          {advancedOpen && (
            <CardContent className="space-y-6">
              {/* Tabla de conversión */}
              <FormField
                control={form.control}
                name="conversion_table"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={!!field.value}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange({
                              ranges: [
                                { min: 0, max: 69.99, effective: 0, label: '' },
                                { min: 70, max: 79.99, effective: 70, label: '' },
                                { min: 80, max: 94.99, effective: 80, label: '' },
                                { min: 95, max: 100, effective: 100, label: 'Meta' },
                                { min: 100.01, max: 999999, effective: '+10', label: '' },
                              ],
                            })
                          } else {
                            field.onChange(null)
                          }
                        }}
                      />
                      <FormLabel className="!mt-0">Usar tabla de conversión</FormLabel>
                    </div>
                    <FormDescription>
                      Convierte el % cumplimiento real a un % efectivo por tramos
                    </FormDescription>
                    {field.value && (
                      <ConversionTableEditor
                        value={field.value.ranges}
                        onChange={(ranges) => field.onChange({ ...field.value, ranges })}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Accelerator base */}
              <FormField
                control={form.control}
                name="accelerator_base"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base para aceleradores</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || 'VARIABLE_TEORICO'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ACCELERATOR_BASE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Qué monto toma como base el efecto ±% de los aceleradores
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          )}
        </Card>

        {/* Resumen */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ingreso potencial:</span>
              <span className="font-semibold">
                S/. {((form.watch('fixed_salary') || 0) + (form.watch('variable_salary') || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
