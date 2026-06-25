// lib/rrhh/utils/permisos-rrhh.ts
// Helpers de permisos por rol para el módulo RRHH

export const ROLES_GESTION_RRHH = ['BACKOFFICE_RRHH', 'ADMIN'] as const
export const ROLES_JEFATURA = ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'] as const
export const ROLES_SUPERVISION = ['COORDINADOR', 'SUPERVISOR'] as const

/** RRHH y Admin: CRUD completo del módulo */
export function puedeGestionarRRHH(rol: string): boolean {
  return (ROLES_GESTION_RRHH as readonly string[]).includes(rol)
}

/** Dashboard RRHH: RRHH + Jefatura */
export function puedeVerDashboardRRHH(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_JEFATURA as readonly string[]).includes(rol)
}

/** Registrar incidencias: RRHH + Supervisión + JV */
export function puedeRegistrarIncidencia(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_SUPERVISION as readonly string[]).includes(rol) ||
    rol === 'JEFE_VENTAS'
}

/** Visar renovación: JV (su zona), KAM/GerCom (todas), Admin */
export function puedeVisarRenovacion(rol: string): boolean {
  return rol === 'JEFE_VENTAS' || rol === 'GERENTE_COMERCIAL' || rol === 'ADMIN'
}

/** Aprobar permisos: RRHH + Jefatura + Supervisor */
export function puedeAprobarPermisos(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_JEFATURA as readonly string[]).includes(rol) ||
    rol === 'SUPERVISOR'
}

/** Asignar turnos: RRHH + Supervisión + JV */
export function puedeAsignarTurnos(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_SUPERVISION as readonly string[]).includes(rol) ||
    rol === 'JEFE_VENTAS'
}

/** Gestionar pipeline de reclutamiento: solo RRHH */
export function puedeGestionarPipeline(rol: string): boolean {
  return puedeGestionarRRHH(rol)
}

/** Ver pipeline (lectura): RRHH + Jefatura */
export function puedeVerPipeline(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_JEFATURA as readonly string[]).includes(rol)
}

/** Entrevistar candidatos nivel 1: RRHH */
export function puedeEntrevistarNivel1(rol: string): boolean {
  return puedeGestionarRRHH(rol)
}

/** Entrevistar candidatos nivel 2+: JV, KAM, Gerencia, Admin */
export function puedeEntrevistarNivel2(rol: string): boolean {
  return (ROLES_JEFATURA as readonly string[]).includes(rol) || rol === 'ADMIN'
}

/** Ver asistencia del equipo */
export function puedeVerAsistenciaEquipo(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    (ROLES_JEFATURA as readonly string[]).includes(rol) ||
    (ROLES_SUPERVISION as readonly string[]).includes(rol)
}

/** Gestionar offboarding: solo RRHH */
export function puedeGestionarOffboarding(rol: string): boolean {
  return puedeGestionarRRHH(rol)
}

/** Acceso al módulo RRHH en sidebar */
export function tieneAccesoModuloRRHH(rol: string): boolean {
  return puedeGestionarRRHH(rol) ||
    puedeVerDashboardRRHH(rol) ||
    (ROLES_SUPERVISION as readonly string[]).includes(rol)
}
