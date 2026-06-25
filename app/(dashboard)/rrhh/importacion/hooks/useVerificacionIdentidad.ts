'use client'

import { useState, useCallback, useRef } from 'react'
import type { EstadoVerificacionIdentidad } from '@/lib/rrhh/types'
import type { DetalleFilaImportacion, VerificacionIdentidadFila } from '@/lib/rrhh/interfaces'

interface DocumentoVerificar {
  fila_excel: number
  tipo_documento: 'DNI' | 'CE'
  numero_documento: string
  nombre_excel: string
}

interface ResultadoVerificacion {
  fila_excel: number
  tipo_documento: 'DNI' | 'CE'
  numero_documento: string
  estado: EstadoVerificacionIdentidad
  nombre_excel: string
  nombre_oficial: string | null
  confianza_nombre: number | null
  detalle: string
}

interface ResumenVerificacion {
  total: number
  verificados: number
  nombre_revisar: number
  nombre_no_coincide: number
  no_encontrado: number
  error_api: number
}

interface VerificacionState {
  ejecutando: boolean
  progreso: { procesados: number; total: number; porcentaje: number }
  resultados: Map<number, ResultadoVerificacion>
  resumen: ResumenVerificacion | null
  error: string | null
}

/**
 * Hook para manejar la verificación de identidad RENIEC/Migraciones
 * via Server-Sent Events. Procesa documentos en batch y actualiza
 * el estado en tiempo real.
 */
export function useVerificacionIdentidad() {
  const [state, setState] = useState<VerificacionState>({
    ejecutando: false,
    progreso: { procesados: 0, total: 0, porcentaje: 0 },
    resultados: new Map(),
    resumen: null,
    error: null,
  })

  const abortRef = useRef<AbortController | null>(null)

  /**
   * Prepara los documentos a verificar a partir de las filas validadas.
   * Solo incluye filas con DNI/CE válido (formato correcto).
   */
  const prepararDocumentos = useCallback(
    (filas: DetalleFilaImportacion[]): DocumentoVerificar[] => {
      const docs: DocumentoVerificar[] = []
      for (const fila of filas) {
        if (fila.estado === 'ERROR') continue
        const dni = fila.dni
        if (!dni) continue

        // Detect document type from mapped data or length
        const tipoDoc = fila.datos_mapeados?.['usuarios_rrhh.tipo_documento']
        let tipo: 'DNI' | 'CE' = 'DNI'

        if (tipoDoc === 'CE' || (!tipoDoc && dni.length === 9)) {
          tipo = 'CE'
        }

        // Validate format
        if (tipo === 'DNI' && !/^\d{8}$/.test(dni)) continue
        if (tipo === 'CE' && !/^\d{9}$/.test(dni)) continue

        docs.push({
          fila_excel: fila.fila_excel,
          tipo_documento: tipo,
          numero_documento: dni,
          nombre_excel: fila.nombre,
        })
      }
      return docs
    },
    [],
  )

  /**
   * Ejecuta la verificación de identidad vía SSE.
   * Retorna las filas actualizadas con la información de verificación.
   */
  const ejecutarVerificacion = useCallback(
    async (
      importacionId: string,
      filas: DetalleFilaImportacion[],
    ): Promise<DetalleFilaImportacion[]> => {
      const documentos = prepararDocumentos(filas)

      if (documentos.length === 0) {
        setState(prev => ({
          ...prev,
          error: 'No hay documentos válidos para verificar',
        }))
        return filas
      }

      abortRef.current = new AbortController()

      setState({
        ejecutando: true,
        progreso: { procesados: 0, total: documentos.length, porcentaje: 0 },
        resultados: new Map(),
        resumen: null,
        error: null,
      })

      try {
        const response = await fetch('/api/rrhh/importacion/verificar-identidad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importacion_id: importacionId, documentos }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No se pudo leer la respuesta')

        const decoder = new TextDecoder()
        let buffer = ''
        const resultadosMap = new Map<number, ResultadoVerificacion>()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'resultado') {
                const resultado = event.data as ResultadoVerificacion
                resultadosMap.set(resultado.fila_excel, resultado)
                setState(prev => ({
                  ...prev,
                  progreso: event.progreso,
                  resultados: new Map(resultadosMap),
                }))
              } else if (event.type === 'resumen') {
                setState(prev => ({
                  ...prev,
                  resumen: event.data as ResumenVerificacion,
                }))
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Apply results to filas
        const filasActualizadas = filas.map(fila => {
          const resultado = resultadosMap.get(fila.fila_excel)
          if (!resultado) return { ...fila, verificacion_identidad: null }

          const verificacion: VerificacionIdentidadFila = {
            estado: resultado.estado,
            nombre_oficial: resultado.nombre_oficial,
            confianza_nombre: resultado.confianza_nombre,
            confirmado_manualmente: false,
            justificacion_manual: null,
          }

          return { ...fila, verificacion_identidad: verificacion }
        })

        setState(prev => ({ ...prev, ejecutando: false }))
        return filasActualizadas
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error desconocido'
        if (msg !== 'The operation was aborted.') {
          setState(prev => ({
            ...prev,
            ejecutando: false,
            error: `Error en verificación: ${msg}`,
          }))
        }
        return filas
      }
    },
    [prepararDocumentos],
  )

  /**
   * Reintenta la verificación solo para los documentos con ERROR_API.
   */
  const reintentarErrores = useCallback(
    async (
      importacionId: string,
      filas: DetalleFilaImportacion[],
    ): Promise<DetalleFilaImportacion[]> => {
      const filasConError = filas.filter(
        f => f.verificacion_identidad?.estado === 'ERROR_API',
      )
      if (filasConError.length === 0) return filas

      const nuevosResultados = await ejecutarVerificacion(importacionId, filasConError)

      // Merge with original filas
      const resultadoMap = new Map(
        nuevosResultados.map(f => [f.fila_excel, f]),
      )
      return filas.map(f => resultadoMap.get(f.fila_excel) || f)
    },
    [ejecutarVerificacion],
  )

  /**
   * Confirma manualmente una fila con estado NOMBRE_NO_COINCIDE o NO_ENCONTRADO.
   */
  const confirmarManualmente = useCallback(
    (
      filas: DetalleFilaImportacion[],
      filaExcel: number,
      justificacion: string,
    ): DetalleFilaImportacion[] => {
      return filas.map(fila => {
        if (fila.fila_excel !== filaExcel) return fila
        if (!fila.verificacion_identidad) return fila

        return {
          ...fila,
          verificacion_identidad: {
            ...fila.verificacion_identidad,
            confirmado_manualmente: true,
            justificacion_manual: justificacion,
          },
        }
      })
    },
    [],
  )

  /**
   * Usa el nombre de RENIEC en lugar del nombre del Excel.
   */
  const usarNombreOficial = useCallback(
    (
      filas: DetalleFilaImportacion[],
      filaExcel: number,
    ): DetalleFilaImportacion[] => {
      return filas.map(fila => {
        if (fila.fila_excel !== filaExcel) return fila
        if (!fila.verificacion_identidad?.nombre_oficial) return fila

        return {
          ...fila,
          nombre: fila.verificacion_identidad.nombre_oficial,
          datos_mapeados: {
            ...fila.datos_mapeados,
            'usuarios.nombre_completo': fila.verificacion_identidad.nombre_oficial,
          },
          verificacion_identidad: {
            ...fila.verificacion_identidad,
            estado: 'VERIFICADO' as const,
            confianza_nombre: 1.0,
          },
        }
      })
    },
    [],
  )

  const cancelar = useCallback(() => {
    abortRef.current?.abort()
    setState(prev => ({ ...prev, ejecutando: false }))
  }, [])

  /**
   * Checks if all blocking issues are resolved (confirmed manually or corrected).
   */
  const puedeContinuar = useCallback(
    (filas: DetalleFilaImportacion[]): boolean => {
      return filas.every(fila => {
        if (!fila.verificacion_identidad) return true
        const { estado, confirmado_manualmente } = fila.verificacion_identidad
        if (estado === 'VERIFICADO' || estado === 'NOMBRE_REVISAR' || estado === 'ERROR_API' || estado === 'SIN_DOCUMENTO') {
          return true
        }
        // NOMBRE_NO_COINCIDE and NO_ENCONTRADO require manual confirmation
        return confirmado_manualmente
      })
    },
    [],
  )

  return {
    ...state,
    ejecutarVerificacion,
    reintentarErrores,
    confirmarManualmente,
    usarNombreOficial,
    cancelar,
    puedeContinuar,
    prepararDocumentos,
  }
}
