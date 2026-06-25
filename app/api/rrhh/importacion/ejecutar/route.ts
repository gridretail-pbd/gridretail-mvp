import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DetalleFilaImportacion } from '@/lib/rrhh/interfaces'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function generarCodigoAsesor(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  nombre: string,
  prefix: string,
): Promise<string> {
  // Generate: PREFIX_InicialesApellido
  const parts = nombre.trim().split(/\s+/)
  let code: string
  if (parts.length >= 2) {
    const inicial = parts[0][0]?.toUpperCase() || ''
    const apellido = parts[parts.length - 1].toUpperCase().replace(/[^A-Z]/g, '')
    code = `${prefix}_${inicial}${apellido}`
  } else {
    code = `${prefix}_${nombre.substring(0, 8).toUpperCase().replace(/[^A-Z]/g, '')}`
  }

  // Check uniqueness, add suffix if needed
  const { data: existing } = await supabase
    .from('usuarios')
    .select('codigo_asesor')
    .like('codigo_asesor', `${code}%`)

  if (!existing || existing.length === 0) return code

  const existingCodes = new Set(existing.map(e => e.codigo_asesor))
  if (!existingCodes.has(code)) return code

  for (let i = 2; i <= 99; i++) {
    const candidate = `${code}${i}`
    if (!existingCodes.has(candidate)) return candidate
  }
  return `${code}_${Date.now()}`
}

// ─── Main Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { importacion_id, filas_incluidas, ejecutado_por } = body as {
      importacion_id: string
      filas_incluidas: number[]
      ejecutado_por: string
    }

    if (!importacion_id || !filas_incluidas?.length) {
      return NextResponse.json({ error: 'Parámetros requeridos: importacion_id, filas_incluidas' }, { status: 400 })
    }

    // ── Get importacion record ──────────────────────────────────────────
    const { data: importacion, error: impError } = await supabase
      .from('importaciones_rrhh')
      .select('*')
      .eq('id', importacion_id)
      .single()

    if (impError || !importacion) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    }

    const detalleFilas = (importacion.detalle_filas as DetalleFilaImportacion[]) || []
    if (detalleFilas.length === 0) {
      return NextResponse.json({ error: 'No hay datos validados' }, { status: 400 })
    }

    // Filter to included rows only
    const filasIncluidas = new Set(filas_incluidas)
    const filasAImportar = detalleFilas.filter(
      f => filasIncluidas.has(f.fila_excel) && f.estado !== 'ERROR',
    )

    if (filasAImportar.length === 0) {
      return NextResponse.json({ error: 'No hay filas válidas para importar' }, { status: 400 })
    }

    // ── Get tenant prefix ───────────────────────────────────────────────
    const { data: configData } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'TENANT_CODIGO_ASESOR_PREFIX')
      .single()
    const prefix = configData?.value || 'PBD'

    // ── Process each row ──────────────────────────────────────────────
    let totalImportados = 0
    let totalActualizados = 0
    let totalSaltados = 0
    let totalActivos = 0
    let totalCesados = 0
    const alertasIndividuales: Record<string, unknown>[] = []

    for (const fila of filasAImportar) {
      const datos = fila.datos_mapeados
      const dni = fila.dni
      const esCesado = fila.es_cesado

      try {
        // Check if user exists
        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id, activo')
          .eq('dni', dni)
          .single()

        let userId: string

        if (existingUser) {
          // Update existing user with new/missing data
          userId = existingUser.id
          const updateData: Record<string, unknown> = {}
          if (datos['usuarios.nombre_completo']) updateData.nombre_completo = datos['usuarios.nombre_completo']
          if (datos['usuarios.email']) updateData.email = datos['usuarios.email']
          if (datos['usuarios.rol']) updateData.rol = datos['usuarios.rol']
          if (datos['usuarios.zona']) updateData.zona = datos['usuarios.zona']
          if (datos['usuarios.activo'] !== undefined) updateData.activo = datos['usuarios.activo']

          if (Object.keys(updateData).length > 0) {
            await supabase.from('usuarios').update(updateData).eq('id', existingUser.id)
          }
          totalActualizados++
        } else {
          // Generate codigo_asesor if not provided
          let codigoAsesor = datos['usuarios.codigo_asesor']
            ? String(datos['usuarios.codigo_asesor'])
            : await generarCodigoAsesor(supabase, String(datos['usuarios.nombre_completo'] || ''), prefix)

          // Insert new usuario
          const { data: newUser, error: userError } = await supabase
            .from('usuarios')
            .insert({
              codigo_asesor: codigoAsesor,
              dni,
              nombre_completo: datos['usuarios.nombre_completo'] || '',
              email: datos['usuarios.email'] || null,
              rol: datos['usuarios.rol'] || 'ASESOR',
              zona: datos['usuarios.zona'] || null,
              activo: esCesado ? false : (datos['usuarios.activo'] ?? true),
              password_hash: 'IMPORTADO_SIN_PASSWORD',
            })
            .select('id')
            .single()

          if (userError || !newUser) {
            console.error(`Error inserting usuario for DNI ${dni}:`, userError)
            totalSaltados++
            continue
          }
          userId = newUser.id
          totalImportados++
        }

        // ── Insert usuarios_rrhh (ficha de persona, migración 033) ────
        // La ficha enlaza la cuenta por usuario_id y lleva identidad propia.
        const rrhhData: Record<string, unknown> = {
          usuario_id: userId,
          nombre_completo: datos['usuarios.nombre_completo'] || null,
          dni,
          codigo_asesor: datos['usuarios.codigo_asesor'] || null,
          fecha_ingreso: datos['usuarios_rrhh.fecha_ingreso'] || new Date().toISOString().split('T')[0],
          tipo_contrato_actual: datos['usuarios_rrhh.tipo_contrato_actual'] || 'PLAZO_FIJO',
          area_funcional: datos['usuarios_rrhh.area_funcional'] || 'COMERCIAL',
          status: datos['usuarios_rrhh.status'] || (esCesado ? 'CESADO' : 'ACTIVO'),
        }

        // Add optional fields
        const optionalRRHHFields = [
          'fecha_nacimiento', 'genero', 'estado_civil', 'telefono_personal',
          'direccion_domiciliaria', 'distrito_residencia',
          'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_parentesco',
          'banco', 'numero_cuenta', 'cci', 'fecha_fin_contrato',
          'regimen_laboral', 'cargo_formal', 'remuneracion_actual',
          'talla_uniforme', 'equipo_corporativo_detalle',
          // Seguridad Social (migración 026)
          'sistema_pensionario', 'afp_nombre', 'cuspp', 'eps_nombre',
          'numero_dependientes', 'numero_hijos',
          // Identificación (migración 026)
          'tipo_documento', 'lugar_nacimiento', 'nacionalidad', 'ruc',
          // Educación (migración 026)
          'nivel_educativo', 'profesion_carrera',
          // Salud (migración 026)
          'grupo_sanguineo',
        ]
        for (const field of optionalRRHHFields) {
          const val = datos[`usuarios_rrhh.${field}`]
          if (val !== null && val !== undefined && val !== '') {
            rrhhData[field] = val
          }
        }
        // Boolean fields (need explicit check since false is a valid value)
        const boolRRHHFields = ['tiene_equipo_corporativo', 'tiene_sctr', 'asignacion_familiar']
        for (const field of boolRRHHFields) {
          if (datos[`usuarios_rrhh.${field}`] !== undefined) {
            rrhhData[field] = datos[`usuarios_rrhh.${field}`]
          }
        }

        // Upsert usuarios_rrhh (might exist if user was updated). Capturamos el
        // id de FICHA para las inserciones de dominio-persona repuntadas (033).
        const { data: fichaRow, error: rrhhError } = await supabase
          .from('usuarios_rrhh')
          .upsert(rrhhData, { onConflict: 'usuario_id' })
          .select('id')
          .single()

        if (rrhhError) {
          console.error(`Error upserting usuarios_rrhh for ${dni}:`, rrhhError)
        }
        const fichaId = fichaRow?.id ?? userId

        // ── Insert usuarios_tiendas (only for activos) ─────────────────
        if (!esCesado && datos['usuarios_tiendas.tienda_id']) {
          const { error: tiendaError } = await supabase
            .from('usuarios_tiendas')
            .upsert(
              {
                usuario_id: userId,
                tienda_id: datos['usuarios_tiendas.tienda_id'],
                activo: true,
              },
              { onConflict: 'usuario_id,tienda_id' },
            )
          if (tiendaError) {
            console.error(`Error inserting usuarios_tiendas for ${dni}:`, tiendaError)
          }
        }

        // ── Insert contrato (if contract data present, only for activos) ──
        if (!esCesado && (datos['contratos.tipo_contrato'] || datos['contratos.fecha_inicio_contrato'])) {
          const { error: contratoError } = await supabase
            .from('contratos')
            .insert({
              usuario_id: fichaId,
              tipo_contrato: datos['contratos.tipo_contrato'] || datos['usuarios_rrhh.tipo_contrato_actual'] || 'PLAZO_FIJO',
              fecha_inicio: datos['contratos.fecha_inicio_contrato'] || datos['usuarios_rrhh.fecha_ingreso'],
              fecha_fin: datos['contratos.fecha_fin_contrato'] || datos['usuarios_rrhh.fecha_fin_contrato'] || null,
              cargo: datos['contratos.cargo_contrato'] || datos['usuarios_rrhh.cargo_formal'] || 'Asesor Comercial',
              remuneracion: datos['contratos.remuneracion_contrato'] || datos['usuarios_rrhh.remuneracion_actual'] || 0,
              tienda_asignada_id: datos['usuarios_tiendas.tienda_id'] || null,
              estado: 'VIGENTE',
            })
          if (contratoError) {
            console.error(`Error inserting contrato for ${dni}:`, contratoError)
          }
        }

        // ── Insert movimiento_personal ────────────────────────────────
        const tipoMovimiento = esCesado
          ? (datos['cesado.motivo_cese'] || 'CESE_VOLUNTARIO')
          : 'INGRESO'

        await supabase
          .from('movimientos_personal')
          .insert({
            usuario_id: fichaId,
            tipo_movimiento: tipoMovimiento,
            fecha_efectiva: esCesado
              ? (datos['cesado.fecha_cese'] || datos['usuarios_rrhh.fecha_ingreso'] || new Date().toISOString().split('T')[0])
              : (datos['usuarios_rrhh.fecha_ingreso'] || new Date().toISOString().split('T')[0]),
            motivo: `Importación inicial${esCesado ? ' (cesado)' : ''}`,
            autorizado_por: ejecutado_por,
            notas: `Importado desde ${importacion.archivo_nombre}`,
          })

        // ── Insert usuarios_status_log ──────────────────────────────
        await supabase
          .from('usuarios_status_log')
          .insert({
            usuario_id: fichaId,
            status_anterior: null,
            status_nuevo: esCesado ? 'CESADO' : 'ACTIVO',
            motivo: 'Importación inicial',
            fecha_efectiva: datos['usuarios_rrhh.fecha_ingreso'] || new Date().toISOString().split('T')[0],
            registrado_por: ejecutado_por,
            metadata: { importacion_id, fuente: 'importacion_masiva' },
          })

        // ── Insert historial_bancario (if banking data present) ────
        if (datos['usuarios_rrhh.banco'] && datos['usuarios_rrhh.numero_cuenta']) {
          await supabase
            .from('historial_bancario')
            .insert({
              usuario_id: userId,
              banco: String(datos['usuarios_rrhh.banco']),
              numero_cuenta: String(datos['usuarios_rrhh.numero_cuenta']),
              cci: datos['usuarios_rrhh.cci'] ? String(datos['usuarios_rrhh.cci']) : null,
              fecha_desde: datos['usuarios_rrhh.fecha_ingreso'] || new Date().toISOString().split('T')[0],
              registrado_por: ejecutado_por,
            })
            .then(({ error }) => {
              if (error) console.error(`Error inserting historial_bancario for ${dni}:`, error)
            })
        }

        // ── Insert historial_direcciones (if address data present) ─
        if (datos['usuarios_rrhh.direccion_domiciliaria']) {
          await supabase
            .from('historial_direcciones')
            .insert({
              usuario_id: userId,
              direccion_domiciliaria: String(datos['usuarios_rrhh.direccion_domiciliaria']),
              distrito_residencia: datos['usuarios_rrhh.distrito_residencia']
                ? String(datos['usuarios_rrhh.distrito_residencia'])
                : null,
              fecha_desde: datos['usuarios_rrhh.fecha_ingreso'] || new Date().toISOString().split('T')[0],
              registrado_por: ejecutado_por,
            })
            .then(({ error }) => {
              if (error) console.error(`Error inserting historial_direcciones for ${dni}:`, error)
            })
        }

        // ── Track activos/cesados ────────────────────────────────────
        if (esCesado) totalCesados++
        else totalActivos++

        // ── Generate individual alerts (only for activos) ────────────
        if (!esCesado) {
          // Missing banking data
          if (!datos['usuarios_rrhh.banco'] && !datos['usuarios_rrhh.numero_cuenta']) {
            alertasIndividuales.push({
              tipo: 'DATOS_INCOMPLETOS',
              titulo: `Datos bancarios faltantes: ${fila.nombre}`,
              mensaje: `El colaborador ${fila.nombre} (${dni}) no tiene datos bancarios registrados.`,
              nivel: 'WARNING',
              entidad_tipo: 'USUARIO',
              entidad_id: userId,
              modulo: 'IMPORTACION',
              datos_contexto: { importacion_id, campo_faltante: 'datos_bancarios' },
              destinatario_rol: 'BACKOFFICE_RRHH',
              generada_por: 'SISTEMA',
            })
          }

          // Missing emergency contact
          if (!datos['usuarios_rrhh.contacto_emergencia_nombre']) {
            alertasIndividuales.push({
              tipo: 'DATOS_INCOMPLETOS',
              titulo: `Contacto emergencia faltante: ${fila.nombre}`,
              mensaje: `El colaborador ${fila.nombre} (${dni}) no tiene contacto de emergencia registrado.`,
              nivel: 'INFO',
              entidad_tipo: 'USUARIO',
              entidad_id: userId,
              modulo: 'IMPORTACION',
              datos_contexto: { importacion_id, campo_faltante: 'contacto_emergencia' },
              destinatario_rol: 'BACKOFFICE_RRHH',
              generada_por: 'SISTEMA',
            })
          }

          // No tienda assigned
          if (!datos['usuarios_tiendas.tienda_id']) {
            alertasIndividuales.push({
              tipo: 'ASIGNACION_PENDIENTE',
              titulo: `Sin tienda asignada: ${fila.nombre}`,
              mensaje: `El colaborador ${fila.nombre} (${dni}) no tiene tienda asignada.`,
              nivel: 'WARNING',
              entidad_tipo: 'USUARIO',
              entidad_id: userId,
              modulo: 'IMPORTACION',
              datos_contexto: { importacion_id },
              destinatario_rol: 'BACKOFFICE_RRHH',
              generada_por: 'SISTEMA',
            })
          }

          // Contract expiring soon (within 30 days)
          const fechaFin = datos['usuarios_rrhh.fecha_fin_contrato'] || datos['contratos.fecha_fin_contrato']
          if (fechaFin) {
            const finDate = new Date(String(fechaFin))
            const now = new Date()
            const diffDays = Math.ceil((finDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays > 0 && diffDays <= 30) {
              alertasIndividuales.push({
                tipo: 'CONTRATO_POR_VENCER',
                titulo: `Contrato próximo a vencer: ${fila.nombre}`,
                mensaje: `El contrato de ${fila.nombre} (${dni}) vence en ${diffDays} días.`,
                nivel: 'CRITICAL',
                entidad_tipo: 'USUARIO',
                entidad_id: userId,
                modulo: 'IMPORTACION',
                datos_contexto: { importacion_id, fecha_vencimiento: fechaFin },
                destinatario_rol: 'BACKOFFICE_RRHH',
                generada_por: 'SISTEMA',
                fecha_limite: fechaFin,
              })
            }
          }
        }
      } catch (rowError) {
        console.error(`Error processing row ${fila.fila_excel} (DNI: ${dni}):`, rowError)
        totalSaltados++
      }
    }

    // ── Insert alerts in batch ──────────────────────────────────────────
    let totalAlertasGeneradas = 0
    if (alertasIndividuales.length > 0) {
      const { error: alertError } = await supabase
        .from('alertas_rrhh')
        .insert(alertasIndividuales)
      if (!alertError) {
        totalAlertasGeneradas = alertasIndividuales.length
      } else {
        console.error('Error inserting alerts:', alertError)
      }
    }

    // ── Check for unverified identities → generate alert ────────────
    const filasConVerificacion = detalleFilas.filter(f => f.verificacion_identidad)
    const errorApiCount = filasConVerificacion.filter(
      f => f.verificacion_identidad?.estado === 'ERROR_API'
    ).length
    if (errorApiCount > 0) {
      alertasIndividuales.push({
        tipo: 'VERIFICACION_IDENTIDAD_PENDIENTE',
        titulo: `${errorApiCount} identidades sin verificar`,
        mensaje: `La verificación RENIEC/Migraciones falló para ${errorApiCount} colaboradores. Se recomienda reintentar.`,
        nivel: 'WARNING',
        entidad_tipo: 'IMPORTACION',
        entidad_id: importacion_id,
        modulo: 'IMPORTACION',
        datos_contexto: { importacion_id, error_api_count: errorApiCount },
        destinatario_rol: 'BACKOFFICE_RRHH',
        generada_por: 'SISTEMA',
      })
    }

    // ── Build verification summary for alert ─────────────────────────
    const verificacionResumen = {
      total_verificados: filasConVerificacion.filter(f => f.verificacion_identidad?.estado === 'VERIFICADO').length,
      total_parcial: filasConVerificacion.filter(f => f.verificacion_identidad?.estado === 'NOMBRE_REVISAR').length,
      total_no_coincide_resueltos: filasConVerificacion.filter(
        f => f.verificacion_identidad?.estado === 'NOMBRE_NO_COINCIDE' && f.verificacion_identidad?.confirmado_manualmente
      ).length,
      total_no_encontrado_resueltos: filasConVerificacion.filter(
        f => f.verificacion_identidad?.estado === 'NO_ENCONTRADO' && f.verificacion_identidad?.confirmado_manualmente
      ).length,
      total_errores_api: errorApiCount,
      total_sin_verificar: detalleFilas.filter(f => !f.verificacion_identidad).length,
    }

    // ── Insert summary alert ──────────────────────────────────────────
    const urgentes = alertasIndividuales.filter(a => a.nivel === 'CRITICAL').length
    const { data: alertaResumen } = await supabase
      .from('alertas_rrhh')
      .insert({
        tipo: 'IMPORTACION_COMPLETADA',
        titulo: 'Importación inicial completada',
        mensaje: `${totalImportados + totalActualizados} colaboradores (${totalActivos} activos, ${totalCesados} cesados). Completitud: ${importacion.completitud_promedio || 0}%. ${urgentes} contratos urgentes.`,
        nivel: urgentes > 0 ? 'CRITICAL' : 'WARNING',
        entidad_tipo: 'IMPORTACION',
        entidad_id: importacion_id,
        modulo: 'IMPORTACION',
        datos_contexto: {
          importacion_id,
          totales: {
            importados: totalImportados,
            actualizados: totalActualizados,
            saltados: totalSaltados,
            activos: totalActivos,
            cesados: totalCesados,
          },
          verificacion_identidad: verificacionResumen,
        },
        destinatario_rol: 'BACKOFFICE_RRHH',
        generada_por: 'SISTEMA',
      })
      .select('id')
      .single()

    if (alertaResumen) {
      totalAlertasGeneradas++
    }

    // ── Update importacion record with results ──────────────────────────
    await supabase
      .from('importaciones_rrhh')
      .update({
        estado: 'IMPORTADO',
        total_importados: totalImportados,
        total_actualizados: totalActualizados,
        total_saltados: totalSaltados,
        total_activos_importados: totalActivos,
        total_cesados_importados: totalCesados,
        total_alertas_generadas: totalAlertasGeneradas,
        alerta_resumen_id: alertaResumen?.id || null,
        ejecutado_por,
        fecha_ejecucion: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', importacion_id)

    return NextResponse.json({
      resultado: {
        totalImportados,
        totalActualizados,
        totalSaltados,
        totalActivos,
        totalCesados,
        alertasGeneradas: totalAlertasGeneradas,
        reporteUrl: null,
      },
    })
  } catch (error) {
    console.error('Error ejecutando importación:', error)

    // Try to mark importation as error
    try {
      const body = await request.clone().json()
      if (body.importacion_id) {
        const supabase = await createClient()
        await supabase
          .from('importaciones_rrhh')
          .update({ estado: 'ERROR', updated_at: new Date().toISOString() })
          .eq('id', body.importacion_id)
      }
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: 'Error al ejecutar la importación' },
      { status: 500 },
    )
  }
}
