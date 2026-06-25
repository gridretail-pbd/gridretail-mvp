import { useEffect, useState, useCallback } from 'react'

export type ArriboVendible = {
  id: string
  hora: string
  tipo_visita: 'VENTA' | 'POSVENTA'
  resultado: string | null
  tipo_documento_cliente: string | null
  dni_cliente: string | null
  nombre_cliente: string | null
  es_cliente_entel: boolean | null
  usuario_id: string | null
  asesor_nombre: string | null
  ventas_activas: number
  ventas_anuladas: number
  ventas_pendientes: number
}

/**
 * Lista los arribos de una tienda/día para la tabla del formulario de venta
 * (Camino B). `usuarioId` es requerido por el endpoint (identidad del repo).
 */
export function useArribosVendibles(
  tiendaId?: string,
  fecha?: string,
  usuarioId?: string
) {
  const [arribos, setArribos] = useState<ArriboVendible[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!tiendaId || !usuarioId) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        tienda_id: tiendaId,
        usuario_id: usuarioId,
        ...(fecha ? { fecha } : {}),
      })
      const res = await fetch(`/api/arribos/vendibles?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar arribos')
      setArribos(json.arribos ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar arribos')
    } finally {
      setLoading(false)
    }
  }, [tiendaId, fecha, usuarioId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { arribos, loading, error, refetch: fetchData }
}
