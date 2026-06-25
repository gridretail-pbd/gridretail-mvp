'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useUsuarioRRHH } from '@/lib/rrhh/hooks/useUsuariosRRHH'
import {
  USUARIO_STATUS, USUARIO_STATUS_LABELS, USUARIO_STATUS_COLORS,
  AREA_FUNCIONAL, AREA_FUNCIONAL_LABELS,
  TIPO_CONTRATO, TIPO_CONTRATO_LABELS,
  GENERO, GENERO_LABELS,
  ESTADO_CIVIL, ESTADO_CIVIL_LABELS,
  SISTEMA_PENSIONARIO, SISTEMA_PENSIONARIO_LABELS,
  TIPO_DOCUMENTO_IDENTIDAD, TIPO_DOCUMENTO_IDENTIDAD_LABELS,
  NIVEL_EDUCATIVO, NIVEL_EDUCATIVO_LABELS,
  GRUPO_SANGUINEO,
} from '@/lib/rrhh/types'
import type {
  UsuarioStatus, AreaFuncional, TipoContrato, Genero, EstadoCivil,
  SistemaPensionario, TipoDocumentoIdentidad, NivelEducativo, GrupoSanguineo,
} from '@/lib/rrhh/types'
import type { UsuarioRRHH } from '@/lib/rrhh/interfaces'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ArrowLeft, Pencil, Save, X, Loader2, User, Briefcase, Phone, Building2, Shield, GraduationCap, Heart } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-PE')
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—'
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

// ─── Componentes de campo ────────────────────────────────────────────────────

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value || '—'}</p>
    </div>
  )
}

function CampoEditable({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (val: string) => void
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function CampoSelect({
  label,
  value,
  onChange,
  options,
  labels,
  placeholder,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[]
  labels: Record<string, string>
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || 'Seleccionar'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {labels[opt] || opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function FichaColaboradorPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [params, setParams] = useState<{ id: string } | null>(null)
  const [user, setUser] = useState<Usuario | null>(null)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  // Resolver params async
  useEffect(() => {
    paramsPromise.then(setParams)
  }, [paramsPromise])

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  // Entrar en modo edición si viene ?editar=1
  useEffect(() => {
    if (searchParams.get('editar') === '1') {
      setEditando(true)
    }
  }, [searchParams])

  const { data: colaborador, loading, error, refetch } = useUsuarioRRHH(params?.id ?? null)

  // Sincronizar formData cuando cambia el colaborador
  useEffect(() => {
    if (colaborador) {
      setFormData({ ...colaborador })
    }
  }, [colaborador])

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false

  function updateField(campo: string, valor: unknown) {
    setFormData((prev) => ({ ...prev, [campo]: valor || null }))
  }

  function cancelarEdicion() {
    if (colaborador) {
      setFormData({ ...colaborador })
    }
    setEditando(false)
  }

  async function guardarCambios() {
    if (!params?.id) return
    setGuardando(true)
    try {
      // Enviar solo campos que cambiaron
      const cambios: Record<string, unknown> = {}
      if (!colaborador) return

      const camposEditables = [
        'fecha_nacimiento', 'genero', 'estado_civil', 'telefono_personal',
        'direccion_domiciliaria', 'distrito_residencia',
        'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_parentesco',
        'banco', 'numero_cuenta', 'cci',
        'fecha_ingreso', 'fecha_fin_contrato', 'tipo_contrato_actual', 'regimen_laboral',
        'cargo_formal', 'area_funcional', 'jefe_directo_id', 'remuneracion_actual', 'status',
        'talla_uniforme', 'tiene_equipo_corporativo', 'equipo_corporativo_detalle',
        'notas',
        // Seguridad Social (migración 026)
        'sistema_pensionario', 'afp_nombre', 'cuspp', 'eps_nombre',
        'tiene_sctr', 'asignacion_familiar', 'numero_dependientes', 'numero_hijos',
        // Identificación (migración 026)
        'tipo_documento', 'lugar_nacimiento', 'nacionalidad', 'ruc',
        // Educación (migración 026)
        'nivel_educativo', 'profesion_carrera',
        // Salud (migración 026)
        'grupo_sanguineo',
      ]

      for (const campo of camposEditables) {
        const valorOriginal = (colaborador as unknown as Record<string, unknown>)[campo]
        const valorNuevo = formData[campo]
        if (valorOriginal !== valorNuevo) {
          cambios[campo] = valorNuevo
        }
      }

      if (Object.keys(cambios).length === 0) {
        toast.info('No hay cambios para guardar')
        setEditando(false)
        return
      }

      const response = await fetch(`/api/rrhh/usuarios-rrhh/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Error al guardar')
      }

      toast.success('Ficha actualizada correctamente')
      setEditando(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (!user || !params) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !colaborador) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/rrhh/colaboradores">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {error || 'Ficha no encontrada'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const f = formData as UsuarioRRHH & Record<string, unknown>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rrhh/colaboradores">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {colaborador.nombre_completo || colaborador.usuario?.nombre_completo || 'Colaborador'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn('text-xs', USUARIO_STATUS_COLORS[colaborador.status as UsuarioStatus])}>
                {USUARIO_STATUS_LABELS[colaborador.status as UsuarioStatus]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {colaborador.codigo_asesor || colaborador.usuario?.codigo_asesor} &middot; DNI: {colaborador.dni || colaborador.usuario?.dni}
              </span>
            </div>
          </div>
        </div>

        {/* Botones edición */}
        {esGestion && !editando && (
          <Button onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
        {editando && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelarEdicion} disabled={guardando}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={guardarCambios} disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="laboral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="laboral" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Datos Laborales
          </TabsTrigger>
          <TabsTrigger value="personal" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Datos Personales
          </TabsTrigger>
          <TabsTrigger value="emergencia" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            Contacto Emergencia
          </TabsTrigger>
          <TabsTrigger value="bancario" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Bancarios / Operativo
          </TabsTrigger>
          <TabsTrigger value="seguridad-social" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Seg. Social
          </TabsTrigger>
          <TabsTrigger value="educacion" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            Educación / Salud
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Datos Laborales ────────────────────────────────── */}
        <TabsContent value="laboral">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información Laboral</CardTitle>
            </CardHeader>
            <CardContent>
              {editando ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <CampoSelect
                    label="Status"
                    value={(f.status as string) || ''}
                    onChange={(v) => updateField('status', v)}
                    options={USUARIO_STATUS}
                    labels={USUARIO_STATUS_LABELS}
                  />
                  <CampoEditable
                    label="Cargo Formal"
                    value={(f.cargo_formal as string) || ''}
                    onChange={(v) => updateField('cargo_formal', v)}
                  />
                  <CampoSelect
                    label="Área Funcional"
                    value={(f.area_funcional as string) || ''}
                    onChange={(v) => updateField('area_funcional', v)}
                    options={AREA_FUNCIONAL}
                    labels={AREA_FUNCIONAL_LABELS}
                  />
                  <CampoSelect
                    label="Tipo de Contrato"
                    value={(f.tipo_contrato_actual as string) || ''}
                    onChange={(v) => updateField('tipo_contrato_actual', v)}
                    options={TIPO_CONTRATO}
                    labels={TIPO_CONTRATO_LABELS}
                  />
                  <CampoEditable
                    label="Fecha de Ingreso"
                    value={(f.fecha_ingreso as string) || ''}
                    onChange={(v) => updateField('fecha_ingreso', v)}
                    type="date"
                  />
                  <CampoEditable
                    label="Fecha Fin Contrato"
                    value={(f.fecha_fin_contrato as string) || ''}
                    onChange={(v) => updateField('fecha_fin_contrato', v)}
                    type="date"
                  />
                  <CampoEditable
                    label="Régimen Laboral"
                    value={(f.regimen_laboral as string) || ''}
                    onChange={(v) => updateField('regimen_laboral', v)}
                  />
                  <CampoEditable
                    label="Remuneración"
                    value={(f.remuneracion_actual as number)?.toString() || ''}
                    onChange={(v) => updateField('remuneracion_actual', v ? parseFloat(v) : null)}
                    type="number"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge className={cn('text-xs mt-0.5', USUARIO_STATUS_COLORS[colaborador.status as UsuarioStatus])}>
                      {USUARIO_STATUS_LABELS[colaborador.status as UsuarioStatus]}
                    </Badge>
                  </div>
                  <Campo label="Cargo Formal" value={colaborador.cargo_formal || '—'} />
                  <Campo
                    label="Área Funcional"
                    value={AREA_FUNCIONAL_LABELS[colaborador.area_funcional as AreaFuncional] || colaborador.area_funcional}
                  />
                  <Campo
                    label="Tipo de Contrato"
                    value={TIPO_CONTRATO_LABELS[colaborador.tipo_contrato_actual as TipoContrato] || colaborador.tipo_contrato_actual}
                  />
                  <Campo label="Fecha de Ingreso" value={formatDate(colaborador.fecha_ingreso)} />
                  <Campo label="Fecha Fin Contrato" value={formatDate(colaborador.fecha_fin_contrato)} />
                  <Campo label="Régimen Laboral" value={colaborador.regimen_laboral || '—'} />
                  <Campo label="Remuneración" value={formatCurrency(colaborador.remuneracion_actual)} />
                  <Campo label="Jefe Directo" value={colaborador.jefe_directo?.nombre_completo || '—'} />
                  <Campo label="Rol Sistema" value={colaborador.usuario?.rol || '—'} />
                  <Campo label="Zona" value={colaborador.usuario?.zona || '—'} />
                  <Campo
                    label="Activo en Sistema"
                    value={colaborador.usuario?.activo ? 'Sí' : 'No'}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Datos Personales ───────────────────────────────── */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos Personales</CardTitle>
            </CardHeader>
            <CardContent>
              {editando ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <CampoEditable
                    label="Fecha de Nacimiento"
                    value={(f.fecha_nacimiento as string) || ''}
                    onChange={(v) => updateField('fecha_nacimiento', v)}
                    type="date"
                  />
                  <CampoSelect
                    label="Género"
                    value={(f.genero as string) || ''}
                    onChange={(v) => updateField('genero', v)}
                    options={GENERO}
                    labels={GENERO_LABELS}
                  />
                  <CampoSelect
                    label="Estado Civil"
                    value={(f.estado_civil as string) || ''}
                    onChange={(v) => updateField('estado_civil', v)}
                    options={ESTADO_CIVIL}
                    labels={ESTADO_CIVIL_LABELS}
                  />
                  <CampoEditable
                    label="Teléfono Personal"
                    value={(f.telefono_personal as string) || ''}
                    onChange={(v) => updateField('telefono_personal', v)}
                  />
                  <div className="md:col-span-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Dirección</Label>
                      <Textarea
                        value={(f.direccion_domiciliaria as string) || ''}
                        onChange={(e) => updateField('direccion_domiciliaria', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                  <CampoEditable
                    label="Distrito de Residencia"
                    value={(f.distrito_residencia as string) || ''}
                    onChange={(v) => updateField('distrito_residencia', v)}
                  />
                  <CampoSelect
                    label="Tipo de Documento"
                    value={(f.tipo_documento as string) || ''}
                    onChange={(v) => updateField('tipo_documento', v)}
                    options={TIPO_DOCUMENTO_IDENTIDAD}
                    labels={TIPO_DOCUMENTO_IDENTIDAD_LABELS}
                  />
                  <CampoEditable
                    label="Lugar de Nacimiento"
                    value={(f.lugar_nacimiento as string) || ''}
                    onChange={(v) => updateField('lugar_nacimiento', v)}
                  />
                  <CampoEditable
                    label="Nacionalidad"
                    value={(f.nacionalidad as string) || ''}
                    onChange={(v) => updateField('nacionalidad', v)}
                  />
                  <CampoEditable
                    label="RUC"
                    value={(f.ruc as string) || ''}
                    onChange={(v) => updateField('ruc', v)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Campo label="Fecha de Nacimiento" value={formatDate(colaborador.fecha_nacimiento)} />
                  <Campo
                    label="Género"
                    value={colaborador.genero ? (GENERO_LABELS[colaborador.genero as Genero] || colaborador.genero) : '—'}
                  />
                  <Campo
                    label="Estado Civil"
                    value={colaborador.estado_civil ? (ESTADO_CIVIL_LABELS[colaborador.estado_civil as EstadoCivil] || colaborador.estado_civil) : '—'}
                  />
                  <Campo label="Teléfono Personal" value={colaborador.telefono_personal || '—'} />
                  <Campo label="Dirección" value={colaborador.direccion_domiciliaria || '—'} />
                  <Campo label="Distrito" value={colaborador.distrito_residencia || '—'} />
                  <Campo
                    label="Tipo de Documento"
                    value={colaborador.tipo_documento ? (TIPO_DOCUMENTO_IDENTIDAD_LABELS[colaborador.tipo_documento as TipoDocumentoIdentidad] || colaborador.tipo_documento) : '—'}
                  />
                  <Campo label="Lugar de Nacimiento" value={colaborador.lugar_nacimiento || '—'} />
                  <Campo label="Nacionalidad" value={colaborador.nacionalidad || '—'} />
                  <Campo label="RUC" value={colaborador.ruc || '—'} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Contacto Emergencia ────────────────────────────── */}
        <TabsContent value="emergencia">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacto de Emergencia</CardTitle>
            </CardHeader>
            <CardContent>
              {editando ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <CampoEditable
                    label="Nombre"
                    value={(f.contacto_emergencia_nombre as string) || ''}
                    onChange={(v) => updateField('contacto_emergencia_nombre', v)}
                  />
                  <CampoEditable
                    label="Teléfono"
                    value={(f.contacto_emergencia_telefono as string) || ''}
                    onChange={(v) => updateField('contacto_emergencia_telefono', v)}
                  />
                  <CampoEditable
                    label="Parentesco"
                    value={(f.contacto_emergencia_parentesco as string) || ''}
                    onChange={(v) => updateField('contacto_emergencia_parentesco', v)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Campo label="Nombre" value={colaborador.contacto_emergencia_nombre || '—'} />
                  <Campo label="Teléfono" value={colaborador.contacto_emergencia_telefono || '—'} />
                  <Campo label="Parentesco" value={colaborador.contacto_emergencia_parentesco || '—'} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Bancarios + Operativo ──────────────────────────── */}
        <TabsContent value="bancario">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Bancarios</CardTitle>
              </CardHeader>
              <CardContent>
                {editando ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <CampoEditable
                      label="Banco"
                      value={(f.banco as string) || ''}
                      onChange={(v) => updateField('banco', v)}
                    />
                    <CampoEditable
                      label="Número de Cuenta"
                      value={(f.numero_cuenta as string) || ''}
                      onChange={(v) => updateField('numero_cuenta', v)}
                    />
                    <CampoEditable
                      label="CCI"
                      value={(f.cci as string) || ''}
                      onChange={(v) => updateField('cci', v)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Campo label="Banco" value={colaborador.banco || '—'} />
                    <Campo label="Número de Cuenta" value={colaborador.numero_cuenta || '—'} />
                    <Campo label="CCI" value={colaborador.cci || '—'} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Operativos</CardTitle>
              </CardHeader>
              <CardContent>
                {editando ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <CampoEditable
                      label="Talla de Uniforme"
                      value={(f.talla_uniforme as string) || ''}
                      onChange={(v) => updateField('talla_uniforme', v)}
                    />
                    <CampoEditable
                      label="Equipo Corporativo (detalle)"
                      value={(f.equipo_corporativo_detalle as string) || ''}
                      onChange={(v) => updateField('equipo_corporativo_detalle', v)}
                    />
                    <div className="md:col-span-2 lg:col-span-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Notas</Label>
                        <Textarea
                          value={(f.notas as string) || ''}
                          onChange={(e) => updateField('notas', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Campo label="Talla de Uniforme" value={colaborador.talla_uniforme || '—'} />
                    <Campo
                      label="Equipo Corporativo"
                      value={colaborador.tiene_equipo_corporativo ? (colaborador.equipo_corporativo_detalle || 'Sí') : 'No'}
                    />
                    <Campo label="Notas" value={colaborador.notas || '—'} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Seguridad Social ────────────────────────────────── */}
        <TabsContent value="seguridad-social">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seguridad Social y Tributario</CardTitle>
            </CardHeader>
            <CardContent>
              {editando ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <CampoSelect
                    label="Sistema Pensionario"
                    value={(f.sistema_pensionario as string) || ''}
                    onChange={(v) => updateField('sistema_pensionario', v)}
                    options={SISTEMA_PENSIONARIO}
                    labels={SISTEMA_PENSIONARIO_LABELS}
                  />
                  <CampoEditable
                    label="Nombre AFP"
                    value={(f.afp_nombre as string) || ''}
                    onChange={(v) => updateField('afp_nombre', v)}
                  />
                  <CampoEditable
                    label="CUSPP"
                    value={(f.cuspp as string) || ''}
                    onChange={(v) => updateField('cuspp', v)}
                  />
                  <CampoEditable
                    label="EPS"
                    value={(f.eps_nombre as string) || ''}
                    onChange={(v) => updateField('eps_nombre', v)}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-sm">Tiene SCTR</Label>
                    <Select
                      value={f.tiene_sctr ? 'true' : 'false'}
                      onValueChange={(v) => updateField('tiene_sctr', v === 'true')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sí</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Asignación Familiar</Label>
                    <Select
                      value={f.asignacion_familiar ? 'true' : 'false'}
                      onValueChange={(v) => updateField('asignacion_familiar', v === 'true')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sí</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <CampoEditable
                    label="Número de Dependientes"
                    value={(f.numero_dependientes as number)?.toString() || ''}
                    onChange={(v) => updateField('numero_dependientes', v ? parseInt(v) : null)}
                    type="number"
                  />
                  <CampoEditable
                    label="Número de Hijos"
                    value={(f.numero_hijos as number)?.toString() || ''}
                    onChange={(v) => updateField('numero_hijos', v ? parseInt(v) : null)}
                    type="number"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Campo
                    label="Sistema Pensionario"
                    value={colaborador.sistema_pensionario ? (SISTEMA_PENSIONARIO_LABELS[colaborador.sistema_pensionario as SistemaPensionario] || colaborador.sistema_pensionario) : '—'}
                  />
                  <Campo label="Nombre AFP" value={colaborador.afp_nombre || '—'} />
                  <Campo label="CUSPP" value={colaborador.cuspp || '—'} />
                  <Campo label="EPS" value={colaborador.eps_nombre || '—'} />
                  <Campo label="Tiene SCTR" value={colaborador.tiene_sctr ? 'Sí' : 'No'} />
                  <Campo label="Asignación Familiar" value={colaborador.asignacion_familiar ? 'Sí' : 'No'} />
                  <Campo label="Dependientes" value={colaborador.numero_dependientes?.toString() || '—'} />
                  <Campo label="Hijos" value={colaborador.numero_hijos?.toString() || '—'} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Educación y Salud ───────────────────────────────── */}
        <TabsContent value="educacion">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Educación</CardTitle>
              </CardHeader>
              <CardContent>
                {editando ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CampoSelect
                      label="Nivel Educativo"
                      value={(f.nivel_educativo as string) || ''}
                      onChange={(v) => updateField('nivel_educativo', v)}
                      options={NIVEL_EDUCATIVO}
                      labels={NIVEL_EDUCATIVO_LABELS}
                    />
                    <CampoEditable
                      label="Profesión / Carrera"
                      value={(f.profesion_carrera as string) || ''}
                      onChange={(v) => updateField('profesion_carrera', v)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Campo
                      label="Nivel Educativo"
                      value={colaborador.nivel_educativo ? (NIVEL_EDUCATIVO_LABELS[colaborador.nivel_educativo as NivelEducativo] || colaborador.nivel_educativo) : '—'}
                    />
                    <Campo label="Profesión / Carrera" value={colaborador.profesion_carrera || '—'} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Salud</CardTitle>
              </CardHeader>
              <CardContent>
                {editando ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CampoSelect
                      label="Grupo Sanguíneo"
                      value={(f.grupo_sanguineo as string) || ''}
                      onChange={(v) => updateField('grupo_sanguineo', v)}
                      options={GRUPO_SANGUINEO}
                      labels={Object.fromEntries(GRUPO_SANGUINEO.map((g) => [g, g]))}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Campo label="Grupo Sanguíneo" value={colaborador.grupo_sanguineo || '—'} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
