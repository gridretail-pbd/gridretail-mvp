'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { format } from 'date-fns'
import { getUsuarioFromLocalStorage, getTiendaActiva } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Store } from 'lucide-react'
import { Usuario } from '@/types'

// Tipo para tienda activa (del localStorage)
interface TiendaActiva {
  id: string
  codigo: string
  nombre: string
  zona?: string
}

// Tipos de documento
const TIPOS_DOCUMENTO = [
  { value: 'NO_PROPORCIONADO', label: 'No lo dio' },
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carné de Extranjería' },
  { value: 'OTRO', label: 'Otro' },
] as const

type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['value']

// Schema con validación estricta - campos obligatorios NO pueden estar vacíos
const arriboSchema = z
  .object({
    tipo_documento: z.enum(['NO_PROPORCIONADO', 'DNI', 'CE', 'OTRO'], {
      message: 'Selecciona el tipo de documento',
    }),
    numero_documento: z.string().optional(),
    es_cliente_entel: z.enum(['SI', 'NO', 'NO_SABE'], {
      message: 'Indica si es cliente Entel',
    }),
    tipo_visita: z.enum(['VENTA', 'POSVENTA'], {
      message: 'Selecciona el tipo de visita',
    }),
    concreto_operacion: z.enum(['SI', 'NO'], {
      message: 'Indica si concretó operación',
    }),
    se_vendio: z.enum(['SI', 'NO']).optional(),
    motivo_no_venta: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validar número de documento según tipo
      if (data.tipo_documento === 'DNI') {
        return data.numero_documento && /^\d{8}$/.test(data.numero_documento)
      }
      if (data.tipo_documento === 'CE') {
        return data.numero_documento && /^\d{9}$/.test(data.numero_documento)
      }
      // OTRO y NO_PROPORCIONADO no requieren validación estricta
      return true
    },
    {
      message: 'Número de documento inválido',
      path: ['numero_documento'],
    }
  )
  .refine(
    (data) => {
      // Si tipo_visita es VENTA, se_vendio es obligatorio
      if (data.tipo_visita === 'VENTA') {
        return data.se_vendio !== undefined
      }
      return true
    },
    {
      message: 'Indica si se realizó la venta',
      path: ['se_vendio'],
    }
  )
  .refine(
    (data) => {
      // Si se_vendio es NO, motivo_no_venta es obligatorio
      if (data.tipo_visita === 'VENTA' && data.se_vendio === 'NO') {
        return data.motivo_no_venta && data.motivo_no_venta.length > 0
      }
      return true
    },
    {
      message: 'Selecciona el motivo de no venta',
      path: ['motivo_no_venta'],
    }
  )

type ArriboFormValues = z.infer<typeof arriboSchema>

const motivosNoVenta = [
  { value: 'SIN_STOCK', label: 'Sin stock' },
  { value: 'PRECIO_ALTO', label: 'Precio muy alto' },
  { value: 'NO_CALIFICA', label: 'No califica crédito' },
  { value: 'SOLO_CONSULTA', label: 'Solo consulta' },
  { value: 'DOCS_INCOMPLETOS', label: 'Documentos incompletos' },
  { value: 'PROBLEMA_SISTEMA', label: 'Problema sistema' },
  { value: 'OTRO', label: 'Otro' },
]

// Tipo para la respuesta de la API de documento
interface DocumentoApiResponse {
  success: boolean
  data?: {
    nombres: string
    apellido_paterno: string
    apellido_materno: string
  }
  message?: string
  debug?: string // Para diagnóstico
}

export default function NuevoArriboPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [tiendaActiva, setTiendaActiva] = useState<TiendaActiva | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Estados para la consulta de documento
  const [nombreCliente, setNombreCliente] = useState<string>('')
  const [documentoLoading, setDocumentoLoading] = useState(false)
  const [documentoError, setDocumentoError] = useState<string | null>(null)
  
  // Ref para evitar consultas duplicadas
  const lastQueryRef = useRef<string>('')

  const form = useForm<ArriboFormValues>({
    resolver: zodResolver(arriboSchema),
    defaultValues: {
      // SIN VALORES POR DEFECTO - El usuario debe seleccionar todo
      tipo_documento: undefined,
      numero_documento: '',
      es_cliente_entel: undefined,
      tipo_visita: undefined,
      concreto_operacion: undefined,
      se_vendio: undefined,
      motivo_no_venta: '',
    },
  })

  const tipoVisita = form.watch('tipo_visita')
  const seVendio = form.watch('se_vendio')
  const tipoDocumento = form.watch('tipo_documento')
  const numeroDocumento = form.watch('numero_documento')

  // Determinar si mostrar campo de número
  const mostrarNumeroDocumento =
    tipoDocumento === 'DNI' ||
    tipoDocumento === 'CE' ||
    tipoDocumento === 'OTRO'

  // Determinar si mostrar campo de nombre (solo para DNI y CE)
  const mostrarNombreCliente =
    tipoDocumento === 'DNI' || tipoDocumento === 'CE'

  // Determinar longitud esperada del documento
  const longitudDocumento = tipoDocumento === 'DNI' ? 8 : tipoDocumento === 'CE' ? 9 : undefined

  // Función para consultar documento
  const consultarDocumento = useCallback(
    async (tipo: TipoDocumento, numero: string) => {
      // Solo consultar DNI y CE
      if (tipo !== 'DNI' && tipo !== 'CE') {
        setNombreCliente('')
        setDocumentoError(null)
        return
      }

      // Validar longitud
      const longitudEsperada = tipo === 'DNI' ? 8 : 9
      if (!/^\d+$/.test(numero) || numero.length !== longitudEsperada) {
        setNombreCliente('')
        setDocumentoError(null)
        return
      }

      // Crear clave única para esta consulta
      const queryKey = `${tipo}-${numero}`
      
      // Evitar consulta duplicada
      if (queryKey === lastQueryRef.current) {
        console.log('[Frontend] Consulta duplicada evitada:', queryKey)
        return
      }

      console.log('[Frontend] Iniciando consulta:', queryKey)
      lastQueryRef.current = queryKey

      setDocumentoLoading(true)
      setDocumentoError(null)
      setNombreCliente('')

      try {
        const response = await fetch(
          `/api/consulta-documento?tipo=${tipo}&numero=${numero}`
        )
        const data: DocumentoApiResponse = await response.json()

        console.log('[Frontend] Respuesta API:', data)

        if (data.success && data.data) {
          const { apellido_paterno, apellido_materno, nombres } = data.data
          const nombreCompleto = `${apellido_paterno} ${apellido_materno}, ${nombres}`
          setNombreCliente(nombreCompleto)
          setDocumentoError(null)
        } else {
          // Mostrar mensaje detallado si está disponible
          const errorMsg = data.debug || data.message || 'Documento no encontrado'
          setDocumentoError(errorMsg)
          setNombreCliente('')
        }
      } catch (error) {
        console.error('[Frontend] Error consultando documento:', error)
        setDocumentoError('Error de conexión')
        setNombreCliente('')
      } finally {
        setDocumentoLoading(false)
      }
    },
    []
  )

  // Efecto para consultar documento cuando cambia el número
  useEffect(() => {
    if (!tipoDocumento || !numeroDocumento) {
      return
    }

    // Crear clave para verificar si ya se consultó
    const queryKey = `${tipoDocumento}-${numeroDocumento}`
    
    // Si ya se consultó este documento, no volver a consultar
    if (queryKey === lastQueryRef.current && (nombreCliente || documentoError)) {
      return
    }

    // Validar longitud antes de consultar
    const longitudEsperada = tipoDocumento === 'DNI' ? 8 : tipoDocumento === 'CE' ? 9 : 0
    if (longitudEsperada > 0 && numeroDocumento.length === longitudEsperada) {
      consultarDocumento(tipoDocumento, numeroDocumento)
    }
  }, [tipoDocumento, numeroDocumento, consultarDocumento, nombreCliente, documentoError])

  // Resetear consulta cuando cambia el tipo de documento
  useEffect(() => {
    setNombreCliente('')
    setDocumentoError(null)
    lastQueryRef.current = ''
    form.setValue('numero_documento', '')
  }, [tipoDocumento, form])

  // Cargar usuario y tienda activa
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)

    const tienda = getTiendaActiva()
    if (tienda) {
      setTiendaActiva(tienda)
    }
  }, [router])

  async function onSubmit(values: ArriboFormValues) {
    if (!user || !tiendaActiva) {
      alert('No se pudo obtener la información del usuario o tienda')
      return
    }

    setIsLoading(true)

    try {
      const now = new Date()

      // Convertir valores del formulario a valores de BD
      const esClienteEntel =
        values.es_cliente_entel === 'SI'
          ? true
          : values.es_cliente_entel === 'NO'
            ? false
            : null

      const payload = {
        fecha: format(now, 'yyyy-MM-dd'),
        hora: format(now, 'HH:mm:ss'),
        tienda_id: tiendaActiva.id,
        usuario_id: user.id,
        registrado_por: user.id,
        tipo_documento_cliente:
          values.tipo_documento === 'NO_PROPORCIONADO'
            ? null
            : values.tipo_documento,
        dni_cliente:
          values.tipo_documento === 'NO_PROPORCIONADO'
            ? null
            : values.numero_documento || null,
        nombre_cliente: nombreCliente || null,
        es_cliente_entel: esClienteEntel,
        tipo_visita: values.tipo_visita,
        concreto_operacion: values.concreto_operacion === 'SI',
        se_vendio:
          values.tipo_visita === 'VENTA'
            ? values.se_vendio === 'SI'
            : null,
        motivo_no_venta:
          values.tipo_visita === 'VENTA' && values.se_vendio === 'NO'
            ? values.motivo_no_venta
            : null,
      }

      const response = await fetch('/api/arribos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al guardar arribo')
      }

      setIsSuccess(true)
      form.reset()
      setNombreCliente('')
      setDocumentoError(null)
      lastQueryRef.current = ''

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al registrar arribo: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    )
  }

  if (!tiendaActiva) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <Store className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Selecciona una tienda desde el menú superior para continuar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registrar Arribo</h1>
        <p className="text-muted-foreground">
          Registra el arribo de un cliente a la tienda
        </p>
      </div>

      {isSuccess && (
        <div className="rounded-md bg-green-50 p-4 border border-green-200">
          <p className="text-sm font-medium text-green-800">
            Arribo registrado exitosamente
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Información del Arribo</CardTitle>
          <CardDescription>
            Completa los datos del cliente que llega a la tienda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Tienda Activa - Badge informativo (read-only) */}
              <div className="space-y-2">
                <FormLabel>Tienda</FormLabel>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <Store className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{tiendaActiva.nombre}</p>
                    <p className="text-sm text-muted-foreground">{tiendaActiva.codigo}</p>
                  </div>
                  {tiendaActiva.zona && (
                    <Badge variant="secondary">{tiendaActiva.zona}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Para cambiar de tienda, usa el selector en la barra superior
                </p>
              </div>

              {/* Documento de Identidad - Grid con alineación al fondo */}
              <div className="grid grid-cols-1 md:grid-cols-[140px_100px_1fr] gap-4 items-end">
                {/* Tipo de Documento */}
                <FormField
                  control={form.control}
                  name="tipo_documento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Documento</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS_DOCUMENTO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Número de Documento - Solo si aplica */}
                {mostrarNumeroDocumento && (
                  <FormField
                    control={form.control}
                    name="numero_documento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              tipoDocumento === 'DNI'
                                ? '8 dígitos'
                                : tipoDocumento === 'CE'
                                  ? '9 dígitos'
                                  : 'Número'
                            }
                            maxLength={tipoDocumento === 'OTRO' ? 20 : longitudDocumento}
                            {...field}
                            disabled={isLoading}
                            onChange={(e) => {
                              // Solo permitir números para DNI y CE
                              const value =
                                tipoDocumento === 'OTRO'
                                  ? e.target.value
                                  : e.target.value.replace(/\D/g, '')
                              field.onChange(value)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Nombre del Cliente (read-only) - Solo para DNI y CE */}
                {mostrarNombreCliente && (
                  <FormItem>
                    <FormLabel>Nombre del Cliente</FormLabel>
                    <div className="relative">
                      <Input
                        value={
                          documentoLoading
                            ? 'Consultando...'
                            : documentoError
                              ? documentoError
                              : nombreCliente || ''
                        }
                        readOnly
                        disabled
                        className={`bg-muted ${
                          documentoError
                            ? 'text-destructive'
                            : nombreCliente
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                        }`}
                        placeholder="Se completará automáticamente"
                      />
                      {documentoLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormItem>
                )}
              </div>

              {/* ¿Es cliente Entel? */}
              <FormField
                control={form.control}
                name="es_cliente_entel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>¿Es cliente Entel? *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                        <SelectItem value="NO_SABE">No sabe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de visita */}
              <FormField
                control={form.control}
                name="tipo_visita"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de visita *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="VENTA">Venta</SelectItem>
                        <SelectItem value="POSVENTA">Posventa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ¿Concretó operación? */}
              <FormField
                control={form.control}
                name="concreto_operacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>¿Concretó operación? *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ¿Se vendió? - Solo si tipo_visita = VENTA */}
              {tipoVisita === 'VENTA' && (
                <FormField
                  control={form.control}
                  name="se_vendio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Se vendió? *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecciona una opción" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SI">Sí</SelectItem>
                          <SelectItem value="NO">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Motivo no venta - Solo si se_vendio = NO */}
              {tipoVisita === 'VENTA' && seVendio === 'NO' && (
                <FormField
                  control={form.control}
                  name="motivo_no_venta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo de no venta *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Selecciona un motivo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {motivosNoVenta.map((motivo) => (
                            <SelectItem key={motivo.value} value={motivo.value}>
                              {motivo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Botones */}
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar Arribo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
