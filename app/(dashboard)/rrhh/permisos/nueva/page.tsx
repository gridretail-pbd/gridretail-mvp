'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { TIPO_PERMISO, TIPO_PERMISO_LABELS } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NuevoPermisoPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [tipo, setTipo] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [horasSolicitadas, setHorasSolicitadas] = useState('')
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  const esPermisoHoras = tipo === 'PERMISO_HORAS'

  // Cuando cambia fecha inicio, pre-set fecha fin si vacía
  useEffect(() => {
    if (fechaInicio && !fechaFin) {
      setFechaFin(fechaInicio)
    }
  }, [fechaInicio, fechaFin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !tipo || !fechaInicio || !fechaFin || !motivo) return

    if (fechaFin < fechaInicio) {
      toast.error('La fecha fin debe ser posterior a la fecha inicio')
      return
    }

    if (motivo.length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/rrhh/permisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          tipo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          horas_solicitadas: esPermisoHoras && horasSolicitadas ? Number(horasSolicitadas) : null,
          motivo,
        }),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error)

      toast.success('Solicitud de permiso enviada correctamente')
      router.push('/rrhh/permisos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar solicitud')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva Solicitud de Permiso</h1>
          <p className="text-muted-foreground">Solicitar permiso, vacaciones o licencia</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la Solicitud</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Permiso</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_PERMISO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_PERMISO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Inicio</label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Fin</label>
                <Input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  min={fechaInicio}
                />
              </div>
            </div>

            {/* Horas (solo para permiso por horas) */}
            {esPermisoHoras && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Horas solicitadas</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={horasSolicitadas}
                  onChange={(e) => setHorasSolicitadas(e.target.value)}
                  placeholder="Ej: 2"
                />
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explique el motivo de la solicitud..."
                rows={4}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !tipo || !fechaInicio || !fechaFin || motivo.length < 5}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar Solicitud
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
