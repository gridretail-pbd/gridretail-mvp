// lib/rrhh/utils/comparar-nombres.ts
// Algoritmo de comparación de nombres para verificación RENIEC
// Spec: SPEC_IMPORTACION_INICIAL_RRHH v2.0 — Sección 7.3

/**
 * Normaliza un nombre: mayúsculas, sin tildes, sin caracteres especiales, trim
 */
function normalizarNombre(nombre: string): string {
  return nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[^A-Z\s]/g, '')       // Solo letras y espacios
    .replace(/\s+/g, ' ')           // Normalizar espacios múltiples
    .trim()
}

/**
 * Tokeniza un nombre en palabras, ignorando iniciales sueltas (1 letra)
 */
function tokenizar(nombre: string): string[] {
  return normalizarNombre(nombre)
    .split(' ')
    .filter(t => t.length > 1) // Ignorar iniciales sueltas como "J." → "J"
}

/**
 * Compara dos nombres y retorna un score de confianza.
 * Usado para validar identidad contra RENIEC/Migraciones.
 *
 * Algoritmo:
 * 1. Normalizar ambos nombres (mayúsculas, sin tildes)
 * 2. Tokenizar por palabras (ignorar iniciales sueltas)
 * 3. Contar coincidencias exactas + parciales (contenido)
 * 4. Calcular confianza: coincidencias / total tokens
 *
 * Umbrales:
 * - >= 0.75: VERIFICADO (al menos 2 palabras coinciden)
 * - 0.50 - 0.74: NOMBRE_REVISAR (coincidencia parcial)
 * - < 0.50: NOMBRE_NO_COINCIDE
 */
export function compararNombres(
  nombreExcel: string,
  nombreReniec: string,
): {
  coincide: boolean
  confianza: number
  detalle: string
} {
  if (!nombreExcel || !nombreReniec) {
    return { coincide: false, confianza: 0, detalle: 'Nombre vacío' }
  }

  const tokensExcel = tokenizar(nombreExcel)
  const tokensReniec = tokenizar(nombreReniec)

  if (tokensExcel.length === 0 || tokensReniec.length === 0) {
    return { coincide: false, confianza: 0, detalle: 'Sin tokens válidos' }
  }

  // Contar coincidencias exactas
  let coincidenciasExactas = 0
  let coincidenciasParciales = 0
  const usados = new Set<number>()

  for (const tokenExcel of tokensExcel) {
    let encontroExacto = false
    for (let i = 0; i < tokensReniec.length; i++) {
      if (usados.has(i)) continue
      if (tokenExcel === tokensReniec[i]) {
        coincidenciasExactas++
        usados.add(i)
        encontroExacto = true
        break
      }
    }
    if (!encontroExacto) {
      // Buscar coincidencia parcial (uno contiene al otro)
      for (let i = 0; i < tokensReniec.length; i++) {
        if (usados.has(i)) continue
        if (
          tokenExcel.length >= 3 &&
          tokensReniec[i].length >= 3 &&
          (tokenExcel.includes(tokensReniec[i]) || tokensReniec[i].includes(tokenExcel))
        ) {
          coincidenciasParciales++
          usados.add(i)
          break
        }
      }
    }
  }

  const totalTokens = Math.max(tokensExcel.length, tokensReniec.length)
  const score = (coincidenciasExactas + coincidenciasParciales * 0.5) / totalTokens
  const confianza = Math.round(score * 100) / 100

  // Para VERIFICADO necesitamos al menos 2 coincidencias exactas
  const coincide = confianza >= 0.75 && coincidenciasExactas >= 2

  let detalle: string
  if (coincide) {
    detalle = `${coincidenciasExactas} coincidencias exactas de ${totalTokens} palabras`
  } else if (confianza >= 0.50) {
    detalle = `Coincidencia parcial: ${coincidenciasExactas} exactas, ${coincidenciasParciales} parciales de ${totalTokens}`
  } else {
    detalle = `Baja coincidencia: ${coincidenciasExactas} exactas de ${totalTokens} palabras`
  }

  return { coincide, confianza, detalle }
}

/**
 * Arma el nombre oficial desde la respuesta de json.pe
 * - DNI (RENIEC): apellidoPaterno + apellidoMaterno + nombres
 * - CE (Migraciones): apellidos + nombres
 */
export function armarNombreOficial(
  tipo: 'DNI' | 'CE',
  data: {
    nombres?: string
    apellido_paterno?: string
    apellido_materno?: string
    apellidos?: string
  },
): string {
  if (tipo === 'DNI') {
    const parts = [
      data.apellido_paterno || '',
      data.apellido_materno || '',
      data.nombres || '',
    ].filter(Boolean)
    return parts.join(' ').trim()
  }
  // CE
  const parts = [
    data.apellidos || `${data.apellido_paterno || ''} ${data.apellido_materno || ''}`.trim(),
    data.nombres || '',
  ].filter(Boolean)
  return parts.join(' ').trim()
}
