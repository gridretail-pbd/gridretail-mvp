// lib/rrhh/schemas.ts
// Schemas Zod para validación de formularios del módulo RRHH

import { z } from 'zod'
import {
  USUARIO_STATUS, ETAPA_PIPELINE, FUENTE_CAPTACION, TIPO_CONTRATO,
  TIPO_MARCACION, TIPO_INCIDENCIA,
  TIPO_PERMISO, TIPO_MOVIMIENTO, TIPO_SALIDA,
  GENERO, ESTADO_CIVIL, AREA_FUNCIONAL,
  SISTEMA_PENSIONARIO, TIPO_DOCUMENTO_IDENTIDAD, NIVEL_EDUCATIVO, GRUPO_SANGUINEO,
  TIPO_ENTREVISTA_COLABORADOR, RESULTADO_ENTREVISTA
} from './types'

// ─── Helpers ───────────────────────────────────────────────────────────────
const dniSchema = z.string().length(8, 'DNI debe tener 8 dígitos').regex(/^\d{8}$/, 'DNI solo números')
const telefonoSchema = z.string().min(7, 'Teléfono muy corto').max(20, 'Teléfono muy largo')
const uuidOptional = z.string().uuid().optional().nullable()

// ─── Candidato ─────────────────────────────────────────────────────────────
export const candidatoCreateSchema = z.object({
  dni: dniSchema,
  nombre_completo: z.string().min(3, 'Nombre requerido').max(200),
  telefono: telefonoSchema,
  email: z.string().email('Email inválido').optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  genero: z.enum(GENERO).optional().nullable(),
  distrito_residencia: z.string().min(2).optional().nullable(),
  direccion: z.string().optional().nullable(),
  experiencia_telecom: z.boolean(),
  experiencia_detalle: z.string().optional().nullable(),
  disponibilidad_horario: z.string().optional().nullable(),
  disponibilidad_detalle: z.string().optional().nullable(),
  fuente_captacion: z.enum(FUENTE_CAPTACION),
  referido_por: uuidOptional,
  tienda_destino_id: uuidOptional,
  notas: z.string().optional().nullable(),
})
export type CandidatoCreateData = z.infer<typeof candidatoCreateSchema>

export const candidatoAvanzarEtapaSchema = z.object({
  candidato_id: z.string().uuid(),
  etapa_destino: z.enum(ETAPA_PIPELINE),
  notas: z.string().optional().nullable(),
})

export const candidatoDescartarSchema = z.object({
  candidato_id: z.string().uuid(),
  motivo: z.string().min(5, 'Motivo requerido (mínimo 5 caracteres)'),
})

// ─── Entrevista ────────────────────────────────────────────────────────────
export const entrevistaCreateSchema = z.object({
  candidato_id: z.string().uuid(),
  nivel: z.number().int().min(1).max(5),
  entrevistador_id: z.string().uuid(),
  fecha_programada: z.string().optional().nullable(),
})

export const entrevistaEvaluarSchema = z.object({
  entrevista_id: z.string().uuid(),
  scorecard: z.object({
    criterios: z.array(z.object({
      nombre: z.string(),
      puntaje: z.number().min(1).max(5),
      peso: z.number().min(0).max(100),
      observacion: z.string().optional(),
    })),
    observaciones_generales: z.string().optional(),
  }),
  observaciones: z.string().optional().nullable(),
  resultado: z.enum(['APROBADO', 'RECHAZADO']),
})

// ─── Contrato ──────────────────────────────────────────────────────────────
export const contratoCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo_contrato: z.enum(TIPO_CONTRATO),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional().nullable(),
  cargo: z.string().min(2, 'Cargo requerido'),
  remuneracion: z.number().positive('La remuneración debe ser positiva'),
  tienda_asignada_id: uuidOptional,
  contrato_anterior_id: uuidOptional,
  notas: z.string().optional().nullable(),
})
export type ContratoCreateData = z.infer<typeof contratoCreateSchema>

// ─── Renovación Decisión ───────────────────────────────────────────────────
export const renovacionVisadoJVSchema = z.object({
  decision_id: z.string().uuid(),
  decision: z.enum(['RENOVAR', 'NO_RENOVAR', 'PENDIENTE_EVALUAR']),
  motivo: z.string().optional().nullable(),
}).refine(
  (data) => data.decision === 'RENOVAR' || (data.motivo && data.motivo.length >= 5),
  { message: 'Motivo obligatorio si no renueva o deja pendiente', path: ['motivo'] }
)

export const renovacionVisadoKAMSchema = z.object({
  decision_id: z.string().uuid(),
  decision: z.enum(['CONFIRMAR', 'REVERTIR']),
  motivo: z.string().optional().nullable(),
}).refine(
  (data) => data.decision === 'CONFIRMAR' || (data.motivo && data.motivo.length >= 5),
  { message: 'Motivo obligatorio si revierte decisión del JV', path: ['motivo'] }
)

// ─── Asistencia ────────────────────────────────────────────────────────────
export const asistenciaMarcacionSchema = z.object({
  tienda_id: z.string().uuid(),
  tipo: z.enum(TIPO_MARCACION),
  hora_dispositivo: z.string(),
  foto_url: z.string().optional().nullable(),
  gps_lat: z.number().min(-90).max(90),
  gps_lng: z.number().min(-180).max(180),
  gps_accuracy: z.number().optional().nullable(),
  mock_location_detectado: z.boolean().optional(),
})

// ─── Incidencia ────────────────────────────────────────────────────────────
export const incidenciaCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo: z.enum(TIPO_INCIDENCIA),
  fecha: z.string(),
  descripcion: z.string().optional().nullable(),
  asistencia_id: uuidOptional,
})

export const incidenciaDescargoSchema = z.object({
  incidencia_id: z.string().uuid(),
  descargo: z.string().min(10, 'El descargo debe ser más detallado'),
})

// ─── Permiso ───────────────────────────────────────────────────────────────
export const permisoCreateSchema = z.object({
  tipo: z.enum(TIPO_PERMISO),
  fecha_inicio: z.string(),
  fecha_fin: z.string(),
  horas_solicitadas: z.number().optional().nullable(),
  motivo: z.string().min(5, 'Motivo requerido'),
}).refine(
  (data) => data.fecha_fin >= data.fecha_inicio,
  { message: 'La fecha fin debe ser posterior a la fecha inicio', path: ['fecha_fin'] }
)

export const permisoAprobarSchema = z.object({
  permiso_id: z.string().uuid(),
  aprobado: z.boolean(),
  motivo_rechazo: z.string().optional().nullable(),
}).refine(
  (data) => data.aprobado || (data.motivo_rechazo && data.motivo_rechazo.length >= 5),
  { message: 'Motivo requerido al rechazar', path: ['motivo_rechazo'] }
)

// ─── Usuarios RRHH ─────────────────────────────────────────────────────────
export const usuarioRRHHCreateSchema = z.object({
  // Identidad propia de la persona (migración 033). `usuario_id` se enlaza al
  // conceder acceso; queda null para personal solo-RRHH (sin login).
  usuario_id: uuidOptional,
  nombre_completo: z.string().min(3, 'Nombre requerido').max(200),
  dni: z.string().optional().nullable(),
  codigo_asesor: z.string().optional().nullable(),
  fecha_ingreso: z.string(),
  tipo_contrato_actual: z.enum(TIPO_CONTRATO).default('PLAZO_FIJO'),
  area_funcional: z.enum(AREA_FUNCIONAL).default('COMERCIAL'),
  cargo_formal: z.string().optional().nullable(),
  jefe_directo_id: uuidOptional,
  remuneracion_actual: z.number().positive().optional().nullable(),
  status: z.enum(USUARIO_STATUS).default('ACTIVO'),
  // Datos personales opcionales
  fecha_nacimiento: z.string().optional().nullable(),
  genero: z.enum(GENERO).optional().nullable(),
  estado_civil: z.enum(ESTADO_CIVIL).optional().nullable(),
  telefono_personal: z.string().optional().nullable(),
  direccion_domiciliaria: z.string().optional().nullable(),
  distrito_residencia: z.string().optional().nullable(),
  // Contacto emergencia
  contacto_emergencia_nombre: z.string().optional().nullable(),
  contacto_emergencia_telefono: z.string().optional().nullable(),
  contacto_emergencia_parentesco: z.string().optional().nullable(),
  // Bancarios
  banco: z.string().optional().nullable(),
  numero_cuenta: z.string().optional().nullable(),
  cci: z.string().optional().nullable(),
  // Operativo
  talla_uniforme: z.string().optional().nullable(),
  // Seguridad Social (migración 026)
  sistema_pensionario: z.enum(SISTEMA_PENSIONARIO).optional().nullable(),
  afp_nombre: z.string().max(50).optional().nullable(),
  cuspp: z.string().max(20).optional().nullable(),
  eps_nombre: z.string().max(50).optional().nullable(),
  tiene_sctr: z.boolean().optional(),
  asignacion_familiar: z.boolean().optional(),
  numero_dependientes: z.number().int().min(0).optional().nullable(),
  numero_hijos: z.number().int().min(0).optional().nullable(),
  // Identificación Adicional (migración 026)
  tipo_documento: z.enum(TIPO_DOCUMENTO_IDENTIDAD).optional().nullable(),
  lugar_nacimiento: z.string().max(100).optional().nullable(),
  nacionalidad: z.string().max(50).optional().nullable(),
  ruc: z.string().max(11).optional().nullable(),
  // Educación (migración 026)
  nivel_educativo: z.enum(NIVEL_EDUCATIVO).optional().nullable(),
  profesion_carrera: z.string().max(100).optional().nullable(),
  // Salud (migración 026)
  grupo_sanguineo: z.enum(GRUPO_SANGUINEO).optional().nullable(),
})
export type UsuarioRRHHCreateData = z.infer<typeof usuarioRRHHCreateSchema>

// ─── Movimiento de Personal ────────────────────────────────────────────────
export const movimientoCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo_movimiento: z.enum(TIPO_MOVIMIENTO),
  fecha_efectiva: z.string(),
  motivo: z.string().optional().nullable(),
  tienda_destino_id: uuidOptional,
  notas: z.string().optional().nullable(),
})

// ─── Offboarding ───────────────────────────────────────────────────────────
export const offboardingCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo_salida: z.enum(TIPO_SALIDA),
  notas: z.string().optional().nullable(),
})

// ─── Importación ──────────────────────────────────────────────────────────
export const importacionUploadSchema = z.object({
  archivo_nombre: z.string().min(1),
  archivo_url: z.string().min(1),
  archivo_tipo: z.enum(['xlsx', 'xls', 'csv']),
  archivo_tamano_bytes: z.number().max(10 * 1024 * 1024, 'Archivo demasiado grande (max 10MB)'),
})
export type ImportacionUploadData = z.infer<typeof importacionUploadSchema>

export const importacionMapeoConfirmSchema = z.object({
  importacion_id: z.string().uuid(),
  mapeos_confirmados: z.array(z.object({
    columna_origen: z.string(),
    campo_destino: z.string(),
    confirmado: z.boolean(),
  })),
})
export type ImportacionMapeoConfirmData = z.infer<typeof importacionMapeoConfirmSchema>

export const importacionEjecutarSchema = z.object({
  importacion_id: z.string().uuid(),
  filas_incluidas: z.array(z.number()).min(1, 'Debe incluir al menos una fila'),
  filas_excluidas: z.array(z.number()).optional(),
})
export type ImportacionEjecutarData = z.infer<typeof importacionEjecutarSchema>

// ─── Historial Bancario (migración 026) ─────────────────────────────────
export const historialBancarioCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  banco: z.string().min(2, 'Banco requerido').max(100),
  numero_cuenta: z.string().min(5, 'Cuenta requerida').max(50),
  cci: z.string().max(25).optional().nullable(),
  fecha_desde: z.string(),
  motivo_cambio: z.string().optional().nullable(),
})
export type HistorialBancarioCreateData = z.infer<typeof historialBancarioCreateSchema>

// ─── Historial Direcciones (migración 026) ──────────────────────────────
export const historialDireccionCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  direccion_domiciliaria: z.string().min(5, 'Dirección requerida'),
  distrito_residencia: z.string().max(100).optional().nullable(),
  gps_domicilio_lat: z.number().min(-90).max(90).optional().nullable(),
  gps_domicilio_lng: z.number().min(-180).max(180).optional().nullable(),
  fecha_desde: z.string(),
  motivo_cambio: z.string().optional().nullable(),
})
export type HistorialDireccionCreateData = z.infer<typeof historialDireccionCreateSchema>

// ─── Entrevista Colaborador (migración 026) ─────────────────────────────
export const entrevistaColaboradorCreateSchema = z.object({
  usuario_id: z.string().uuid(),
  tipo: z.enum(TIPO_ENTREVISTA_COLABORADOR),
  entrevistador_id: z.string().uuid(),
  fecha: z.string(),
  motivo: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  resultado: z.enum(RESULTADO_ENTREVISTA).optional().nullable(),
  movimiento_id: z.string().uuid().optional().nullable(),
  es_confidencial: z.boolean().default(false),
})
export type EntrevistaColaboradorCreateData = z.infer<typeof entrevistaColaboradorCreateSchema>
