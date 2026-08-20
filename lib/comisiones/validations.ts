// ============================================================================
// VALIDACIONES ZOD - MÓDULO DE COMISIONES (v3.3)
// ============================================================================

import { z } from 'zod'

// ── Schemas auxiliares ────────────────────────────────────────

const conversionTableRangeSchema = z.object({
  min: z.number().min(0),
  max: z.number(),
  effective: z.union([z.number(), z.string()]),
  label: z.string().optional(),
})

const conversionTableSchema = z.object({
  description: z.string().optional(),
  ranges: z.array(conversionTableRangeSchema).min(1),
})

const acceleratorRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  pct_effect: z.number(),
  label: z.string().optional(),
})

const acceleratorRangesSchema = z.object({
  source_item_name: z.string().optional(),
  ranges: z.array(acceleratorRangeSchema).min(1),
})

const measurementConfigSchema = z.object({
  value_field: z.string().optional(),
  condition_field: z.string().optional(),
  condition_value: z.union([z.boolean(), z.string(), z.number()]).optional(),
  scope_tipos_venta: z.array(z.string()).optional(),
  description: z.string().optional(),
})

const tieredRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  factor: z.number(),
  label: z.string().optional(),
})

// ── Schema: Esquema de comisiones ─────────────────────────────

export const schemeFormSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(150, 'Máximo 150 caracteres'),
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'Solo mayúsculas, números y guión bajo'),
  description: z.string().max(500).optional(),
  scheme_type: z.enum(['asesor', 'supervisor', 'encargado']),
  year: z
    .number()
    .min(2020, 'Año mínimo: 2020')
    .max(2100, 'Año máximo: 2100'),
  month: z
    .number()
    .min(1, 'Mes inválido')
    .max(12, 'Mes inválido'),
  fixed_salary: z
    .number()
    .min(0, 'El sueldo fijo no puede ser negativo'),
  variable_salary: z
    .number()
    .min(0, 'El sueldo variable no puede ser negativo'),
  total_ss_quota: z
    .number()
    .min(0, 'La cuota no puede ser negativa'),
  default_min_fulfillment: z
    .number()
    .min(0.01, 'Mínimo 1%')
    .max(1, 'Máximo 100%')
    .optional()
    .nullable(),
  // v3.2
  conversion_table: conversionTableSchema.optional().nullable(),
  global_range_method: z.enum(['VOLUMEN_TOTAL']).optional().nullable(),
  // v3.3
  accelerator_base: z.enum(['VARIABLE_TEORICO', 'VARIABLE_CALCULADO']).optional(),
})

export type SchemeFormValues = z.infer<typeof schemeFormSchema>

// ── Schema: Selección de tipo de venta ────────────────────────

export const tipoVentaSelectionSchema = z.object({
  tipo_venta_id: z.string().uuid(),
  cuenta_linea: z.boolean(),
  cuenta_equipo: z.boolean(),
})

export type TipoVentaSelectionValues = z.infer<typeof tipoVentaSelectionSchema>

// ── Schema: Partida (v3.3) ────────────────────────────────────

export const schemeItemFormSchema = z.object({
  item_type_id: z.string().uuid().optional().nullable(),
  preset_id: z.string().uuid().optional().nullable(),
  custom_name: z.string().max(100).optional().nullable(),
  custom_description: z.string().max(500).optional().nullable(),
  tipos_venta_ids: z.array(tipoVentaSelectionSchema).optional().nullable(),
  original_label: z.string().max(200).optional().nullable(),
  quota: z.number().min(0).optional().nullable(),
  quota_amount: z.number().min(0).optional().nullable(),
  weight: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(1, 'Máximo 100%')
    .optional()
    .nullable(),
  mix_factor: z.number().min(0).optional().nullable(),
  variable_amount: z
    .number()
    .min(0, 'El monto variable no puede ser negativo'),
  min_fulfillment: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(1, 'Máximo 100%')
    .optional()
    .nullable(),
  has_cap: z.boolean(),
  cap_percentage: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(2, 'Máximo 200%')
    .optional()
    .nullable(),
  cap_amount: z.number().min(0).optional().nullable(),
  // v3.2
  contribution_type: z.enum(['PONDERADA', 'ACELERADOR', 'PXQ_INDEPENDIENTE', 'BONO']).default('PONDERADA'),
  range_source: z.enum(['CUOTA_PROPIA', 'VOLUMEN_GLOBAL', 'CUOTA_GLOBAL_SS']).default('CUOTA_PROPIA'),
  uses_conversion_table: z.boolean().default(false),
  accelerator_ranges: acceleratorRangesSchema.optional().nullable(),
  // v3.3
  measurement_type: z.enum(['UNIT_COUNT', 'AVERAGE_VALUE', 'TOTAL_VALUE', 'RATE', 'MANUAL']).default('UNIT_COUNT'),
  fulfillment_method: z.enum(['RATIO', 'ABSOLUTE_RANGES']).default('RATIO'),
  measurement_config: measurementConfigSchema.optional().nullable(),
  // v3.0.1: Sobrecumplimiento
  overcompliance_mode: z.enum(['none', 'proportional', 'pxq_bonus']).default('none'),
  cap_units: z.number().min(0).optional().nullable(),
  pxq_bonus_amount: z.number().min(0).optional().nullable(),
  overcap_max_units: z.number().min(0).optional().nullable(),
  overcap_max_amount: z.number().min(0).optional().nullable(),
  // v3.4: Fuente del variable
  variable_source: z.enum(['FROM_MIX', 'FIXED_EXTRA']).default('FROM_MIX'),
  is_active: z.boolean(),
  display_order: z.number().min(0),
  notes: z.string().max(500).optional().nullable(),
})

export type SchemeItemFormValues = z.infer<typeof schemeItemFormSchema>
/** Tipo de ENTRADA del schema: los campos con .default() son opcionales.
 *  Necesario para useForm porque zodResolver se tipa contra el input. */
export type SchemeItemFormInput = z.input<typeof schemeItemFormSchema>

/**
 * Validación adicional: debe tener item_type_id, preset_id o custom_name
 */
export function validateSchemeItem(data: SchemeItemFormValues): { valid: boolean; message?: string } {
  if (!data.item_type_id && !data.preset_id && !data.custom_name) {
    return {
      valid: false,
      message: 'Debe seleccionar un tipo de partida, preset, o definir un nombre personalizado'
    }
  }
  return { valid: true }
}

// ── Schema: Multiplicador (v3.2) ──────────────────────────────

export const multiplierFormSchema = z.object({
  multiplier_type: z.enum(['LOCK', 'ACCELERATOR', 'DECELERATOR', 'PROPORTIONAL', 'CROSS_PRODUCT', 'TIERED']),
  activation_criteria: z.enum(['MIN_QUANTITY', 'OWN_ATTAINMENT', 'OTHER_ATTAINMENT', 'GLOBAL_ATTAINMENT', 'ATTAINMENT_RANGE', 'OPERATOR_ORIGIN']),
  source_description: z.string().min(1, 'La descripción es requerida').max(200),
  source_item_id: z.string().uuid().optional().nullable(),
  threshold_value: z.number().optional().nullable(),
  factor_if_met: z.number().min(0).max(10).default(1.0),
  factor_if_not_met: z.number().min(0).max(10).default(0.0),
  tiered_ranges: z.array(tieredRangeSchema).optional().nullable(),
  operator_cedente: z.string().max(30).optional().nullable(),
  measurement_type: z.enum(['UNIT_COUNT', 'RATE', 'AVERAGE_VALUE', 'MANUAL']).default('UNIT_COUNT'),
  measurement_config: measurementConfigSchema.optional().nullable(),
  is_active: z.boolean().default(true),
})

export type MultiplierFormValues = z.infer<typeof multiplierFormSchema>
/** Tipo de ENTRADA del schema (ver nota en SchemeItemFormInput). */
export type MultiplierFormInput = z.input<typeof multiplierFormSchema>

// ── Schema: Candado (legacy) ──────────────────────────────────

export const lockFormSchema = z.object({
  lock_type: z.enum(['min_quantity', 'min_amount', 'min_percentage', 'min_fulfillment']),
  required_item_type_id: z.string().uuid().optional().nullable(),
  required_value: z
    .number()
    .min(0, 'El valor debe ser positivo'),
  description: z.string().max(255).optional(),
  is_active: z.boolean(),
})

export type LockFormValues = z.infer<typeof lockFormSchema>

// ── Schema: Restricción ───────────────────────────────────────

export const restrictionFormSchema = z.object({
  restriction_type: z.enum(['max_percentage', 'max_quantity', 'min_percentage', 'operator_origin']),
  scheme_item_id: z.string().uuid().optional().nullable(),
  plan_code: z.string().max(30).optional().nullable(),
  operator_code: z.string().max(30).optional().nullable(),
  max_percentage: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(1, 'Máximo 100%')
    .optional()
    .nullable(),
  max_quantity: z
    .number()
    .min(0)
    .optional()
    .nullable(),
  min_percentage: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(1, 'Máximo 100%')
    .optional()
    .nullable(),
  scope: z.enum(['hc', 'tex', 'global']),
  description: z.string().max(255).optional().nullable(),
  is_active: z.boolean(),
})

export type RestrictionFormValues = z.infer<typeof restrictionFormSchema>

// ── Schema: Filtros ───────────────────────────────────────────

export const schemeFiltersSchema = z.object({
  status: z.array(z.enum(['oficial', 'draft', 'aprobado', 'archivado'])).optional(),
  scheme_type: z.enum(['asesor', 'supervisor', 'encargado']).optional(),
  year: z.number().optional(),
  month: z.number().min(1).max(12).optional(),
  search: z.string().optional(),
})

export const pxqScaleFormSchema = z.object({
  min_fulfillment: z.number().min(0).max(2),
  max_fulfillment: z.number().min(0).max(2).optional().nullable(),
  amount_per_unit: z.number().min(0),
  display_order: z.number().min(0).default(0),
})

export type SchemeFiltersValues = z.infer<typeof schemeFiltersSchema>

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

/**
 * Valida que los pesos de las partidas PONDERADAS sumen 100%
 */
export function validatePrincipalWeights(
  items: Array<{ contribution_type?: string; weight?: number | null }>
): { valid: boolean; sum: number; message?: string } {
  const ponderadas = items.filter(item =>
    !item.contribution_type || item.contribution_type === 'PONDERADA'
  )
  const sum = ponderadas.reduce((acc, item) => acc + (item.weight || 0), 0)

  const valid = Math.abs(sum - 1) <= 0.001

  return {
    valid,
    sum,
    message: valid
      ? undefined
      : `Las partidas ponderadas deben sumar 100%. Actual: ${(sum * 100).toFixed(1)}%`,
  }
}

/**
 * Valida que no exista otro esquema con el mismo código
 */
export function validateUniqueCode(
  code: string,
  existingCodes: string[],
  currentId?: string
): boolean {
  const codesWithoutCurrent = currentId
    ? existingCodes.filter(c => c !== code)
    : existingCodes
  return !codesWithoutCurrent.includes(code)
}
