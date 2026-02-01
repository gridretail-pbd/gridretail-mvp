// Database Types - Coinciden exactamente con el schema de Supabase

export interface Tienda {
  id: string
  codigo: string
  nombre: string
  direccion?: string
  zona: 'SUR' | 'NORTE'
  gps_lat?: number
  gps_long?: number
  cuota_diaria: number
  activa: boolean
  created_at: string
}

export interface Usuario {
  id: string
  codigo_asesor: string
  dni?: string
  nombre_completo: string
  email?: string
  password_hash: string
  rol: 'ASESOR' | 'ASESOR_REFERENTE' | 'COORDINADOR' | 'SUPERVISOR' |
       'JEFE_VENTAS' | 'GERENTE_COMERCIAL' | 'GERENTE_GENERAL' |
       'BACKOFFICE_OPERACIONES' | 'BACKOFFICE_RRHH' | 'BACKOFFICE_AUDITORIA' |
       'VALIDADOR_ARRIBOS' | 'ADMIN'
  zona?: 'SUR' | 'NORTE' | 'AMBAS'
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioTienda {
  id: string
  usuario_id: string
  tienda_id: string
  es_principal: boolean
  created_at: string
}

// Tipos extendidos para módulo de gestión de usuarios
export interface UsuarioConTiendas extends Omit<Usuario, 'password_hash'> {
  tiendas: UsuarioTiendaDetalle[]
}

export interface UsuarioTiendaDetalle {
  id: string
  tienda_id: string
  es_principal: boolean
  tienda: {
    id: string
    codigo: string
    nombre: string
  }
}

export type RolUsuario = Usuario['rol']

export interface Venta {
  id: string
  fecha: string
  hora: string
  tienda_id: string
  usuario_id: string
  codigo_asesor?: string
  dni_asesor?: string

  // Datos del cliente
  tipo_documento_cliente: 'DNI' | 'C.E.' | 'RUC 20' | 'PASAPORTE' | 'PTP'
  numero_documento_cliente: string
  nombre_cliente: string
  telefono_asignado?: string

  // Datos de la venta
  orden_venta: string
  monto_plan?: number
  monto_liquidado: number
  tipo_venta: string
  base_captura?: 'BASE' | 'CAPTURA'
  validacion_huella?: 'HUELLERO' | 'DJ' | 'VENTA EXTRANJERO'
  operador_cedente?: 'CLARO' | 'MOVISTAR' | 'BITEL' | 'OTROS'
  vep_contado?: 'VEP' | 'CONTADO'

  // Productos
  iccid_chip?: string
  imei_equipo?: string
  modelo_accesorio?: string

  // Auditoría
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface Arribo {
  id: string
  fecha: string
  hora: string
  tienda_id: string
  usuario_id: string
  registrado_por?: string

  dni_cliente?: string
  es_cliente_entel?: boolean
  tipo_visita?: 'VENTA' | 'POSVENTA'
  concreto_operacion?: boolean
  se_vendio?: boolean
  motivo_no_venta?: string

  created_at: string
  updated_at: string
}

export interface LogAuditoria {
  id: string
  usuario: string
  accion: 'CREATE' | 'UPDATE' | 'DELETE'
  tabla: string
  registro_id: string
  valor_anterior?: any
  valor_nuevo?: any
  justificacion?: string
  timestamp: string
}

// Dashboard Metrics Types
export interface DashboardMetrics {
  totalArribos: number
  totalVentas: number
  montoTotal: number
  conversion: number
  cumplimiento: number
}

export interface TiendaMetrics {
  tienda_id: string
  tienda_nombre: string
  tienda_codigo: string
  cuota: number
  total_ventas: number
  monto_total: number
  falta: number
  cumplimiento: number
  conversion: number
  arribos: number
}

export interface LoginCredentials {
  codigo_asesor: string
  password: string
}
