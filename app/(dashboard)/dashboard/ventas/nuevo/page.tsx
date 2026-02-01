'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import {
  MapPin,
  Calendar,
  Search,
  User,
  Tag,
  Smartphone,
  FileText,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react'
import { getUsuarioFromLocalStorage, getTiendaActiva, TiendaActiva } from '@/lib/auth-client'
import {
  RANGOS_HORARIOS,
  TIPOS_DOCUMENTO,
  ROLES_FECHA_LIBRE,
  ROLES_SIN_TIENDA,
  getRangoHorarioActual,
  validarDocumento,
  getFechaHoy,
  getFechaAyer,
  ORDEN_VENTA_PATTERN,
  ORDEN_VENTA_MESSAGE,
} from '@/lib/constants/tipos-venta'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Usuario } from '@/types'

// Schema de validación con regex actualizado
const ventaSchema = z.object({
  // Fecha y hora
  opcion_fecha: z.enum(['HOY', 'AYER', 'OTRA']),
  fecha: z.string(),
  rango_horario: z.string().length(2),
  motivo_rezago: z.string().optional(),
  asesor_real_id: z.string().optional(),

  // Orden - actualizado para aceptar 7 u 8
  orden_venta: z.string().regex(/^[78]\d{8}$/, ORDEN_VENTA_MESSAGE),

  // Identificación
  telefono_linea: z.string().regex(/^9\d{8}$/, 'Debe ser 9 dígitos y empezar con 9'),
  tipo_documento: z.enum(['DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP']),
  numero_documento: z.string().min(6, 'Mínimo 6 caracteres').max(15, 'Máximo 15 caracteres'),
  nombre_cliente: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),

  // Clasificación
  tipo_venta: z.string().min(1, 'Selecciona un tipo de venta'),
  operador_cedente: z.string().optional(),

  // Equipo
  imei_equipo: z.string().regex(/^\d{15}$/, 'Debe ser 15 dígitos').optional().or(z.literal('')),
  modelo_equipo: z.string().optional(),
  iccid_chip: z.string().regex(/^\d{19,20}$/, 'Debe ser 19-20 dígitos').optional().or(z.literal('')),

  // Seguro y accesorios
  incluye_seguro: z.boolean(),
  incluye_accesorios: z.boolean(),
  descripcion_accesorios: z.string().optional(),

  // Confirmación INAR
  confirmar_inar: z.boolean(),

  // Otros
  notas: z.string().max(500).optional(),
})

type VentaFormValues = z.infer<typeof ventaSchema>

// Tipos para resultado de verificación
interface RegistroInar {
  id: string
  telefono: string
  fecha: string
  plan: string
  vendedor: string
  contrato: string
}

interface LineaVenta {
  id: string
  telefono: string
  tipo_venta: string
  rango_horario: string
  asesor: string
}

interface OrdenVerificada {
  existeEnInar: boolean
  existeEnVentasHoy: boolean
  mensaje: string
  registrosInar?: RegistroInar[]
  lineas?: LineaVenta[]
  cliente?: {
    nombre: string
    tipo_documento: string
    numero_documento: string
  }
}

interface Operador {
  id: string
  codigo: string
  nombre: string
}

// Tipo de venta desde la BD
interface TipoVentaConfig {
  codigo: string
  nombre: string
  categoria: string
  fuente_validacion: string
  requiere_cedente: boolean
  requiere_imei: boolean
  permite_seguro: boolean
  descripcion_ayuda: string | null
}

// Categorías para agrupar tipos de venta
const CATEGORIAS_NOMBRES: Record<string, string> = {
  POSTPAGO: 'Postpago',
  PACK: 'Pack con Equipo',
  PACK_SS: 'Pack SS',
  RENO: 'Renovación',
  PREPAGO: 'Prepago',
  OTROS: 'Otros',
}

export default function NuevaVentaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [tiendaActiva, setTiendaActivaState] = useState<TiendaActiva | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [verificandoOrden, setVerificandoOrden] = useState(false)
  const [ordenVerificada, setOrdenVerificada] = useState<OrdenVerificada | null>(null)
  const [esLineaAdicional, setEsLineaAdicional] = useState(false)
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [tiposVenta, setTiposVenta] = useState<TipoVentaConfig[]>([])
  const [tiposVentaAgrupados, setTiposVentaAgrupados] = useState<Record<string, TipoVentaConfig[]>>({})
  const [categorias, setCategorias] = useState<string[]>([])
  const [loadingTipos, setLoadingTipos] = useState(true)

  const hoy = getFechaHoy()
  const ayer = getFechaAyer()

  const puedeRegistrarFechaLibre = user?.rol && ROLES_FECHA_LIBRE.includes(user.rol as typeof ROLES_FECHA_LIBRE[number])
  const requiereTienda = user?.rol && !ROLES_SIN_TIENDA.includes(user.rol as typeof ROLES_SIN_TIENDA[number])

  const form = useForm<VentaFormValues>({
    resolver: zodResolver(ventaSchema),
    defaultValues: {
      opcion_fecha: 'HOY',
      fecha: hoy,
      rango_horario: getRangoHorarioActual(),
      motivo_rezago: '',
      asesor_real_id: '',
      orden_venta: '',
      telefono_linea: '',
      tipo_documento: 'DNI',
      numero_documento: '',
      nombre_cliente: '',
      tipo_venta: '',
      operador_cedente: '',
      imei_equipo: '',
      modelo_equipo: '',
      iccid_chip: '',
      incluye_seguro: false,
      incluye_accesorios: false,
      descripcion_accesorios: '',
      confirmar_inar: false,
      notas: '',
    },
  })

  const opcionFecha = form.watch('opcion_fecha')
  const tipoVenta = form.watch('tipo_venta')
  const tipoDocumento = form.watch('tipo_documento')
  const incluyeAccesorios = form.watch('incluye_accesorios')
  const confirmarInar = form.watch('confirmar_inar')

  const tipoVentaConfig = tipoVenta ? tiposVenta.find((t) => t.codigo === tipoVenta) : null
  const requiereCedente = tipoVentaConfig?.requiere_cedente ?? false
  const requiereImei = tipoVentaConfig?.requiere_imei ?? false
  const permiteSeguro = tipoVentaConfig?.permite_seguro ?? false
  const esRenovacionOAccesorios = tipoVenta === 'RENO' || tipoVenta === 'ACCESORIOS'
  const muestraIccid = !esRenovacionOAccesorios && tipoVenta !== ''

  // Cargar usuario y tienda activa
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)

    const tienda = getTiendaActiva()
    if (!tienda && requiereTienda) {
      router.push('/seleccionar-tienda')
      return
    }
    setTiendaActivaState(tienda)
  }, [router, requiereTienda])

  // Cargar tipos de venta desde la BD
  useEffect(() => {
    async function loadTiposVenta() {
      try {
        setLoadingTipos(true)
        const response = await fetch('/api/tipos-venta')
        const data = await response.json()
        if (data.tiposVenta) {
          setTiposVenta(data.tiposVenta)
          setTiposVentaAgrupados(data.tiposAgrupados || {})
          setCategorias(data.categorias || [])
        }
      } catch (error) {
        console.error('Error cargando tipos de venta:', error)
      } finally {
        setLoadingTipos(false)
      }
    }
    loadTiposVenta()
  }, [])

  // Cargar operadores cedentes
  useEffect(() => {
    async function loadOperadores() {
      try {
        const response = await fetch('/api/operadores-cedentes')
        const data = await response.json()
        if (data.operadores) {
          setOperadores(data.operadores)
        }
      } catch (error) {
        console.error('Error cargando operadores:', error)
      }
    }
    loadOperadores()
  }, [])

  // Actualizar fecha cuando cambia opción
  useEffect(() => {
    if (opcionFecha === 'HOY') {
      form.setValue('fecha', hoy)
      form.setValue('rango_horario', getRangoHorarioActual())
      form.setValue('motivo_rezago', '')
    } else if (opcionFecha === 'AYER') {
      form.setValue('fecha', ayer)
    }
  }, [opcionFecha, form, hoy, ayer])

  // Verificar orden de venta
  const verificarOrden = useCallback(async (orden: string) => {
    // Limpiar espacios
    const ordenLimpia = orden.trim()

    // Validar que no esté vacía
    if (!ordenLimpia) {
      form.setError('orden_venta', { message: 'Ingresa el número de orden' })
      setOrdenVerificada(null)
      setEsLineaAdicional(false)
      return
    }

    // Validar formato: 9 dígitos, empieza con 7 u 8
    if (!ORDEN_VENTA_PATTERN.test(ordenLimpia)) {
      form.setError('orden_venta', { message: ORDEN_VENTA_MESSAGE })
      setOrdenVerificada(null)
      setEsLineaAdicional(false)
      return
    }

    // Limpiar error previo si el formato es válido
    form.clearErrors('orden_venta')
    // Reset confirmación INAR
    form.setValue('confirmar_inar', false)

    setVerificandoOrden(true)
    try {
      const fecha = form.getValues('fecha')
      console.log('Verificando orden:', ordenLimpia, 'fecha:', fecha)

      const response = await fetch(`/api/ventas/verificar-orden?orden=${ordenLimpia}&fecha=${fecha}`)
      const data = await response.json()

      console.log('Respuesta verificación:', data)

      if (response.ok) {
        setOrdenVerificada(data)
        setEsLineaAdicional(false)
      } else {
        console.error('Error en respuesta:', data)
        form.setError('orden_venta', { message: data.error || 'Error al verificar' })
        setOrdenVerificada(null)
      }
    } catch (error) {
      console.error('Error verificando orden:', error)
      form.setError('orden_venta', { message: 'Error de conexión al verificar' })
      setOrdenVerificada(null)
    } finally {
      setVerificandoOrden(false)
    }
  }, [form])

  // Agregar línea adicional a orden existente
  const agregarLineaAdicional = () => {
    if (ordenVerificada?.cliente) {
      form.setValue('tipo_documento', ordenVerificada.cliente.tipo_documento as 'DNI' | 'CE' | 'RUC' | 'PASAPORTE' | 'PTP')
      form.setValue('numero_documento', ordenVerificada.cliente.numero_documento)
      form.setValue('nombre_cliente', ordenVerificada.cliente.nombre)
      setEsLineaAdicional(true)
    }
  }

  // Cancelar y limpiar orden
  const cancelarOrden = () => {
    form.setValue('orden_venta', '')
    form.setValue('confirmar_inar', false)
    setOrdenVerificada(null)
    setEsLineaAdicional(false)
  }

  async function onSubmit(values: VentaFormValues) {
    if (!user) return

    // Validar documento según tipo
    if (!validarDocumento(values.tipo_documento, values.numero_documento)) {
      const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === values.tipo_documento)
      form.setError('numero_documento', {
        message: `Formato inválido para ${tipoDoc?.nombre}`,
      })
      return
    }

    // Validar IMEI si es requerido
    if (requiereImei && !values.imei_equipo) {
      form.setError('imei_equipo', { message: 'El IMEI es requerido para este tipo de venta' })
      return
    }

    // Validar operador cedente si es requerido
    if (requiereCedente && !values.operador_cedente) {
      form.setError('operador_cedente', { message: 'Selecciona el operador cedente' })
      return
    }

    // Validar motivo rezago si no es hoy
    if (values.opcion_fecha !== 'HOY' && !values.motivo_rezago) {
      form.setError('motivo_rezago', { message: 'Indica el motivo del registro tardío' })
      return
    }

    // Validar confirmación si existe en INAR
    if (ordenVerificada?.existeEnInar && !values.confirmar_inar) {
      form.setError('confirmar_inar', { message: 'Debes confirmar que deseas continuar' })
      return
    }

    setIsLoading(true)
    setIsSuccess(false)

    try {
      const tipoConfig = tiposVenta.find((t) => t.codigo === values.tipo_venta)
      const esRezagada = values.opcion_fecha !== 'HOY'

      const ventaData = {
        // Automáticos
        tienda_id: tiendaActiva?.id || null,
        usuario_id: values.asesor_real_id || user.id,
        codigo_asesor: user.codigo_asesor,
        registrado_por: user.id,

        // Fecha y hora
        fecha: values.fecha,
        rango_horario: values.rango_horario,
        es_venta_rezagada: esRezagada,
        motivo_rezago: esRezagada ? values.motivo_rezago : null,

        // Estado
        estado: esRezagada && !puedeRegistrarFechaLibre ? 'pendiente_aprobacion' : 'registrada',

        // Identificación
        orden_venta: values.orden_venta,
        telefono_linea: values.telefono_linea,
        tipo_documento_cliente: values.tipo_documento,
        numero_documento_cliente: values.numero_documento,
        nombre_cliente: values.nombre_cliente,

        // Clasificación
        tipo_venta: values.tipo_venta,
        categoria_venta: tipoConfig?.categoria || null,
        operador_cedente: requiereCedente ? values.operador_cedente : null,

        // Equipo
        imei_equipo: values.imei_equipo || null,
        modelo_equipo: values.modelo_equipo || null,
        iccid_chip: values.iccid_chip || null,

        // Seguro
        incluye_seguro: values.incluye_seguro || false,

        // Accesorios
        incluye_accesorios: values.incluye_accesorios || false,
        descripcion_accesorios: values.incluye_accesorios ? values.descripcion_accesorios : null,

        // Monto (se calcula después en el cruce con INAR)
        monto_liquidado: 0,

        // Otros
        notas: values.notas || null,
        estado_cruce: 'PENDIENTE',
      }

      const response = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ventaData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar venta')
      }

      setIsSuccess(true)
      form.reset()
      setOrdenVerificada(null)
      setEsLineaAdicional(false)

      // Ocultar mensaje de éxito después de 5 segundos
      setTimeout(() => setIsSuccess(false), 5000)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al registrar venta: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user || loadingTipos) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registrar Venta</h1>
            <p className="text-muted-foreground">
              Registro declarativo de ventas (Boca de Urna)
            </p>
          </div>
          {tiendaActiva && (
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-2 text-base">
              <MapPin className="h-4 w-4" />
              <span>{tiendaActiva.nombre}</span>
              <span className="text-muted-foreground">({tiendaActiva.zona})</span>
            </Badge>
          )}
        </div>

        {/* Mensaje de éxito */}
        {isSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Venta registrada exitosamente</AlertTitle>
            <AlertDescription className="text-green-700">
              <div className="flex gap-4 mt-2">
                <Button size="sm" onClick={() => setIsSuccess(false)}>
                  Registrar otra venta
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/ventas')}>
                  Ver mis ventas
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* SECCIÓN 1: FECHA Y HORA */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  Fecha y Hora de la Venta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="opcion_fecha"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="HOY" id="hoy" />
                            <Label htmlFor="hoy" className="cursor-pointer">
                              Venta de HOY ({hoy})
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="AYER" id="ayer" />
                            <Label htmlFor="ayer" className="cursor-pointer">
                              Venta de AYER ({ayer})
                            </Label>
                          </div>
                          {puedeRegistrarFechaLibre && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="OTRA" id="otra" />
                              <Label htmlFor="otra" className="cursor-pointer">
                                Otra fecha
                              </Label>
                            </div>
                          )}
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  {opcionFecha === 'OTRA' && (
                    <FormField
                      control={form.control}
                      name="fecha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              max={ayer}
                              {...field}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {opcionFecha !== 'HOY' && (
                    <FormField
                      control={form.control}
                      name="rango_horario"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rango Horario *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona hora" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RANGOS_HORARIOS.map((rango) => (
                                <SelectItem key={rango.codigo} value={rango.codigo}>
                                  {rango.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {opcionFecha !== 'HOY' && (
                  <>
                    <Alert variant="destructive" className="bg-amber-50 border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800">Venta Rezagada</AlertTitle>
                      <AlertDescription className="text-amber-700">
                        {puedeRegistrarFechaLibre
                          ? 'Registrando venta de fecha anterior.'
                          : 'Esta venta requiere aprobación y genera una incidencia.'}
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name="motivo_rezago"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motivo del registro tardío *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Explica por qué no se registró en su momento..."
                              className="resize-none"
                              rows={2}
                              {...field}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* SECCIÓN 2: ORDEN DE VENTA */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5" />
                  Orden de Venta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="orden_venta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Orden *</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="712345678 o 812345678"
                            maxLength={9}
                            {...field}
                            disabled={isLoading || esLineaAdicional}
                            onChange={(e) => {
                              field.onChange(e)
                              // Limpiar verificación previa cuando cambia el valor
                              if (ordenVerificada) {
                                setOrdenVerificada(null)
                                setEsLineaAdicional(false)
                              }
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => verificarOrden(field.value)}
                          disabled={isLoading || verificandoOrden || esLineaAdicional}
                        >
                          {verificandoOrden ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Verificar'
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        9 dígitos, debe empezar con 7 u 8
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Alerta: Orden existe en INAR */}
                {ordenVerificada?.existeEnInar && !esLineaAdicional && (
                  <Alert variant="destructive" className="bg-amber-50 border-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">
                      Esta orden ya fue procesada en el INAR
                    </AlertTitle>
                    <AlertDescription className="text-amber-700">
                      <div className="mt-2 space-y-2">
                        <p className="font-medium">Registros encontrados:</p>
                        {ordenVerificada.registrosInar?.map((reg, idx) => (
                          <div key={idx} className="text-sm bg-amber-100 p-2 rounded">
                            <div>Teléfono: <strong>{reg.telefono}</strong></div>
                            <div>Fecha: {reg.fecha}</div>
                            <div>Plan: {reg.plan}</div>
                            <div>Vendedor: {reg.vendedor}</div>
                          </div>
                        ))}
                        <div className="mt-4 pt-3 border-t border-amber-300">
                          <FormField
                            control={form.control}
                            name="confirmar_inar"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-amber-800 font-medium">
                                    Confirmo que deseo registrar esta venta de todas formas
                                  </FormLabel>
                                  <FormDescription className="text-amber-600">
                                    La orden ya existe en INAR. Solo marca esto si estás seguro.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelarOrden}
                          >
                            Cancelar y usar otra orden
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Alerta: Orden tiene líneas registradas hoy */}
                {ordenVerificada?.existeEnVentasHoy && !ordenVerificada.existeEnInar && !esLineaAdicional && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">
                      Esta orden tiene líneas registradas hoy
                    </AlertTitle>
                    <AlertDescription className="text-blue-700">
                      <div className="mt-2 space-y-2">
                        {ordenVerificada.lineas?.map((linea, idx) => (
                          <div key={idx} className="text-sm">
                            • {linea.telefono} | {linea.tipo_venta} | {linea.rango_horario}:00 | Por: {linea.asesor}
                          </div>
                        ))}
                        {ordenVerificada.cliente && (
                          <div className="mt-2 pt-2 border-t border-blue-200">
                            <strong>Cliente:</strong> {ordenVerificada.cliente.nombre}<br />
                            <strong>{ordenVerificada.cliente.tipo_documento}:</strong> {ordenVerificada.cliente.numero_documento}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            type="button"
                            size="sm"
                            onClick={agregarLineaAdicional}
                          >
                            Agregar otra línea a esta orden
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelarOrden}
                          >
                            Cancelar - ingresé mal el número
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Alerta: Orden disponible (nueva) */}
                {ordenVerificada && !ordenVerificada.existeEnInar && !ordenVerificada.existeEnVentasHoy && !esLineaAdicional && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">
                      Orden disponible
                    </AlertTitle>
                    <AlertDescription className="text-green-700">
                      Esta orden no tiene registros previos. Puedes continuar con el registro.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Alerta: Agregando línea adicional */}
                {esLineaAdicional && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">
                      Agregando línea adicional
                    </AlertTitle>
                    <AlertDescription className="text-green-700">
                      Los datos del cliente se completaron automáticamente.
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="p-0 h-auto ml-2 text-green-800"
                        onClick={cancelarOrden}
                      >
                        Cancelar
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* SECCIÓN 3: IDENTIFICACIÓN */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Datos de Identificación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="telefono_linea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono / Línea *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="987654321"
                            maxLength={9}
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormDescription>
                          9 dígitos, debe empezar con 9
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="tipo_documento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isLoading || esLineaAdicional}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIPOS_DOCUMENTO.map((tipo) => (
                                <SelectItem key={tipo.codigo} value={tipo.codigo}>
                                  {tipo.nombre}
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
                      name="numero_documento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Documento *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                TIPOS_DOCUMENTO.find((t) => t.codigo === tipoDocumento)?.placeholder
                              }
                              maxLength={
                                TIPOS_DOCUMENTO.find((t) => t.codigo === tipoDocumento)?.longitud
                              }
                              {...field}
                              disabled={isLoading || esLineaAdicional}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="nombre_cliente"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nombre del Cliente *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Como aparece en el documento"
                            {...field}
                            disabled={isLoading || esLineaAdicional}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓN 4: CLASIFICACIÓN */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="h-5 w-5" />
                  Clasificación de la Venta
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm p-4">
                      <div className="space-y-2 text-sm">
                        <p><strong>VENTA REGULAR (VR):</strong></p>
                        <p>• VR_MONO: Cliente NUEVO, primera o única línea</p>
                        <p>• VR_CAPTURA: Cliente NUEVO, 2da línea en adelante</p>
                        <p>• VR_LLAA: Cliente BASE ({'>'}30 días en Entel)</p>
                        <p className="mt-2"><strong>PORTABILIDAD:</strong></p>
                        <p>• OSS = Origen Pospago (del otro operador)</p>
                        <p>• OPP = Origen Prepago (del otro operador)</p>
                        <p>• BASE = Cliente con {'>'}30 días en Entel</p>
                        <p>• CAPTURA = Cliente nuevo en Entel</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tipo_venta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Venta *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona tipo de venta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categorias.map((categoria) => (
                              <SelectGroup key={categoria}>
                                <SelectLabel className="font-bold text-primary">
                                  {CATEGORIAS_NOMBRES[categoria] || categoria}
                                </SelectLabel>
                                {tiposVentaAgrupados[categoria]?.map((tipo) => (
                                  <SelectItem key={tipo.codigo} value={tipo.codigo}>
                                    {tipo.nombre}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                        {tipoVentaConfig && tipoVentaConfig.descripcion_ayuda && (
                          <FormDescription>
                            {tipoVentaConfig.descripcion_ayuda}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {requiereCedente && (
                    <FormField
                      control={form.control}
                      name="operador_cedente"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operador Cedente *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona operador" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {operadores.map((op) => (
                                <SelectItem key={op.codigo} value={op.codigo}>
                                  {op.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓN 5: EQUIPO Y SEGURO */}
            {(requiereImei || permiteSeguro || muestraIccid || tipoVenta) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Smartphone className="h-5 w-5" />
                    Equipo y Seguro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(requiereImei || permiteSeguro) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="imei_equipo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              IMEI Equipo {requiereImei && '*'}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="123456789012345"
                                maxLength={15}
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormDescription>15 dígitos</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="modelo_equipo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modelo Equipo</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Samsung Galaxy A54"
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {permiteSeguro && (
                    <FormField
                      control={form.control}
                      name="incluye_seguro"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Incluye Seguro MEP</FormLabel>
                            <FormDescription>
                              Marcar si la venta incluye seguro de equipo
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  )}

                  {muestraIccid && (
                    <FormField
                      control={form.control}
                      name="iccid_chip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ICCID Chip (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="8951100000000000000"
                              maxLength={20}
                              {...field}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormDescription>19-20 dígitos</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="incluye_accesorios"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Incluye Accesorios</FormLabel>
                          <FormDescription>
                            Marcar si la venta incluye accesorios adicionales
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {incluyeAccesorios && (
                    <FormField
                      control={form.control}
                      name="descripcion_accesorios"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción de Accesorios</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: Funda, cargador, audífonos"
                              {...field}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECCIÓN 6: OBSERVACIONES */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Observaciones (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notas"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Observaciones adicionales sobre la venta..."
                          className="resize-none"
                          rows={3}
                          maxLength={500}
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/500 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={isLoading || (ordenVerificada?.existeEnInar && !confirmarInar)}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Registrar Venta'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset()
                  setOrdenVerificada(null)
                  setEsLineaAdicional(false)
                }}
                disabled={isLoading}
              >
                Limpiar Formulario
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </TooltipProvider>
  )
}
