// ============================================================================
// VALIDACIONES ZOD - MÓDULO DE COMISIONES
// ============================================================================

import { z } from 'zod'

/**
 * Schema para crear/editar un esquema de comisiones
 */
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
    .min(1, 'La cuota debe ser mayor a 0'),
  default_min_fulfillment: z
    .number()
    .min(0.01, 'Mínimo 1%')
    .max(1, 'Máximo 100%')
    .optional()
    .nullable(),
})

export type SchemeFormValues = z.infer<typeof schemeFormSchema>

/**
 * Schema para selección de tipo de venta con flags
 */
export const tipoVentaSelectionSchema = z.object({
  tipo_venta_id: z.string().uuid(),
  cuenta_linea: z.boolean(),
  cuenta_equipo: z.boolean(),
})

export type TipoVentaSelectionValues = z.infer<typeof tipoVentaSelectionSchema>

/**
 * Schema para crear/editar una partida (v2.1 - con sistema de presets)
 */
export const schemeItemFormSchema = z.object({
  // Ahora item_type_id es opcional (puede ser null si usa preset o es custom)
  item_type_id: z.string().uuid().optional().nullable(),
  // Referencia al preset usado
  preset_id: z.string().uuid().optional().nullable(),
  // Nombre y descripción personalizados
  custom_name: z.string().max(100).optional().nullable(),
  custom_description: z.string().max(500).optional().nullable(),
  // Tipos de venta seleccionados manualmente
  tipos_venta_ids: z.array(tipoVentaSelectionSchema).optional().nullable(),
  // Campos existentes
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
  is_active: z.boolean(),
  display_order: z.number().min(0),
  notes: z.string().max(500).optional().nullable(),
})

export type SchemeItemFormValues = z.infer<typeof schemeItemFormSchema>

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

/**
 * Schema para configurar un candado
 */
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

/**
 * Schema para configurar una restricción
 */
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

/**
 * Schema para filtros de la lista de esquemas
 */
export const schemeFiltersSchema = z.object({
  status: z.array(z.enum(['oficial', 'draft', 'aprobado', 'archivado'])).optional(),
  scheme_type: z.enum(['asesor', 'supervisor', 'encargado']).optional(),
  year: z.number().optional(),
  month: z.number().min(1).max(12).optional(),
  search: z.string().optional(),
})

/**
 * Schema para escalas PxQ
 */
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
 * Valida que los pesos de las partidas principales sumen 100%
 */
export function validatePrincipalWeights(
  items: Array<{ category: string; weight?: number | null }>
): { valid: boolean; sum: number; message?: string } {
  const principalItems = items.filter(item => item.category === 'principal')
  const sum = principalItems.reduce((acc, item) => acc + (item.weight || 0), 0)

  // Permitir tolerancia de 0.1%
  const valid = Math.abs(sum - 1) <= 0.001

  return {
    valid,
    sum,
    message: valid
      ? undefined
      : `Las partidas principales deben sumar 100%. Actual: ${(sum * 100).toFixed(1)}%`,
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

