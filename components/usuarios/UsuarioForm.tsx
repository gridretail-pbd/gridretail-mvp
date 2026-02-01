'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  crearUsuarioSchema, editarUsuarioSchema,
  ROLES, ROLES_LABELS, ZONAS,
  type CrearUsuarioFormData, type EditarUsuarioFormData,
} from '@/lib/validations/usuario'
import type { UsuarioConTiendas } from '@/types'

interface Tienda {
  id: string
  codigo: string
  nombre: string
}

interface UsuarioFormProps {
  mode: 'crear' | 'editar'
  usuario?: UsuarioConTiendas
  currentUserRol: string
  onSuccess: () => void
  onCancel: () => void
}

export function UsuarioForm({ mode, usuario, currentUserRol, onSuccess, onCancel }: UsuarioFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [selectedTiendas, setSelectedTiendas] = useState<Map<string, boolean>>(new Map())
  const [principalTienda, setPrincipalTienda] = useState<string | null>(null)

  const schema = mode === 'crear' ? crearUsuarioSchema : editarUsuarioSchema

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'editar' && usuario ? {
      codigo_asesor: usuario.codigo_asesor,
      dni: usuario.dni || '',
      nombre_completo: usuario.nombre_completo,
      email: usuario.email || '',
      rol: usuario.rol,
      zona: usuario.zona as any || undefined,
      activo: usuario.activo,
      tiendas: usuario.tiendas.map(t => ({
        tienda_id: t.tienda_id,
        es_principal: t.es_principal,
      })),
    } : {
      codigo_asesor: 'PBD_',
      dni: '',
      nombre_completo: '',
      email: '',
      rol: undefined,
      zona: undefined,
      activo: true,
      tiendas: [],
      ...(mode === 'crear' ? { password: '', confirm_password: '' } : {}),
    },
  })

  // Cargar tiendas
  useEffect(() => {
    async function loadTiendas() {
      const supabase = createClient()
      const { data } = await supabase
        .from('tiendas')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('nombre')

      if (data) setTiendas(data)
    }
    loadTiendas()
  }, [])

  // Inicializar selección de tiendas en modo editar
  useEffect(() => {
    if (mode === 'editar' && usuario) {
      const map = new Map<string, boolean>()
      usuario.tiendas.forEach(t => {
        map.set(t.tienda_id, true)
        if (t.es_principal) setPrincipalTienda(t.tienda_id)
      })
      setSelectedTiendas(map)
    }
  }, [mode, usuario])

  function toggleTienda(tiendaId: string) {
    setSelectedTiendas(prev => {
      const next = new Map(prev)
      if (next.has(tiendaId)) {
        next.delete(tiendaId)
        if (principalTienda === tiendaId) setPrincipalTienda(null)
      } else {
        next.set(tiendaId, true)
        if (next.size === 1) setPrincipalTienda(tiendaId)
      }
      // Update form value
      const tiendaArr = Array.from(next.keys()).map(id => ({
        tienda_id: id,
        es_principal: id === principalTienda,
      }))
      form.setValue('tiendas', tiendaArr, { shouldValidate: true })
      return next
    })
  }

  function setPrincipal(tiendaId: string) {
    if (!selectedTiendas.has(tiendaId)) return
    setPrincipalTienda(tiendaId)
    const tiendaArr = Array.from(selectedTiendas.keys()).map(id => ({
      tienda_id: id,
      es_principal: id === tiendaId,
    }))
    form.setValue('tiendas', tiendaArr, { shouldValidate: true })
  }

  async function onSubmit(values: CrearUsuarioFormData | EditarUsuarioFormData) {
    setIsLoading(true)

    // Asegurar tiendas tienen es_principal correcto
    const tiendasPayload = Array.from(selectedTiendas.keys()).map(id => ({
      tienda_id: id,
      es_principal: id === principalTienda,
    }))

    if (tiendasPayload.length === 0) {
      form.setError('tiendas', { message: 'Debe asignar al menos una tienda' })
      setIsLoading(false)
      return
    }

    try {
      const payload = { ...values, tiendas: tiendasPayload }

      const url = mode === 'crear' ? '/api/usuarios' : `/api/usuarios/${usuario?.id}`
      const method = mode === 'crear' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al guardar')
        return
      }

      onSuccess()
    } catch (error) {
      alert('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  const canAssignAdmin = currentUserRol === 'ADMIN'

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Información Personal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo_asesor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Asesor *</FormLabel>
                    <FormControl>
                      <Input placeholder="PBD_JPEREZ" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="12345678"
                        maxLength={8}
                        {...field}
                        disabled={isLoading}
                        onChange={e => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="nombre_completo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Carlos Pérez García" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="jperez@pbd.com.pe"
                      {...field}
                      value={field.value || ''}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Rol y Zona */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rol y Zona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLES.filter(r => canAssignAdmin || r !== 'ADMIN').map(r => (
                          <SelectItem key={r} value={r}>
                            {ROLES_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value || '__none__'}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin zona" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin zona</SelectItem>
                        {ZONAS.map(z => (
                          <SelectItem key={z} value={z}>{z}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {mode === 'editar' && (
              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Usuario activo</FormLabel>
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Credenciales (solo al crear) */}
        {mode === 'crear' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credenciales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={'password' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 8 caracteres" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={'confirm_password' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Contraseña *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repetir contraseña" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, incluir al menos 1 número
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tiendas Asignadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiendas Asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            {tiendas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cargando tiendas...</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tiendas.map(t => (
                  <div key={t.id} className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedTiendas.has(t.id)}
                      onCheckedChange={() => toggleTienda(t.id)}
                      disabled={isLoading}
                    />
                    <span className="text-sm flex-1">{t.nombre}</span>
                    {selectedTiendas.has(t.id) && (
                      <button
                        type="button"
                        onClick={() => setPrincipal(t.id)}
                        className="p-1"
                        title={principalTienda === t.id ? 'Tienda principal' : 'Marcar como principal'}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            principalTienda === t.id
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {form.formState.errors.tiendas && (
              <p className="text-sm text-destructive mt-2">
                {(form.formState.errors.tiendas as any)?.message || 'Debe asignar al menos una tienda'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Click en la estrella para marcar tienda principal
            </p>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'crear' ? 'Crear Usuario' : 'Guardar Cambios'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}
