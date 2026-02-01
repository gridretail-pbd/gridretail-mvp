import { z } from 'zod'
import type { RolUsuario } from '@/types'

// Roles disponibles
export const ROLES = [
  'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
  'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
  'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
  'VALIDADOR_ARRIBOS', 'ADMIN'
] as const

export const ROLES_LABELS: Record<RolUsuario, string> = {
  ASESOR: 'Asesor de Venta',
  ASESOR_REFERENTE: 'Asesor Referente',
  COORDINADOR: 'Coordinador',
  SUPERVISOR: 'Supervisor',
  JEFE_VENTAS: 'Jefe de Ventas',
  GERENTE_COMERCIAL: 'Gerente Comercial',
  GERENTE_GENERAL: 'Gerente General',
  BACKOFFICE_OPERACIONES: 'Backoffice Operaciones',
  BACKOFFICE_RRHH: 'Backoffice RRHH',
  BACKOFFICE_AUDITORIA: 'Backoffice Auditoría',
  VALIDADOR_ARRIBOS: 'Validador de Arribos',
  ADMIN: 'Administrador',
}

export const ROL_COLORS: Record<RolUsuario, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  GERENTE_GENERAL: 'bg-purple-100 text-purple-800',
  GERENTE_COMERCIAL: 'bg-purple-100 text-purple-800',
  JEFE_VENTAS: 'bg-blue-100 text-blue-800',
  SUPERVISOR: 'bg-cyan-100 text-cyan-800',
  COORDINADOR: 'bg-teal-100 text-teal-800',
  ASESOR_REFERENTE: 'bg-green-100 text-green-800',
  ASESOR: 'bg-green-100 text-green-800',
  BACKOFFICE_OPERACIONES: 'bg-orange-100 text-orange-800',
  BACKOFFICE_RRHH: 'bg-orange-100 text-orange-800',
  BACKOFFICE_AUDITORIA: 'bg-orange-100 text-orange-800',
  VALIDADOR_ARRIBOS: 'bg-gray-100 text-gray-800',
}

export const ZONAS = [
  'NORTE', 'SUR', 'ESTE', 'OESTE', 'CENTRO', 'LIMA_NORTE', 'LIMA_SUR', 'CALLAO'
] as const

// Permisos por rol
export const ROLES_GESTION_USUARIOS: RolUsuario[] = [
  'ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_RRHH'
]

export const ROLES_PUEDEN_CREAR: RolUsuario[] = [
  'ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_RRHH'
]

export const ROLES_PUEDEN_ELIMINAR: RolUsuario[] = ['ADMIN']

// Schema para crear usuario
export const crearUsuarioSchema = z.object({
  codigo_asesor: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^PBD_[A-Z0-9_]+$/, 'Formato: PBD_XXXXX (mayúsculas)'),
  dni: z
    .string()
    .regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  nombre_completo: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  rol: z.enum(ROLES),
  zona: z
    .enum(ZONAS)
    .optional()
    .nullable(),
  activo: z.boolean().default(true),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/\d/, 'Debe incluir al menos un número'),
  confirm_password: z.string(),
  tiendas: z
    .array(z.object({
      tienda_id: z.string().uuid(),
      es_principal: z.boolean().default(false)
    }))
    .min(1, 'Debe asignar al menos una tienda'),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password']
})

export type CrearUsuarioFormData = z.infer<typeof crearUsuarioSchema>

// Schema para editar usuario (sin password)
export const editarUsuarioSchema = z.object({
  codigo_asesor: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^PBD_[A-Z0-9_]+$/, 'Formato: PBD_XXXXX (mayúsculas)'),
  dni: z
    .string()
    .regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  nombre_completo: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  rol: z.enum(ROLES),
  zona: z
    .enum(ZONAS)
    .optional()
    .nullable(),
  activo: z.boolean(),
  tiendas: z
    .array(z.object({
      tienda_id: z.string().uuid(),
      es_principal: z.boolean().default(false)
    }))
    .min(1, 'Debe asignar al menos una tienda'),
})

export type EditarUsuarioFormData = z.infer<typeof editarUsuarioSchema>

// Schema para reset password
export const resetPasswordSchema = z.object({
  new_password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/\d/, 'Debe incluir al menos un número'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password']
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
