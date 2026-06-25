import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CAMPOS_DESTINO, FIELD_ALIASES } from '@/lib/rrhh/types'
import type { ColumnaDetectada } from '@/lib/rrhh/interfaces'
import stringSimilarity from 'string-similarity'
import { runAITask } from '@/lib/ai/task-runner'
import {
  type MapeoResultado,
  SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserPrompt,
  parseAIResponse,
  getCamposDestinoInfo,
} from '@/lib/ai/prompts/rrhh/importacion-mapeo'

// ─── Heuristic Mapping ────────────────────────────────────────────────

function mapeoHeuristico(columnas: ColumnaDetectada[]): {
  mapeos: MapeoResultado[]
  columnasSinMapeo: string[]
  camposSinDato: string[]
} {
  const mapeos: MapeoResultado[] = []
  const camposMapeados = new Set<string>()

  for (const col of columnas) {
    const normalizado = col.nombre_original.toLowerCase().replace(/[_\-\.]/g, ' ').trim()
    let bestMatch: { campo: string; score: number } | null = null

    // 1. Exact alias match
    for (const [campo, aliases] of Object.entries(FIELD_ALIASES)) {
      for (const alias of aliases) {
        if (normalizado === alias.toLowerCase()) {
          bestMatch = { campo, score: 100 }
          break
        }
      }
      if (bestMatch?.score === 100) break
    }

    // 2. Fuzzy match against aliases
    if (!bestMatch || bestMatch.score < 90) {
      for (const [campo, aliases] of Object.entries(FIELD_ALIASES)) {
        for (const alias of aliases) {
          const similarity = stringSimilarity.compareTwoStrings(normalizado, alias.toLowerCase())
          const score = Math.round(similarity * 100)
          if (score > (bestMatch?.score || 0)) {
            bestMatch = { campo, score }
          }
        }
      }
    }

    // 3. Fuzzy match against campo labels
    if (!bestMatch || bestMatch.score < 60) {
      for (const campoDestino of CAMPOS_DESTINO) {
        const similarity = stringSimilarity.compareTwoStrings(
          normalizado,
          campoDestino.label.toLowerCase(),
        )
        const score = Math.round(similarity * 100)
        if (score > (bestMatch?.score || 0)) {
          bestMatch = { campo: campoDestino.campo, score }
        }
      }
    }

    if (bestMatch && bestMatch.score >= 40 && !camposMapeados.has(bestMatch.campo)) {
      const campoDef = CAMPOS_DESTINO.find(c => c.campo === bestMatch!.campo)
      let transformacion: MapeoResultado['transformacion'] = null
      if (campoDef?.tipo === 'enum') transformacion = 'NORMALIZAR_ENUM'
      if (campoDef?.tipo === 'fecha' && col.tipo_inferido !== 'fecha') transformacion = 'FECHA'

      mapeos.push({
        columna_origen: col.nombre_original,
        campo_destino: bestMatch.campo,
        confianza: bestMatch.score,
        transformacion,
        notas: null,
        metodo: 'heuristica',
      })
      camposMapeados.add(bestMatch.campo)
    }
  }

  const columnasSinMapeo = columnas
    .map(c => c.nombre_original)
    .filter(nombre => !mapeos.some(m => m.columna_origen === nombre))

  const camposSinDato = CAMPOS_DESTINO
    .map(c => c.campo)
    .filter(campo => !camposMapeados.has(campo))

  return { mapeos, columnasSinMapeo, camposSinDato }
}

// ─── AI Mapping ───────────────────────────────────────────────────────

async function mapeoConAI(
  columnas: ColumnaDetectada[],
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
): Promise<{ mapeos: MapeoResultado[]; aiTaskId: string | null }> {
  const columnasInfo = columnas.map(c => ({
    nombre: c.nombre_original,
    tipo: c.tipo_inferido,
    muestra: c.valores_muestra.slice(0, 3),
    pct_lleno: c.porcentaje_lleno,
  }))

  const result = await runAITask({
    supabase,
    tipo: 'IMPORTACION_MAPEO',
    modulo: 'IMPORTACION',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt({
      columnasInfo,
      camposDestino: getCamposDestinoInfo(),
    }),
    promptVersion: PROMPT_VERSION,
  })

  if (!result.success) {
    return { mapeos: [], aiTaskId: null }
  }

  const mapeos = parseAIResponse(result.text)
  return {
    mapeos: mapeos || [],
    aiTaskId: result.taskId,
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const columnas: ColumnaDetectada[] = body.columnas
    const importacionId: string | undefined = body.importacion_id

    if (!columnas || !Array.isArray(columnas) || columnas.length === 0) {
      return NextResponse.json({ error: 'Se requieren columnas detectadas' }, { status: 400 })
    }

    const supabase = await createClient()

    // Try AI mapping first
    const aiResult = await mapeoConAI(columnas, supabase)

    let mapeoFinal: MapeoResultado[]
    let metodo: 'ai' | 'heuristica'

    if (aiResult.mapeos.length > 0) {
      mapeoFinal = aiResult.mapeos
      metodo = 'ai'
    } else {
      // Fallback to heuristic
      const heuristico = mapeoHeuristico(columnas)
      mapeoFinal = heuristico.mapeos
      metodo = 'heuristica'
    }

    // Calculate unmapped columns and fields
    const columnasMapeadas = new Set(mapeoFinal.map(m => m.columna_origen))
    const camposMapeados = new Set(mapeoFinal.map(m => m.campo_destino))

    const columnasSinMapeo = columnas
      .map(c => c.nombre_original)
      .filter(n => !columnasMapeadas.has(n))

    const camposSinDato = CAMPOS_DESTINO
      .map(c => c.campo)
      .filter(c => !camposMapeados.has(c))

    const confianzaPromedio = mapeoFinal.length > 0
      ? Math.round(mapeoFinal.reduce((sum, m) => sum + m.confianza, 0) / mapeoFinal.length)
      : 0

    // Update importacion record if ID provided
    if (importacionId) {
      await supabase
        .from('importaciones_rrhh')
        .update({
          mapeo_columnas: {
            mapeos: mapeoFinal,
            columnas_sin_mapeo: columnasSinMapeo,
            campos_sin_dato: camposSinDato,
          },
          mapeo_ai_task_id: aiResult.aiTaskId,
          mapeo_confianza_promedio: confianzaPromedio,
          estado: 'MAPEADO',
        })
        .eq('id', importacionId)
    }

    return NextResponse.json({
      mapeos: mapeoFinal,
      columnas_sin_mapeo: columnasSinMapeo,
      campos_sin_dato: camposSinDato,
      confianza_promedio: confianzaPromedio,
      metodo,
      ai_task_id: aiResult.aiTaskId,
    })
  } catch (error) {
    console.error('Error en mapeo:', error)
    return NextResponse.json({ error: 'Error al mapear columnas' }, { status: 500 })
  }
}
