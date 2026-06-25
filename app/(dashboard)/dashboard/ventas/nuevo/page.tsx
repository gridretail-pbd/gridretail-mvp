'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import {
  MapPin,
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
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { getUsuarioFromLocalStorage, getTiendaActiva, TiendaActiva } from '@/lib/auth-client'
import { TablaArribosVendibles } from '@/components/ventas/TablaArribosVendibles'
import {
  RANGOS_HORARIOS,
  TIPOS_DOCUMENTO,
  ROLES_FECHA_LIBRE,
  ROLES_SIN_TIENDA,
  getRangoHorarioActual,
  validarDocumento,
  getFechaHoy,
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
  // Vínculo obligatorio al arribo: la fecha y la tienda se heredan de él.
  arribo_id: z.string().uuid('Debes seleccionar un arribo'),

  // Rezago: el servidor los exige si la venta es de fecha anterior y el rol no
  // tiene "fecha libre". El form los muestra/valida solo en ese caso.
  rango_horario: z.string().optional(),
  motivo_rezago: z.string().optional(),

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

// Arribo vinculado a la venta (Camino A: GET /api/arribos/[id]; Camino B: tabla).
interface ArriboLink {
  id: string
  tienda_id: string
  fecha: string
  hora?: string
  tipo_visita?: string
  resultado?: string | null
  tipo_documento_cliente: string | null
  dni_cliente: string | null
  nombre_cliente: string | null
  es_cliente_entel?: boolean | null
}

// Tipos de documento válidos en ventas (sin OTRO). Para "elevación" 7.1.
const TIPOS_DOC_VENTA = ['DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP']

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

  // Estados para consulta DNI (json.pe)
  const [consultandoDocumento, setConsultandoDocumento] = useState(false)
  const [documentoError, setDocumentoError] = useState<string | null>(null)
  const lastDocQueryRef = useRef<string>('')

  // Vínculo al arribo (Camino A por query param, o Camino B desde la tabla).
  const searchParams = useSearchParams()
  const arriboIdQuery = searchParams.get('arribo_id')
  const [arribo, setArribo] = useState<ArriboLink | null>(null)
  const [mostrandoTabla, setMostrandoTabla] = useState(!arriboIdQuery)
  const [cargandoArribo, setCargandoArribo] = useState(!!arriboIdQuery)
  const [fechaTabla, setFechaTabla] = useState<string>(getFechaHoy())

  const hoy = getFechaHoy()

  const puedeRegistrarFechaLibre = user?.rol && ROLES_FECHA_LIBRE.includes(user.rol as typeof ROLES_FECHA_LIBRE[number])
  const requiereTienda = user?.rol && !ROLES_SIN_TIENDA.includes(user.rol as typeof ROLES_SIN_TIENDA[number])

  // Rezago: derivado de la fecha del arribo (no del cliente).
  const esRezagada = !!arribo && arribo.fecha !== hoy
  const requiereAutorizacion = esRezagada && !puedeRegistrarFechaLibre

  const form = useForm<VentaFormValues>({
    resolver: zodResolver(ventaSchema),
    defaultValues: {
      arribo_id: '',
      rango_horario: getRangoHorarioActual(),
      motivo_rezago: '',
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

  const tipoVenta = form.watch('tipo_venta')
  const tipoDocumento = form.watch('tipo_documento')
  const numeroDocumento = form.watch('numero_documento')
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

  // Vincular un arribo y pre-llenar (hacia adelante, editable).
  const vincularArribo = useCallback(
    (a: ArriboLink) => {
      setArribo(a)
      setMostrandoTabla(false)
      form.setValue('arribo_id', a.id)

      // "Elevación" 7.1: si el doc del arribo es OTRO/nulo o no es de los 5
      // tipos válidos en ventas, dejar vacío para exigir uno válido.
      const tipoValido =
        !!a.tipo_documento_cliente && TIPOS_DOC_VENTA.includes(a.tipo_documento_cliente)
      form.setValue(
        'tipo_documento',
        (tipoValido ? a.tipo_documento_cliente : 'DNI') as VentaFormValues['tipo_documento']
      )
      form.setValue('numero_documento', tipoValido ? a.dni_cliente ?? '' : '')
      form.setValue('nombre_cliente', a.nombre_cliente ?? '')
    },
    [form]
  )

  // Camino A: releer el arribo por id (la página es nueva y pierde el estado).
  useEffect(() => {
    if (!arriboIdQuery || !user) return
    let cancelado = false
    ;(async () => {
      setCargandoArribo(true)
      try {
        const res = await fetch(
          `/api/arribos/${arriboIdQuery}?usuario_id=${user.id}`
        )
        const json = await res.json()
        if (cancelado) return
        if (!res.ok) {
          toast.error(json.error ?? 'No se pudo cargar el arribo')
          setMostrandoTabla(true)
          return
        }
        if (json.arribo.tipo_visita === 'POSVENTA') {
          toast.error('No se puede registrar una venta sobre un arribo de posventa')
          setMostrandoTabla(true)
          return
        }
        vincularArribo(json.arribo)
      } catch {
        if (!cancelado) {
          toast.error('Error de conexión al cargar el arribo')
          setMostrandoTabla(true)
        }
      } finally {
        if (!cancelado) setCargandoArribo(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [arriboIdQuery, user, vincularArribo])

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

  // Consultar DNI en json.pe
  const consultarDocumento = useCallback(async (numero: string) => {
    if (!/^\d{8}$/.test(numero)) return

    const queryKey = `DNI-${numero}`
    if (queryKey === lastDocQueryRef.current) return

    lastDocQueryRef.current = queryKey
    setConsultandoDocumento(true)
    setDocumentoError(null)

    try {
      const response = await fetch(`/api/consulta-documento?tipo=DNI&numero=${numero}`)
      const data = await response.json()

      if (data.success && data.data) {
        const { apellido_paterno, apellido_materno, nombres } = data.data
        const nombreCompleto = `${apellido_paterno} ${apellido_materno}, ${nombres}`
        form.setValue('nombre_cliente', nombreCompleto)
        setDocumentoError(null)
      } else {
        setDocumentoError(data.message || 'DNI no encontrado')
      }
    } catch {
      setDocumentoError('Error de conexión')
    } finally {
      setConsultandoDocumento(false)
    }
  }, [form])

  // Auto-consultar cuando se completan 8 dígitos de DNI
  useEffect(() => {
    if (esLineaAdicional) return
    if (tipoDocumento !== 'DNI' || !numeroDocumento) return
    if (numeroDocumento.length === 8 && /^\d{8}$/.test(numeroDocumento)) {
      consultarDocumento(numeroDocumento)
    }
  }, [tipoDocumento, numeroDocumento, consultarDocumento, esLineaAdicional])

  // Resetear consulta cuando cambia tipo de documento
  useEffect(() => {
    setDocumentoError(null)
    lastDocQueryRef.current = ''
  }, [tipoDocumento])

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
      const fecha = arribo?.fecha ?? hoy
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
  }, [form, arribo, hoy])

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

    // Debe haber un arribo vinculado (Camino A o B).
    if (!arribo || !values.arribo_id) {
      toast.error('Selecciona el arribo al que pertenece esta venta')
      setMostrandoTabla(true)
      return
    }

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

    // Venta rezagada sin fecha libre: exigir motivo y rango horario (el server
    // también los exige; aquí se evita el 400).
    if (requiereAutorizacion) {
      if (!values.motivo_rezago?.trim()) {
        form.setError('motivo_rezago', { message: 'Indica el motivo del registro tardío' })
        return
      }
      if (!values.rango_horario) {
        form.setError('rango_horario', { message: 'Selecciona el rango horario' })
        return
      }
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

      // El servidor deriva fecha/tienda del arribo, el estado de rezago y el
      // vendedor. Solo enviamos la identidad del usuario actual y arribo_id.
      const ventaData = {
        arribo_id: values.arribo_id,
        usuario_id: user.id,

        // Rezago (el server decide la obligatoriedad real y el estado)
        rango_horario: values.rango_horario || null,
        motivo_rezago: values.motivo_rezago || null,

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

        // Seguro y accesorios
        incluye_seguro: values.incluye_seguro || false,
        incluye_accesorios: values.incluye_accesorios || false,
        descripcion_accesorios: values.incluye_accesorios ? values.descripcion_accesorios : null,

        // Otros
        notas: values.notas || null,
      }

      const response = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ventaData),
      })

      const data = await response.json()

      if (!response.ok) {
        // Catálogo de errores del backend §3.
        const mensajes: Record<number, string> = {
          400: data.error || 'Datos inválidos',
          403: 'No tienes acceso a la tienda del arribo',
          404: 'El arribo ya no existe',
          409: 'La orden de venta ya existe',
          422: 'No se puede registrar venta sobre un arribo de posventa',
        }
        throw new Error(mensajes[response.status] || data.error || 'Error al registrar venta')
      }

      toast.success('Venta registrada exitosamente')
      setIsSuccess(true)
      setOrdenVerificada(null)
      setEsLineaAdicional(false)
      router.push('/dashboard/ventas')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al registrar venta: ' + (error as Error).message)
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
          <div className="flex flex-col items-end gap-2">
            {/* Vendedor: se atribuye a la sesión activa (anti-error de asignación) */}
            <Badge className="flex items-center gap-2 bg-primary px-3 py-2 text-base text-primary-foreground">
              <User className="h-4 w-4" />
              <span>Vendedor: {user.nombre_completo}</span>
            </Badge>
            {tiendaActiva && (
              <Badge variant="outline" className="flex items-center gap-2 px-3 py-2 text-base">
                <MapPin className="h-4 w-4" />
                <span>{tiendaActiva.nombre}</span>
                <span className="text-muted-foreground">({tiendaActiva.zona})</span>
              </Badge>
            )}
          </div>
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
            {/* SECCIÓN 1: ARRIBO VINCULADO */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Link2 className="h-5 w-5" />
                  Arribo vinculado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cargandoArribo ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando arribo...
                  </div>
                ) : arribo ? (
                  <>
                    {/* Banner del arribo vinculado */}
                    <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 text-sm">
                      <span>
                        Venta vinculada al arribo de{' '}
                        <b>
                          {arribo.nombre_cliente ??
                            arribo.dni_cliente ??
                            'cliente sin documento'}
                        </b>
                        {arribo.hora ? ` · ${arribo.hora.slice(0, 5)}` : ''} · {arribo.fecha}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setArribo(null)
                          setMostrandoTabla(true)
                          form.setValue('arribo_id', '')
                        }}
                        className="text-xs text-slate-500 underline"
                      >
                        Cambiar arribo
                      </button>
                    </div>

                    {/* Aviso de venta rezagada (la fecha viene del arribo) */}
                    {esRezagada && (
                      <Alert variant="destructive" className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">
                          Venta de fecha anterior
                        </AlertTitle>
                        <AlertDescription className="text-amber-700">
                          Esta venta es de una fecha anterior ({arribo.fecha}).{' '}
                          {requiereAutorizacion
                            ? 'Quedará pendiente de aprobación.'
                            : 'Registrando con fecha libre.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {requiereAutorizacion && (
                      <div className="grid gap-4 md:grid-cols-2">
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

                        <FormField
                          control={form.control}
                          name="motivo_rezago"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
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
                      </div>
                    )}
                  </>
                ) : mostrandoTabla ? (
                  tiendaActiva ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FormLabel className="whitespace-nowrap">Arribos del día</FormLabel>
                        <Input
                          type="date"
                          value={fechaTabla}
                          max={hoy}
                          onChange={(e) => setFechaTabla(e.target.value)}
                          className="w-auto"
                          disabled={isLoading}
                        />
                      </div>
                      <TablaArribosVendibles
                        tiendaId={tiendaActiva.id}
                        fecha={fechaTabla}
                        usuarioId={user.id}
                        onSelect={(a) =>
                          vincularArribo({
                            // tienda_id y fecha provienen del contexto de la tabla.
                            id: a.id,
                            tienda_id: tiendaActiva.id,
                            fecha: fechaTabla,
                            hora: a.hora,
                            tipo_visita: a.tipo_visita,
                            resultado: a.resultado,
                            tipo_documento_cliente: a.tipo_documento_cliente,
                            dni_cliente: a.dni_cliente,
                            nombre_cliente: a.nombre_cliente,
                            es_cliente_entel: a.es_cliente_entel,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Selecciona una tienda para ver sus arribos.
                    </p>
                  )
                ) : null}
              </CardContent>
            </Card>

            {/* El resto del formulario solo aplica con un arribo vinculado */}
            {arribo && (
              <>

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
                        <div className="relative">
                          <FormControl>
                            <Input
                              placeholder="Como aparece en el documento"
                              {...field}
                              disabled={isLoading || esLineaAdicional || consultandoDocumento}
                            />
                          </FormControl>
                          {consultandoDocumento && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        {documentoError && tipoDocumento === 'DNI' && (
                          <p className="text-sm text-amber-600">{documentoError} - ingresa el nombre manualmente</p>
                        )}
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
              </>
            )}
          </form>
        </Form>
      </div>
    </TooltipProvider>
  )
}
