import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { CAMPOS_DESTINO } from '@/lib/rrhh/types'

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch tenant config for dynamic content
    const [tiendasRes, configRes] = await Promise.all([
      supabase.from('tiendas').select('nombre').order('nombre'),
      supabase.from('system_config').select('value').eq('key', 'TENANT_CODIGO_ASESOR_PREFIX').single(),
    ])

    const tiendas = (tiendasRes.data || []).map(t => t.nombre)
    const prefijo = configRes.data?.value || 'PBD'

    // ─── Hoja 1: Colaboradores ───
    const headers = CAMPOS_DESTINO.map(c => c.label)
    const colaboradoresData = [headers]

    // ─── Hoja 2: Valores Válidos ───
    const roles = ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA', 'VALIDADOR_ARRIBOS', 'ADMIN']
    const tiposContrato = ['PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA']
    const areas = ['COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION']
    const generos = ['MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA']
    const estadosCivil = ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO']
    const statusColaborador = ['ACTIVO', 'PERIODO_PRUEBA', 'VACACIONES', 'LICENCIA_MEDICA', 'SUSPENDIDO', 'CESADO', 'EN_INDUCCION', 'SOMBRA', 'ASIGNADO']
    const motivosCese = ['CESE_VOLUNTARIO', 'CESE_DESPIDO', 'CESE_NO_RENOVACION', 'CESE_ABANDONO', 'CESE_PERIODO_PRUEBA']
    const zonas = ['NORTE', 'SUR', 'ESTE', 'CENTRO']
    const sistemaPensionario = ['AFP', 'ONP']
    const tipoDocumento = ['DNI', 'CE', 'PASAPORTE', 'PTP']
    const nivelEducativo = ['SECUNDARIA_INCOMPLETA', 'SECUNDARIA', 'TECNICO_INCOMPLETO', 'TECNICO', 'UNIVERSITARIO_INCOMPLETO', 'UNIVERSITARIO', 'POSTGRADO']
    const grupoSanguineo = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

    // Build matrix: columns side by side
    const allCols = [roles, tiendas, zonas, tiposContrato, areas, generos, estadosCivil, statusColaborador, motivosCese, sistemaPensionario, tipoDocumento, nivelEducativo, grupoSanguineo]
    const maxRows = Math.max(...allCols.map(c => c.length))
    const valoresHeaders = ['Roles', 'Tiendas', 'Zonas', 'Tipos Contrato', 'Áreas', 'Géneros', 'Estado Civil', 'Status Colaborador', 'Motivo Cese', 'Sistema Pensionario', 'Tipo Documento', 'Nivel Educativo', 'Grupo Sanguíneo']
    const valoresData = [valoresHeaders]
    for (let i = 0; i < maxRows; i++) {
      valoresData.push(allCols.map(col => col[i] || ''))
    }

    // ─── Hoja 3: Instrucciones ───
    const instrucciones = [
      ['INSTRUCCIONES DE USO'],
      [''],
      ['1. Complete la hoja "Colaboradores" con los datos de sus colaboradores.'],
      ['2. Consulte la hoja "Valores Válidos" para los valores aceptados en cada campo.'],
      ['3. Los campos obligatorios son: DNI, Nombre Completo, Rol/Cargo, Fecha Ingreso.'],
      ['4. Formatos de fecha: DD/MM/YYYY o YYYY-MM-DD.'],
      ['5. DNI: siempre 8 dígitos numéricos (no omitir ceros a la izquierda).'],
      ['6. CCI: 20 dígitos numéricos.'],
      [''],
      ['MANEJO DE CESADOS:'],
      ['- Incluya a los colaboradores cesados con Status = "CESADO".'],
      ['- Complete Fecha Cese y Motivo Cese.'],
      ['- No es necesario completar tienda ni datos bancarios para cesados.'],
      [''],
      ['CÓDIGO ASESOR:'],
      [`- Si lo deja vacío, el sistema lo generará automáticamente con el prefijo "${prefijo}".`],
      [`- Formato autogenerado: ${prefijo}_IAPELLIDO (ej: ${prefijo}_JGARCIA).`],
      [''],
      ['NOTAS:'],
      ['- Puede usar este template o subir su propio Excel. El sistema mapeará las columnas automáticamente.'],
      ['- Campos no obligatorios se marcarán como brechas para completar después.'],
    ]

    // Build workbook
    const wb = XLSX.utils.book_new()
    const wsColaboradores = XLSX.utils.aoa_to_sheet(colaboradoresData)
    const wsValores = XLSX.utils.aoa_to_sheet(valoresData)
    const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones)

    // Set column widths
    wsColaboradores['!cols'] = headers.map(() => ({ wch: 22 }))
    wsValores['!cols'] = valoresHeaders.map(() => ({ wch: 28 }))
    wsInstrucciones['!cols'] = [{ wch: 100 }]

    XLSX.utils.book_append_sheet(wb, wsColaboradores, 'Colaboradores')
    XLSX.utils.book_append_sheet(wb, wsValores, 'Valores Válidos')
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template_importacion_rrhh.xlsx"',
      },
    })
  } catch (error) {
    console.error('Error generando template:', error)
    return NextResponse.json({ error: 'Error al generar el template' }, { status: 500 })
  }
}
