// lib/rrhh/utils/gps.ts
// Utilidades GPS para validación de asistencia

/**
 * Calcula la distancia en metros entre dos puntos GPS usando la fórmula de Haversine.
 */
export function calcularDistanciaMetros(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000 // Radio de la Tierra en metros
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Valida si un punto GPS está dentro del radio de una tienda.
 */
export function validarDentroRadio(
  userLat: number, userLng: number,
  tiendaLat: number, tiendaLng: number,
  radioMetros: number
): { dentro: boolean; distancia: number } {
  const distancia = calcularDistanciaMetros(userLat, userLng, tiendaLat, tiendaLng)
  return {
    dentro: distancia <= radioMetros,
    distancia: Math.round(distancia),
  }
}

/**
 * Detecta "viaje imposible": si dos marcaciones consecutivas tienen
 * una distancia mayor a la que se podría recorrer en el tiempo transcurrido.
 * Velocidad máxima razonable: 120 km/h (33.3 m/s)
 */
export function detectarViajeImposible(
  lat1: number, lng1: number, timestamp1: Date,
  lat2: number, lng2: number, timestamp2: Date
): boolean {
  const distanciaMetros = calcularDistanciaMetros(lat1, lng1, lat2, lng2)
  const tiempoSegundos = Math.abs(timestamp2.getTime() - timestamp1.getTime()) / 1000

  if (tiempoSegundos === 0) return distanciaMetros > 0

  const velocidadMs = distanciaMetros / tiempoSegundos
  const VELOCIDAD_MAX_MS = 33.3 // ~120 km/h

  return velocidadMs > VELOCIDAD_MAX_MS
}
