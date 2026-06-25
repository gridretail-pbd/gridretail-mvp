'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import type { Usuario } from '@/types'

import { ProgressWizard } from './components/ProgressWizard'
import { StepSubida } from './components/StepSubida'
import { StepAnalisis } from './components/StepAnalisis'
import { StepMapeo } from './components/StepMapeo'
import { StepValidacion } from './components/StepValidacion'
import { StepRevision } from './components/StepRevision'
import { StepResultado } from './components/StepResultado'
import ModalResolucionIdentidad from './components/ModalResolucionIdentidad'
import { useWizardImportacion } from './hooks/useWizardImportacion'
import { useMapeoAI } from './hooks/useMapeoAI'
import { useVerificacionIdentidad } from './hooks/useVerificacionIdentidad'

export default function ImportacionPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const {
    state,
    dispatch,
    setLoading,
    setError,
    nextStep,
    prevStep,
    reset,
    setFile,
    setImportacionId,
    setAnalisis,
    setMapeo,
    updateMapeo,
    setResultado,
  } = useWizardImportacion()

  const { ejecutarMapeo, loading: mapeoLoading } = useMapeoAI()

  const verificacion = useVerificacionIdentidad()
  const [filaResolviendo, setFilaResolviendo] = useState<number | null>(null)

  // Auth guard
  useEffect(() => {
    const u = getUsuarioFromLocalStorage()
    if (!u) {
      router.push('/login')
      return
    }
    if (!puedeGestionarRRHH(u.rol)) {
      router.push('/rrhh')
      return
    }
    setUsuario(u)
  }, [router])

  // ─── Step 1 → 2: Analyze file ──────────────────────────────────────

  const handleAnalizar = useCallback(async () => {
    if (!state.file) return
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', state.file)

      const res = await fetch('/api/rrhh/importacion/analizar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al analizar el archivo')
      }

      const data = await res.json()
      setAnalisis({
        hojas: data.hojas,
        hoja_seleccionada: data.hoja_seleccionada,
        fila_encabezados: data.fila_encabezados,
        total_filas_datos: data.total_filas_datos,
        columnas_detectadas: data.columnas_detectadas,
        preview_datos: data.preview_datos,
      })

      // Create importacion record in DB
      const createRes = await fetch('/api/rrhh/importacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivo_nombre: state.file.name,
          archivo_url: `imports/rrhh/${Date.now()}_${state.file.name}`,
          archivo_tipo: state.file.name.split('.').pop()?.toLowerCase(),
          archivo_tamano_bytes: state.file.size,
          total_filas_datos: data.total_filas_datos,
          hoja_procesada: data.hoja_seleccionada,
          fila_encabezados: data.fila_encabezados,
        }),
      })

      if (createRes.ok) {
        const created = await createRes.json()
        if (created.importacion?.id) {
          setImportacionId(created.importacion.id)
        }
      }

      setLoading(false)
      nextStep()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    }
  }, [state.file, setLoading, setError, setAnalisis, setImportacionId, nextStep])

  // ─── Step 2 → 3: Run mapping ──────────────────────────────────────

  const handleMapear = useCallback(async () => {
    if (!state.analisis) return
    setLoading(true)

    const result = await ejecutarMapeo(
      state.analisis.columnas_detectadas,
      state.importacionId || undefined,
    )

    if (result) {
      setMapeo(
        result.mapeos,
        result.columnas_sin_mapeo,
        result.campos_sin_dato,
        result.confianza_promedio,
        result.metodo,
        result.ai_task_id,
      )
      setLoading(false)
      nextStep()
    } else {
      setError('No se pudo mapear las columnas. Intenta de nuevo.')
    }
  }, [state.analisis, state.importacionId, ejecutarMapeo, setLoading, setError, setMapeo, nextStep])

  // ─── Step 3: Update individual mapping ────────────────────────────

  const handleUpdateMapeo = useCallback((index: number, campoDestino: string | null) => {
    if (index === -1) return
    if (campoDestino === null) {
      updateMapeo(index, { campo_destino: '', confianza: 0 })
    } else {
      updateMapeo(index, { campo_destino: campoDestino, confianza: 100 })
    }
  }, [updateMapeo])

  // ─── Step 3 → 4: Confirm mapping + validate ──────────────────────

  const handleConfirmarMapeo = useCallback(async () => {
    if (!state.file || !state.analisis) {
      nextStep()
      return
    }

    setLoading(true)
    try {
      // Save mapping to DB
      if (state.importacionId) {
        const validMapeos = state.mapeos.filter(m => m.campo_destino)
        await fetch(`/api/rrhh/importacion?id=${state.importacionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapeo_columnas: {
              mapeos: validMapeos,
              columnas_sin_mapeo: state.columnasSinMapeo,
              campos_sin_dato: state.camposSinDato,
            },
            estado: 'MAPEADO',
          }),
        })
      }

      // Run validation
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('mapeos', JSON.stringify(state.mapeos.filter(m => m.campo_destino)))
      formData.append('hoja_procesada', state.analisis.hoja_seleccionada)
      formData.append('fila_encabezados', String(state.analisis.fila_encabezados))
      if (state.importacionId) {
        formData.append('importacion_id', state.importacionId)
      }

      const res = await fetch('/api/rrhh/importacion/validar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al validar')
      }

      const data = await res.json()

      dispatch({
        type: 'SET_VALIDACION',
        detalleFilas: data.detalle_filas,
        reporteBrechas: data.reporte_brechas,
      })

      setLoading(false)
      nextStep()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    }
  }, [state.file, state.analisis, state.importacionId, state.mapeos, state.columnasSinMapeo, state.camposSinDato, dispatch, setLoading, setError, nextStep])

  // ─── Step 5 → 6: Execute import ──────────────────────────────────

  const handleEjecutar = useCallback(async () => {
    if (!state.importacionId || state.filasIncluidas.length === 0) return
    setLoading(true)

    try {
      const res = await fetch('/api/rrhh/importacion/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importacion_id: state.importacionId,
          filas_incluidas: state.filasIncluidas,
          ejecutado_por: usuario?.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al ejecutar la importación')
      }

      const data = await res.json()
      setResultado(data.resultado)
      setLoading(false)
      nextStep()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    }
  }, [state.importacionId, state.filasIncluidas, usuario, setLoading, setError, setResultado, nextStep])

  // ─── Step 5: Toggle rows ──────────────────────────────────────────

  const handleToggleFila = useCallback((fila: number) => {
    dispatch({ type: 'TOGGLE_FILA', fila })
  }, [dispatch])

  const handleSetFilasIncluidas = useCallback((filas: number[]) => {
    dispatch({ type: 'SET_FILAS_INCLUIDAS', filas })
  }, [dispatch])

  // ─── RENIEC Verification handlers ─────────────────────────────────

  const handleIniciarVerificacion = useCallback(async () => {
    if (!state.importacionId || !state.validacion) return
    const filasActualizadas = await verificacion.ejecutarVerificacion(
      state.importacionId,
      state.validacion.detalleFilas,
    )
    dispatch({ type: 'SET_VALIDACION', detalleFilas: filasActualizadas, reporteBrechas: state.validacion.reporteBrechas })
  }, [state.importacionId, state.validacion, verificacion, dispatch])

  const handleReintentarErrores = useCallback(async () => {
    if (!state.importacionId || !state.validacion) return
    const filasActualizadas = await verificacion.reintentarErrores(
      state.importacionId,
      state.validacion.detalleFilas,
    )
    dispatch({ type: 'SET_VALIDACION', detalleFilas: filasActualizadas, reporteBrechas: state.validacion.reporteBrechas })
  }, [state.importacionId, state.validacion, verificacion, dispatch])

  const handleUsarNombreOficial = useCallback((filaExcel: number) => {
    if (!state.validacion) return
    const filasActualizadas = verificacion.usarNombreOficial(state.validacion.detalleFilas, filaExcel)
    dispatch({ type: 'SET_VALIDACION', detalleFilas: filasActualizadas, reporteBrechas: state.validacion.reporteBrechas })
  }, [state.validacion, verificacion, dispatch])

  const handleConfirmarManualmente = useCallback((filaExcel: number, justificacion: string) => {
    if (!state.validacion) return
    const filasActualizadas = verificacion.confirmarManualmente(state.validacion.detalleFilas, filaExcel, justificacion)
    dispatch({ type: 'SET_VALIDACION', detalleFilas: filasActualizadas, reporteBrechas: state.validacion.reporteBrechas })
  }, [state.validacion, verificacion, dispatch])

  // ─── Render ────────────────────────────────────────────────────────

  if (!usuario) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importación de Colaboradores</h1>
        <p className="text-sm text-gray-500">
          Importa tu base de colaboradores desde un archivo Excel.
        </p>
      </div>

      {state.step < 5 && <ProgressWizard currentStep={state.step} />}

      {state.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {/* Step 0: Subida */}
      {state.step === 0 && (
        <StepSubida
          onFileSelect={setFile}
          selectedFile={state.file}
          loading={state.loading}
          error={null}
          onNext={handleAnalizar}
        />
      )}

      {/* Step 1: Análisis */}
      {state.step === 1 && state.analisis && (
        <StepAnalisis
          analisis={state.analisis}
          onPrev={prevStep}
          onNext={handleMapear}
          loading={state.loading || mapeoLoading}
        />
      )}

      {/* Step 2: Mapeo */}
      {state.step === 2 && state.analisis && (
        <StepMapeo
          columnas={state.analisis.columnas_detectadas}
          mapeos={state.mapeos}
          columnasSinMapeo={state.columnasSinMapeo}
          camposSinDato={state.camposSinDato}
          confianzaPromedio={state.confianzaPromedio}
          metodo={state.mapeoMetodo}
          onUpdateMapeo={handleUpdateMapeo}
          onPrev={prevStep}
          onNext={handleConfirmarMapeo}
          loading={state.loading}
        />
      )}

      {/* Step 3: Validación */}
      {state.step === 3 && state.validacion && (
        <StepValidacion
          detalleFilas={state.validacion.detalleFilas}
          reporteBrechas={state.validacion.reporteBrechas}
          onPrev={prevStep}
          onNext={nextStep}
          loading={state.loading}
          verificacion={{
            ejecutando: verificacion.ejecutando,
            progreso: verificacion.progreso,
            resumen: verificacion.resumen,
            error: verificacion.error,
            onIniciar: handleIniciarVerificacion,
            onReintentarErrores: handleReintentarErrores,
            onResolverFila: (fila) => setFilaResolviendo(fila),
            puedeContinuar: verificacion.puedeContinuar(state.validacion.detalleFilas),
          }}
        />
      )}

      {/* Step 4: Revisión */}
      {state.step === 4 && state.validacion && (
        <StepRevision
          detalleFilas={state.validacion.detalleFilas}
          filasIncluidas={state.filasIncluidas}
          onToggleFila={handleToggleFila}
          onSetFilasIncluidas={handleSetFilasIncluidas}
          onPrev={prevStep}
          onNext={handleEjecutar}
          loading={state.loading}
        />
      )}

      {/* Step 5: Resultado */}
      {state.step === 5 && state.resultado && (
        <StepResultado
          resultado={state.resultado}
          importacionId={state.importacionId}
          onNuevaImportacion={reset}
          onIrAlertAs={() => router.push('/rrhh/alertas')}
          onIrColaboradores={() => router.push('/rrhh/colaboradores')}
        />
      )}

      {/* Modal: Resolución de identidad */}
      <ModalResolucionIdentidad
        fila={filaResolviendo !== null && state.validacion
          ? state.validacion.detalleFilas.find(f => f.fila_excel === filaResolviendo) || null
          : null}
        open={filaResolviendo !== null}
        onClose={() => setFilaResolviendo(null)}
        onUsarNombreOficial={handleUsarNombreOficial}
        onConfirmarManualmente={handleConfirmarManualmente}
      />
    </div>
  )
}
