import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchOffboardings, insertOffboarding } from '@/lib/rrhh/queries/offboarding'
import { offboardingCreateSchema } from '@/lib/rrhh/schemas'
import type { OffboardingTarea } from '@/lib/rrhh/interfaces'
import type { TipoSalida } from '@/lib/rrhh/types'

// ─── Checklists por tipo de salida (SPEC_MODULO_RRHH.md §11) ──────────────

function generarChecklist(tipoSalida: TipoSalida): OffboardingTarea[] {
  const checklists: Record<TipoSalida, string[]> = {
    RENUNCIA: [
      'Carta de renuncia recibida y registrada',
      'Carta de aceptación generada',
      'Liquidación de comisiones pendientes calculada',
      'Devolución de uniforme',
      'Devolución de equipo corporativo',
      'Solicitud de desactivación de usuario Entel',
      'Desactivación de usuario GridRetail',
      'Encuesta de salida completada',
      'Cierre de contrato vigente',
      'Documentación archivada',
    ],
    NO_RENOVACION: [
      'Notificación anticipada al colaborador',
      'Liquidación calculada',
      'Devolución de bienes',
      'Desactivación de usuarios (Entel y GridRetail)',
      'Documentación archivada',
    ],
    DESPIDO: [
      'Notificación formal al colaborador',
      'Liquidación calculada',
      'Devolución de bienes',
      'Desactivación inmediata de accesos',
      'Documentación legal archivada',
    ],
    ABANDONO: [
      'Acta de constatación de ausencias',
      'Carta de requerimiento (día 1-2)',
      'Segunda comunicación (día 3)',
      'Carta notarial (día 5)',
      'Desactivación inmediata de accesos',
      'Informe de abandono',
      'Documentación legal archivada',
    ],
    PERIODO_PRUEBA: [
      'Notificación al colaborador',
      'Liquidación proporcional calculada',
      'Devolución de bienes',
      'Desactivación de usuarios',
      'Documentación archivada',
    ],
    MUTUO_ACUERDO: [
      'Acuerdo firmado por ambas partes',
      'Liquidación calculada',
      'Devolución de bienes',
      'Desactivación de usuarios',
      'Documentación archivada',
    ],
  }

  return (checklists[tipoSalida] || []).map((titulo, index) => ({
    id: `t${index + 1}`,
    titulo,
    completada: false,
    orden: index + 1,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const { data, error } = await fetchOffboardings(supabase, {
      estado: searchParams.get('estado') || undefined,
      tipo_salida: searchParams.get('tipo_salida') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ offboardings: data, total: data.length })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const parsed = offboardingCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verificar que la ficha existe (offboarding.usuario_id -> usuarios_rrhh, 033)
    const { data: usuario } = await supabase
      .from('usuarios_rrhh')
      .select('id, nombre_completo')
      .eq('id', parsed.data.usuario_id)
      .single()

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que no tenga offboarding activo
    const { data: existente } = await supabase
      .from('offboarding_checklist')
      .select('id')
      .eq('usuario_id', parsed.data.usuario_id)
      .eq('estado', 'EN_PROCESO')
      .limit(1)
      .single()

    if (existente) {
      return NextResponse.json(
        { error: 'Este colaborador ya tiene un proceso de offboarding en curso' },
        { status: 409 }
      )
    }

    // Generar checklist adaptativo según tipo de salida
    const tareas = generarChecklist(parsed.data.tipo_salida)

    const datosInsert = {
      usuario_id: parsed.data.usuario_id,
      tipo_salida: parsed.data.tipo_salida,
      tareas,
      responsable_id: body.responsable_id,
      notas: parsed.data.notas || null,
    }

    const { data, error } = await insertOffboarding(supabase, datosInsert)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, offboarding: data })
  } catch (error) {
    console.error('Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
