import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { compararNombres, armarNombreOficial } from '@/lib/rrhh/utils/comparar-nombres'
import type { EstadoVerificacionIdentidad } from '@/lib/rrhh/types'

// ─── Configuration ───────────────────────────────────────────────────────

const RENIEC_CONFIG = {
  BATCH_SIZE: 5,
  DELAY_BETWEEN_BATCHES_MS: 1000,
  TIMEOUT_PER_REQUEST_MS: 8000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 2000,
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function consultarDocumento(
  baseUrl: string,
  tipo: 'DNI' | 'CE',
  numero: string,
): Promise<{
  success: boolean
  data?: { nombres?: string; apellido_paterno?: string; apellido_materno?: string; apellidos?: string }
  error?: string
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RENIEC_CONFIG.TIMEOUT_PER_REQUEST_MS)

  try {
    const url = `${baseUrl}/api/consulta-documento?tipo=${tipo}&numero=${numero}`
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const result = await response.json()
    return result
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

async function verificarConReintentos(
  baseUrl: string,
  doc: DocumentoVerificar,
): Promise<ResultadoVerificacion> {
  let lastError = ''

  for (let intento = 0; intento <= RENIEC_CONFIG.MAX_RETRIES; intento++) {
    if (intento > 0) {
      await delay(RENIEC_CONFIG.RETRY_DELAY_MS)
    }

    const result = await consultarDocumento(baseUrl, doc.tipo_documento, doc.numero_documento)

    if (result.success && result.data) {
      // Armar nombre oficial
      const nombreOficial = armarNombreOficial(doc.tipo_documento, result.data)

      if (!nombreOficial) {
        return {
          fila_excel: doc.fila_excel,
          tipo_documento: doc.tipo_documento,
          numero_documento: doc.numero_documento,
          estado: 'NO_ENCONTRADO',
          nombre_excel: doc.nombre_excel,
          nombre_oficial: null,
          confianza_nombre: null,
          detalle: 'Documento encontrado pero sin nombre',
        }
      }

      // Comparar nombres
      const comparacion = compararNombres(doc.nombre_excel, nombreOficial)

      let estado: EstadoVerificacionIdentidad
      if (comparacion.confianza >= 0.75 && comparacion.coincide) {
        estado = 'VERIFICADO'
      } else if (comparacion.confianza >= 0.50) {
        estado = 'NOMBRE_REVISAR'
      } else {
        estado = 'NOMBRE_NO_COINCIDE'
      }

      return {
        fila_excel: doc.fila_excel,
        tipo_documento: doc.tipo_documento,
        numero_documento: doc.numero_documento,
        estado,
        nombre_excel: doc.nombre_excel,
        nombre_oficial: nombreOficial,
        confianza_nombre: comparacion.confianza,
        detalle: comparacion.detalle,
      }
    }

    if (!result.success) {
      // Check if document was not found (not an API error)
      if (result.error?.includes('no encontrado') || result.error?.includes('not found')) {
        return {
          fila_excel: doc.fila_excel,
          tipo_documento: doc.tipo_documento,
          numero_documento: doc.numero_documento,
          estado: 'NO_ENCONTRADO',
          nombre_excel: doc.nombre_excel,
          nombre_oficial: null,
          confianza_nombre: null,
          detalle: 'Documento no encontrado en registros oficiales',
        }
      }
      lastError = result.error || 'Error desconocido'
    }
  }

  // All retries failed
  return {
    fila_excel: doc.fila_excel,
    tipo_documento: doc.tipo_documento,
    numero_documento: doc.numero_documento,
    estado: 'ERROR_API',
    nombre_excel: doc.nombre_excel,
    nombre_oficial: null,
    confianza_nombre: null,
    detalle: `Error después de ${RENIEC_CONFIG.MAX_RETRIES + 1} intentos: ${lastError}`,
  }
}

// ─── Main Handler (SSE Stream) ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { importacion_id, documentos } = body as {
      importacion_id: string
      documentos: DocumentoVerificar[]
    }

    if (!importacion_id || !documentos?.length) {
      return new Response(
        JSON.stringify({ error: 'Parámetros requeridos: importacion_id, documentos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Get base URL for internal API call
    const baseUrl = request.nextUrl.origin

    // Deduplicar documentos (mismo DNI puede aparecer en múltiples filas)
    const docMap = new Map<string, DocumentoVerificar[]>()
    for (const doc of documentos) {
      const key = `${doc.tipo_documento}-${doc.numero_documento}`
      if (!docMap.has(key)) docMap.set(key, [])
      docMap.get(key)!.push(doc)
    }

    const uniqueDocs: DocumentoVerificar[] = []
    for (const [, docs] of docMap) {
      uniqueDocs.push(docs[0])
    }

    // Log to ai_tasks
    await supabase.from('ai_tasks').insert({
      tipo: 'VERIFICACION_IDENTIDAD',
      modulo: 'RRHH',
      estado: 'PROCESSING',
      prompt_version: '1.0',
      tokens_input: uniqueDocs.length,
      metadata: {
        importacion_id,
        total_documentos: documentos.length,
        documentos_unicos: uniqueDocs.length,
      },
    })

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const resultados: ResultadoVerificacion[] = []
        let processed = 0

        // Process in batches
        for (let i = 0; i < uniqueDocs.length; i += RENIEC_CONFIG.BATCH_SIZE) {
          const batch = uniqueDocs.slice(i, i + RENIEC_CONFIG.BATCH_SIZE)

          // Execute batch concurrently
          const batchResults = await Promise.all(
            batch.map(doc => verificarConReintentos(baseUrl, doc)),
          )

          // Expand results for duplicate documents
          for (const result of batchResults) {
            const key = `${result.tipo_documento}-${result.numero_documento}`
            const allDocs = docMap.get(key) || [{ fila_excel: result.fila_excel }]

            for (const doc of allDocs) {
              const expandedResult = { ...result, fila_excel: doc.fila_excel }
              resultados.push(expandedResult)

              // Send SSE event
              const event = `data: ${JSON.stringify({
                type: 'resultado',
                data: expandedResult,
                progreso: {
                  procesados: ++processed,
                  total: documentos.length,
                  porcentaje: Math.round((processed / documentos.length) * 100),
                },
              })}\n\n`
              controller.enqueue(encoder.encode(event))
            }
          }

          // Delay between batches (except for the last one)
          if (i + RENIEC_CONFIG.BATCH_SIZE < uniqueDocs.length) {
            await delay(RENIEC_CONFIG.DELAY_BETWEEN_BATCHES_MS)
          }
        }

        // Send summary
        const resumen = {
          total: resultados.length,
          verificados: resultados.filter(r => r.estado === 'VERIFICADO').length,
          nombre_revisar: resultados.filter(r => r.estado === 'NOMBRE_REVISAR').length,
          nombre_no_coincide: resultados.filter(r => r.estado === 'NOMBRE_NO_COINCIDE').length,
          no_encontrado: resultados.filter(r => r.estado === 'NO_ENCONTRADO').length,
          error_api: resultados.filter(r => r.estado === 'ERROR_API').length,
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'resumen', data: resumen })}\n\n`),
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error en verificación de identidad:', error)
    return new Response(
      JSON.stringify({ error: 'Error interno en verificación de identidad' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
