import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { CAMPOS_DESTINO, type CampoDestino } from '@/lib/rrhh/types'
import type { NivelCompletitud } from '@/lib/rrhh/types'
import type {
  DetalleFilaImportacion,
  ReporteBrechas,
  AnalisisBrechas,
  MapeoColumna,
} from '@/lib/rrhh/interfaces'

// ─── Normalization Maps ────────────────────────────────────────────────────

const ROL_NORMALIZATION: Record<string, string> = {
  vendedor: 'ASESOR', vendedora: 'ASESOR',
  asesor: 'ASESOR', asesora: 'ASESOR',
  'asesor comercial': 'ASESOR', 'asesora comercial': 'ASESOR',
  'asesor de ventas': 'ASESOR',
  referente: 'ASESOR_REFERENTE', 'asesor referente': 'ASESOR_REFERENTE',
  'encargado de tienda': 'ASESOR_REFERENTE', 'encargado': 'ASESOR_REFERENTE',
  coordinador: 'COORDINADOR', coordinadora: 'COORDINADOR',
  supervisor: 'SUPERVISOR', supervisora: 'SUPERVISOR',
  'jefe de ventas': 'JEFE_VENTAS', 'jefe ventas': 'JEFE_VENTAS',
  'gerente comercial': 'GERENTE_COMERCIAL',
  'gerente general': 'GERENTE_GENERAL',
  backoffice: 'BACKOFFICE_OPERACIONES',
  'back office': 'BACKOFFICE_OPERACIONES',
  admin: 'ADMIN', administrador: 'ADMIN',
}

const VALID_ROLES = [
  'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
  'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
  'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
  'VALIDADOR_ARRIBOS', 'ADMIN',
]

const TIPO_CONTRATO_NORM: Record<string, string> = {
  'plazo fijo': 'PLAZO_FIJO', 'contrato fijo': 'PLAZO_FIJO', mensual: 'PLAZO_FIJO',
  indeterminado: 'INDETERMINADO', indefinido: 'INDETERMINADO',
  rxh: 'RXH', 'recibo por honorarios': 'RXH', honorarios: 'RXH',
  'periodo de prueba': 'PERIODO_PRUEBA', 'periodo prueba': 'PERIODO_PRUEBA',
}

const GENERO_NORM: Record<string, string> = {
  masculino: 'MASCULINO', m: 'MASCULINO', hombre: 'MASCULINO', male: 'MASCULINO',
  femenino: 'FEMENINO', f: 'FEMENINO', mujer: 'FEMENINO', female: 'FEMENINO',
  otro: 'OTRO', other: 'OTRO',
  'no especifica': 'NO_ESPECIFICA', 'no indica': 'NO_ESPECIFICA',
}

const ESTADO_CIVIL_NORM: Record<string, string> = {
  soltero: 'SOLTERO', soltera: 'SOLTERO', 's': 'SOLTERO',
  casado: 'CASADO', casada: 'CASADO', 'c': 'CASADO',
  conviviente: 'CONVIVIENTE',
  divorciado: 'DIVORCIADO', divorciada: 'DIVORCIADO',
  viudo: 'VIUDO', viuda: 'VIUDO',
}

const AREA_NORM: Record<string, string> = {
  comercial: 'COMERCIAL', ventas: 'COMERCIAL',
  operaciones: 'OPERACIONES',
  rrhh: 'RRHH', 'recursos humanos': 'RRHH',
  mantenimiento: 'MANTENIMIENTO',
  administracion: 'ADMINISTRACION', admin: 'ADMINISTRACION',
}

const MOTIVO_CESE_NORM: Record<string, string> = {
  renuncia: 'CESE_VOLUNTARIO', 'renuncia voluntaria': 'CESE_VOLUNTARIO', voluntario: 'CESE_VOLUNTARIO',
  despido: 'CESE_DESPIDO', despedido: 'CESE_DESPIDO',
  'no renovacion': 'CESE_NO_RENOVACION', 'no renovado': 'CESE_NO_RENOVACION',
  abandono: 'CESE_ABANDONO', 'abandono de puesto': 'CESE_ABANDONO',
  'periodo prueba': 'CESE_PERIODO_PRUEBA', 'no supero periodo': 'CESE_PERIODO_PRUEBA',
}

const STATUS_NORM: Record<string, string> = {
  activo: 'ACTIVO', vigente: 'ACTIVO', active: 'ACTIVO',
  cesado: 'CESADO', inactivo: 'CESADO', baja: 'CESADO',
  suspendido: 'SUSPENDIDO',
  licencia: 'LICENCIA',
}

const SISTEMA_PENSIONARIO_NORM: Record<string, string> = {
  afp: 'AFP', privado: 'AFP', 'sistema privado': 'AFP',
  onp: 'ONP', 'público': 'ONP', publico: 'ONP', nacional: 'ONP', 'sistema nacional': 'ONP',
}

const TIPO_DOCUMENTO_NORM: Record<string, string> = {
  dni: 'DNI', 'documento nacional': 'DNI', 'documento nacional de identidad': 'DNI',
  ce: 'CE', 'carnet de extranjería': 'CE', 'carnet de extranjeria': 'CE', 'carné': 'CE',
  pasaporte: 'PASAPORTE',
  ptp: 'PTP', 'permiso temporal': 'PTP', 'permiso temporal de permanencia': 'PTP',
}

const NIVEL_EDUCATIVO_NORM: Record<string, string> = {
  'secundaria incompleta': 'SECUNDARIA_INCOMPLETA', 'sec. incompleta': 'SECUNDARIA_INCOMPLETA',
  secundaria: 'SECUNDARIA', 'sec. completa': 'SECUNDARIA', 'secundaria completa': 'SECUNDARIA',
  'técnico incompleto': 'TECNICO_INCOMPLETO', 'tecnico incompleto': 'TECNICO_INCOMPLETO', 'instituto incompleto': 'TECNICO_INCOMPLETO',
  'técnico': 'TECNICO', tecnico: 'TECNICO', instituto: 'TECNICO', 'técnico completo': 'TECNICO', 'tecnico completo': 'TECNICO',
  'universitario incompleto': 'UNIVERSITARIO_INCOMPLETO', 'univ. incompleto': 'UNIVERSITARIO_INCOMPLETO',
  universitario: 'UNIVERSITARIO', universidad: 'UNIVERSITARIO', bachiller: 'UNIVERSITARIO', 'universitario completo': 'UNIVERSITARIO',
  postgrado: 'POSTGRADO', 'maestría': 'POSTGRADO', maestria: 'POSTGRADO', doctorado: 'POSTGRADO', 'post grado': 'POSTGRADO',
}

const GRUPO_SANGUINEO_VALID = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeEnum(value: string, normMap: Record<string, string>): string | null {
  if (!value) return null
  const lower = value.toLowerCase().trim()
  // Direct enum match (already correct format)
  const upper = value.toUpperCase().trim()
  if (Object.values(normMap).includes(upper)) return upper
  // Normalized match
  return normMap[lower] || null
}

function isValidDate(value: string): boolean {
  if (!value) return false
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return !isNaN(Date.parse(value))
  // Try DD/MM/YYYY
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(value)) {
    const parts = value.split(/[\/\-\.]/)
    const day = parseInt(parts[0])
    const month = parseInt(parts[1])
    const year = parseInt(parts[2])
    return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1950
  }
  // Excel serial number
  const num = Number(value)
  if (!isNaN(num) && num > 30000 && num < 60000) return true
  return false
}

function parseDate(value: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }
  // DD/MM/YYYY or similar
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\-\.]/)
    let day = parseInt(parts[0])
    let month = parseInt(parts[1])
    let year = parseInt(parts[2])
    // Heuristic: if day > 12, it's DD/MM; if month > 12, it's MM/DD
    if (month > 12 && day <= 12) {
      ;[day, month] = [month, day]
    }
    if (year < 100) year += 2000
    if (year < 1950) year += 100
    const d = new Date(year, month - 1, day)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }
  // Excel serial
  const num = Number(trimmed)
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400 * 1000)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }
  return null
}

function parseBool(value: string): boolean {
  const lower = String(value).toLowerCase().trim()
  return ['si', 'sí', 'true', '1', 'x', 'yes', 'activo', 'vigente'].includes(lower)
}

function calcularNivelCompletitud(
  datos: Record<string, unknown>,
  esCesado: boolean,
): NivelCompletitud {
  const camposCore = ['usuarios.dni', 'usuarios.nombre_completo', 'usuarios.rol', 'usuarios_rrhh.fecha_ingreso']
  const camposPersonales = [
    'usuarios_rrhh.fecha_nacimiento', 'usuarios_rrhh.genero', 'usuarios_rrhh.estado_civil',
    'usuarios_rrhh.telefono_personal', 'usuarios_rrhh.direccion_domiciliaria',
    'usuarios_rrhh.distrito_residencia',
    'usuarios_rrhh.contacto_emergencia_nombre', 'usuarios_rrhh.contacto_emergencia_telefono',
  ]
  const camposBancarios = ['usuarios_rrhh.banco', 'usuarios_rrhh.numero_cuenta', 'usuarios_rrhh.cci']
  const camposContractuales = ['usuarios_rrhh.tipo_contrato_actual', 'usuarios_rrhh.fecha_fin_contrato']
  const camposSeguridadSocial = [
    'usuarios_rrhh.sistema_pensionario', 'usuarios_rrhh.afp_nombre', 'usuarios_rrhh.cuspp',
    'usuarios_rrhh.eps_nombre', 'usuarios_rrhh.tiene_sctr',
    'usuarios_rrhh.asignacion_familiar', 'usuarios_rrhh.numero_dependientes', 'usuarios_rrhh.numero_hijos',
  ]
  const camposIdentificacion = [
    'usuarios_rrhh.tipo_documento', 'usuarios_rrhh.lugar_nacimiento',
    'usuarios_rrhh.nacionalidad', 'usuarios_rrhh.ruc',
  ]
  const camposEducacion = ['usuarios_rrhh.nivel_educativo', 'usuarios_rrhh.profesion_carrera']

  const present = (campo: string) => {
    const val = datos[campo]
    return val !== null && val !== undefined && val !== ''
  }

  const corePresent = camposCore.filter(present).length
  const coreTotal = camposCore.length
  const personalPresent = camposPersonales.filter(present).length
  const personalTotal = camposPersonales.length
  const bancoPresent = camposBancarios.filter(present).length
  const bancoTotal = camposBancarios.length
  const contratoPresent = camposContractuales.filter(present).length
  const contratoTotal = camposContractuales.length
  const ssPresent = camposSeguridadSocial.filter(present).length
  const ssTotal = camposSeguridadSocial.length
  const idPresent = camposIdentificacion.filter(present).length
  const idTotal = camposIdentificacion.length
  const eduPresent = camposEducacion.filter(present).length
  const eduTotal = camposEducacion.length

  // Core check
  if (corePresent < coreTotal) return 'INSUFICIENTE'

  if (esCesado) {
    // Cesados: only core + personal + identificación
    const totalPresent = corePresent + personalPresent + idPresent
    const totalPossible = coreTotal + personalTotal + idTotal
    const pct = totalPossible > 0 ? totalPresent / totalPossible : 0
    if (pct >= 0.7) return 'COMPLETO'
    if (pct >= 0.5) return 'PARCIAL'
    return 'MINIMO'
  }

  // Activos - include all categories
  const totalCampos = coreTotal + personalTotal + bancoTotal + contratoTotal + ssTotal + idTotal + eduTotal
  const totalPresent = corePresent + personalPresent + bancoPresent + contratoPresent + ssPresent + idPresent + eduPresent
  const pct = totalCampos > 0 ? totalPresent / totalCampos : 0

  if (pct >= 0.9 && bancoPresent >= 2 && contratoPresent >= 1 && ssPresent >= 2) return 'COMPLETO'
  if (pct >= 0.7 || (bancoPresent === 0 && contratoPresent === 0)) return 'PARCIAL'
  return 'MINIMO'
}

function generarBrechasColaborador(
  datos: Record<string, unknown>,
  dni: string,
  nombre: string,
  esCesado: boolean,
  nivel: NivelCompletitud,
): AnalisisBrechas {
  const categorize = (campos: string[]) => {
    const presentes: string[] = []
    const faltantes: string[] = []
    for (const c of campos) {
      const val = datos[c]
      if (val !== null && val !== undefined && val !== '') {
        presentes.push(c)
      } else {
        faltantes.push(c)
      }
    }
    const porcentaje = campos.length > 0 ? Math.round((presentes.length / campos.length) * 100) : 100
    return { presentes, faltantes, porcentaje }
  }

  return {
    colaborador_dni: dni,
    colaborador_nombre: nombre,
    es_cesado: esCesado,
    datos_core: categorize(['usuarios.dni', 'usuarios.nombre_completo', 'usuarios.rol', 'usuarios_rrhh.fecha_ingreso']),
    datos_personales: categorize([
      'usuarios_rrhh.fecha_nacimiento', 'usuarios_rrhh.genero', 'usuarios_rrhh.estado_civil',
      'usuarios_rrhh.telefono_personal', 'usuarios_rrhh.direccion_domiciliaria',
      'usuarios_rrhh.distrito_residencia',
      'usuarios_rrhh.contacto_emergencia_nombre', 'usuarios_rrhh.contacto_emergencia_telefono',
    ]),
    datos_bancarios: categorize(['usuarios_rrhh.banco', 'usuarios_rrhh.numero_cuenta', 'usuarios_rrhh.cci']),
    datos_contractuales: categorize([
      'usuarios_rrhh.tipo_contrato_actual', 'usuarios_rrhh.fecha_fin_contrato',
      'contratos.tipo_contrato', 'contratos.fecha_inicio_contrato', 'contratos.cargo_contrato',
    ]),
    datos_operativo: categorize([
      'usuarios_tiendas.tienda', 'usuarios.zona', 'usuarios.codigo_asesor',
    ]),
    datos_seguridad_social: categorize([
      'usuarios_rrhh.sistema_pensionario', 'usuarios_rrhh.afp_nombre', 'usuarios_rrhh.cuspp',
      'usuarios_rrhh.eps_nombre', 'usuarios_rrhh.tiene_sctr',
      'usuarios_rrhh.asignacion_familiar', 'usuarios_rrhh.numero_dependientes', 'usuarios_rrhh.numero_hijos',
    ]),
    datos_identificacion: categorize([
      'usuarios_rrhh.tipo_documento', 'usuarios_rrhh.lugar_nacimiento',
      'usuarios_rrhh.nacionalidad', 'usuarios_rrhh.ruc',
    ]),
    datos_educacion: categorize([
      'usuarios_rrhh.nivel_educativo', 'usuarios_rrhh.profesion_carrera',
    ]),
    datos_salud: categorize([
      'usuarios_rrhh.grupo_sanguineo',
    ]),
    documentos_pendientes: esCesado ? [] : ['CV', 'Foto', 'DNI escaneado', 'Contrato firmado'],
    nivel_completitud: nivel,
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const mapeosJson = formData.get('mapeos') as string
    const hojaStr = formData.get('hoja_procesada') as string | null
    const filaEncStr = formData.get('fila_encabezados') as string | null
    const importacionId = formData.get('importacion_id') as string | null

    if (!file || !mapeosJson) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    const mapeos: MapeoColumna[] = JSON.parse(mapeosJson)
    const validMapeos = mapeos.filter(m => m.campo_destino)

    if (validMapeos.length === 0) {
      return NextResponse.json({ error: 'No hay columnas mapeadas' }, { status: 400 })
    }

    // ── Parse Excel ─────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
    const hojas = workbook.SheetNames
    const hoja = hojaStr && hojas.includes(hojaStr) ? hojaStr : hojas[0]
    const worksheet = workbook.Sheets[hoja]

    const rawAllRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][]

    const filaEncabezados = filaEncStr ? parseInt(filaEncStr) : 0
    const headerRow = (rawAllRows[filaEncabezados] as unknown[]) || []
    const headers = headerRow.map((h, i) => {
      const val = String(h || '').trim()
      return val || `Columna_${i + 1}`
    })

    // Parse all data rows
    const dataRows: { filaExcel: number; raw: Record<string, string> }[] = []
    for (let i = filaEncabezados + 1; i < rawAllRows.length; i++) {
      const rawRow = rawAllRows[i] as unknown[]
      if (!rawRow) continue
      const row: Record<string, string> = {}
      let nonEmpty = 0
      headers.forEach((h, idx) => {
        const val = rawRow[idx] != null ? String(rawRow[idx]) : ''
        row[h] = val
        if (val.trim()) nonEmpty++
      })
      // Skip empty/subtotal rows
      if (nonEmpty / headers.length < 0.2) continue
      const joined = Object.values(row).join(' ').toLowerCase()
      if (/\b(total|subtotal|resumen|suma)\b/.test(joined)) continue
      dataRows.push({ filaExcel: i + 1, raw: row }) // 1-based Excel row
    }

    // ── Fetch reference data from DB ──────────────────────────────────
    const [tiendasRes, existingUsersRes] = await Promise.all([
      supabase.from('tiendas').select('id, nombre, codigo'),
      supabase.from('usuarios').select('id, dni, nombre_completo, activo'),
    ])
    const tiendas = (tiendasRes.data || []) as { id: string; nombre: string; codigo: string }[]
    const existingUsers = (existingUsersRes.data || []) as { id: string; dni: string; nombre_completo: string; activo: boolean }[]
    const existingDniMap = new Map(existingUsers.map(u => [u.dni, u]))

    // Build mapping: columna_origen → campo_destino
    const colToCampo = new Map<string, string>()
    for (const m of validMapeos) {
      colToCampo.set(m.columna_origen, m.campo_destino)
    }

    // ── Validate each row ─────────────────────────────────────────────
    const dniSeen = new Map<string, number>() // track DNI duplicates in file
    const detalleFilas: DetalleFilaImportacion[] = []

    for (const { filaExcel, raw } of dataRows) {
      const errores: DetalleFilaImportacion['errores'] = []
      const datos_mapeados: Record<string, unknown> = {}

      // Apply mapping
      for (const [colName, value] of Object.entries(raw)) {
        const campo = colToCampo.get(colName)
        if (!campo || !value.trim()) continue
        datos_mapeados[campo] = value.trim()
      }

      // ── Normalize values ────────────────────────────────────────────
      // DNI
      let dni = String(datos_mapeados['usuarios.dni'] || '').replace(/\D/g, '')
      if (dni.length > 0 && dni.length < 8) dni = dni.padStart(8, '0')
      datos_mapeados['usuarios.dni'] = dni

      // Nombre
      const nombre = String(datos_mapeados['usuarios.nombre_completo'] || '').trim()
      datos_mapeados['usuarios.nombre_completo'] = nombre

      // Rol
      if (datos_mapeados['usuarios.rol']) {
        const rolNorm = normalizeEnum(String(datos_mapeados['usuarios.rol']), ROL_NORMALIZATION)
        if (rolNorm && VALID_ROLES.includes(rolNorm)) {
          datos_mapeados['usuarios.rol'] = rolNorm
        } else if (VALID_ROLES.includes(String(datos_mapeados['usuarios.rol']).toUpperCase())) {
          datos_mapeados['usuarios.rol'] = String(datos_mapeados['usuarios.rol']).toUpperCase()
        } else {
          errores.push({ campo: 'usuarios.rol', mensaje: `Rol no reconocido: "${datos_mapeados['usuarios.rol']}"`, tipo: 'WARNING' })
        }
      }

      // Tipo contrato
      if (datos_mapeados['usuarios_rrhh.tipo_contrato_actual']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.tipo_contrato_actual']), TIPO_CONTRATO_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.tipo_contrato_actual'] = norm
        else errores.push({ campo: 'usuarios_rrhh.tipo_contrato_actual', mensaje: `Tipo contrato no reconocido: "${datos_mapeados['usuarios_rrhh.tipo_contrato_actual']}"`, tipo: 'WARNING' })
      }
      if (datos_mapeados['contratos.tipo_contrato']) {
        const norm = normalizeEnum(String(datos_mapeados['contratos.tipo_contrato']), TIPO_CONTRATO_NORM)
        if (norm) datos_mapeados['contratos.tipo_contrato'] = norm
      }

      // Genero
      if (datos_mapeados['usuarios_rrhh.genero']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.genero']), GENERO_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.genero'] = norm
        else errores.push({ campo: 'usuarios_rrhh.genero', mensaje: `Género no reconocido: "${datos_mapeados['usuarios_rrhh.genero']}"`, tipo: 'INFO' })
      }

      // Estado civil
      if (datos_mapeados['usuarios_rrhh.estado_civil']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.estado_civil']), ESTADO_CIVIL_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.estado_civil'] = norm
      }

      // Area funcional
      if (datos_mapeados['usuarios_rrhh.area_funcional']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.area_funcional']), AREA_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.area_funcional'] = norm
      }

      // Status
      if (datos_mapeados['usuarios_rrhh.status']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.status']), STATUS_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.status'] = norm
      }

      // Motivo cese
      if (datos_mapeados['cesado.motivo_cese']) {
        const norm = normalizeEnum(String(datos_mapeados['cesado.motivo_cese']), MOTIVO_CESE_NORM)
        if (norm) datos_mapeados['cesado.motivo_cese'] = norm
      }

      // Sistema pensionario
      if (datos_mapeados['usuarios_rrhh.sistema_pensionario']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.sistema_pensionario']), SISTEMA_PENSIONARIO_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.sistema_pensionario'] = norm
        else errores.push({ campo: 'usuarios_rrhh.sistema_pensionario', mensaje: `Sistema pensionario no reconocido: "${datos_mapeados['usuarios_rrhh.sistema_pensionario']}"`, tipo: 'WARNING' })
      }

      // Tipo documento
      if (datos_mapeados['usuarios_rrhh.tipo_documento']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.tipo_documento']), TIPO_DOCUMENTO_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.tipo_documento'] = norm
        else errores.push({ campo: 'usuarios_rrhh.tipo_documento', mensaje: `Tipo documento no reconocido: "${datos_mapeados['usuarios_rrhh.tipo_documento']}"`, tipo: 'INFO' })
      }

      // Nivel educativo
      if (datos_mapeados['usuarios_rrhh.nivel_educativo']) {
        const norm = normalizeEnum(String(datos_mapeados['usuarios_rrhh.nivel_educativo']), NIVEL_EDUCATIVO_NORM)
        if (norm) datos_mapeados['usuarios_rrhh.nivel_educativo'] = norm
        else errores.push({ campo: 'usuarios_rrhh.nivel_educativo', mensaje: `Nivel educativo no reconocido: "${datos_mapeados['usuarios_rrhh.nivel_educativo']}"`, tipo: 'INFO' })
      }

      // Grupo sanguíneo
      if (datos_mapeados['usuarios_rrhh.grupo_sanguineo']) {
        const raw = String(datos_mapeados['usuarios_rrhh.grupo_sanguineo']).trim().toUpperCase()
        if (GRUPO_SANGUINEO_VALID.includes(raw)) {
          datos_mapeados['usuarios_rrhh.grupo_sanguineo'] = raw
        } else {
          errores.push({ campo: 'usuarios_rrhh.grupo_sanguineo', mensaje: `Grupo sanguíneo no válido: "${datos_mapeados['usuarios_rrhh.grupo_sanguineo']}"`, tipo: 'INFO' })
          datos_mapeados['usuarios_rrhh.grupo_sanguineo'] = null
        }
      }

      // Activo/cesado detection
      let esCesado = false
      if (datos_mapeados['usuarios.activo'] !== undefined) {
        const activo = parseBool(String(datos_mapeados['usuarios.activo']))
        datos_mapeados['usuarios.activo'] = activo
        if (!activo) esCesado = true
      }
      if (datos_mapeados['usuarios_rrhh.status'] === 'CESADO') esCesado = true
      if (datos_mapeados['cesado.fecha_cese']) esCesado = true

      // Date fields
      const dateFields = [
        'usuarios_rrhh.fecha_nacimiento', 'usuarios_rrhh.fecha_ingreso',
        'usuarios_rrhh.fecha_fin_contrato', 'contratos.fecha_inicio_contrato',
        'contratos.fecha_fin_contrato', 'cesado.fecha_cese',
      ]
      for (const field of dateFields) {
        if (datos_mapeados[field]) {
          const parsed = parseDate(String(datos_mapeados[field]))
          if (parsed) {
            datos_mapeados[field] = parsed
          } else {
            errores.push({ campo: field, mensaje: `Fecha no válida: "${datos_mapeados[field]}"`, tipo: 'WARNING' })
            datos_mapeados[field] = null
          }
        }
      }

      // Boolean fields
      const boolFields = [
        'usuarios_rrhh.tiene_equipo_corporativo',
        'usuarios_rrhh.tiene_sctr',
        'usuarios_rrhh.asignacion_familiar',
      ]
      for (const field of boolFields) {
        if (datos_mapeados[field] !== undefined) {
          datos_mapeados[field] = parseBool(String(datos_mapeados[field]))
        }
      }

      // Numeric fields
      const numericFields = [
        'usuarios_rrhh.remuneracion_actual', 'contratos.remuneracion_contrato',
        'usuarios_rrhh.numero_dependientes', 'usuarios_rrhh.numero_hijos',
      ]
      for (const field of numericFields) {
        if (datos_mapeados[field]) {
          const num = Number(String(datos_mapeados[field]).replace(/[,\s]/g, ''))
          if (!isNaN(num)) datos_mapeados[field] = num
          else {
            errores.push({ campo: field, mensaje: `Valor numérico inválido: "${datos_mapeados[field]}"`, tipo: 'WARNING' })
            datos_mapeados[field] = null
          }
        }
      }

      // ── Resolve tienda reference ──────────────────────────────────
      if (datos_mapeados['usuarios_tiendas.tienda']) {
        const tiendaInput = String(datos_mapeados['usuarios_tiendas.tienda']).trim().toLowerCase()
        // Exact match by nombre or codigo
        let match = tiendas.find(
          t => t.nombre.toLowerCase() === tiendaInput || t.codigo.toLowerCase() === tiendaInput,
        )
        // Partial match
        if (!match) {
          match = tiendas.find(
            t => t.nombre.toLowerCase().includes(tiendaInput) || tiendaInput.includes(t.nombre.toLowerCase()),
          )
        }
        if (match) {
          datos_mapeados['usuarios_tiendas.tienda_id'] = match.id
          datos_mapeados['usuarios_tiendas.tienda_nombre'] = match.nombre
        } else {
          errores.push({ campo: 'usuarios_tiendas.tienda', mensaje: `Tienda no encontrada: "${datos_mapeados['usuarios_tiendas.tienda']}"`, tipo: 'WARNING' })
        }
      }

      // ── Core validations ──────────────────────────────────────────
      // DNI
      if (!dni) {
        errores.push({ campo: 'usuarios.dni', mensaje: 'DNI es obligatorio', tipo: 'ERROR' })
      } else if (!/^\d{8}$/.test(dni)) {
        errores.push({ campo: 'usuarios.dni', mensaje: `DNI debe tener 8 dígitos: "${dni}"`, tipo: 'ERROR' })
      } else {
        // Check duplicate in file
        if (dniSeen.has(dni)) {
          errores.push({ campo: 'usuarios.dni', mensaje: `DNI duplicado en fila ${dniSeen.get(dni)}`, tipo: 'ERROR' })
        }
        dniSeen.set(dni, filaExcel)

        // Check existing in DB
        const existing = existingDniMap.get(dni)
        if (existing) {
          errores.push({
            campo: 'usuarios.dni',
            mensaje: `DNI ya existe en BD: ${existing.nombre_completo} (${existing.activo ? 'activo' : 'cesado'})`,
            tipo: 'WARNING',
          })
        }
      }

      // Nombre
      if (!nombre) {
        errores.push({ campo: 'usuarios.nombre_completo', mensaje: 'Nombre completo es obligatorio', tipo: 'ERROR' })
      }

      // Rol
      if (!datos_mapeados['usuarios.rol']) {
        errores.push({ campo: 'usuarios.rol', mensaje: 'Rol es obligatorio', tipo: 'ERROR' })
      }

      // Fecha ingreso
      if (!datos_mapeados['usuarios_rrhh.fecha_ingreso']) {
        errores.push({ campo: 'usuarios_rrhh.fecha_ingreso', mensaje: 'Fecha de ingreso es obligatoria', tipo: 'ERROR' })
      }

      // Email format
      if (datos_mapeados['usuarios.email']) {
        const email = String(datos_mapeados['usuarios.email'])
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errores.push({ campo: 'usuarios.email', mensaje: `Email inválido: "${email}"`, tipo: 'WARNING' })
        }
      }

      // CCI validation
      if (datos_mapeados['usuarios_rrhh.cci']) {
        const cci = String(datos_mapeados['usuarios_rrhh.cci']).replace(/\D/g, '')
        if (cci.length > 0 && cci.length !== 20) {
          errores.push({ campo: 'usuarios_rrhh.cci', mensaje: `CCI debe tener 20 dígitos (tiene ${cci.length})`, tipo: 'WARNING' })
        }
        datos_mapeados['usuarios_rrhh.cci'] = cci
      }

      // Cesado validations
      if (esCesado) {
        if (!datos_mapeados['cesado.fecha_cese']) {
          errores.push({ campo: 'cesado.fecha_cese', mensaje: 'Cesado sin fecha de cese', tipo: 'WARNING' })
        }
        // Set defaults for cesados
        datos_mapeados['usuarios.activo'] = false
        if (!datos_mapeados['usuarios_rrhh.status']) {
          datos_mapeados['usuarios_rrhh.status'] = 'CESADO'
        }
      } else {
        if (datos_mapeados['usuarios.activo'] === undefined) {
          datos_mapeados['usuarios.activo'] = true
        }
        if (!datos_mapeados['usuarios_rrhh.status']) {
          datos_mapeados['usuarios_rrhh.status'] = 'ACTIVO'
        }
        // Activo with fecha_cese contradiction
        if (datos_mapeados['cesado.fecha_cese']) {
          errores.push({ campo: 'cesado.fecha_cese', mensaje: 'Colaborador activo con fecha de cese', tipo: 'WARNING' })
        }
      }

      // ── Determine row state ─────────────────────────────────────────
      const hasErrors = errores.some(e => e.tipo === 'ERROR')
      const hasWarnings = errores.some(e => e.tipo === 'WARNING')
      const estado = hasErrors ? 'ERROR' as const : hasWarnings ? 'WARNING' as const : 'VALIDO' as const

      const nivel = calcularNivelCompletitud(datos_mapeados, esCesado)

      detalleFilas.push({
        fila_excel: filaExcel,
        dni,
        nombre,
        estado,
        es_cesado: esCesado,
        errores,
        datos_mapeados,
        nivel_completitud: nivel,
        verificacion_identidad: null,
      })
    }

    // ── Generate gap report ─────────────────────────────────────────────
    const totalActivos = detalleFilas.filter(f => !f.es_cesado).length
    const totalCesados = detalleFilas.filter(f => f.es_cesado).length

    const distribucion: Record<NivelCompletitud, number> = {
      COMPLETO: 0,
      PARCIAL: 0,
      MINIMO: 0,
      INSUFICIENTE: 0,
    }
    const campoFaltanteCount: Record<string, number> = {}

    const brechas: AnalisisBrechas[] = detalleFilas.map(fila => {
      distribucion[fila.nivel_completitud]++

      const brecha = generarBrechasColaborador(
        fila.datos_mapeados,
        fila.dni,
        fila.nombre,
        fila.es_cesado,
        fila.nivel_completitud,
      )

      // Count missing fields
      const allFaltantes = [
        ...brecha.datos_core.faltantes,
        ...brecha.datos_personales.faltantes,
        ...brecha.datos_bancarios.faltantes,
        ...brecha.datos_contractuales.faltantes,
        ...brecha.datos_operativo.faltantes,
        ...brecha.datos_seguridad_social.faltantes,
        ...brecha.datos_identificacion.faltantes,
        ...brecha.datos_educacion.faltantes,
        ...brecha.datos_salud.faltantes,
      ]
      for (const f of allFaltantes) {
        campoFaltanteCount[f] = (campoFaltanteCount[f] || 0) + 1
      }

      return brecha
    })

    const topCamposFaltantes = Object.entries(campoFaltanteCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([campo, cantidad]) => ({ campo, cantidad }))

    const completitudPromedio = detalleFilas.length > 0
      ? Math.round(
        brechas.reduce((sum, b) => {
          const allCats = [
            b.datos_core, b.datos_personales, b.datos_bancarios, b.datos_contractuales,
            b.datos_operativo, b.datos_seguridad_social, b.datos_identificacion,
            b.datos_educacion, b.datos_salud,
          ]
          const avg = allCats.reduce((s, c) => s + c.porcentaje, 0) / allCats.length
          return sum + avg
        }, 0) / brechas.length,
      )
      : 0

    const reporteBrechas: ReporteBrechas = {
      total_colaboradores: detalleFilas.length,
      total_activos: totalActivos,
      total_cesados: totalCesados,
      completitud_promedio: completitudPromedio,
      distribucion_completitud: distribucion,
      top_campos_faltantes: topCamposFaltantes,
      brechas_por_colaborador: brechas,
    }

    // ── Update importacion record ──────────────────────────────────────
    if (importacionId) {
      const totalValidos = detalleFilas.filter(f => f.estado === 'VALIDO').length
      const totalWarnings = detalleFilas.filter(f => f.estado === 'WARNING').length
      const totalErrores = detalleFilas.filter(f => f.estado === 'ERROR').length

      await supabase
        .from('importaciones_rrhh')
        .update({
          estado: 'VALIDADO',
          total_validos: totalValidos,
          total_warnings: totalWarnings,
          total_errores: totalErrores,
          reporte_brechas: reporteBrechas,
          completitud_promedio: completitudPromedio,
          detalle_filas: detalleFilas,
          updated_at: new Date().toISOString(),
        })
        .eq('id', importacionId)
    }

    return NextResponse.json({
      detalle_filas: detalleFilas,
      reporte_brechas: reporteBrechas,
      totales: {
        total: detalleFilas.length,
        validos: detalleFilas.filter(f => f.estado === 'VALIDO').length,
        warnings: detalleFilas.filter(f => f.estado === 'WARNING').length,
        errores: detalleFilas.filter(f => f.estado === 'ERROR').length,
        activos: totalActivos,
        cesados: totalCesados,
      },
    })
  } catch (error) {
    console.error('Error validando importación:', error)
    return NextResponse.json(
      { error: 'Error al validar los datos de importación' },
      { status: 500 },
    )
  }
}
