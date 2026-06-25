import { z } from 'zod'

/**
 * Validación server-side para el INSERT de arribos (Vinculación Venta↔Arribo).
 *
 * Refleja el shape del payload que envía el formulario
 * (app/(dashboard)/dashboard/arribos/nuevo/page.tsx) y los CHECK constraints
 * de la tabla `arribos` (migración 029), para devolver un 400 limpio en lugar
 * de un error de constraint de Postgres.
 *
 * El desenlace de la visita es una **declaración** del asesor (`se_vendio`
 * SÍ/NO). El valor de la columna `resultado` se **deriva en el servidor** con
 * `derivarResultado()`; NO se acepta del cliente. La columna `se_vendio` ya no
 * existe en BD (migración 029) y por eso NO se persiste.
 */

// Tipos de documento aceptados en arribos (incluye OTRO, a diferencia de ventas).
// Espejo del constraint arribos_tipo_documento_cliente_check (migración 029).
export const TIPOS_DOC_ARRIBO = ['DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP', 'OTRO'] as const

export const MOTIVOS_NO_VENTA = [
  'SIN_STOCK',
  'PRECIO_ALTO',
  'NO_CALIFICA',
  'SOLO_CONSULTA',
  'DOCS_INCOMPLETOS',
  'PROBLEMA_SISTEMA',
  'OTRO',
] as const

// Patrones por tipo de documento (espejo de arribos_dni_cliente_format_check).
const DOC_PATTERNS: Record<(typeof TIPOS_DOC_ARRIBO)[number], RegExp> = {
  DNI: /^\d{8}$/,
  CE: /^\d{9}$/,
  RUC: /^(10|20)\d{9}$/,
  PASAPORTE: /^[A-Z0-9]{6,12}$/i,
  PTP: /^[A-Z0-9]{6,15}$/i,
  OTRO: /^.+$/, // cualquier string no vacío
}

export const arriboInsertSchema = z
  .object({
    // fecha y hora NO se aceptan del cliente: las fija el servidor en
    // zona horaria America/Lima para no depender del reloj del dispositivo.
    tienda_id: z.string().uuid('tienda_id inválido'),
    usuario_id: z.string().uuid('usuario_id inválido'),
    registrado_por: z.string().max(50).nullish(),
    tipo_documento_cliente: z.enum(TIPOS_DOC_ARRIBO).nullable(),
    dni_cliente: z.string().max(20).nullable(),
    nombre_cliente: z.string().max(200).nullable(),
    es_cliente_entel: z.boolean().nullable(),
    tipo_visita: z.enum(['VENTA', 'POSVENTA']),
    concreto_operacion: z.boolean(),
    // Declaración del asesor (solo aplica a VENTA). Se mapea a `resultado` en
    // el servidor; no se persiste tal cual (la columna se_vendio no existe).
    se_vendio: z.boolean().nullable(),
    motivo_no_venta: z.enum(MOTIVOS_NO_VENTA).nullable(),
  })
  // Formato del número de documento según el tipo (debe coincidir con el
  // CHECK constraint arribos_dni_cliente_format_check de la migración 029).
  .refine(
    (d) => {
      if (d.dni_cliente == null) return true
      // dni_cliente presente pero sin tipo de documento: inválido.
      if (d.tipo_documento_cliente == null) return false
      return DOC_PATTERNS[d.tipo_documento_cliente].test(d.dni_cliente)
    },
    {
      message: 'Número de documento inválido para el tipo seleccionado',
      path: ['dni_cliente'],
    }
  )
  // Si la visita es VENTA, se_vendio es obligatorio.
  .refine((d) => d.tipo_visita !== 'VENTA' || d.se_vendio !== null, {
    message: 'Indica si se realizó la venta',
    path: ['se_vendio'],
  })
  // POSVENTA no lleva se_vendio (no hay desenlace de venta).
  .refine((d) => !(d.tipo_visita === 'POSVENTA' && d.se_vendio != null), {
    message: 'POSVENTA no admite se_vendio',
    path: ['se_vendio'],
  })
  // motivo_no_venta solo válido si VENTA y se_vendio = false.
  .refine(
    (d) =>
      d.motivo_no_venta == null ||
      (d.tipo_visita === 'VENTA' && d.se_vendio === false),
    {
      message: 'motivo_no_venta solo aplica a VENTA no concretada',
      path: ['motivo_no_venta'],
    }
  )
  // Si no se vendió en una visita de VENTA, el motivo es obligatorio.
  .refine(
    (d) =>
      !(d.tipo_visita === 'VENTA' && d.se_vendio === false) ||
      d.motivo_no_venta != null,
    {
      message: 'Selecciona el motivo de no venta',
      path: ['motivo_no_venta'],
    }
  )

export type ArriboInsert = z.infer<typeof arriboInsertSchema>

/**
 * Mapeo declaración → `resultado`. Única fuente del valor inicial de la
 * columna `resultado` en un arribo recién creado.
 *
 * - POSVENTA            → null (nunca tiene resultado; constraint en BD)
 * - VENTA + se_vendio T → 'VENTA_DECLARADA_PENDIENTE' (declarada, sin venta enlazada aún)
 * - VENTA + se_vendio F → 'NO_VENDIO'
 * - VENTA sin declarar  → null (queda sin resultado hasta que el asesor decida)
 *
 * Cuando luego se registra una venta enlazada, el trigger
 * `recompute_arribo_resultado` (migración 029) actualiza el resultado
 * automáticamente (p. ej. a 'VENDIDO_CONFIRMADO').
 */
export function derivarResultado(
  tipo_visita: 'VENTA' | 'POSVENTA',
  se_vendio: boolean | null | undefined
): string | null {
  if (tipo_visita === 'POSVENTA') return null
  if (se_vendio === true) return 'VENTA_DECLARADA_PENDIENTE'
  if (se_vendio === false) return 'NO_VENDIO'
  return null
}
