// ═══════════════════════════════════════════════════════════════════════
// AI Prompt — Importación RRHH: Mapeo de Columnas Excel → BD
// Extracted from app/api/rrhh/importacion/mapear/route.ts
// ═══════════════════════════════════════════════════════════════════════

import { CAMPOS_DESTINO } from '@/lib/rrhh/types'

// ─── Types ───────────────────────────────────────────────────────────

export interface MapeoResultado {
  columna_origen: string
  campo_destino: string
  confianza: number
  transformacion: 'CONCATENAR' | 'NORMALIZAR_ENUM' | 'SPLIT' | 'FECHA' | null
  notas: string | null
  metodo: 'ai' | 'heuristica'
}

interface ColumnaInfo {
  nombre: string
  tipo: string
  muestra: string[]
  pct_lleno: number
}

interface CampoDestinoInfo {
  campo: string
  label: string
  tipo: string
  requerido: boolean
}

// ─── Prompt ──────────────────────────────────────────────────────────

export const PROMPT_VERSION = '1.0'

export const SYSTEM_PROMPT = 'Eres un experto en mapeo de datos de recursos humanos en el contexto peruano.'

export function buildUserPrompt(params: {
  columnasInfo: ColumnaInfo[]
  camposDestino: CampoDestinoInfo[]
}): string {
  return `Dado las siguientes columnas de un Excel con datos de colaboradores:
${JSON.stringify(params.columnasInfo, null, 2)}

Y los siguientes campos destino en la base de datos:
${JSON.stringify(params.camposDestino, null, 2)}

Mapea cada columna del Excel al campo destino más apropiado. Responde SOLO con un JSON array donde cada elemento tiene:
- "columna_origen": nombre exacto de la columna del Excel
- "campo_destino": campo destino (formato "tabla.columna") o null si no hay match
- "confianza": número 0-100
- "transformacion": "NORMALIZAR_ENUM" | "FECHA" | "CONCATENAR" | "SPLIT" | null
- "notas": observación breve o null

Contexto peruano: DNI=8 dígitos, CCI=20 dígitos, Distrito=subdivisión de Lima/provincias. Los campos de cesados (fecha_cese, motivo_cese) pueden estar en columnas como "fecha baja", "motivo salida", etc.

Responde SOLO con el JSON array, sin explicación adicional.`
}

// ─── Response Parser ─────────────────────────────────────────────────

export function parseAIResponse(text: string): MapeoResultado[] | null {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      columna_origen: string
      campo_destino: string | null
      confianza: number
      transformacion: string | null
      notas: string | null
    }>

    const validCampos = new Set(CAMPOS_DESTINO.map(c => c.campo))

    return parsed
      .filter(m => m.campo_destino && validCampos.has(m.campo_destino))
      .map(m => ({
        columna_origen: m.columna_origen,
        campo_destino: m.campo_destino!,
        confianza: m.confianza,
        transformacion: m.transformacion as MapeoResultado['transformacion'],
        notas: m.notas,
        metodo: 'ai' as const,
      }))
  } catch {
    return null
  }
}

// ─── Helper: Build camposDestino from CAMPOS_DESTINO ─────────────────

export function getCamposDestinoInfo(): CampoDestinoInfo[] {
  return CAMPOS_DESTINO.map(c => ({
    campo: c.campo,
    label: c.label,
    tipo: c.tipo,
    requerido: c.requerido,
  }))
}
