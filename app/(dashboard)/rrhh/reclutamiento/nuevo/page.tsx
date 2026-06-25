'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarPipeline } from '@/lib/rrhh/utils/permisos-rrhh'
import { candidatoCreateSchema, type CandidatoCreateData } from '@/lib/rrhh/schemas'
import {
  FUENTE_CAPTACION, FUENTE_CAPTACION_LABELS,
  GENERO, GENERO_LABELS,
} from '@/lib/rrhh/types'
import type { Usuario } from '@/types'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

interface FormErrors {
  [key: string]: string[]
}

export default function NuevoCandidatoPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Form state
  const [dni, setDni] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [genero, setGenero] = useState('')
  const [distritoResidencia, setDistritoResidencia] = useState('')
  const [direccion, setDireccion] = useState('')
  const [experienciaTelecom, setExperienciaTelecom] = useState(false)
  const [experienciaDetalle, setExperienciaDetalle] = useState('')
  const [disponibilidadHorario, setDisponibilidadHorario] = useState('')
  const [disponibilidadDetalle, setDisponibilidadDetalle] = useState('')
  const [fuenteCaptacion, setFuenteCaptacion] = useState<string>('CONVOCATORIA')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!puedeGestionarPipeline(usuario.rol)) {
      router.push('/rrhh/reclutamiento')
      return
    }
    setUser(usuario)
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setErrors({})

    const formData = {
      dni,
      nombre_completo: nombreCompleto,
      telefono,
      email: email || null,
      fecha_nacimiento: fechaNacimiento || null,
      genero: genero || null,
      distrito_residencia: distritoResidencia || null,
      direccion: direccion || null,
      experiencia_telecom: experienciaTelecom,
      experiencia_detalle: experienciaDetalle || null,
      disponibilidad_horario: disponibilidadHorario || null,
      disponibilidad_detalle: disponibilidadDetalle || null,
      fuente_captacion: fuenteCaptacion,
      referido_por: null,
      tienda_destino_id: null,
      notas: notas || null,
    }

    const parsed = candidatoCreateSchema.safeParse(formData)
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as FormErrors)
      toast.error('Por favor corrige los errores del formulario')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/rrhh/candidatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed.data,
          registrado_por: user.id,
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al crear candidato')
      }

      toast.success('Candidato registrado exitosamente')
      router.push('/rrhh/reclutamiento')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/rrhh/reclutamiento')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo Candidato</h1>
          <p className="text-muted-foreground">Registrar un candidato en el pipeline de reclutamiento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos Personales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos Personales</CardTitle>
            <CardDescription>Información básica del candidato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dni">DNI *</Label>
                <Input
                  id="dni"
                  placeholder="12345678"
                  maxLength={8}
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                />
                {errors.dni && <p className="text-xs text-red-500">{errors.dni[0]}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nombre">Nombre Completo *</Label>
                <Input
                  id="nombre"
                  placeholder="Nombre y apellidos"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                />
                {errors.nombre_completo && <p className="text-xs text-red-500">{errors.nombre_completo[0]}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono *</Label>
                <Input
                  id="telefono"
                  placeholder="987654321"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                {errors.telefono && <p className="text-xs text-red-500">{errors.telefono[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fechaNacimiento"
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={genero} onValueChange={setGenero}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENERO.map((g) => (
                      <SelectItem key={g} value={g}>{GENERO_LABELS[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="distrito">Distrito de Residencia</Label>
                <Input
                  id="distrito"
                  placeholder="San Juan de Lurigancho"
                  value={distritoResidencia}
                  onChange={(e) => setDistritoResidencia(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  placeholder="Av. Ejemplo 123"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Experiencia y Disponibilidad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Experiencia y Disponibilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="experienciaTelecom"
                checked={experienciaTelecom}
                onCheckedChange={(checked) => setExperienciaTelecom(checked === true)}
              />
              <Label htmlFor="experienciaTelecom">Tiene experiencia en telecomunicaciones</Label>
            </div>

            {experienciaTelecom && (
              <div className="space-y-2">
                <Label htmlFor="experienciaDetalle">Detalle de experiencia</Label>
                <Textarea
                  id="experienciaDetalle"
                  placeholder="Dónde trabajó, cuánto tiempo, qué funciones..."
                  value={experienciaDetalle}
                  onChange={(e) => setExperienciaDetalle(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="disponibilidad">Disponibilidad Horario</Label>
                <Input
                  id="disponibilidad"
                  placeholder="Tiempo completo / Medio tiempo"
                  value={disponibilidadHorario}
                  onChange={(e) => setDisponibilidadHorario(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disponibilidadDetalle">Detalle de Disponibilidad</Label>
                <Input
                  id="disponibilidadDetalle"
                  placeholder="Desde cuándo, restricciones..."
                  value={disponibilidadDetalle}
                  onChange={(e) => setDisponibilidadDetalle(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuente de Captación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuente *</Label>
                <Select value={fuenteCaptacion} onValueChange={setFuenteCaptacion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUENTE_CAPTACION.map((f) => (
                      <SelectItem key={f} value={f}>{FUENTE_CAPTACION_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas adicionales</Label>
              <Textarea
                id="notas"
                placeholder="Observaciones, comentarios..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/rrhh/reclutamiento')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Registrar Candidato
          </Button>
        </div>
      </form>
    </div>
  )
}
