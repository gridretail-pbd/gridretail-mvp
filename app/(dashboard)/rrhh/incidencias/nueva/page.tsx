'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeRegistrarIncidencia } from '@/lib/rrhh/utils/permisos-rrhh'
import { TIPO_INCIDENCIA, TIPO_INCIDENCIA_LABELS } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { ArrowLeft, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

export default function NuevaIncidenciaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [usuarioId, setUsuarioId] = useState('')
  const [tipo, setTipo] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [descripcion, setDescripcion] = useState('')

  // Search usuarios
  const [searchUsuario, setSearchUsuario] = useState('')
  const [usuarios, setUsuarios] = useState<{ id: string; nombre_completo: string; codigo_asesor: string }[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!puedeRegistrarIncidencia(usuario.rol)) {
      router.push('/rrhh/incidencias')
      return
    }
    setUser(usuario)
  }, [router])

  // Buscar usuarios
  useEffect(() => {
    if (searchUsuario.length < 2) {
      setUsuarios([])
      return
    }

    const timer = setTimeout(async () => {
      setLoadingUsuarios(true)
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('usuarios')
          .select('id, nombre_completo, codigo_asesor')
          .eq('activo', true)
          .or(`nombre_completo.ilike.%${searchUsuario}%,codigo_asesor.ilike.%${searchUsuario}%,dni.ilike.%${searchUsuario}%`)
          .limit(10)
        setUsuarios(data || [])
      } catch { /* ignore */ }
      setLoadingUsuarios(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchUsuario])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !usuarioId || !tipo || !fecha) return

    setSaving(true)
    try {
      const response = await fetch('/api/rrhh/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          tipo,
          fecha,
          descripcion: descripcion || null,
          registrado_por: user.id,
        }),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Incidencia registrada correctamente')
      router.push('/rrhh/incidencias')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar incidencia')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const selectedUsuario = usuarios.find((u) => u.id === usuarioId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva Incidencia</h1>
          <p className="text-muted-foreground">Registrar una incidencia laboral</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la Incidencia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Buscar colaborador */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Colaborador</label>
              {selectedUsuario ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 rounded-md border bg-muted/50">
                    <span className="font-medium">{selectedUsuario.nombre_completo}</span>
                    <span className="text-sm text-muted-foreground ml-2">({selectedUsuario.codigo_asesor})</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setUsuarioId(''); setSearchUsuario('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar por nombre, código o DNI..."
                    value={searchUsuario}
                    onChange={(e) => setSearchUsuario(e.target.value)}
                  />
                  {loadingUsuarios && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                  )}
                  {usuarios.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {usuarios.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onClick={() => {
                            setUsuarioId(u.id)
                            setSearchUsuario('')
                            setUsuarios([])
                          }}
                        >
                          <span className="font-medium">{u.nombre_completo}</span>
                          <span className="text-muted-foreground ml-2">({u.codigo_asesor})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Incidencia</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_INCIDENCIA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_INCIDENCIA_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha</label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalle de la incidencia (opcional)..."
                rows={4}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !usuarioId || !tipo || !fecha}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Registrar Incidencia
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
