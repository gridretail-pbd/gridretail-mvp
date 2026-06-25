// lib/rrhh/types.ts
// Enums y constantes para el módulo RRHH
// Coinciden 1:1 con los CHECK constraints de las migraciones 020-024

// ─── Status del Colaborador ────────────────────────────────────────────────
export const USUARIO_STATUS = [
  'CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA',
  'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'
] as const
export type UsuarioStatus = typeof USUARIO_STATUS[number]

export const USUARIO_STATUS_LABELS: Record<UsuarioStatus, string> = {
  CANDIDATO: 'Candidato',
  EN_INDUCCION: 'En Inducción',
  EN_SOMBRA: 'En Sombra',
  PERIODO_PRUEBA: 'Periodo de Prueba',
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  LICENCIA: 'Licencia',
  PRE_CESE: 'Pre-Cese',
  CESADO: 'Cesado',
}

export const USUARIO_STATUS_COLORS: Record<UsuarioStatus, string> = {
  CANDIDATO: 'bg-blue-100 text-blue-800',
  EN_INDUCCION: 'bg-cyan-100 text-cyan-800',
  EN_SOMBRA: 'bg-teal-100 text-teal-800',
  PERIODO_PRUEBA: 'bg-amber-100 text-amber-800',
  ACTIVO: 'bg-green-100 text-green-800',
  SUSPENDIDO: 'bg-red-100 text-red-800',
  LICENCIA: 'bg-purple-100 text-purple-800',
  PRE_CESE: 'bg-orange-100 text-orange-800',
  CESADO: 'bg-gray-100 text-gray-800',
}

// ─── Pipeline de Candidatos ────────────────────────────────────────────────
export const ETAPA_PIPELINE = [
  'CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL',
  'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA', 'ALTA', 'DESCARTADO'
] as const
export type EtapaPipeline = typeof ETAPA_PIPELINE[number]

export const FUENTE_CAPTACION = [
  'REFERIDO', 'PORTAL_EMPLEO', 'CONVOCATORIA', 'REINGRESO', 'BANCO_TALENTO'
] as const
export type FuenteCaptacion = typeof FUENTE_CAPTACION[number]

export const FUENTE_CAPTACION_LABELS: Record<FuenteCaptacion, string> = {
  REFERIDO: 'Referido',
  PORTAL_EMPLEO: 'Portal de Empleo',
  CONVOCATORIA: 'Convocatoria',
  REINGRESO: 'Reingreso',
  BANCO_TALENTO: 'Banco de Talento',
}

// ─── Contratos ─────────────────────────────────────────────────────────────
export const TIPO_CONTRATO = ['PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA'] as const
export type TipoContrato = typeof TIPO_CONTRATO[number]

export const TIPO_CONTRATO_LABELS: Record<TipoContrato, string> = {
  PLAZO_FIJO: 'Plazo Fijo',
  INDETERMINADO: 'Indeterminado',
  RXH: 'Recibo por Honorarios',
  PERIODO_PRUEBA: 'Periodo de Prueba',
}

export const ESTADO_CONTRATO = [
  'BORRADOR', 'ENVIADO', 'FIRMADO', 'VIGENTE', 'VENCIDO', 'CANCELADO', 'NO_RENOVADO'
] as const
export type EstadoContrato = typeof ESTADO_CONTRATO[number]

export const ESTADO_CONTRATO_LABELS: Record<EstadoContrato, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  FIRMADO: 'Firmado',
  VIGENTE: 'Vigente',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
  NO_RENOVADO: 'No Renovado',
}

export const ESTADO_CONTRATO_COLORS: Record<EstadoContrato, string> = {
  BORRADOR: 'bg-gray-100 text-gray-800',
  ENVIADO: 'bg-blue-100 text-blue-800',
  FIRMADO: 'bg-indigo-100 text-indigo-800',
  VIGENTE: 'bg-green-100 text-green-800',
  VENCIDO: 'bg-orange-100 text-orange-800',
  CANCELADO: 'bg-red-100 text-red-800',
  NO_RENOVADO: 'bg-red-100 text-red-800',
}

// ─── Renovación ────────────────────────────────────────────────────────────
export const ESTADO_LOTE = [
  'GENERADO', 'EN_VISADO_JV', 'EN_VISADO_KAM',
  'LISTO_PARA_RRHH', 'EJECUTADO', 'CANCELADO'
] as const
export type EstadoLote = typeof ESTADO_LOTE[number]

export const ESTADO_LOTE_LABELS: Record<EstadoLote, string> = {
  GENERADO: 'Generado',
  EN_VISADO_JV: 'En Visado JV',
  EN_VISADO_KAM: 'En Visado KAM',
  LISTO_PARA_RRHH: 'Listo para RRHH',
  EJECUTADO: 'Ejecutado',
  CANCELADO: 'Cancelado',
}

export const DECISION_JV = ['RENOVAR', 'NO_RENOVAR', 'PENDIENTE_EVALUAR'] as const
export type DecisionJV = typeof DECISION_JV[number]

export const DECISION_KAM = ['CONFIRMAR', 'REVERTIR'] as const
export type DecisionKAM = typeof DECISION_KAM[number]

export const DECISION_FINAL = ['RENOVAR', 'NO_RENOVAR'] as const
export type DecisionFinal = typeof DECISION_FINAL[number]

export const AI_RECOMENDACION = ['RENOVAR', 'NO_RENOVAR', 'EVALUAR'] as const
export type AIRecomendacion = typeof AI_RECOMENDACION[number]

// ─── Asistencia ────────────────────────────────────────────────────────────
export const TIPO_MARCACION = ['ENTRADA', 'SALIDA'] as const
export type TipoMarcacion = typeof TIPO_MARCACION[number]

export const ESTADO_ASISTENCIA = ['VALIDO', 'OBSERVADO', 'JUSTIFICADO', 'RECHAZADO', 'EDITADO'] as const
export type EstadoAsistencia = typeof ESTADO_ASISTENCIA[number]

export const ESTADO_ASISTENCIA_LABELS: Record<EstadoAsistencia, string> = {
  VALIDO: 'Válido',
  OBSERVADO: 'Observado',
  JUSTIFICADO: 'Justificado',
  RECHAZADO: 'Rechazado',
  EDITADO: 'Editado',
}

export const ESTADO_ASISTENCIA_COLORS: Record<EstadoAsistencia, string> = {
  VALIDO: 'bg-green-100 text-green-800',
  OBSERVADO: 'bg-yellow-100 text-yellow-800',
  JUSTIFICADO: 'bg-blue-100 text-blue-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  EDITADO: 'bg-purple-100 text-purple-800',
}

// ─── Incidencias ───────────────────────────────────────────────────────────
export const TIPO_INCIDENCIA = [
  'TARDANZA', 'FALTA_INJUSTIFICADA', 'FALTA_JUSTIFICADA',
  'ABANDONO_PUESTO', 'AMONESTACION_VERBAL', 'AMONESTACION_ESCRITA',
  'SUSPENSION', 'SALIDA_ANTICIPADA', 'OTRO'
] as const
export type TipoIncidencia = typeof TIPO_INCIDENCIA[number]

export const TIPO_INCIDENCIA_LABELS: Record<TipoIncidencia, string> = {
  TARDANZA: 'Tardanza',
  FALTA_INJUSTIFICADA: 'Falta Injustificada',
  FALTA_JUSTIFICADA: 'Falta Justificada',
  ABANDONO_PUESTO: 'Abandono de Puesto',
  AMONESTACION_VERBAL: 'Amonestación Verbal',
  AMONESTACION_ESCRITA: 'Amonestación Escrita',
  SUSPENSION: 'Suspensión',
  SALIDA_ANTICIPADA: 'Salida Anticipada',
  OTRO: 'Otro',
}

export const TIPO_INCIDENCIA_COLORS: Record<TipoIncidencia, string> = {
  TARDANZA: 'bg-yellow-100 text-yellow-800',
  FALTA_INJUSTIFICADA: 'bg-red-100 text-red-800',
  FALTA_JUSTIFICADA: 'bg-blue-100 text-blue-800',
  ABANDONO_PUESTO: 'bg-red-200 text-red-900',
  AMONESTACION_VERBAL: 'bg-orange-100 text-orange-800',
  AMONESTACION_ESCRITA: 'bg-orange-200 text-orange-900',
  SUSPENSION: 'bg-red-100 text-red-800',
  SALIDA_ANTICIPADA: 'bg-amber-100 text-amber-800',
  OTRO: 'bg-gray-100 text-gray-800',
}

export const ESTADO_INCIDENCIA = [
  'REGISTRADA', 'NOTIFICADA', 'EN_DESCARGO', 'RESUELTA', 'ESCALADA', 'ANULADA'
] as const
export type EstadoIncidencia = typeof ESTADO_INCIDENCIA[number]

export const ESTADO_INCIDENCIA_LABELS: Record<EstadoIncidencia, string> = {
  REGISTRADA: 'Registrada',
  NOTIFICADA: 'Notificada',
  EN_DESCARGO: 'En Descargo',
  RESUELTA: 'Resuelta',
  ESCALADA: 'Escalada',
  ANULADA: 'Anulada',
}

export const ESTADO_INCIDENCIA_COLORS: Record<EstadoIncidencia, string> = {
  REGISTRADA: 'bg-gray-100 text-gray-800',
  NOTIFICADA: 'bg-blue-100 text-blue-800',
  EN_DESCARGO: 'bg-yellow-100 text-yellow-800',
  RESUELTA: 'bg-green-100 text-green-800',
  ESCALADA: 'bg-red-100 text-red-800',
  ANULADA: 'bg-gray-200 text-gray-600',
}

// ─── Permisos ──────────────────────────────────────────────────────────────
export const TIPO_PERMISO = [
  'PERMISO_HORAS', 'PERMISO_DIA', 'VACACIONES',
  'LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD',
  'LICENCIA_FALLECIMIENTO', 'OTRO'
] as const
export type TipoPermiso = typeof TIPO_PERMISO[number]

export const TIPO_PERMISO_LABELS: Record<TipoPermiso, string> = {
  PERMISO_HORAS: 'Permiso por Horas',
  PERMISO_DIA: 'Permiso Día Completo',
  VACACIONES: 'Vacaciones',
  LICENCIA_MEDICA: 'Licencia Médica',
  LICENCIA_MATERNIDAD: 'Licencia Maternidad',
  LICENCIA_PATERNIDAD: 'Licencia Paternidad',
  LICENCIA_FALLECIMIENTO: 'Licencia por Fallecimiento',
  OTRO: 'Otro',
}

export const TIPO_PERMISO_COLORS: Record<TipoPermiso, string> = {
  PERMISO_HORAS: 'bg-blue-100 text-blue-800',
  PERMISO_DIA: 'bg-indigo-100 text-indigo-800',
  VACACIONES: 'bg-green-100 text-green-800',
  LICENCIA_MEDICA: 'bg-red-100 text-red-800',
  LICENCIA_MATERNIDAD: 'bg-pink-100 text-pink-800',
  LICENCIA_PATERNIDAD: 'bg-cyan-100 text-cyan-800',
  LICENCIA_FALLECIMIENTO: 'bg-gray-200 text-gray-800',
  OTRO: 'bg-gray-100 text-gray-800',
}

export const ESTADO_PERMISO = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO'] as const
export type EstadoPermiso = typeof ESTADO_PERMISO[number]

export const ESTADO_PERMISO_LABELS: Record<EstadoPermiso, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
}

export const ESTADO_PERMISO_COLORS: Record<EstadoPermiso, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  APROBADO: 'bg-green-100 text-green-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-800',
}

// ─── Horarios ─────────────────────────────────────────────────────────────
export const DIA_SEMANA_LABELS: Record<number, string> = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo',
}

export const DIA_SEMANA_SHORT: Record<number, string> = {
  0: 'Lun',
  1: 'Mar',
  2: 'Mié',
  3: 'Jue',
  4: 'Vie',
  5: 'Sáb',
  6: 'Dom',
}

// ─── Movimientos ───────────────────────────────────────────────────────────
export const TIPO_MOVIMIENTO = [
  'INGRESO', 'TRANSFERENCIA', 'CAMBIO_ROL', 'CAMBIO_ZONA',
  'PROMOCION', 'CAMBIO_REMUNERACION',
  'CESE_VOLUNTARIO', 'CESE_DESPIDO', 'CESE_NO_RENOVACION',
  'CESE_ABANDONO', 'CESE_PERIODO_PRUEBA', 'REINGRESO'
] as const
export type TipoMovimiento = typeof TIPO_MOVIMIENTO[number]

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso',
  TRANSFERENCIA: 'Transferencia',
  CAMBIO_ROL: 'Cambio de Rol',
  CAMBIO_ZONA: 'Cambio de Zona',
  PROMOCION: 'Promoción',
  CAMBIO_REMUNERACION: 'Cambio de Remuneración',
  CESE_VOLUNTARIO: 'Cese Voluntario',
  CESE_DESPIDO: 'Cese por Despido',
  CESE_NO_RENOVACION: 'Cese por No Renovación',
  CESE_ABANDONO: 'Cese por Abandono',
  CESE_PERIODO_PRUEBA: 'Cese Periodo de Prueba',
  REINGRESO: 'Reingreso',
}

export const TIPO_MOVIMIENTO_COLORS: Record<TipoMovimiento, string> = {
  INGRESO: 'bg-green-100 text-green-800',
  TRANSFERENCIA: 'bg-blue-100 text-blue-800',
  CAMBIO_ROL: 'bg-indigo-100 text-indigo-800',
  CAMBIO_ZONA: 'bg-cyan-100 text-cyan-800',
  PROMOCION: 'bg-emerald-100 text-emerald-800',
  CAMBIO_REMUNERACION: 'bg-teal-100 text-teal-800',
  CESE_VOLUNTARIO: 'bg-orange-100 text-orange-800',
  CESE_DESPIDO: 'bg-red-100 text-red-800',
  CESE_NO_RENOVACION: 'bg-red-100 text-red-800',
  CESE_ABANDONO: 'bg-red-200 text-red-900',
  CESE_PERIODO_PRUEBA: 'bg-amber-100 text-amber-800',
  REINGRESO: 'bg-purple-100 text-purple-800',
}

// ─── Offboarding ───────────────────────────────────────────────────────────
export const TIPO_SALIDA = [
  'RENUNCIA', 'NO_RENOVACION', 'DESPIDO',
  'ABANDONO', 'PERIODO_PRUEBA', 'MUTUO_ACUERDO'
] as const
export type TipoSalida = typeof TIPO_SALIDA[number]

export const TIPO_SALIDA_LABELS: Record<TipoSalida, string> = {
  RENUNCIA: 'Renuncia',
  NO_RENOVACION: 'No Renovación',
  DESPIDO: 'Despido',
  ABANDONO: 'Abandono',
  PERIODO_PRUEBA: 'Periodo de Prueba',
  MUTUO_ACUERDO: 'Mutuo Acuerdo',
}

export const TIPO_SALIDA_COLORS: Record<TipoSalida, string> = {
  RENUNCIA: 'bg-orange-100 text-orange-800',
  NO_RENOVACION: 'bg-red-100 text-red-800',
  DESPIDO: 'bg-red-200 text-red-900',
  ABANDONO: 'bg-red-100 text-red-800',
  PERIODO_PRUEBA: 'bg-amber-100 text-amber-800',
  MUTUO_ACUERDO: 'bg-gray-100 text-gray-800',
}

export const ESTADO_OFFBOARDING = ['EN_PROCESO', 'COMPLETADO', 'CANCELADO'] as const
export type EstadoOffboarding = typeof ESTADO_OFFBOARDING[number]

export const ESTADO_OFFBOARDING_LABELS: Record<EstadoOffboarding, string> = {
  EN_PROCESO: 'En Proceso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

export const ESTADO_OFFBOARDING_COLORS: Record<EstadoOffboarding, string> = {
  EN_PROCESO: 'bg-yellow-100 text-yellow-800',
  COMPLETADO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-gray-100 text-gray-800',
}

// ─── Documentos ────────────────────────────────────────────────────────────
export const TIPO_DOCUMENTO_CANDIDATO = [
  'CV', 'FOTO', 'DNI', 'CERTIFICADO', 'ANTECEDENTES', 'OTRO'
] as const
export type TipoDocumentoCandidato = typeof TIPO_DOCUMENTO_CANDIDATO[number]

export const TIPO_DOCUMENTO_COLABORADOR = [
  'CV', 'FOTO', 'DNI', 'CONTRATO', 'AMONESTACION',
  'CERTIFICADO', 'CARTA_NOTARIAL', 'LIQUIDACION',
  'EVALUACION', 'ENTREVISTA_GRABACION', 'ENTREVISTA_TRANSCRIPCION',
  'LICENCIA_MEDICA', 'OTRO'
] as const
export type TipoDocumentoColaborador = typeof TIPO_DOCUMENTO_COLABORADOR[number]

// ─── Alertas ───────────────────────────────────────────────────────────────
export const TIPO_ALERTA = [
  'CONTRATO_POR_VENCER', 'VISADO_PENDIENTE', 'PERIODO_PRUEBA_VENCER',
  'CANDIDATO_ESTANCADO', 'AUSENCIA_SIN_JUSTIFICAR', 'ABANDONO_POTENCIAL',
  'RIESGO_FUGA', 'INCIDENCIA_REINCIDENTE', 'COBERTURA_BAJA',
  'CUMPLEANOS', 'TURNO_SIN_ASIGNAR', 'PERMISO_PENDIENTE',
  'OFFBOARDING_PENDIENTE', 'GENERAL',
  'IMPORTACION_COMPLETADA', 'DATOS_INCOMPLETOS', 'ASIGNACION_PENDIENTE',
  'DUPLICADO_DETECTADO', 'REFERENCIA_PENDIENTE'
] as const
export type TipoAlerta = typeof TIPO_ALERTA[number]

export const NIVEL_ALERTA = ['INFO', 'WARNING', 'CRITICAL'] as const
export type NivelAlerta = typeof NIVEL_ALERTA[number]

export const NIVEL_ALERTA_COLORS: Record<NivelAlerta, string> = {
  INFO: 'bg-blue-100 text-blue-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

export const TIPO_ALERTA_LABELS: Record<TipoAlerta, string> = {
  CONTRATO_POR_VENCER: 'Contrato por Vencer',
  VISADO_PENDIENTE: 'Visado Pendiente',
  PERIODO_PRUEBA_VENCER: 'Periodo Prueba por Vencer',
  CANDIDATO_ESTANCADO: 'Candidato Estancado',
  AUSENCIA_SIN_JUSTIFICAR: 'Ausencia sin Justificar',
  ABANDONO_POTENCIAL: 'Abandono Potencial',
  RIESGO_FUGA: 'Riesgo de Fuga',
  INCIDENCIA_REINCIDENTE: 'Incidencia Reincidente',
  COBERTURA_BAJA: 'Cobertura Baja',
  CUMPLEANOS: 'Cumpleaños',
  TURNO_SIN_ASIGNAR: 'Turno sin Asignar',
  PERMISO_PENDIENTE: 'Permiso Pendiente',
  OFFBOARDING_PENDIENTE: 'Offboarding Pendiente',
  GENERAL: 'General',
  IMPORTACION_COMPLETADA: 'Importación Completada',
  DATOS_INCOMPLETOS: 'Datos Incompletos',
  ASIGNACION_PENDIENTE: 'Asignación Pendiente',
  DUPLICADO_DETECTADO: 'Duplicado Detectado',
  REFERENCIA_PENDIENTE: 'Referencia Pendiente',
}

export const ESTADO_ALERTA = ['PENDIENTE', 'LEIDA', 'ACCIONADA', 'DESCARTADA'] as const
export type EstadoAlerta = typeof ESTADO_ALERTA[number]

export const ESTADO_ALERTA_LABELS: Record<EstadoAlerta, string> = {
  PENDIENTE: 'Pendiente',
  LEIDA: 'Leída',
  ACCIONADA: 'Accionada',
  DESCARTADA: 'Descartada',
}

export const ESTADO_ALERTA_COLORS: Record<EstadoAlerta, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  LEIDA: 'bg-blue-100 text-blue-800',
  ACCIONADA: 'bg-green-100 text-green-800',
  DESCARTADA: 'bg-gray-100 text-gray-800',
}

// ─── AI Tasks ──────────────────────────────────────────────────────────────
export const TIPO_AI_TASK = [
  'CV_PARSING', 'ENTREVISTA_TRANSCRIPCION', 'ENTREVISTA_ANALISIS',
  'CONTRATO_GENERACION', 'RENOVACION_RESUMEN', 'SCORING_CANDIDATO',
  'RIESGO_FUGA', 'CHATBOT_QUERY', 'DOCUMENTO_OCR', 'EMAIL_DRAFT',
  'ANOMALIA_DETECCION', 'INDUCCION_PLAN', 'OFFBOARDING_CHECKLIST',
  'MAPEO_COLUMNAS_IMPORT',
  'IMPORTACION_MAPEO', 'IMPORTACION_NORMALIZACION', 'IMPORTACION_BRECHAS',
] as const
export type TipoAITask = typeof TIPO_AI_TASK[number]

export const ESTADO_AI_TASK = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
export type EstadoAITask = typeof ESTADO_AI_TASK[number]

// ─── Áreas funcionales ────────────────────────────────────────────────────
export const AREA_FUNCIONAL = [
  'COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION'
] as const
export type AreaFuncional = typeof AREA_FUNCIONAL[number]

export const AREA_FUNCIONAL_LABELS: Record<AreaFuncional, string> = {
  COMERCIAL: 'Comercial',
  OPERACIONES: 'Operaciones',
  RRHH: 'Recursos Humanos',
  MANTENIMIENTO: 'Mantenimiento',
  ADMINISTRACION: 'Administración',
}

export const GENERO = ['MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'] as const
export type Genero = typeof GENERO[number]

export const GENERO_LABELS: Record<Genero, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  NO_ESPECIFICA: 'No Especifica',
}

export const ESTADO_CIVIL = ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'] as const
export type EstadoCivil = typeof ESTADO_CIVIL[number]

export const ESTADO_CIVIL_LABELS: Record<EstadoCivil, string> = {
  SOLTERO: 'Soltero/a',
  CASADO: 'Casado/a',
  CONVIVIENTE: 'Conviviente',
  DIVORCIADO: 'Divorciado/a',
  VIUDO: 'Viudo/a',
}

// ─── Importación ──────────────────────────────────────────────────────────
export const ESTADO_IMPORTACION = [
  'EN_PROCESO', 'ANALIZADO', 'MAPEADO', 'VALIDADO', 'IMPORTADO', 'ERROR', 'CANCELADO'
] as const
export type EstadoImportacion = typeof ESTADO_IMPORTACION[number]

export const ESTADO_IMPORTACION_LABELS: Record<EstadoImportacion, string> = {
  EN_PROCESO: 'En Proceso',
  ANALIZADO: 'Analizado',
  MAPEADO: 'Mapeado',
  VALIDADO: 'Validado',
  IMPORTADO: 'Importado',
  ERROR: 'Error',
  CANCELADO: 'Cancelado',
}

export const ESTADO_IMPORTACION_COLORS: Record<EstadoImportacion, string> = {
  EN_PROCESO: 'bg-blue-100 text-blue-800',
  ANALIZADO: 'bg-cyan-100 text-cyan-800',
  MAPEADO: 'bg-indigo-100 text-indigo-800',
  VALIDADO: 'bg-purple-100 text-purple-800',
  IMPORTADO: 'bg-green-100 text-green-800',
  ERROR: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-800',
}

export const NIVEL_COMPLETITUD = [
  'COMPLETO', 'PARCIAL', 'MINIMO', 'INSUFICIENTE'
] as const
export type NivelCompletitud = typeof NIVEL_COMPLETITUD[number]

export const NIVEL_COMPLETITUD_LABELS: Record<NivelCompletitud, string> = {
  COMPLETO: 'Completo',
  PARCIAL: 'Parcial',
  MINIMO: 'Mínimo',
  INSUFICIENTE: 'Insuficiente',
}

export const NIVEL_COMPLETITUD_COLORS: Record<NivelCompletitud, string> = {
  COMPLETO: 'bg-green-100 text-green-800',
  PARCIAL: 'bg-yellow-100 text-yellow-800',
  MINIMO: 'bg-orange-100 text-orange-800',
  INSUFICIENTE: 'bg-red-100 text-red-800',
}

export const MOTIVO_CESE = [
  'CESE_VOLUNTARIO', 'CESE_DESPIDO', 'CESE_NO_RENOVACION',
  'CESE_ABANDONO', 'CESE_PERIODO_PRUEBA'
] as const
export type MotivoCese = typeof MOTIVO_CESE[number]

export const MOTIVO_CESE_LABELS: Record<MotivoCese, string> = {
  CESE_VOLUNTARIO: 'Renuncia voluntaria',
  CESE_DESPIDO: 'Despido',
  CESE_NO_RENOVACION: 'No renovación',
  CESE_ABANDONO: 'Abandono de puesto',
  CESE_PERIODO_PRUEBA: 'No superó periodo de prueba',
}

// ─── Verificación Identidad ──────────────────────────────────────────────

export const ESTADO_VERIFICACION_IDENTIDAD = [
  'VERIFICADO', 'NOMBRE_NO_COINCIDE', 'NOMBRE_REVISAR',
  'NO_ENCONTRADO', 'ERROR_API', 'SIN_DOCUMENTO'
] as const
export type EstadoVerificacionIdentidad = typeof ESTADO_VERIFICACION_IDENTIDAD[number]

export const ESTADO_VERIFICACION_IDENTIDAD_LABELS: Record<EstadoVerificacionIdentidad, string> = {
  VERIFICADO: 'Verificado',
  NOMBRE_NO_COINCIDE: 'Nombre no coincide',
  NOMBRE_REVISAR: 'Revisar coincidencia',
  NO_ENCONTRADO: 'No encontrado',
  ERROR_API: 'Error de verificación',
  SIN_DOCUMENTO: 'Sin documento',
}

export const ESTADO_VERIFICACION_IDENTIDAD_COLORS: Record<EstadoVerificacionIdentidad, string> = {
  VERIFICADO: 'bg-green-100 text-green-800',
  NOMBRE_NO_COINCIDE: 'bg-red-100 text-red-800',
  NOMBRE_REVISAR: 'bg-yellow-100 text-yellow-800',
  NO_ENCONTRADO: 'bg-red-100 text-red-800',
  ERROR_API: 'bg-gray-100 text-gray-800',
  SIN_DOCUMENTO: 'bg-gray-50 text-gray-400',
}

// ─── Seguridad Social ────────────────────────────────────────────────────

export const SISTEMA_PENSIONARIO = ['AFP', 'ONP'] as const
export type SistemaPensionario = typeof SISTEMA_PENSIONARIO[number]

export const SISTEMA_PENSIONARIO_LABELS: Record<SistemaPensionario, string> = {
  AFP: 'AFP (Privado)',
  ONP: 'ONP (Público)',
}

// ─── Identificación ─────────────────────────────────────────────────────

export const TIPO_DOCUMENTO_IDENTIDAD = ['DNI', 'CE', 'PASAPORTE', 'PTP'] as const
export type TipoDocumentoIdentidad = typeof TIPO_DOCUMENTO_IDENTIDAD[number]

export const TIPO_DOCUMENTO_IDENTIDAD_LABELS: Record<TipoDocumentoIdentidad, string> = {
  DNI: 'DNI',
  CE: 'Carnet de Extranjería',
  PASAPORTE: 'Pasaporte',
  PTP: 'Permiso Temporal de Permanencia',
}

// ─── Educación ──────────────────────────────────────────────────────────

export const NIVEL_EDUCATIVO = [
  'SECUNDARIA_INCOMPLETA', 'SECUNDARIA', 'TECNICO_INCOMPLETO', 'TECNICO',
  'UNIVERSITARIO_INCOMPLETO', 'UNIVERSITARIO', 'POSTGRADO'
] as const
export type NivelEducativo = typeof NIVEL_EDUCATIVO[number]

export const NIVEL_EDUCATIVO_LABELS: Record<NivelEducativo, string> = {
  SECUNDARIA_INCOMPLETA: 'Secundaria Incompleta',
  SECUNDARIA: 'Secundaria Completa',
  TECNICO_INCOMPLETO: 'Técnico Incompleto',
  TECNICO: 'Técnico Completo',
  UNIVERSITARIO_INCOMPLETO: 'Universitario Incompleto',
  UNIVERSITARIO: 'Universitario Completo',
  POSTGRADO: 'Postgrado',
}

// ─── Salud ──────────────────────────────────────────────────────────────

export const GRUPO_SANGUINEO = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
export type GrupoSanguineo = typeof GRUPO_SANGUINEO[number]

// ─── Historial ──────────────────────────────────────────────────────────

export const CAMPO_HISTORIAL = [
  'TELEFONO_PERSONAL', 'REMUNERACION', 'JEFE_DIRECTO', 'CARGO_FORMAL'
] as const
export type CampoHistorial = typeof CAMPO_HISTORIAL[number]

export const CAMPO_HISTORIAL_LABELS: Record<CampoHistorial, string> = {
  TELEFONO_PERSONAL: 'Teléfono personal',
  REMUNERACION: 'Remuneración',
  JEFE_DIRECTO: 'Jefe directo',
  CARGO_FORMAL: 'Cargo formal',
}

// ─── Entrevistas Colaborador ────────────────────────────────────────────

export const TIPO_ENTREVISTA_COLABORADOR = [
  'EXIT_INTERVIEW', 'FEEDBACK_DESEMPENO', 'RETENCION', 'AMONESTACION_VERBAL'
] as const
export type TipoEntrevistaColaborador = typeof TIPO_ENTREVISTA_COLABORADOR[number]

export const TIPO_ENTREVISTA_COLABORADOR_LABELS: Record<TipoEntrevistaColaborador, string> = {
  EXIT_INTERVIEW: 'Entrevista de salida',
  FEEDBACK_DESEMPENO: 'Feedback de desempeño',
  RETENCION: 'Entrevista de retención',
  AMONESTACION_VERBAL: 'Amonestación verbal',
}

export const RESULTADO_ENTREVISTA = ['SATISFACTORIA', 'CON_OBSERVACIONES', 'NO_REALIZADA'] as const
export type ResultadoEntrevista = typeof RESULTADO_ENTREVISTA[number]

export const RESULTADO_ENTREVISTA_LABELS: Record<ResultadoEntrevista, string> = {
  SATISFACTORIA: 'Satisfactoria',
  CON_OBSERVACIONES: 'Con Observaciones',
  NO_REALIZADA: 'No Realizada',
}

// ─── Campos Destino para Importación ────────────────────────────────────

export interface CampoDestino {
  campo: string        // formato: "tabla.columna"
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'booleano' | 'email' | 'enum' | 'referencia'
  requerido: boolean
  tabla: 'usuarios' | 'usuarios_rrhh' | 'usuarios_tiendas' | 'contratos' | 'cesado'
  enumValores?: string[]
}

export const CAMPOS_DESTINO: CampoDestino[] = [
  // --- usuarios (7) ---
  { campo: 'usuarios.codigo_asesor', label: 'Código Asesor', tipo: 'texto', requerido: false, tabla: 'usuarios' },
  { campo: 'usuarios.dni', label: 'DNI', tipo: 'texto', requerido: true, tabla: 'usuarios' },
  { campo: 'usuarios.nombre_completo', label: 'Nombre Completo', tipo: 'texto', requerido: true, tabla: 'usuarios' },
  { campo: 'usuarios.email', label: 'Email', tipo: 'email', requerido: false, tabla: 'usuarios' },
  { campo: 'usuarios.rol', label: 'Rol / Cargo', tipo: 'enum', requerido: true, tabla: 'usuarios', enumValores: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA', 'VALIDADOR_ARRIBOS', 'ADMIN'] },
  { campo: 'usuarios.zona', label: 'Zona', tipo: 'texto', requerido: false, tabla: 'usuarios' },
  { campo: 'usuarios.activo', label: 'Activo', tipo: 'booleano', requerido: false, tabla: 'usuarios' },
  // --- usuarios_rrhh (24) ---
  { campo: 'usuarios_rrhh.fecha_nacimiento', label: 'Fecha Nacimiento', tipo: 'fecha', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.genero', label: 'Género', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'] },
  { campo: 'usuarios_rrhh.estado_civil', label: 'Estado Civil', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'] },
  { campo: 'usuarios_rrhh.telefono_personal', label: 'Teléfono Personal', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.direccion_domiciliaria', label: 'Dirección Domiciliaria', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.distrito_residencia', label: 'Distrito Residencia', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.contacto_emergencia_nombre', label: 'Contacto Emergencia Nombre', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.contacto_emergencia_telefono', label: 'Contacto Emergencia Teléfono', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.contacto_emergencia_parentesco', label: 'Contacto Emergencia Parentesco', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.banco', label: 'Banco', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.numero_cuenta', label: 'Número de Cuenta', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.cci', label: 'CCI', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.fecha_ingreso', label: 'Fecha Ingreso', tipo: 'fecha', requerido: true, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.fecha_fin_contrato', label: 'Fecha Fin Contrato', tipo: 'fecha', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.tipo_contrato_actual', label: 'Tipo Contrato', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA'] },
  { campo: 'usuarios_rrhh.regimen_laboral', label: 'Régimen Laboral', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.cargo_formal', label: 'Cargo Formal', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.area_funcional', label: 'Área Funcional', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION'] },
  { campo: 'usuarios_rrhh.jefe_directo_id', label: 'Jefe Directo', tipo: 'referencia', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.remuneracion_actual', label: 'Remuneración', tipo: 'numero', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.talla_uniforme', label: 'Talla Uniforme', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.tiene_equipo_corporativo', label: 'Tiene Equipo Corporativo', tipo: 'booleano', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.equipo_corporativo_detalle', label: 'Detalle Equipo Corporativo', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.status', label: 'Status Colaborador', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh' },
  // --- usuarios_rrhh: Seguridad Social (8) ---
  { campo: 'usuarios_rrhh.sistema_pensionario', label: 'Sistema Pensionario', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['AFP', 'ONP'] },
  { campo: 'usuarios_rrhh.afp_nombre', label: 'Nombre AFP', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.cuspp', label: 'CUSPP', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.eps_nombre', label: 'EPS', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.tiene_sctr', label: 'Tiene SCTR', tipo: 'booleano', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.asignacion_familiar', label: 'Asignación Familiar', tipo: 'booleano', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.numero_dependientes', label: 'Número de Dependientes', tipo: 'numero', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.numero_hijos', label: 'Número de Hijos', tipo: 'numero', requerido: false, tabla: 'usuarios_rrhh' },
  // --- usuarios_rrhh: Identificación (4) ---
  { campo: 'usuarios_rrhh.tipo_documento', label: 'Tipo de Documento', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['DNI', 'CE', 'PASAPORTE', 'PTP'] },
  { campo: 'usuarios_rrhh.lugar_nacimiento', label: 'Lugar de Nacimiento', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.nacionalidad', label: 'Nacionalidad', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  { campo: 'usuarios_rrhh.ruc', label: 'RUC', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  // --- usuarios_rrhh: Educación (2) ---
  { campo: 'usuarios_rrhh.nivel_educativo', label: 'Nivel Educativo', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['SECUNDARIA_INCOMPLETA', 'SECUNDARIA', 'TECNICO_INCOMPLETO', 'TECNICO', 'UNIVERSITARIO_INCOMPLETO', 'UNIVERSITARIO', 'POSTGRADO'] },
  { campo: 'usuarios_rrhh.profesion_carrera', label: 'Profesión/Carrera', tipo: 'texto', requerido: false, tabla: 'usuarios_rrhh' },
  // --- usuarios_rrhh: Salud (1) ---
  { campo: 'usuarios_rrhh.grupo_sanguineo', label: 'Grupo Sanguíneo', tipo: 'enum', requerido: false, tabla: 'usuarios_rrhh', enumValores: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  // --- usuarios_tiendas (1 ref) ---
  { campo: 'usuarios_tiendas.tienda', label: 'Tienda', tipo: 'referencia', requerido: false, tabla: 'usuarios_tiendas' },
  // --- contratos (5) ---
  { campo: 'contratos.tipo_contrato', label: 'Tipo Contrato (contrato)', tipo: 'enum', requerido: false, tabla: 'contratos', enumValores: ['PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA'] },
  { campo: 'contratos.fecha_inicio_contrato', label: 'Fecha Inicio Contrato', tipo: 'fecha', requerido: false, tabla: 'contratos' },
  { campo: 'contratos.fecha_fin_contrato', label: 'Fecha Fin Contrato (contrato)', tipo: 'fecha', requerido: false, tabla: 'contratos' },
  { campo: 'contratos.cargo_contrato', label: 'Cargo Contrato', tipo: 'texto', requerido: false, tabla: 'contratos' },
  { campo: 'contratos.remuneracion_contrato', label: 'Remuneración Contrato', tipo: 'numero', requerido: false, tabla: 'contratos' },
  // --- cesados (2) ---
  { campo: 'cesado.fecha_cese', label: 'Fecha Cese', tipo: 'fecha', requerido: false, tabla: 'cesado' },
  { campo: 'cesado.motivo_cese', label: 'Motivo Cese', tipo: 'enum', requerido: false, tabla: 'cesado', enumValores: ['CESE_VOLUNTARIO', 'CESE_DESPIDO', 'CESE_NO_RENOVACION', 'CESE_ABANDONO', 'CESE_PERIODO_PRUEBA'] },
]

/** Aliases comunes para mapeo heurístico de columnas Excel → campos destino */
export const FIELD_ALIASES: Record<string, string[]> = {
  'usuarios.codigo_asesor': ['codigo', 'codigo_asesor', 'cod_asesor', 'code', 'codigo asesor', 'cod', 'codigo empleado', 'id empleado'],
  'usuarios.dni': ['dni', 'documento', 'num_documento', 'nro_documento', 'numero documento', 'doc identidad', 'num doc', 'documento identidad', 'nro doc'],
  'usuarios.nombre_completo': ['nombre', 'nombre_completo', 'nombres', 'nombre completo', 'apellidos y nombres', 'nombres y apellidos', 'colaborador', 'trabajador', 'empleado', 'full name'],
  'usuarios.email': ['email', 'correo', 'correo electronico', 'e-mail', 'mail', 'correo_electronico'],
  'usuarios.rol': ['rol', 'cargo', 'puesto', 'posicion', 'role', 'tipo empleado', 'categoria'],
  'usuarios.zona': ['zona', 'region', 'area geografica', 'zona geografica'],
  'usuarios.activo': ['activo', 'estado', 'active', 'vigente', 'habilitado'],
  'usuarios_rrhh.fecha_nacimiento': ['fecha nacimiento', 'fecha_nacimiento', 'fec nacimiento', 'fec_nac', 'nacimiento', 'birthday', 'cumpleanos'],
  'usuarios_rrhh.genero': ['genero', 'sexo', 'gender', 'sex'],
  'usuarios_rrhh.estado_civil': ['estado civil', 'estado_civil', 'est civil', 'situacion civil'],
  'usuarios_rrhh.telefono_personal': ['telefono', 'celular', 'phone', 'tel', 'nro celular', 'num celular', 'movil', 'telefono personal'],
  'usuarios_rrhh.direccion_domiciliaria': ['direccion', 'domicilio', 'dir', 'address', 'direccion domiciliaria'],
  'usuarios_rrhh.distrito_residencia': ['distrito', 'distrito residencia', 'dist'],
  'usuarios_rrhh.contacto_emergencia_nombre': ['contacto emergencia', 'emergencia nombre', 'contacto_emergencia'],
  'usuarios_rrhh.contacto_emergencia_telefono': ['telefono emergencia', 'emergencia telefono', 'tel emergencia'],
  'usuarios_rrhh.contacto_emergencia_parentesco': ['parentesco', 'parentesco emergencia', 'relacion emergencia'],
  'usuarios_rrhh.banco': ['banco', 'entidad bancaria', 'bank'],
  'usuarios_rrhh.numero_cuenta': ['numero cuenta', 'nro cuenta', 'cuenta bancaria', 'num cuenta', 'cuenta'],
  'usuarios_rrhh.cci': ['cci', 'codigo interbancario', 'cuenta interbancaria'],
  'usuarios_rrhh.fecha_ingreso': ['fecha ingreso', 'fecha_ingreso', 'fec ingreso', 'ingreso', 'fecha inicio', 'start date', 'fecha alta'],
  'usuarios_rrhh.fecha_fin_contrato': ['fecha fin', 'fecha_fin', 'fin contrato', 'vencimiento', 'fecha termino'],
  'usuarios_rrhh.tipo_contrato_actual': ['tipo contrato', 'tipo_contrato', 'modalidad', 'contrato tipo'],
  'usuarios_rrhh.regimen_laboral': ['regimen', 'regimen laboral', 'reg laboral'],
  'usuarios_rrhh.cargo_formal': ['cargo formal', 'cargo_formal', 'titulo cargo'],
  'usuarios_rrhh.area_funcional': ['area', 'area funcional', 'departamento', 'dept', 'area_funcional'],
  'usuarios_rrhh.jefe_directo_id': ['jefe', 'jefe directo', 'supervisor', 'responsable', 'superior'],
  'usuarios_rrhh.remuneracion_actual': ['remuneracion', 'sueldo', 'salario', 'pago', 'rem', 'basico', 'sueldo basico'],
  'usuarios_rrhh.talla_uniforme': ['talla', 'talla uniforme', 'size'],
  'usuarios_rrhh.tiene_equipo_corporativo': ['equipo corporativo', 'equipo', 'tiene equipo'],
  'usuarios_rrhh.equipo_corporativo_detalle': ['detalle equipo', 'equipo detalle', 'descripcion equipo'],
  'usuarios_rrhh.status': ['status', 'estado colaborador', 'estado empleado', 'situacion'],
  'usuarios_rrhh.sistema_pensionario': ['sistema pensionario', 'pension', 'pensiones', 'afp/onp', 'sistema pension'],
  'usuarios_rrhh.afp_nombre': ['afp', 'nombre afp', 'afp nombre', 'administradora'],
  'usuarios_rrhh.cuspp': ['cuspp', 'codigo spp', 'codigo pension', 'cod cuspp'],
  'usuarios_rrhh.eps_nombre': ['eps', 'nombre eps', 'seguro salud', 'eps nombre'],
  'usuarios_rrhh.tiene_sctr': ['sctr', 'tiene sctr', 'seguro riesgo', 'sctr activo'],
  'usuarios_rrhh.asignacion_familiar': ['asignacion familiar', 'asig familiar', 'familiar'],
  'usuarios_rrhh.numero_dependientes': ['dependientes', 'numero dependientes', 'nro dependientes', 'num dependientes'],
  'usuarios_rrhh.numero_hijos': ['hijos', 'numero hijos', 'nro hijos', 'cantidad hijos'],
  'usuarios_rrhh.tipo_documento': ['tipo documento', 'tipo doc', 'tipo_documento', 'doc tipo'],
  'usuarios_rrhh.lugar_nacimiento': ['lugar nacimiento', 'lugar_nacimiento', 'ciudad nacimiento', 'procedencia'],
  'usuarios_rrhh.nacionalidad': ['nacionalidad', 'pais', 'pais origen'],
  'usuarios_rrhh.ruc': ['ruc', 'ruc personal', 'numero ruc'],
  'usuarios_rrhh.nivel_educativo': ['nivel educativo', 'educacion', 'grado instruccion', 'nivel estudios', 'formacion'],
  'usuarios_rrhh.profesion_carrera': ['profesion', 'carrera', 'profesion carrera', 'titulo profesional'],
  'usuarios_rrhh.grupo_sanguineo': ['grupo sanguineo', 'sangre', 'tipo sangre', 'grupo sangre', 'factor rh'],
  'usuarios_tiendas.tienda': ['tienda', 'local', 'punto venta', 'pdv', 'store', 'sucursal', 'sede'],
  'contratos.tipo_contrato': ['tipo contrato formal', 'contrato tipo formal'],
  'contratos.fecha_inicio_contrato': ['inicio contrato', 'fecha inicio contrato'],
  'contratos.fecha_fin_contrato': ['fin contrato formal', 'vencimiento contrato'],
  'contratos.cargo_contrato': ['cargo contrato', 'cargo en contrato'],
  'contratos.remuneracion_contrato': ['remuneracion contrato', 'sueldo contrato'],
  'cesado.fecha_cese': ['fecha cese', 'fecha_cese', 'fecha baja', 'fecha salida', 'fecha retiro', 'fecha termino relacion'],
  'cesado.motivo_cese': ['motivo cese', 'motivo_cese', 'razon cese', 'tipo cese', 'motivo salida', 'motivo baja'],
}
