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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { schemeItemFormSchema, type SchemeItemFormValues } from '@/lib/comisiones/validations'
import {
  type PartitionPreset,
  type TipoVenta,
  type ContributionType,
  type RangeSource,
  type OvercomplianceMode,
  type VariableSource,
  ITEM_CATEGORY_LABELS,
  type ItemCategory,
  CONTRIBUTION_TYPE_LABELS,
  CONTRIBUTION_TYPE_DESCRIPTIONS,
  RANGE_SOURCE_LABELS,
  OVERCOMPLIANCE_MODE_LABELS,
  OVERCOMPLIANCE_MODE_DESCRIPTIONS,
  VARIABLE_SOURCE_LABELS,
  VARIABLE_SOURCE_DESCRIPTIONS,
} from '@/lib/comisiones'
import { AcceleratorRangesEditor } from '@/components/comisiones/AcceleratorRangesEditor'

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
  totalSSQuota?: number
  variableSalary?: number
  existingItems?: Array<{ id: string; quota?: number | null; weight?: number | null; mix_factor?: number | null }>
  editingItemId?: string | null
}

type TabValue = 'agrupacion' | 'individual' | 'personalizado'

const CONTRIBUTION_TYPES: ContributionType[] = ['PONDERADA', 'ACELERADOR', 'PXQ_INDEPENDIENTE', 'BONO']
const RANGE_SOURCES: RangeSource[] = ['CUOTA_PROPIA', 'VOLUMEN_GLOBAL', 'CUOTA_GLOBAL_SS']
const OVERCOMPLIANCE_MODES: OvercomplianceMode[] = ['none', 'proportional', 'pxq_bonus']

export function SchemeItemModal({
  open,
  onOpenChange,
  presets,
  tiposVenta,
  defaultValues,
  onSubmit,
  isLoading,
  isEditing,
  totalSSQuota,
  variableSalary,
  existingItems,
  editingItemId,
}: SchemeItemModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetWithVentas | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('agrupacion')
  const [lastEdited, setLastEdited] = useState<'meta' | 'weight' | null>(null)

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
      contribution_type: 'PONDERADA',
      range_source: 'CUOTA_PROPIA',
      uses_conversion_table: false,
      accelerator_ranges: null,
      measurement_type: 'UNIT_COUNT',
      fulfillment_method: 'RATIO',
      measurement_config: null,
      overcompliance_mode: 'none',
      cap_units: null,
      pxq_bonus_amount: null,
      overcap_max_units: null,
      overcap_max_amount: null,
      variable_source: 'FROM_MIX',
      ...defaultValues,
    },
  })

  // Reset form when dialog opens with new defaultValues
  useEffect(() => {
    if (open) {
      form.reset({
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
        contribution_type: 'PONDERADA',
        range_source: 'CUOTA_PROPIA',
        uses_conversion_table: false,
        accelerator_ranges: null,
        measurement_type: 'UNIT_COUNT',
        fulfillment_method: 'RATIO',
        measurement_config: null,
        overcompliance_mode: 'none',
        cap_units: null,
        pxq_bonus_amount: null,
        overcap_max_units: null,
        overcap_max_amount: null,
        variable_source: 'FROM_MIX',
        ...defaultValues,
      })
      setLastEdited(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const hasCap = form.watch('has_cap')
  const tiposVentaIds = form.watch('tipos_venta_ids') || []
  const contributionType = form.watch('contribution_type') as ContributionType
  const overcomplianceMode = form.watch('overcompliance_mode') as OvercomplianceMode
  const variableSource = form.watch('variable_source') as VariableSource

  const watchedQuota = form.watch('quota')
  const watchedWeight = form.watch('weight')
  const watchedMixFactor = form.watch('mix_factor')

  // Determinar categoría de la partida para cálculos (antes de los useEffects que la necesitan)
  const isCustomModeCalc = activeTab === 'personalizado'
  const categoryForCalc: ItemCategory | null = selectedPreset?.default_category as ItemCategory
    || (isCustomModeCalc ? 'adicional' : null)
    || (isEditing && defaultValues ? (defaultValues as { category?: ItemCategory }).category || 'adicional' : null)

  // Partidas Principal + PONDERADA: tienen Meta, Peso, Mix
  const isPrincipalPonderadaCalc = contributionType === 'PONDERADA' && categoryForCalc === 'principal'

  // Partidas Adicional + PONDERADA con FROM_MIX: tienen Mix (sin Meta/Peso)
  const isAdicionalFromMixCalc = contributionType === 'PONDERADA' && categoryForCalc === 'adicional' && variableSource === 'FROM_MIX'

  // ¿Mostrar Mix Factor? Principal PONDERADA o Adicional PONDERADA con FROM_MIX
  const showMixFactorCalc = isPrincipalPonderadaCalc || isAdicionalFromMixCalc

  // CHG-03: Bidirectional Meta <-> Weight link (PONDERADA Principal only)
  useEffect(() => {
    if (!isPrincipalPonderadaCalc || !totalSSQuota) return
    if (lastEdited === 'meta' && watchedQuota != null) {
      const newWeight = watchedQuota / totalSSQuota
      const currentWeight = form.getValues('weight')
      if (currentWeight !== newWeight) {
        form.setValue('weight', newWeight)
      }
    }
  }, [watchedQuota, lastEdited, isPrincipalPonderadaCalc, totalSSQuota, form])

  useEffect(() => {
    if (!isPrincipalPonderadaCalc || !totalSSQuota) return
    if (lastEdited === 'weight' && watchedWeight != null) {
      const newMeta = Math.ceil(watchedWeight * totalSSQuota)
      const currentMeta = form.getValues('quota')
      if (currentMeta !== newMeta) {
        form.setValue('quota', newMeta)
      }
    }
  }, [watchedWeight, lastEdited, isPrincipalPonderadaCalc, totalSSQuota, form])

  // CHG-05/CHG-06: Auto-calculate variable_amount from mix_factor (PONDERADA con Mix)
  useEffect(() => {
    if (!showMixFactorCalc || variableSalary == null) return
    if (watchedMixFactor != null) {
      form.setValue('variable_amount', Math.round(watchedMixFactor * variableSalary * 100) / 100)
    }
  }, [watchedMixFactor, showMixFactorCalc, variableSalary, form])

  // CHG-07: Cross-validation availability
  const otherItems = (existingItems || []).filter(i => i.id !== editingItemId)
  const usedMeta = otherItems.reduce((sum, i) => sum + (i.quota || 0), 0)
  const usedWeight = otherItems.reduce((sum, i) => sum + (i.weight || 0), 0)
  const usedMix = otherItems.reduce((sum, i) => sum + (i.mix_factor || 0), 0)
  const metaAvailable = (totalSSQuota || 0) - usedMeta
  const weightAvailable = (1 - usedWeight) * 100
  const mixAvailable = (1 - usedMix) * 100

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
    const orderA = indexA === -1 ? CATEGORIA_ORDER.length : indexA
    const orderB = indexB === -1 ? CATEGORIA_ORDER.length : indexB
    return orderA - orderB
  })

  // Usar alias para isCustomMode (ya calculado arriba como isCustomModeCalc)
  const isCustomMode = isCustomModeCalc

  // Cuando se selecciona un preset, aplicar sus tipos de venta
  useEffect(() => {
    if (selectedPreset && !isEditing) {
      form.setValue('preset_id', selectedPreset.id)
      form.setValue('custom_name', selectedPreset.name)

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
      setSelectedPreset(null)
      form.setValue('preset_id', null)
      form.setValue('custom_name', null)
      form.setValue('tipos_venta_ids', [])
    }
  }

  const handlePresetSelect = (preset: PresetWithVentas) => {
    if (selectedPreset?.id === preset.id) {
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

  const handleContributionTypeChange = (newType: ContributionType) => {
    form.setValue('contribution_type', newType)
    // Auto-set sensible defaults per type
    switch (newType) {
      case 'PONDERADA':
        form.setValue('weight', null)
        form.setValue('mix_factor', null)
        form.setValue('accelerator_ranges', null)
        break
      case 'ACELERADOR':
        form.setValue('weight', null)
        form.setValue('mix_factor', null)
        form.setValue('range_source', 'CUOTA_PROPIA')
        break
      case 'PXQ_INDEPENDIENTE':
        form.setValue('weight', null)
        form.setValue('mix_factor', null)
        form.setValue('accelerator_ranges', null)
        break
      case 'BONO':
        form.setValue('weight', null)
        form.setValue('mix_factor', null)
        form.setValue('quota', null)
        form.setValue('accelerator_ranges', null)
        break
    }
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

  // Usar alias para category y campos calculados (ya calculados arriba)
  const category = categoryForCalc
  const isPrincipalPonderada = isPrincipalPonderadaCalc
  const isAdicionalFromMix = isAdicionalFromMixCalc
  const showMixFactor = showMixFactorCalc

  // Es Adicional PONDERADA (muestra selector de variable_source)
  const isAdicionalPonderada = contributionType === 'PONDERADA' && categoryForCalc === 'adicional'

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

                {/* Tipo de Contribución */}
                {showConfigFields && (
                  <FormField
                    control={form.control}
                    name="contribution_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Tipo de Contribución</FormLabel>
                        <FormDescription>
                          Define cómo esta partida aporta al cálculo de comisión
                        </FormDescription>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {CONTRIBUTION_TYPES.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleContributionTypeChange(type)}
                              className={cn(
                                "flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-colors",
                                field.value === type
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                              )}
                            >
                              <span className="font-medium">{CONTRIBUTION_TYPE_LABELS[type]}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {CONTRIBUTION_TYPE_DESCRIPTIONS[type]}
                              </span>
                            </button>
                          ))}
                        </div>
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

                {/* Fuente del Variable (solo para Adicional PONDERADA) */}
                {showConfigFields && isAdicionalPonderada && (
                  <FormField
                    control={form.control}
                    name="variable_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Fuente del Variable</FormLabel>
                        <FormDescription>
                          Define si el monto variable forma parte del mix teórico o es un monto adicional
                        </FormDescription>
                        <div className="flex gap-2 pt-1">
                          {(['FROM_MIX', 'FIXED_EXTRA'] as VariableSource[]).map((source) => (
                            <button
                              key={source}
                              type="button"
                              onClick={() => field.onChange(source)}
                              className={cn(
                                "flex-1 flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-colors",
                                field.value === source
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                              )}
                            >
                              <span className="font-medium">{VARIABLE_SOURCE_LABELS[source]}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {VARIABLE_SOURCE_DESCRIPTIONS[source]}
                              </span>
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Configuración de Meta */}
                {showConfigFields && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Configuración de Meta</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Meta (unidades) - show for PONDERADA, ACELERADOR, PXQ_INDEPENDIENTE but not BONO */}
                      {contributionType !== 'BONO' && (
                        <FormField
                          control={form.control}
                          name="quota"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meta (unidades)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="1"
                                  placeholder="Ej: 32"
                                  value={field.value ?? ''}
                                  onChange={(e) => {
                                    if (contributionType === 'PONDERADA') setLastEdited('meta')
                                    field.onChange(e.target.value ? Math.ceil(parseFloat(e.target.value)) : null)
                                  }}
                                />
                              </FormControl>
                              {isPrincipalPonderada && totalSSQuota != null && (
                                <FormDescription>
                                  Disponible: {metaAvailable} de {totalSSQuota}
                                </FormDescription>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Weight - only for PONDERADA + Principal (not Adicional) */}
                      {isPrincipalPonderada && (
                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peso (% de la cuota total)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    placeholder="Ej: 45"
                                    className="pr-8"
                                    value={field.value != null ? Math.round(field.value * 100) : ''}
                                    onChange={(e) => {
                                      setLastEdited('weight')
                                      field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)
                                    }}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Disponible: {weightAvailable.toFixed(1)}% de 100%
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Mix Factor - for PONDERADA (Principal or Adicional con FROM_MIX) */}
                      {showMixFactor && (
                        <FormField
                          control={form.control}
                          name="mix_factor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Factor Mix (%)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="100"
                                  placeholder="Ej: 27"
                                  value={field.value ? (field.value * 100) : ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                                />
                              </FormControl>
                              <FormDescription>
                                Disponible: {mixAvailable.toFixed(1)}% de 100%
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {isPrincipalPonderada && totalSSQuota != null && (
                      <p className="text-xs text-muted-foreground italic">
                        Meta y Peso están vinculados. Al modificar uno, el otro se recalcula.
                      </p>
                    )}

                    {/* Acelerador: range_source + accelerator_ranges */}
                    {contributionType === 'ACELERADOR' && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="range_source"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fuente de Rango</FormLabel>
                              <Select
                                value={field.value ?? 'CUOTA_PROPIA'}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecciona fuente" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {RANGE_SOURCES.map((src) => (
                                    <SelectItem key={src} value={src}>
                                      {RANGE_SOURCE_LABELS[src]}
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
                          name="accelerator_ranges"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rangos del Acelerador</FormLabel>
                              <FormControl>
                                <AcceleratorRangesEditor
                                  value={field.value}
                                  onChange={field.onChange}
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
                            <FormLabel>
                              {contributionType === 'BONO' ? 'Monto del bono (S/.)' : contributionType === 'PONDERADA' ? 'Variable S/.' : 'Variable máximo (S/.)'}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ej: 324.00"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                readOnly={showMixFactor && variableSalary != null}
                                className={showMixFactor && variableSalary != null ? 'bg-muted' : ''}
                              />
                            </FormControl>
                            {showMixFactor && variableSalary != null && watchedMixFactor != null && (
                              <FormDescription>
                                = {((watchedMixFactor || 0) * 100).toFixed(0)}% × S/ {variableSalary}
                              </FormDescription>
                            )}
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

                {/* Usa tabla de conversión */}
                {showConfigFields && (
                  <FormField
                    control={form.control}
                    name="uses_conversion_table"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Usa tabla de conversión del esquema</FormLabel>
                          <FormDescription>
                            Aplica la tabla de conversión definida en el esquema para esta partida
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                {/* Sobrecumplimiento */}
                {showConfigFields && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="overcompliance_mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Sobrecumplimiento</FormLabel>
                          <FormDescription>
                            Define qué sucede cuando se supera la meta
                          </FormDescription>
                          <div className="flex gap-2 pt-1">
                            {OVERCOMPLIANCE_MODES.map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => field.onChange(mode)}
                                className={cn(
                                  "flex-1 flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-colors",
                                  field.value === mode
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                                )}
                              >
                                <span className="font-medium">{OVERCOMPLIANCE_MODE_LABELS[mode]}</span>
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  {OVERCOMPLIANCE_MODE_DESCRIPTIONS[mode]}
                                </span>
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Proporcional fields */}
                    {overcomplianceMode === 'proportional' && (
                      <div className="grid grid-cols-2 gap-4 pl-1">
                        <FormField
                          control={form.control}
                          name="cap_units"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tope máximo unidades</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="Ej: 50"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                />
                              </FormControl>
                              <FormDescription>Máximo de unidades comisionables</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="overcap_max_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto máximo (S/.)</FormLabel>
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
                              <FormDescription>Tope de monto por sobrecumplimiento</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* PxQ Bonus fields */}
                    {overcomplianceMode === 'pxq_bonus' && (
                      <div className="grid grid-cols-3 gap-4 pl-1">
                        <FormField
                          control={form.control}
                          name="pxq_bonus_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto por unidad extra (S/.)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Ej: 15.00"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="overcap_max_units"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Máx unidades extra</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="1"
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

                        <FormField
                          control={form.control}
                          name="overcap_max_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto máximo extra (S/.)</FormLabel>
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

                    {/* Legacy cap fields - only when overcompliance_mode is 'none' */}
                    {overcomplianceMode === 'none' && (
                      <>
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
                      </>
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
