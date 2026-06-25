// lib/rrhh/interfaces.ts
// Interfaces de datos del módulo RRHH
// Mapean 1:1 con las tablas de las migraciones 020-024

import type {
  UsuarioStatus, EtapaPipeline, FuenteCaptacion, TipoContrato,
  EstadoContrato, EstadoLote, DecisionJV, DecisionKAM, DecisionFinal,
  AIRecomendacion, TipoMarcacion, EstadoAsistencia, TipoIncidencia,
  EstadoIncidencia, TipoPermiso, EstadoPermiso, TipoMovimiento,
  TipoSalida, TipoAITask, EstadoAITask, AreaFuncional, Genero,
  EstadoCivil, NivelAlerta, TipoAlerta,
  EstadoImportacion, NivelCompletitud, EstadoVerificacionIdentidad,
  SistemaPensionario, TipoDocumentoIdentidad, NivelEducativo,
  GrupoSanguineo, CampoHistorial, TipoEntrevistaColaborador, ResultadoEntrevista
} from './types'

// ─── Core ──────────────────────────────────────────────────────────────────
export interface UsuarioRRHH {
  id: string
  // Cuenta de login enlazada (null = personal solo-RRHH) — migración 033
  usuario_id: string | null
  // Identidad propia de la persona (migración 033)
  nombre_completo: string | null
  dni: string | null
  codigo_asesor: string | null
  fecha_nacimiento: string | null
  genero: Genero | null
  estado_civil: EstadoCivil | null
  telefono_personal: string | null
  direccion_domiciliaria: string | null
  distrito_residencia: string | null
  gps_domicilio_lat: number | null
  gps_domicilio_lng: number | null
  contacto_emergencia_nombre: string | null
  contacto_emergencia_telefono: string | null
  contacto_emergencia_parentesco: string | null
  banco: string | null
  numero_cuenta: string | null
  cci: string | null
  fecha_ingreso: string
  fecha_fin_contrato: string | null
  tipo_contrato_actual: TipoContrato
  regimen_laboral: string | null
  cargo_formal: string | null
  area_funcional: AreaFuncional
  jefe_directo_id: string | null
  remuneracion_actual: number | null
  status: UsuarioStatus
  talla_uniforme: string | null
  tiene_equipo_corporativo: boolean
  equipo_corporativo_detalle: string | null
  foto_url: string | null
  notas: string | null
  // Seguridad Social y Tributario (migración 026)
  sistema_pensionario: SistemaPensionario | null
  afp_nombre: string | null
  cuspp: string | null
  eps_nombre: string | null
  tiene_sctr: boolean
  asignacion_familiar: boolean
  numero_dependientes: number | null
  numero_hijos: number | null
  // Identificación Adicional (migración 026)
  tipo_documento: TipoDocumentoIdentidad | null
  lugar_nacimiento: string | null
  nacionalidad: string | null
  ruc: string | null
  // Educación (migración 026)
  nivel_educativo: NivelEducativo | null
  profesion_carrera: string | null
  // Salud (migración 026)
  grupo_sanguineo: GrupoSanguineo | null
  created_at: string
  updated_at: string
  // Relaciones (opcionales, para queries con join)
  usuario?: { nombre_completo: string; dni: string; codigo_asesor: string; rol: string; activo: boolean; zona: string | null }
  jefe_directo?: { nombre_completo: string } | null
}

export interface UsuarioStatusLog {
  id: string
  usuario_id: string
  status_anterior: UsuarioStatus | null
  status_nuevo: UsuarioStatus
  motivo: string | null
  fecha_efectiva: string
  registrado_por: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Reclutamiento ─────────────────────────────────────────────────────────
export interface Candidato {
  id: string
  dni: string
  nombre_completo: string
  telefono: string
  email: string | null
  fecha_nacimiento: string | null
  genero: Genero | null
  distrito_residencia: string | null
  direccion: string | null
  gps_domicilio_lat: number | null
  gps_domicilio_lng: number | null
  experiencia_telecom: boolean
  experiencia_detalle: string | null
  disponibilidad_horario: string | null
  disponibilidad_detalle: string | null
  etapa_actual: EtapaPipeline
  fecha_captacion: string
  fecha_ultima_actualizacion: string | null
  fuente_captacion: FuenteCaptacion
  referido_por: string | null
  tienda_destino_id: string | null
  ai_score: number | null
  ai_score_detalle: Record<string, unknown> | null
  ai_task_id: string | null
  cv_url: string | null
  cv_datos_extraidos: CvDatosExtraidos | null
  foto_url: string | null
  entel_fecha_envio: string | null
  entel_estado: string | null
  entel_fecha_respuesta: string | null
  entel_observaciones: string | null
  entel_usuario_fecha_solicitud: string | null
  entel_usuario_estado: string | null
  entel_usuario_confirmado: boolean
  induccion_fecha_inicio: string | null
  induccion_fecha_fin: string | null
  induccion_capacitador_id: string | null
  induccion_checklist: InduccionChecklist | null
  induccion_evaluacion: string | null
  sombra_tienda_id: string | null
  sombra_mentor_id: string | null
  sombra_fecha_inicio: string | null
  sombra_fecha_fin: string | null
  sombra_evaluacion_mentor: Record<string, unknown> | null
  sombra_evaluacion_supervisor: Record<string, unknown> | null
  sombra_resultado: string | null
  descartado: boolean
  descarte_etapa: string | null
  descarte_motivo: string | null
  descarte_fecha: string | null
  descartado_por: string | null
  usuario_generado_id: string | null
  notas: string | null
  registrado_por: string
  created_at: string
  updated_at: string
  // Relaciones opcionales
  referido_por_usuario?: { nombre_completo: string } | null
  tienda_destino?: { nombre: string; codigo: string } | null
  entrevistas?: CandidatoEntrevista[]
  etapas?: CandidatoEtapa[]
  documentos?: CandidatoDocumento[]
}

export interface CvDatosExtraidos {
  nombre?: string
  experiencia?: { empresa: string; cargo: string; periodo: string }[]
  educacion?: { institucion: string; titulo: string; año: string }[]
  habilidades?: string[]
  telecom_experiencia?: boolean
  resumen?: string
}

export interface InduccionChecklist {
  modulos: {
    id: string
    nombre: string
    completado: boolean
    fecha: string | null
  }[]
}

export interface CandidatoEtapa {
  id: string
  candidato_id: string
  etapa: EtapaPipeline
  fecha_entrada: string
  fecha_salida: string | null
  resultado: string | null
  notas: string | null
  registrado_por: string | null
  created_at: string
}

export interface CandidatoEntrevista {
  id: string
  candidato_id: string
  nivel: number
  entrevistador_id: string
  fecha_programada: string | null
  fecha_realizada: string | null
  tipo_captura: 'VIDEO' | 'AUDIO' | 'TEXTO' | null
  media_url: string | null
  duracion_segundos: number | null
  transcripcion_texto: string | null
  transcripcion_ai_task_id: string | null
  ai_analisis: Record<string, unknown> | null
  ai_analisis_task_id: string | null
  scorecard: ScorecardData | null
  observaciones: string | null
  resultado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
  created_at: string
  updated_at: string
  // Relaciones
  entrevistador?: { nombre_completo: string; rol: string }
}

export interface ScorecardData {
  criterios: ScorecardCriterio[]
  observaciones_generales?: string
}

export interface ScorecardCriterio {
  nombre: string
  puntaje: number  // 1-5
  peso: number     // peso relativo
  observacion?: string
}

export interface CandidatoDocumento {
  id: string
  candidato_id: string
  tipo: string
  nombre_archivo: string
  url: string
  mime_type: string | null
  tamano_bytes: number | null
  ai_texto_extraido: string | null
  ai_task_id: string | null
  subido_por: string
  created_at: string
}

// ─── Contratos ─────────────────────────────────────────────────────────────
export interface Contrato {
  id: string
  usuario_id: string
  tipo_contrato: TipoContrato
  fecha_inicio: string
  fecha_fin: string | null
  cargo: string
  remuneracion: number
  tienda_asignada_id: string | null
  estado: EstadoContrato
  documento_url: string | null
  documento_generado_por_ai: boolean
  ai_task_id: string | null
  firma_colaborador_timestamp: string | null
  firma_colaborador_ip: string | null
  firma_colaborador_geo: Record<string, unknown> | null
  firma_colaborador_user_agent: string | null
  contrato_anterior_id: string | null
  lote_renovacion_id: string | null
  motivo_no_renovacion: string | null
  notas: string | null
  generado_por: string | null
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: { nombre_completo: string; dni: string; codigo_asesor: string }
  tienda_asignada?: { nombre: string; codigo: string } | null
}

export interface RenovacionLote {
  id: string
  periodo: string
  fecha_generacion: string
  fecha_limite_visado: string | null
  estado: EstadoLote
  total_colaboradores: number
  resumen: Record<string, unknown> | null
  generado_por: string | null
  created_at: string
  updated_at: string
  // Relaciones
  decisiones?: RenovacionDecision[]
}

export interface RenovacionDecision {
  id: string
  lote_id: string
  usuario_id: string
  contrato_actual_id: string | null
  ai_resumen: string | null
  ai_recomendacion: AIRecomendacion | null
  ai_task_id: string | null
  indicadores_snapshot: IndicadoresSnapshot | null
  decision_jv: DecisionJV | null
  decision_jv_motivo: string | null
  decision_jv_id: string | null
  decision_jv_fecha: string | null
  decision_kam: DecisionKAM | null
  decision_kam_motivo: string | null
  decision_kam_id: string | null
  decision_kam_fecha: string | null
  decision_final: DecisionFinal | null
  ejecutado_por: string | null
  ejecutado_fecha: string | null
  contrato_nuevo_id: string | null
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: { nombre_completo: string; dni: string; codigo_asesor: string; cuenta?: { rol: string } | null }
  usuario_rrhh?: UsuarioRRHH
}

export interface IndicadoresSnapshot {
  ventas_mes?: number
  comision_mes?: number
  cuota_cumplimiento?: number
  tardanzas_mes?: number
  faltas_mes?: number
  incidencias_activas?: number
  antiguedad_meses?: number
  ranking_tienda?: number
  total_hc_tienda?: number
  [key: string]: unknown
}

// ─── Asistencia ────────────────────────────────────────────────────────────
export interface Asistencia {
  id: string
  usuario_id: string
  tienda_id: string
  tipo: TipoMarcacion
  fecha: string
  hora_servidor: string
  hora_dispositivo: string | null
  foto_url: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  dentro_radio: boolean | null
  distancia_tienda_metros: number | null
  mock_location_detectado: boolean
  estado: EstadoAsistencia
  es_tardanza: boolean
  minutos_tardanza: number
  observaciones: string | null
  editado_por: string | null
  editado_motivo: string | null
  editado_at: string | null
  created_at: string
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string }
  tienda?: { nombre: string; codigo: string }
}

export interface AperturaCierreTienda {
  id: string
  tienda_id: string
  tipo: 'APERTURA' | 'CIERRE'
  fecha: string
  hora: string
  foto_url: string | null
  gps_lat: number | null
  gps_lng: number | null
  cantidad_hc: number
  usuarios_presentes: string[]
  novedades: string | null
  registrado_por: string
  created_at: string
  // Relaciones
  tienda?: { nombre: string; codigo: string }
}

// ─── Horarios y Turnos ────────────────────────────────────────────────────
export interface HorarioTienda {
  id: string
  tienda_id: string
  dia_semana: number // 0=Lunes, 6=Domingo
  hora_apertura: string
  hora_cierre: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Turno {
  id: string
  codigo: string
  nombre: string
  hora_inicio: string | null
  hora_fin: string | null
  es_partido: boolean
  hora_corte_inicio: string | null
  hora_corte_fin: string | null
  tolerancia_tardanza_minutos: number
  activo: boolean
  created_at: string
}

export interface AsignacionTurno {
  id: string
  usuario_id: string
  tienda_id: string
  turno_id: string
  fecha: string
  es_dia_descanso: boolean
  es_feriado: boolean
  notas: string | null
  asignado_por: string | null
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string }
  tienda?: { nombre: string }
  turno?: Turno
}

// ─── Incidencias ───────────────────────────────────────────────────────────
export interface IncidenciaLaboral {
  id: string
  usuario_id: string
  tipo: TipoIncidencia
  fecha: string
  descripcion: string | null
  asistencia_id: string | null
  estado: EstadoIncidencia
  descargo_colaborador: string | null
  descargo_fecha: string | null
  resolucion: string | null
  resolucion_por: string | null
  resolucion_fecha: string | null
  documento_url: string | null
  generada_automaticamente: boolean
  registrado_por: string
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string }
}

// ─── Permisos ──────────────────────────────────────────────────────────────
export interface SolicitudPermiso {
  id: string
  usuario_id: string
  tipo: TipoPermiso
  fecha_inicio: string
  fecha_fin: string
  horas_solicitadas: number | null
  motivo: string
  documento_adjunto_url: string | null
  estado: EstadoPermiso
  aprobado_por: string | null
  aprobado_fecha: string | null
  motivo_rechazo: string | null
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string }
}

// ─── Movimientos ───────────────────────────────────────────────────────────
export interface MovimientoPersonal {
  id: string
  usuario_id: string
  tipo_movimiento: TipoMovimiento
  fecha_efectiva: string
  motivo: string | null
  datos_anteriores: Record<string, unknown> | null
  datos_nuevos: Record<string, unknown> | null
  contrato_id: string | null
  tienda_origen_id: string | null
  tienda_destino_id: string | null
  autorizado_por: string
  documento_url: string | null
  notas: string | null
  created_at: string
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string }
  tienda_origen?: { nombre: string } | null
  tienda_destino?: { nombre: string } | null
}

// ─── Offboarding ───────────────────────────────────────────────────────────
export interface OffboardingChecklist {
  id: string
  usuario_id: string
  tipo_salida: TipoSalida
  fecha_inicio: string
  fecha_cierre: string | null
  estado: 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO'
  tareas: OffboardingTarea[]
  generado_por_ai: boolean
  ai_task_id: string | null
  responsable_id: string
  notas: string | null
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: { nombre_completo: string; codigo_asesor: string }
}

export interface OffboardingTarea {
  id: string
  titulo: string
  completada: boolean
  completada_por?: string
  completada_fecha?: string
  notas?: string
  orden: number
}

// ─── Documentos del Colaborador ────────────────────────────────────────────
export interface DocumentoColaborador {
  id: string
  usuario_id: string
  tipo: string
  nombre_archivo: string
  descripcion: string | null
  url: string
  mime_type: string | null
  tamano_bytes: number | null
  ai_texto_extraido: string | null
  ai_task_id: string | null
  fecha_documento: string | null
  es_confidencial: boolean
  subido_por: string
  created_at: string
}

// ─── AI Tasks ──────────────────────────────────────────────────────────────
export interface AITask {
  id: string
  tipo: TipoAITask
  modulo: string
  entidad_tipo: string | null
  entidad_id: string | null
  modelo: string | null
  prompt_version: string | null
  input_summary: string | null
  output: Record<string, unknown> | null
  ai_confidence: number | null
  tokens_input: number | null
  tokens_output: number | null
  costo_estimado_usd: number | null
  latency_ms: number | null
  status: EstadoAITask
  error_message: string | null
  reintentos: number
  solicitado_por: string | null
  created_at: string
  updated_at: string
}

// ─── Alertas ───────────────────────────────────────────────────────────────
export interface AlertaRRHH {
  id: string
  tipo: TipoAlerta
  titulo: string
  mensaje: string
  nivel: NivelAlerta
  entidad_tipo: string | null
  entidad_id: string | null
  modulo: string | null
  datos_contexto: Record<string, unknown> | null
  destinatario_id: string | null
  destinatario_rol: string | null
  estado: 'PENDIENTE' | 'LEIDA' | 'ACCIONADA' | 'DESCARTADA'
  fecha_limite: string | null
  leida_at: string | null
  accion_tomada: string | null
  accion_por: string | null
  accion_at: string | null
  generada_por: 'SISTEMA' | 'AI' | 'MANUAL'
  created_at: string
}

// ─── Importación ──────────────────────────────────────────────────────────
export interface ImportacionRRHH {
  id: string
  archivo_nombre: string
  archivo_url: string
  archivo_tamano_bytes: number | null
  archivo_tipo: string | null
  hoja_procesada: string | null
  fila_encabezados: number | null
  total_filas_datos: number
  mapeo_columnas: MapeoColumnas
  mapeo_ai_task_id: string | null
  mapeo_confianza_promedio: number | null
  estado: EstadoImportacion
  total_validos: number
  total_warnings: number
  total_errores: number
  total_importados: number
  total_actualizados: number
  total_saltados: number
  total_activos_importados: number
  total_cesados_importados: number
  reporte_brechas: ReporteBrechas | null
  reporte_brechas_url: string | null
  completitud_promedio: number | null
  total_alertas_generadas: number
  alerta_resumen_id: string | null
  detalle_filas: DetalleFilaImportacion[] | null
  ejecutado_por: string | null
  fecha_ejecucion: string | null
  notas: string | null
  created_at: string
  updated_at: string
  // Relaciones opcionales (joins)
  ai_task?: AITask
  ejecutado_por_usuario?: { nombre_completo: string }
}

export interface MapeoColumnas {
  mapeos: MapeoColumna[]
  columnas_sin_mapeo: string[]
  campos_sin_dato: string[]
}

export interface MapeoColumna {
  columna_origen: string
  campo_destino: string // formato: "tabla.campo"
  confianza: number
  transformacion: 'CONCATENAR' | 'NORMALIZAR_ENUM' | 'SPLIT' | 'FECHA' | null
  notas: string | null
}

export interface ColumnaDetectada {
  indice: number
  nombre_original: string
  tipo_inferido: 'texto' | 'numero' | 'fecha' | 'booleano' | 'email' | 'telefono'
  valores_muestra: string[]
  porcentaje_lleno: number
  valores_unicos: number
}

export interface AnalisisBrechas {
  colaborador_dni: string
  colaborador_nombre: string
  es_cesado: boolean
  datos_core: CategoriaCompletitud
  datos_personales: CategoriaCompletitud
  datos_bancarios: CategoriaCompletitud
  datos_contractuales: CategoriaCompletitud
  datos_operativo: CategoriaCompletitud
  datos_seguridad_social: CategoriaCompletitud
  datos_identificacion: CategoriaCompletitud
  datos_educacion: CategoriaCompletitud
  datos_salud: CategoriaCompletitud
  documentos_pendientes: string[]
  nivel_completitud: NivelCompletitud
}

export interface CategoriaCompletitud {
  presentes: string[]
  faltantes: string[]
  porcentaje: number
}

export interface ReporteBrechas {
  total_colaboradores: number
  total_activos: number
  total_cesados: number
  completitud_promedio: number
  distribucion_completitud: Record<NivelCompletitud, number>
  top_campos_faltantes: { campo: string; cantidad: number }[]
  brechas_por_colaborador: AnalisisBrechas[]
}

export interface VerificacionIdentidadFila {
  estado: EstadoVerificacionIdentidad
  nombre_oficial: string | null
  confianza_nombre: number | null
  confirmado_manualmente: boolean
  justificacion_manual: string | null
}

export interface DetalleFilaImportacion {
  fila_excel: number
  dni: string
  nombre: string
  estado: 'VALIDO' | 'WARNING' | 'ERROR' | 'SALTADO'
  es_cesado: boolean
  usuario_id_generado?: string
  errores: { campo: string; mensaje: string; tipo: 'ERROR' | 'WARNING' | 'INFO' }[]
  datos_mapeados: Record<string, unknown>
  nivel_completitud: NivelCompletitud
  verificacion_identidad: VerificacionIdentidadFila | null
}

// ─── Historial (migración 026) ──────────────────────────────────────────

export interface HistorialBancario {
  id: string
  usuario_id: string
  banco: string
  numero_cuenta: string
  cci: string | null
  fecha_desde: string
  fecha_hasta: string | null
  motivo_cambio: string | null
  registrado_por: string
  created_at: string
  registrado_por_usuario?: { nombre_completo: string }
}

export interface HistorialDireccion {
  id: string
  usuario_id: string
  direccion_domiciliaria: string
  distrito_residencia: string | null
  gps_domicilio_lat: number | null
  gps_domicilio_lng: number | null
  fecha_desde: string
  fecha_hasta: string | null
  motivo_cambio: string | null
  registrado_por: string
  created_at: string
}

export interface HistorialCambioRRHH {
  id: string
  usuario_id: string
  campo: CampoHistorial
  valor_anterior: string | null
  valor_nuevo: string
  fecha_cambio: string
  motivo: string | null
  registrado_por: string
  created_at: string
}

export interface EntrevistaColaborador {
  id: string
  usuario_id: string
  tipo: TipoEntrevistaColaborador
  entrevistador_id: string
  fecha: string
  motivo: string | null
  notas: string | null
  datos_estructurados: Record<string, unknown> | null
  resultado: ResultadoEntrevista | null
  grabacion_url: string | null
  transcripcion_url: string | null
  ai_task_id: string | null
  ai_resumen: string | null
  movimiento_id: string | null
  es_confidencial: boolean
  created_at: string
  updated_at: string
  // Relaciones opcionales
  entrevistador?: { nombre_completo: string }
  usuario?: { nombre_completo: string; dni: string }
  movimiento?: { tipo_movimiento: string; fecha_efectiva: string }
}
