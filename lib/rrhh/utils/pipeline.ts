// lib/rrhh/utils/pipeline.ts
// Helpers para el pipeline de reclutamiento

import type { EtapaPipeline } from '../types'

export const TRANSICIONES_VALIDAS: Record<EtapaPipeline, EtapaPipeline[]> = {
  CAPTACION: ['FILTRO_CV', 'DESCARTADO'],
  FILTRO_CV: ['ENTREVISTAS', 'DESCARTADO'],
  ENTREVISTAS: ['CONSULTA_ENTEL', 'DESCARTADO'],
  CONSULTA_ENTEL: ['USUARIO_ENTEL', 'DESCARTADO'],
  USUARIO_ENTEL: ['INDUCCION', 'DESCARTADO'],
  INDUCCION: ['SOMBRA', 'DESCARTADO'],
  SOMBRA: ['ALTA', 'INDUCCION', 'DESCARTADO'], // INDUCCION = extender
  ALTA: [],       // Estado terminal positivo
  DESCARTADO: [], // Estado terminal negativo (banco de talento)
}

export function puedeAvanzar(desde: EtapaPipeline, hacia: EtapaPipeline): boolean {
  return TRANSICIONES_VALIDAS[desde]?.includes(hacia) ?? false
}

export function obtenerSiguientesEtapas(etapaActual: EtapaPipeline): EtapaPipeline[] {
  return TRANSICIONES_VALIDAS[etapaActual] ?? []
}

export function esEtapaTerminal(etapa: EtapaPipeline): boolean {
  return TRANSICIONES_VALIDAS[etapa]?.length === 0
}

export const ETAPA_COLORES: Record<EtapaPipeline, string> = {
  CAPTACION: 'bg-blue-100 text-blue-800',
  FILTRO_CV: 'bg-indigo-100 text-indigo-800',
  ENTREVISTAS: 'bg-purple-100 text-purple-800',
  CONSULTA_ENTEL: 'bg-yellow-100 text-yellow-800',
  USUARIO_ENTEL: 'bg-orange-100 text-orange-800',
  INDUCCION: 'bg-cyan-100 text-cyan-800',
  SOMBRA: 'bg-teal-100 text-teal-800',
  ALTA: 'bg-green-100 text-green-800',
  DESCARTADO: 'bg-red-100 text-red-800',
}

export const ETAPA_LABELS: Record<EtapaPipeline, string> = {
  CAPTACION: 'Captación',
  FILTRO_CV: 'Filtro CV',
  ENTREVISTAS: 'Entrevistas',
  CONSULTA_ENTEL: 'Consulta Entel',
  USUARIO_ENTEL: 'Usuario Entel',
  INDUCCION: 'Inducción',
  SOMBRA: 'Sombra',
  ALTA: 'Alta',
  DESCARTADO: 'Descartado',
}

/** Etapas activas del pipeline (sin terminales) para el Kanban */
export const ETAPAS_KANBAN: EtapaPipeline[] = [
  'CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL',
  'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA'
]

/** Orden numérico de las etapas para sorting */
export const ETAPA_ORDEN: Record<EtapaPipeline, number> = {
  CAPTACION: 1,
  FILTRO_CV: 2,
  ENTREVISTAS: 3,
  CONSULTA_ENTEL: 4,
  USUARIO_ENTEL: 5,
  INDUCCION: 6,
  SOMBRA: 7,
  ALTA: 8,
  DESCARTADO: 9,
}
