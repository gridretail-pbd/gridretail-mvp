import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { CAMPOS_DESTINO, NIVEL_COMPLETITUD_LABELS } from '@/lib/rrhh/types'
import type { NivelCompletitud, EstadoVerificacionIdentidad } from '@/lib/rrhh/types'
import type {
  ImportacionRRHH,
  DetalleFilaImportacion,
  AnalisisBrechas,
} from '@/lib/rrhh/interfaces'

const ESTADO_VERIF_LABELS: Record<EstadoVerificacionIdentidad, string> = {
  VERIFICADO: 'Verificado',
  NOMBRE_NO_COINCIDE: 'Nombre no coincide',
  NOMBRE_REVISAR: 'Revisar',
  NO_ENCONTRADO: 'No encontrado',
  ERROR_API: 'Error API',
  SIN_DOCUMENTO: 'Sin documento',
}

function campoLabel(campo: string): string {
  const def = CAMPOS_DESTINO.find(c => c.campo === campo)
  return def?.label || campo.split('.').pop() || campo
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const importacionId = searchParams.get('importacion_id')

    if (!importacionId) {
      return NextResponse.json({ error: 'importacion_id requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: importacion, error } = await supabase
      .from('importaciones_rrhh')
      .select('*')
      .eq('id', importacionId)
      .single()

    if (error || !importacion) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    }

    const imp = importacion as ImportacionRRHH
    const detalleFilas: DetalleFilaImportacion[] = imp.detalle_filas || []
    const brechas: AnalisisBrechas[] = imp.reporte_brechas?.brechas_por_colaborador || []

    // ─── Hoja 1: Resumen ────────────────────────────────────────────

    const resumenData: (string | number)[][] = [
      ['REPORTE DE IMPORTACIÓN - RESUMEN'],
      [''],
      ['Archivo', imp.archivo_nombre],
      ['Fecha ejecución', imp.fecha_ejecucion || imp.created_at],
      ['Estado', imp.estado],
      [''],
      ['TOTALES'],
      ['Total filas procesadas', imp.total_filas_datos],
      ['Válidos', imp.total_validos],
      ['Advertencias', imp.total_warnings],
      ['Errores', imp.total_errores],
      ['Importados', imp.total_importados],
      ['Actualizados', imp.total_actualizados],
      ['Saltados', imp.total_saltados],
      [''],
      ['DISTRIBUCIÓN'],
      ['Activos importados', imp.total_activos_importados],
      ['Cesados importados', imp.total_cesados_importados],
      [''],
      ['COMPLETITUD'],
      ['Completitud promedio', `${imp.completitud_promedio || 0}%`],
    ]

    // Distribution by level
    if (imp.reporte_brechas) {
      const dist = imp.reporte_brechas.distribucion_completitud as Record<NivelCompletitud, number>
      resumenData.push([''])
      resumenData.push(['DISTRIBUCIÓN DE COMPLETITUD'])
      for (const [nivel, count] of Object.entries(dist)) {
        resumenData.push([NIVEL_COMPLETITUD_LABELS[nivel as NivelCompletitud] || nivel, count])
      }
    }

    // Top missing fields
    if (imp.reporte_brechas?.top_campos_faltantes?.length) {
      resumenData.push([''])
      resumenData.push(['CAMPOS MÁS FALTANTES', 'Cantidad'])
      for (const { campo, cantidad } of imp.reporte_brechas.top_campos_faltantes) {
        resumenData.push([campoLabel(campo), cantidad])
      }
    }

    // Alert count
    resumenData.push([''])
    resumenData.push(['Alertas generadas', imp.total_alertas_generadas])

    // ─── Hoja 2: Detalle por Colaborador ─────────────────────────────

    const detalleHeaders = [
      'Fila Excel', 'DNI', 'Nombre', 'Estado', 'Activo/Cesado',
      'Nivel Completitud',
      // RENIEC columns
      'Verificación RENIEC', 'Nombre Oficial', 'Confianza Nombre', 'Resolución Manual',
      // Brechas by category
      'Core %', 'Personal %', 'Bancario %', 'Contractual %',
      'Operativo %', 'Seg. Social %', 'Identificación %', 'Educación %', 'Salud %',
      'Campos Faltantes', 'Errores',
    ]

    const detalleRows: (string | number)[][] = [detalleHeaders]

    for (const fila of detalleFilas) {
      const brecha = brechas.find(b => b.colaborador_dni === fila.dni)
      const verif = fila.verificacion_identidad

      // Collect all missing fields
      const faltantes: string[] = []
      if (brecha) {
        const cats = [
          brecha.datos_core, brecha.datos_personales, brecha.datos_bancarios,
          brecha.datos_contractuales, brecha.datos_operativo, brecha.datos_seguridad_social,
          brecha.datos_identificacion, brecha.datos_educacion, brecha.datos_salud,
        ]
        for (const cat of cats) {
          faltantes.push(...cat.faltantes.map(campoLabel))
        }
      }

      // Collect errors/warnings
      const erroresStr = fila.errores
        .map(e => `[${e.tipo}] ${campoLabel(e.campo)}: ${e.mensaje}`)
        .join('; ')

      detalleRows.push([
        fila.fila_excel,
        fila.dni,
        fila.nombre,
        fila.estado,
        fila.es_cesado ? 'Cesado' : 'Activo',
        NIVEL_COMPLETITUD_LABELS[fila.nivel_completitud] || fila.nivel_completitud,
        // RENIEC
        verif ? ESTADO_VERIF_LABELS[verif.estado] : 'Sin verificar',
        verif?.nombre_oficial || '',
        verif?.confianza_nombre != null ? `${Math.round(verif.confianza_nombre * 100)}%` : '',
        verif?.confirmado_manualmente ? verif.justificacion_manual || 'Confirmado' : '',
        // Brechas
        brecha ? brecha.datos_core.porcentaje : '',
        brecha ? brecha.datos_personales.porcentaje : '',
        brecha ? brecha.datos_bancarios.porcentaje : '',
        brecha ? brecha.datos_contractuales.porcentaje : '',
        brecha ? brecha.datos_operativo.porcentaje : '',
        brecha ? brecha.datos_seguridad_social.porcentaje : '',
        brecha ? brecha.datos_identificacion.porcentaje : '',
        brecha ? brecha.datos_educacion.porcentaje : '',
        brecha ? brecha.datos_salud.porcentaje : '',
        faltantes.join(', '),
        erroresStr,
      ])
    }

    // ─── Hoja 3: Documentos Pendientes (solo activos) ────────────────

    const docHeaders = ['DNI', 'Nombre', 'Documentos Pendientes']
    const docRows: (string | number)[][] = [docHeaders]

    for (const brecha of brechas) {
      if (brecha.es_cesado) continue
      if (brecha.documentos_pendientes.length === 0) continue
      docRows.push([
        brecha.colaborador_dni,
        brecha.colaborador_nombre,
        brecha.documentos_pendientes.join(', '),
      ])
    }

    // ─── Hoja 4: Errores y Warnings ──────────────────────────────────

    const errorHeaders = ['Fila Excel', 'DNI', 'Nombre', 'Tipo', 'Campo', 'Mensaje']
    const errorRows: (string | number)[][] = [errorHeaders]

    for (const fila of detalleFilas) {
      for (const err of fila.errores) {
        errorRows.push([
          fila.fila_excel,
          fila.dni,
          fila.nombre,
          err.tipo,
          campoLabel(err.campo),
          err.mensaje,
        ])
      }
    }

    // ─── Build workbook ──────────────────────────────────────────────

    const wb = XLSX.utils.book_new()

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
    wsResumen['!cols'] = [{ wch: 35 }, { wch: 30 }]

    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows)
    wsDetalle['!cols'] = detalleHeaders.map(h => ({ wch: Math.max(h.length + 2, 14) }))

    const wsDocs = XLSX.utils.aoa_to_sheet(docRows)
    wsDocs['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 50 }]

    const wsErrores = XLSX.utils.aoa_to_sheet(errorRows)
    wsErrores['!cols'] = errorHeaders.map(h => ({ wch: Math.max(h.length + 2, 14) }))

    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle por Colaborador')
    XLSX.utils.book_append_sheet(wb, wsDocs, 'Documentos Pendientes')
    XLSX.utils.book_append_sheet(wb, wsErrores, 'Errores y Warnings')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `reporte_importacion_${imp.archivo_nombre.replace(/\.[^.]+$/, '')}_${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generando reporte:', error)
    return NextResponse.json(
      { error: 'Error al generar el reporte de brechas' },
      { status: 500 },
    )
  }
}
