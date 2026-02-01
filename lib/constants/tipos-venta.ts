// ============================================================================
// CONSTANTES DE VENTAS - GridRetail
// ============================================================================
// NOTA: Los tipos de venta se leen de la BD (tabla tipos_venta, vista v_tipos_venta_config)
// Este archivo solo contiene helpers y constantes que NO están en la BD
// ============================================================================

// Rangos horarios para registro de ventas
export const RANGOS_HORARIOS = [
  { codigo: '08', nombre: '08:00 - 08:59' },
  { codigo: '09', nombre: '09:00 - 09:59' },
  { codigo: '10', nombre: '10:00 - 10:59' },
  { codigo: '11', nombre: '11:00 - 11:59' },
  { codigo: '12', nombre: '12:00 - 12:59' },
  { codigo: '13', nombre: '13:00 - 13:59' },
  { codigo: '14', nombre: '14:00 - 14:59' },
  { codigo: '15', nombre: '15:00 - 15:59' },
  { codigo: '16', nombre: '16:00 - 16:59' },
  { codigo: '17', nombre: '17:00 - 17:59' },
  { codigo: '18', nombre: '18:00 - 18:59' },
  { codigo: '19', nombre: '19:00 - 19:59' },
  { codigo: '20', nombre: '20:00 - 20:59' },
  { codigo: '21', nombre: '21:00 - 21:59' },
] as const

// Tipos de documento de identidad
export const TIPOS_DOCUMENTO = [
  { codigo: 'DNI', nombre: 'DNI', patron: /^\d{8}$/, placeholder: '12345678', longitud: 8 },
  { codigo: 'CE', nombre: 'Carné Extranjería', patron: /^\d{9}$/, placeholder: '123456789', longitud: 9 },
  { codigo: 'RUC', nombre: 'RUC', patron: /^(10|20)\d{9}$/, placeholder: '10123456789', longitud: 11 },
  { codigo: 'PASAPORTE', nombre: 'Pasaporte', patron: /^[A-Z0-9]{6,12}$/i, placeholder: 'AB123456', longitud: 12 },
  { codigo: 'PTP', nombre: 'PTP', patron: /^[A-Z0-9]{6,15}$/i, placeholder: 'PTP123456', longitud: 15 },
] as const

export type TipoDocumentoCodigo = (typeof TIPOS_DOCUMENTO)[number]['codigo']

// ============================================================================
// PERMISOS POR ROL
// Los 12 roles están definidos en la BD (constraint en usuarios.rol)
// Estos arrays definen permisos especiales para funcionalidades del frontend
// ============================================================================

// Roles que pueden registrar ventas de fechas anteriores (>1 día)
export const ROLES_FECHA_LIBRE = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'JEFE_VENTAS',
  'BACKOFFICE_OPERACIONES',
] as const

// Roles que NO requieren tienda asignada
export const ROLES_SIN_TIENDA = [
  'ADMIN',
  'GERENTE_GENERAL',
  'GERENTE_COMERCIAL',
  'BACKOFFICE_OPERACIONES',
  'BACKOFFICE_RRHH',
  'BACKOFFICE_AUDITORIA',
  'VALIDADOR_ARRIBOS',
] as const

// ============================================================================
// HELPERS DE FECHA Y HORA
// ============================================================================

// Helper para obtener rango horario actual
export function getRangoHorarioActual(): string {
  const hora = new Date().getHours()
  if (hora < 8) return '08'
  if (hora > 21) return '21'
  return hora.toString().padStart(2, '0')
}

// Helper para obtener fecha de hoy en formato YYYY-MM-DD
export function getFechaHoy(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper para obtener fecha de ayer en formato YYYY-MM-DD
export function getFechaAyer(): string {
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  return ayer.toISOString().split('T')[0]
}

// ============================================================================
// VALIDACIONES
// ============================================================================

// Patrón de validación para orden de venta: 9 dígitos, empieza con 7 u 8
export const ORDEN_VENTA_PATTERN = /^[78]\d{8}$/
export const ORDEN_VENTA_MESSAGE = 'Debe ser 9 dígitos y empezar con 7 u 8'

// Helper para validar orden de venta
export function validarOrdenVenta(orden: string): boolean {
  return ORDEN_VENTA_PATTERN.test(orden.trim())
}

// Helper para validar documento según tipo
export function validarDocumento(tipo: string, numero: string): boolean {
  const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)
  if (!tipoDoc) return false
  return tipoDoc.patron.test(numero)
}
