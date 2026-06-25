'use client'

import { useReducer, useCallback } from 'react'
import type { ColumnaDetectada, MapeoColumna, DetalleFilaImportacion, ReporteBrechas } from '@/lib/rrhh/interfaces'

// ─── Wizard Steps ──────────────────────────────────────────────────────

export const WIZARD_STEPS = [
  { key: 'subida', label: 'Subida', description: 'Sube tu archivo Excel' },
  { key: 'analisis', label: 'Análisis', description: 'Revisión del contenido' },
  { key: 'mapeo', label: 'Mapeo', description: 'Asignar columnas' },
  { key: 'validacion', label: 'Validación', description: 'Verificar datos' },
  { key: 'revision', label: 'Revisión', description: 'Confirmar importación' },
  { key: 'resultado', label: 'Resultado', description: 'Resumen final' },
] as const

export type WizardStepKey = typeof WIZARD_STEPS[number]['key']

// ─── State ─────────────────────────────────────────────────────────────

export interface AnalisisExcel {
  hojas: string[]
  hoja_seleccionada: string
  fila_encabezados: number
  total_filas_datos: number
  columnas_detectadas: ColumnaDetectada[]
  preview_datos: Record<string, unknown>[]
}

export interface WizardState {
  step: number
  importacionId: string | null

  // Step 1: Subida
  file: File | null
  fileName: string | null

  // Step 2: Análisis
  analisis: AnalisisExcel | null

  // Step 3: Mapeo
  mapeos: MapeoColumna[]
  columnasSinMapeo: string[]
  camposSinDato: string[]
  confianzaPromedio: number | null
  mapeoMetodo: 'ai' | 'heuristica' | null
  mapeoAiTaskId: string | null

  // Step 4: Validación (Phase 7C)
  validacion: {
    detalleFilas: DetalleFilaImportacion[]
    reporteBrechas: ReporteBrechas | null
  } | null

  // Step 5: Revisión (Phase 7C)
  filasIncluidas: number[]
  filasExcluidas: number[]

  // Step 6: Resultado (Phase 7C)
  resultado: {
    totalImportados: number
    totalActualizados: number
    totalSaltados: number
    totalActivos: number
    totalCesados: number
    alertasGeneradas: number
    reporteUrl: string | null
  } | null

  // Global
  loading: boolean
  error: string | null
}

const INITIAL_STATE: WizardState = {
  step: 0,
  importacionId: null,
  file: null,
  fileName: null,
  analisis: null,
  mapeos: [],
  columnasSinMapeo: [],
  camposSinDato: [],
  confianzaPromedio: null,
  mapeoMetodo: null,
  mapeoAiTaskId: null,
  validacion: null,
  filasIncluidas: [],
  filasExcluidas: [],
  resultado: null,
  loading: false,
  error: null,
}

// ─── Actions ───────────────────────────────────────────────────────────

type WizardAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'SET_FILE'; file: File | null }
  | { type: 'SET_IMPORTACION_ID'; id: string }
  | { type: 'SET_ANALISIS'; analisis: AnalisisExcel }
  | { type: 'SET_MAPEO'; mapeos: MapeoColumna[]; columnasSinMapeo: string[]; camposSinDato: string[]; confianzaPromedio: number; metodo: 'ai' | 'heuristica'; aiTaskId: string | null }
  | { type: 'UPDATE_MAPEO'; index: number; mapeo: Partial<MapeoColumna> }
  | { type: 'SET_VALIDACION'; detalleFilas: DetalleFilaImportacion[]; reporteBrechas: ReporteBrechas | null }
  | { type: 'SET_FILAS_INCLUIDAS'; filas: number[] }
  | { type: 'TOGGLE_FILA'; fila: number }
  | { type: 'SET_RESULTADO'; resultado: WizardState['resultado'] }
  | { type: 'RESET' }

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading, error: action.loading ? null : state.error }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }
    case 'NEXT_STEP':
      return { ...state, step: Math.min(state.step + 1, WIZARD_STEPS.length - 1), error: null }
    case 'PREV_STEP':
      return { ...state, step: Math.max(state.step - 1, 0), error: null }
    case 'GO_TO_STEP':
      return { ...state, step: action.step, error: null }
    case 'SET_FILE':
      return { ...state, file: action.file, fileName: action.file?.name ?? null }
    case 'SET_IMPORTACION_ID':
      return { ...state, importacionId: action.id }
    case 'SET_ANALISIS':
      return { ...state, analisis: action.analisis }
    case 'SET_MAPEO':
      return {
        ...state,
        mapeos: action.mapeos,
        columnasSinMapeo: action.columnasSinMapeo,
        camposSinDato: action.camposSinDato,
        confianzaPromedio: action.confianzaPromedio,
        mapeoMetodo: action.metodo,
        mapeoAiTaskId: action.aiTaskId,
      }
    case 'UPDATE_MAPEO': {
      const newMapeos = [...state.mapeos]
      newMapeos[action.index] = { ...newMapeos[action.index], ...action.mapeo }
      return { ...state, mapeos: newMapeos }
    }
    case 'SET_VALIDACION':
      return {
        ...state,
        validacion: { detalleFilas: action.detalleFilas, reporteBrechas: action.reporteBrechas },
        filasIncluidas: action.detalleFilas
          .filter(f => f.estado !== 'ERROR')
          .map(f => f.fila_excel),
      }
    case 'SET_FILAS_INCLUIDAS':
      return { ...state, filasIncluidas: action.filas }
    case 'TOGGLE_FILA': {
      const included = state.filasIncluidas.includes(action.fila)
      return {
        ...state,
        filasIncluidas: included
          ? state.filasIncluidas.filter(f => f !== action.fila)
          : [...state.filasIncluidas, action.fila],
      }
    }
    case 'SET_RESULTADO':
      return { ...state, resultado: action.resultado }
    case 'RESET':
      return INITIAL_STATE
    default:
      return state
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useWizardImportacion() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE)

  const setLoading = useCallback((loading: boolean) =>
    dispatch({ type: 'SET_LOADING', loading }), [])
  const setError = useCallback((error: string | null) =>
    dispatch({ type: 'SET_ERROR', error }), [])
  const nextStep = useCallback(() =>
    dispatch({ type: 'NEXT_STEP' }), [])
  const prevStep = useCallback(() =>
    dispatch({ type: 'PREV_STEP' }), [])
  const goToStep = useCallback((step: number) =>
    dispatch({ type: 'GO_TO_STEP', step }), [])
  const reset = useCallback(() =>
    dispatch({ type: 'RESET' }), [])

  const setFile = useCallback((file: File | null) =>
    dispatch({ type: 'SET_FILE', file }), [])
  const setImportacionId = useCallback((id: string) =>
    dispatch({ type: 'SET_IMPORTACION_ID', id }), [])
  const setAnalisis = useCallback((analisis: AnalisisExcel) =>
    dispatch({ type: 'SET_ANALISIS', analisis }), [])
  const setMapeo = useCallback((
    mapeos: MapeoColumna[],
    columnasSinMapeo: string[],
    camposSinDato: string[],
    confianzaPromedio: number,
    metodo: 'ai' | 'heuristica',
    aiTaskId: string | null,
  ) => dispatch({ type: 'SET_MAPEO', mapeos, columnasSinMapeo, camposSinDato, confianzaPromedio, metodo, aiTaskId }), [])
  const updateMapeo = useCallback((index: number, mapeo: Partial<MapeoColumna>) =>
    dispatch({ type: 'UPDATE_MAPEO', index, mapeo }), [])
  const setResultado = useCallback((resultado: WizardState['resultado']) =>
    dispatch({ type: 'SET_RESULTADO', resultado }), [])

  return {
    state,
    dispatch,
    setLoading,
    setError,
    nextStep,
    prevStep,
    goToStep,
    reset,
    setFile,
    setImportacionId,
    setAnalisis,
    setMapeo,
    updateMapeo,
    setResultado,
  }
}
