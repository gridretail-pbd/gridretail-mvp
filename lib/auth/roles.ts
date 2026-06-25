/**
 * Roles autorizados a enrolar / des-enrolar un dispositivo a una tienda.
 * Ver docs/SPEC_LOGIN_MODO_TIENDA.md §6.1.
 */
export const ROLES_ENROLADORES = [
  'ADMIN',
  'GERENTE_GENERAL',
  'GERENTE_COMERCIAL',
  'JEFE_VENTAS',
  'SUPERVISOR',
] as const

export function puedeEnrolarDispositivo(rol: string): boolean {
  return (ROLES_ENROLADORES as readonly string[]).includes(rol)
}
