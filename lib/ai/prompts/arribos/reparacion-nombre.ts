// ═══════════════════════════════════════════════════════════════════════
// Reparación de nombres RENIEC con caracteres especiales perdidos
//
// json.pe devuelve los nombres con el carácter de reemplazo U+FFFD ('�')
// en lugar de las letras españolas que perdió en su pipeline (tildes, ñ, ü).
// La información original es irrecuperable desde la respuesta, pero como el
// conjunto de letras posibles es pequeño y el contexto del nombre desambigua,
// un modelo barato (Haiku) puede restaurar la letra correcta con alta fiabilidad.
//
// Salvaguarda anti-alucinación: validamos que el modelo SOLO haya reemplazado
// las posiciones del '�' por una letra especial española y no haya tocado
// ningún otro carácter (misma longitud, mismos caracteres en el resto). Si la
// salida no cumple la máscara, se descarta y se conserva el valor original.
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import { runAITask } from '@/lib/ai/task-runner'

export const REPLACEMENT_CHAR = '�' // '�'

// Letras españolas que un '�' puede representar (mayúsculas y minúsculas).
const SPANISH_SPECIAL = 'ÁÉÍÓÚÑÜáéíóúñü'

export const SYSTEM_PROMPT_REPARACION = `Eres un corrector ortográfico de nombres propios peruanos del registro RENIEC.
Recibes nombres y apellidos en MAYÚSCULAS donde el carácter '${REPLACEMENT_CHAR}' reemplaza a una única letra española que se perdió. Esa letra SOLO puede ser una vocal con tilde (Á, É, Í, Ó, Ú), una eñe (Ñ) o una u con diéresis (Ü).

Tu única tarea es reemplazar cada '${REPLACEMENT_CHAR}' por la letra correcta según la ortografía del nombre.

REGLAS ESTRICTAS:
1. Cada '${REPLACEMENT_CHAR}' representa una letra ACENTUADA o especial (Á É Í Ó Ú Ñ Ü) y debe reemplazarse por esa letra acentuada, nunca por su versión simple.
2. NO cambies ninguna otra letra: todo lo que no sea '${REPLACEMENT_CHAR}' queda idéntico (no agregues tildes en otras posiciones).
3. NO agregues ni elimines caracteres: cada '${REPLACEMENT_CHAR}' se reemplaza por EXACTAMENTE una letra.
4. Conserva las MAYÚSCULAS.
5. Si no estás seguro de la letra, elige la más probable; nunca dejes un '${REPLACEMENT_CHAR}'.

Devuelve SOLAMENTE un arreglo JSON de strings en el mismo orden recibido, sin explicaciones ni texto adicional. Ejemplo de entrada ["MART${REPLACEMENT_CHAR}N","MU${REPLACEMENT_CHAR}OZ"] → salida ["MARTÍN","MUÑOZ"].`

export function buildUserPromptReparacion(valores: string[]): string {
  return JSON.stringify(valores)
}

/**
 * Construye una máscara regex a partir del valor original: cada carácter es
 * literal salvo '�', que admite exactamente una letra especial española.
 * Una reparación es válida solo si calza exactamente con esta máscara.
 */
function buildMask(original: string): RegExp {
  const escapeRe = /[.*+?^${}()|[\]\\]/g
  const pattern = [...original]
    .map((ch) =>
      ch === REPLACEMENT_CHAR
        ? `[${SPANISH_SPECIAL}]`
        : ch.replace(escapeRe, '\\$&'),
    )
    .join('')
  return new RegExp(`^${pattern}$`)
}

/** Extrae el primer arreglo JSON de strings que aparezca en el texto. */
function parseArray(text: string): string[] | null {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (
      Array.isArray(parsed) &&
      parsed.every((v) => typeof v === 'string')
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export interface NombreReparado {
  nombres: string
  apellido_paterno: string
  apellido_materno: string
}

/**
 * Repara los campos que contengan '�' usando un modelo económico.
 * Cualquier fallo (IA deshabilitada, error, salida inválida) degrada de forma
 * segura devolviendo los valores originales sin romper la consulta de documento.
 */
export async function repararNombresRENIEC(
  supabase: SupabaseClient,
  fields: NombreReparado,
): Promise<NombreReparado> {
  const keys = ['nombres', 'apellido_paterno', 'apellido_materno'] as const

  // Solo enviamos a la IA los campos que realmente tienen '�'.
  const indicesAReparar = keys
    .map((k, i) => (fields[k].includes(REPLACEMENT_CHAR) ? i : -1))
    .filter((i) => i >= 0)

  if (indicesAReparar.length === 0) return fields

  const originales = indicesAReparar.map((i) => fields[keys[i]])

  try {
    const result = await runAITask({
      supabase,
      tipo: 'REPARACION_NOMBRE',
      modulo: 'arribos',
      systemPrompt: SYSTEM_PROMPT_REPARACION,
      userPrompt: buildUserPromptReparacion(originales),
      promptVersion: 'reparacion-nombre@1',
    })

    if (!result.success) return fields

    const reparados = parseArray(result.text)
    if (!reparados || reparados.length !== originales.length) return fields

    // Aplicamos cada reparación solo si pasa la máscara de validación.
    const out: NombreReparado = { ...fields }
    indicesAReparar.forEach((fieldIndex, j) => {
      const original = originales[j]
      const candidato = reparados[j]
      if (typeof candidato === 'string' && buildMask(original).test(candidato)) {
        out[keys[fieldIndex]] = candidato
      }
    })
    return out
  } catch (err) {
    console.error('[reparacion-nombre] Error reparando nombre, se usa original:', err)
    return fields
  }
}
