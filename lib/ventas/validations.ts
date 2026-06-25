import { z } from 'zod'

/**
 * Validación server-side para el INSERT de ventas (Vinculación Venta↔Arribo).
 *
 * Cambios clave respecto al flujo anterior:
 * - `arribo_id` es **requerido**: toda venta nace de un arribo (migración 029,
 *   ventas.arribo_id NOT NULL).
 * - Se eliminó el flujo manual de fecha (`opcion_fecha` / fecha libre): la
 *   `fecha` y la `tienda_id` se **heredan del arribo** en el servidor.
 * - Validación estricta de cliente con los **5 tipos** de documento (sin OTRO),
 *   espejo del constraint ventas_tipo_documento_cliente_check.
 *
 * La obligatoriedad real de `motivo_rezago` / `rango_horario` la decide el
 * servidor según la fecha del arribo y el rol (el cliente no es fuente de
 * verdad de la fecha); por eso aquí son opcionales.
 */

// Tipos de documento válidos en ventas (sin OTRO).
export const TIPOS_DOC_VENTA = ['DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP'] as const

const DOC_PATTERNS: Record<(typeof TIPOS_DOC_VENTA)[number], RegExp> = {
  DNI: /^\d{8}$/,
  CE: /^\d{9}$/,
  RUC: /^(10|20)\d{9}$/,
  PASAPORTE: /^[A-Z0-9]{6,12}$/i,
  PTP: /^[A-Z0-9]{6,15}$/i,
}

const optionalString = z.string().trim().optional().nullable()

export const ventaInsertSchema = z
  .object({
    // Vínculo obligatorio al arribo (fecha y tienda se heredan de él).
    arribo_id: z.string().uuid('arribo_id requerido'),

    // Identidad del vendedor (patrón del repo: viaja en el body). El servidor
    // recarga la fila autoritativa de usuarios y deriva codigo_asesor/dni.
    usuario_id: z.string().uuid('usuario_id inválido'),

    // Rezago: el servidor exige estos campos solo si la venta es rezagada y el
    // rol no tiene "fecha libre".
    motivo_rezago: z.string().trim().min(1).optional().nullable(),
    rango_horario: z.string().trim().optional().nullable(),

    // Identificación
    orden_venta: z
      .string()
      .trim()
      .regex(/^[78]\d{8}$/, 'La orden debe tener 9 dígitos y empezar con 7 u 8'),
    telefono_linea: z
      .string()
      .trim()
      .regex(/^9\d{8}$/, 'El teléfono debe tener 9 dígitos y empezar con 9'),
    tipo_documento_cliente: z.enum(TIPOS_DOC_VENTA),
    numero_documento_cliente: z.string().trim(),
    nombre_cliente: z.string().trim().min(3, 'Mínimo 3 caracteres').max(100),

    // Clasificación
    tipo_venta: z.string().trim().min(1, 'Selecciona un tipo de venta'),
    categoria_venta: optionalString,
    operador_cedente: optionalString,

    // Equipo
    imei_equipo: z
      .string()
      .trim()
      .regex(/^\d{15}$/, 'El IMEI debe tener 15 dígitos')
      .optional()
      .nullable()
      .or(z.literal('')),
    modelo_equipo: optionalString,
    iccid_chip: z
      .string()
      .trim()
      .regex(/^\d{19,20}$/, 'El ICCID debe tener 19-20 dígitos')
      .optional()
      .nullable()
      .or(z.literal('')),

    // Seguro y accesorios
    incluye_seguro: z.boolean().optional().default(false),
    incluye_accesorios: z.boolean().optional().default(false),
    descripcion_accesorios: optionalString,

    // Otros
    notas: z.string().trim().max(500).optional().nullable(),
  })
  // Formato del número de documento según el tipo (espejo del constraint de BD).
  .superRefine((v, ctx) => {
    if (!DOC_PATTERNS[v.tipo_documento_cliente].test(v.numero_documento_cliente)) {
      ctx.addIssue({
        code: 'custom',
        path: ['numero_documento_cliente'],
        message: 'Formato de documento inválido para el tipo seleccionado',
      })
    }
  })

export type VentaInsert = z.infer<typeof ventaInsertSchema>
