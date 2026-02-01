'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { schemeItemFormSchema, type SchemeItemFormValues } from '@/lib/comisiones/validations'
import {
  type PartitionPreset,
  type TipoVenta,
  ITEM_CATEGORY_LABELS,
  type ItemCategory,
} from '@/lib/comisiones'

interface PresetWithVentas extends PartitionPreset {
  tipos_venta?: Array<{
    tipo_venta_id: string
    codigo: string
    nombre: string
    categoria: string
    cuenta_linea: boolean
    cuenta_equipo: boolean
  }>
}

interface SchemeItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presets: PresetWithVentas[]
  tiposVenta: TipoVenta[]
  defaultValues?: Partial<SchemeItemFormValues>
  onSubmit: (values: SchemeItemFormValues) => Promise<void>
  isLoading?: boolean
  isEditing?: boolean
}

type TabValue = 'agrupacion' | 'individual' | 'personalizado'

export function SchemeItemModal({
  open,
  onOpenChange,
  presets,
  tiposVenta,
  defaultValues,
  onSubmit,
  isLoading,
  isEditing,
}: SchemeItemModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetWithVentas | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('agrupacion')

  const form = useForm<SchemeItemFormValues>({
    resolver: zodResolver(schemeItemFormSchema),
    defaultValues: {
      item_type_id: null,
      preset_id: null,
      custom_name: null,
      custom_description: null,
      tipos_venta_ids: [],
      quota: null,
      quota_amount: null,
      weight: null,
      mix_factor: null,
      variable_amount: 0,
      min_fulfillment: null,
      has_cap: false,
      cap_percentage: null,
      cap_amount: null,
      is_active: true,
      display_order: 0,
      notes: null,
      ...defaultValues,
    },
  })

  const hasCap = form.watch('has_cap')
  const tiposVentaIds = form.watch('tipos_venta_ids') || []

  // Agrupar presets por grupo
  const agrupaciones = presets.filter(p => p.preset_group === 'agrupacion')
  const individuales = presets.filter(p => p.preset_group === 'individual')

  // Orden de categorías para visualización
  const CATEGORIA_ORDER = ['POSTPAGO', 'PREPAGO', 'RENO', 'PACK SS', 'PACK', 'OTROS']

  // Agrupar tipos de venta por categoría
  const tiposVentaGrouped = tiposVenta.reduce((acc, tv) => {
    const cat = tv.categoria || 'OTROS'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tv)
    return acc
  }, {} as Record<string, TipoVenta[]>)

  // Ordenar categorías según el orden definido
  const sortedCategories = Object.entries(tiposVentaGrouped).sort(([a], [b]) => {
    const indexA = CATEGORIA_ORDER.indexOf(a)
    const indexB = CATEGORIA_ORDER.indexOf(b)
    // Si no está en la lista, ponerlo al final
    const orderA = indexA === -1 ? CATEGORIA_ORDER.length : indexA
    const orderB = indexB === -1 ? CATEGORIA_ORDER.length : indexB
    return orderA - orderB
  })

  // Determinar si estamos en modo personalizado
  const isCustomMode = activeTab === 'personalizado'

  // Cuando se selecciona un preset, aplicar sus tipos de venta
  useEffect(() => {
    if (selectedPreset && !isEditing) {
      form.setValue('preset_id', selectedPreset.id)
      form.setValue('custom_name', selectedPreset.name)

      // Aplicar tipos de venta del preset
      const presetVentas = selectedPreset.tipos_venta?.map(tv => ({
        tipo_venta_id: tv.tipo_venta_id,
        cuenta_linea: tv.cuenta_linea,
        cuenta_equipo: tv.cuenta_equipo,
      })) || []
      form.setValue('tipos_venta_ids', presetVentas)
    }
  }, [selectedPreset, form, isEditing])

  // Restaurar estado al abrir el modal en modo edición
  useEffect(() => {
    if (open && isEditing && defaultValues) {
      if (defaultValues.preset_id) {
        const preset = presets.find(p => p.id === defaultValues.preset_id)
        if (preset) {
          setSelectedPreset(preset)
          setActiveTab(preset.preset_group as TabValue)
        }
      } else if (defaultValues.custom_name && !defaultValues.preset_id) {
        setActiveTab('personalizado')
      }
    }
  }, [open, isEditing, defaultValues, presets])

  // Limpiar preset cuando cambia de tab
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue)
    if (value === 'personalizado') {
      setSelectedPreset(null)
      form.setValue('preset_id', null)
      form.setValue('custom_name', null)
      form.setValue('tipos_venta_ids', [])
    } else {
      // Si cambia a otro tab, limpiar selección previa
      setSelectedPreset(null)
      form.setValue('preset_id', null)
      form.setValue('custom_name', null)
      form.setValue('tipos_venta_ids', [])
    }
  }

  const handlePresetSelect = (preset: PresetWithVentas) => {
    if (selectedPreset?.id === preset.id) {
      // Deseleccionar si ya estaba seleccionado
      setSelectedPreset(null)
      form.setValue('preset_id', null)
      form.setValue('custom_name', null)
      form.setValue('tipos_venta_ids', [])
    } else {
      setSelectedPreset(preset)
    }
  }

  const toggleTipoVenta = (tipoVentaId: string, tipoVenta: TipoVenta) => {
    const current = tiposVentaIds || []
    const existing = current.find(tv => tv.tipo_venta_id === tipoVentaId)

    if (existing) {
      form.setValue('tipos_venta_ids', current.filter(tv => tv.tipo_venta_id !== tipoVentaId))
    } else {
      // Determinar valores por defecto basados en el tipo de venta
      const isPack = tipoVenta.categoria === 'PACK'
      form.setValue('tipos_venta_ids', [
        ...current,
        {
          tipo_venta_id: tipoVentaId,
          cuenta_linea: !isPack || tipoVenta.requiere_iccid,
          cuenta_equipo: isPack || tipoVenta.requiere_imei,
        }
      ])
    }
  }

  const isTipoVentaSelected = (tipoVentaId: string) => {
    return tiposVentaIds?.some(tv => tv.tipo_venta_id === tipoVentaId) || false
  }

  const handleSubmit = async (values: SchemeItemFormValues) => {
    await onSubmit(values)
    form.reset()
    setSelectedPreset(null)
    setActiveTab('agrupacion')
  }

  const handleClose = () => {
    onOpenChange(false)
    setSelectedPreset(null)
    setActiveTab('agrupacion')
    form.reset()
  }

  // Determinar categoría para mostrar campos específicos
  const category: ItemCategory | null = selectedPreset?.default_category ||
    (isCustomMode ? 'adicional' : null)

  // Determinar si mostrar los campos de configuración
  const showConfigFields = isCustomMode || selectedPreset || isEditing

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {isEditing ? 'Editar Partida' : 'Agregar Partida'}
          </DialogTitle>
          <DialogDescription>
            {selectedPreset
              ? `${selectedPreset.name} - ${ITEM_CATEGORY_LABELS[selectedPreset.default_category as ItemCategory]}`
              : isCustomMode
                ? 'Configura una partida personalizada'
                : 'Selecciona un preset o configura una partida personalizada'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-6 py-2">
                {/* Selector de Tipo de Partida con 3 tabs iguales */}
                {!isEditing && (
                  <div className="space-y-4">
                    <FormLabel className="text-base">Tipo de Partida</FormLabel>

                    <Tabs value={activeTab} onValueChange={handleTabChange}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="agrupacion">Agrupaciones</TabsTrigger>
                        <TabsTrigger value="individual">Individuales</TabsTrigger>
                        <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
                      </TabsList>

                      <TabsContent value="agrupacion" className="mt-4">
                        <div className="grid grid-cols-2 gap-2 p-0.5">
                          {agrupaciones.map(preset => (
                            <PresetButton
                              key={preset.id}
                              name={preset.name}
                              isSelected={selectedPreset?.id === preset.id}
                              onClick={() => handlePresetSelect(preset)}
                            />
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="individual" className="mt-4">
                        <div className="grid grid-cols-4 gap-2 p-0.5">
                          {individuales.map(preset => (
                            <PresetButton
                              key={preset.id}
                              name={preset.name}
                              isSelected={selectedPreset?.id === preset.id}
                              onClick={() => handlePresetSelect(preset)}
                            />
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="personalizado" className="mt-4">
                        <div className="text-sm text-muted-foreground">
                          Configura manualmente los tipos de venta y parámetros de esta partida.
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Nombre personalizado */}
                {showConfigFields && (
                  <FormField
                    control={form.control}
                    name="custom_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la partida</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: OSS, PACK SS, etc."
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Tipos de Venta */}
                {showConfigFields && (
                  <div className="space-y-3">
                    <FormLabel className="text-base">Tipos de Venta que Aplican</FormLabel>
                    <FormDescription>
                      Selecciona qué tipos de venta contarán para esta partida
                    </FormDescription>

                    <div className="border rounded-lg p-4 space-y-4">
                      {sortedCategories.map(([categoria, tipos]) => (
                        <div key={categoria}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            {categoria}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tipos.map(tv => (
                              <Badge
                                key={tv.id}
                                variant={isTipoVentaSelected(tv.id) ? "default" : "outline"}
                                className={cn(
                                  "cursor-pointer transition-colors",
                                  isTipoVentaSelected(tv.id) && "bg-primary"
                                )}
                                onClick={() => toggleTipoVenta(tv.id, tv)}
                              >
                                {tv.codigo}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {tiposVentaIds && tiposVentaIds.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {tiposVentaIds.length} tipo(s) seleccionado(s)
                      </div>
                    )}
                  </div>
                )}

                {/* Configuración de Meta */}
                {showConfigFields && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Configuración de Meta</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="quota"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meta (unidades)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ej: 31.5"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {category === 'principal' && (
                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peso (% del variable)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="100"
                                  placeholder="Ej: 45"
                                  value={field.value ? (field.value * 100) : ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                                />
                              </FormControl>
                              <FormDescription>Porcentaje del sueldo variable</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {category === 'principal' && (
                        <FormField
                          control={form.control}
                          name="mix_factor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Factor Mix</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ej: 0.27"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                />
                              </FormControl>
                              <FormDescription>Para cálculo de subpartidas</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Comisión */}
                {showConfigFields && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Comisión</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="variable_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Variable máximo (S/.)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ej: 324.00"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="min_fulfillment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cumplimiento mínimo (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                placeholder="Vacío = usar global"
                                value={field.value ? (field.value * 100) : ''}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                              />
                            </FormControl>
                            <FormDescription>Deja vacío para usar el valor global</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Tope */}
                {showConfigFields && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="has_cap"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Tiene tope máximo</FormLabel>
                            <FormDescription>
                              Limita el porcentaje o monto máximo comisionable
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    {hasCap && (
                      <div className="grid grid-cols-2 gap-4 pl-7">
                        <FormField
                          control={form.control}
                          name="cap_percentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Porcentaje tope (%)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="200"
                                  placeholder="Ej: 100"
                                  value={field.value ? (field.value * 100) : ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="cap_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto tope (S/.)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Opcional"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Notas */}
                {showConfigFields && (
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Notas adicionales sobre esta partida..."
                            className="resize-none"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Estado activo */}
                {showConfigFields && (
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Partida activa</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-background">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (!selectedPreset && !isCustomMode && !isEditing)}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : 'Agregar Partida'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// Componente auxiliar para botones de preset - simplificado
function PresetButton({
  name,
  isSelected,
  onClick,
}: {
  name: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm transition-colors",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <span className="font-medium">{name}</span>
      {isSelected && <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />}
    </button>
  )
}
