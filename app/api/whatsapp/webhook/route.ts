/**
 * GridRetail — POST /api/whatsapp/webhook
 * Recepción de eventos de Evolution API (Fase 0 — captura en modo sombra).
 *
 * Spec: SPEC_ASISTENCIA_WHATSAPP.md v1.1 §4.1, §9, §10.1
 *
 * Responsabilidades de esta fase (y SOLO estas):
 *   1. Validar el token del webhook.
 *   2. Filtrar por WHATSAPP_GRUPO_JID (y aceptar DMs al bot).
 *   3. Persistir en `marcaciones_raw` con idempotencia por `wa_message_id`.
 *   4. Subir la imagen (base64) al bucket privado de Storage.
 *   5. Registrar alerta WHATSAPP_DESCONECTADO en `connection.update`.
 *
 * NO hace: Claude Vision, resolución de identidad, escritura en `asistencia`
 * ni envío de DMs. Eso es Fase 1 (`/api/asistencia/procesar`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import {
  fechaPartes,
  getSupabaseAdmin,
  getWhatsappEnv,
} from '@/lib/whatsapp/config'
import {
  normalizarMensaje,
  payloadSinBase64,
  type EvolutionWebhookBody,
} from '@/lib/whatsapp/evolution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Token aceptado en: ?token=, header x-webhook-secret, header authorization
 * (Bearer) o header apikey. El spec §10.1 usa el query param.
 */
function tokenValido(req: NextRequest, secret: string): boolean {
  const candidatos = [
    req.nextUrl.searchParams.get('token'),
    req.headers.get('x-webhook-secret'),
    req.headers.get('apikey'),
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)

  return candidatos.some((c) => comparaSegura(c, secret))
}

/** Respuesta corta: Evolution reintenta si no recibe 2xx rápido. */
function ok(payload: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...payload }, { status: 200 })
}

// ---------------------------------------------------------------------------
// GET — verificación manual / health check
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  let env
  try {
    env = getWhatsappEnv()
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    )
  }
  if (!tokenValido(req, env.webhookSecret)) {
    return NextResponse.json({ ok: false, error: 'token inválido' }, { status: 401 })
  }
  return ok({ servicio: 'whatsapp-webhook', fase: 0, modo: 'sombra' })
}

// ---------------------------------------------------------------------------
// POST — evento de Evolution
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let env
  try {
    env = getWhatsappEnv()
  } catch (e) {
    console.error('[wa-webhook] configuración incompleta:', e)
    return NextResponse.json(
      { ok: false, error: 'configuración incompleta' },
      { status: 500 },
    )
  }

  if (!tokenValido(req, env.webhookSecret)) {
    console.warn('[wa-webhook] token inválido desde', req.headers.get('x-forwarded-for'))
    return NextResponse.json({ ok: false, error: 'token inválido' }, { status: 401 })
  }

  let body: EvolutionWebhookBody
  try {
    body = (await req.json()) as EvolutionWebhookBody
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 })
  }

  const evento = String(body.event ?? '').toLowerCase().replace(/_/g, '.')

  try {
    if (evento === 'connection.update') {
      return await manejarConnectionUpdate(body)
    }
    if (evento === 'messages.upsert') {
      return await manejarMessagesUpsert(body, env.grupoJid, env.storageBucket)
    }
    return ok({ evento, accion: 'EVENTO_NO_MANEJADO' })
  } catch (e) {
    // Nunca devolvemos 5xx por un fallo de procesamiento: Evolution reintentaría
    // y duplicaría trabajo. El error queda en logs y, si aplica, en la fila raw.
    console.error('[wa-webhook] error no controlado:', e)
    return ok({ evento, accion: 'ERROR', detalle: (e as Error).message })
  }
}

// ---------------------------------------------------------------------------
// connection.update → alerta WHATSAPP_DESCONECTADO
// ---------------------------------------------------------------------------

async function manejarConnectionUpdate(body: EvolutionWebhookBody) {
  const supabase = getSupabaseAdmin()
  const estado = String(
    (body.data as Record<string, unknown> | undefined)?.state ??
      (body.data as Record<string, unknown> | undefined)?.connection ??
      '',
  ).toLowerCase()

  if (estado !== 'close' && estado !== 'closed') {
    return ok({ evento: 'connection.update', estado, accion: 'SIN_ACCION' })
  }

  // Antirrebote: una sola alerta pendiente a la vez
  const { data: existente } = await supabase
    .from('alertas_rrhh')
    .select('id')
    .eq('tipo', 'WHATSAPP_DESCONECTADO')
    .eq('estado', 'PENDIENTE')
    .limit(1)

  if (existente && existente.length > 0) {
    return ok({ evento: 'connection.update', estado, accion: 'ALERTA_YA_PENDIENTE' })
  }

  await supabase.from('alertas_rrhh').insert({
    tipo: 'WHATSAPP_DESCONECTADO',
    titulo: 'Sesión de WhatsApp caída',
    mensaje:
      `La instancia "${body.instance ?? 'desconocida'}" de Evolution reporta la sesión desconectada. ` +
      'Las marcaciones del grupo no se están recibiendo. Reconectar por QR desde /dashboard/rrhh/asistencia/whatsapp.',
    nivel: 'CRITICAL',
    modulo: 'ASISTENCIA',
    destinatario_rol: 'ADMIN',
    datos_contexto: body.data ?? {},
    generada_por: 'SISTEMA',
  })

  return ok({ evento: 'connection.update', estado, accion: 'ALERTA_CREADA' })
}

// ---------------------------------------------------------------------------
// messages.upsert → marcaciones_raw
// ---------------------------------------------------------------------------

async function manejarMessagesUpsert(
  body: EvolutionWebhookBody,
  grupoJid: string,
  bucket: string,
) {
  const supabase = getSupabaseAdmin()
  const msg = normalizarMensaje(body.data)

  if (!msg) return ok({ accion: 'PAYLOAD_NO_RECONOCIDO' })
  if (msg.fromMe) return ok({ accion: 'IGNORADO_PROPIO' })

  const esDM = !msg.esGrupo
  const esGrupoMonitoreado = msg.esGrupo && msg.chatJid === grupoJid

  // §10: el bot solo procesa el grupo configurado y DMs. Cualquier otro chat
  // se descarta sin dejar rastro.
  if (!esGrupoMonitoreado && !esDM) {
    return ok({ accion: 'IGNORADO_OTRO_CHAT' })
  }

  // --- Idempotencia por wa_message_id ------------------------------------
  const { data: yaExiste, error: errBusca } = await supabase
    .from('marcaciones_raw')
    .select('id, estado_proceso')
    .eq('wa_message_id', msg.waMessageId)
    .maybeSingle()

  if (errBusca) throw errBusca
  if (yaExiste) {
    return ok({
      accion: 'DUPLICADO',
      marcacion_raw_id: yaExiste.id,
      estado_proceso: yaExiste.estado_proceso,
    })
  }

  const rawId = randomUUID()

  // --- Estado inicial de procesamiento -----------------------------------
  // En el grupo solo las imágenes son marcaciones candidatas. El texto que
  // responde (quote) a otro mensaje se guarda como PENDIENTE: Fase 1 lo usará
  // como caption tardío (§4.1.3). Los DMs siempre son PENDIENTE (onboarding).
  let estadoProceso: 'PENDIENTE' | 'IGNORADO' = 'PENDIENTE'
  if (esGrupoMonitoreado && msg.tipoMensaje !== 'IMAGE' && !msg.quotedMessageId) {
    estadoProceso = 'IGNORADO'
  }

  // --- Subida de la imagen a Storage --------------------------------------
  let mediaUrl: string | null = null
  let mediaHash: string | null = null
  let errorDetalle: string | null = null

  if (msg.tipoMensaje === 'IMAGE' && msg.base64) {
    try {
      const buffer = Buffer.from(msg.base64, 'base64')
      mediaHash = createHash('sha256').update(buffer).digest('hex')

      const { yyyy, mm, dd } = fechaPartes(msg.timestamp)
      const ext = msg.mimetype?.includes('png') ? 'png' : 'jpg'
      const path = `${yyyy}/${mm}/${dd}/${rawId}.${ext}`

      const { error: errUpload } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType: msg.mimetype ?? 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        })

      if (errUpload) throw errUpload
      mediaUrl = `${bucket}/${path}`
    } catch (e) {
      // No perdemos el mensaje: se guarda como ERROR para reintento manual
      // desde /api/asistencia/procesar.
      errorDetalle = `Fallo al subir la imagen: ${(e as Error).message}`
      estadoProceso = 'PENDIENTE'
      console.error('[wa-webhook] storage:', e)
    }
  } else if (msg.tipoMensaje === 'IMAGE' && !msg.base64) {
    errorDetalle =
      'Imagen sin base64 en el webhook. Verificar webhook_base64=true en Evolution.'
    console.warn('[wa-webhook]', errorDetalle, msg.waMessageId)
  }

  // --- Persistencia --------------------------------------------------------
  const { error: errInsert } = await supabase.from('marcaciones_raw').insert({
    id: rawId,
    wa_message_id: msg.waMessageId,
    wa_grupo_jid: msg.chatJid,
    wa_remitente_jid: msg.remitenteJid,
    wa_remitente_telefono: msg.remitenteTelefono,
    wa_push_name: msg.pushName,
    wa_timestamp: msg.timestamp.toISOString(),
    tipo_mensaje: msg.tipoMensaje,
    caption: msg.caption,
    media_url: mediaUrl,
    media_hash: mediaHash,
    payload: payloadSinBase64(body),
    estado_proceso: estadoProceso,
    error_detalle: errorDetalle,
  })

  if (errInsert) {
    // 23505 = carrera entre dos entregas del mismo mensaje → idempotente
    if ((errInsert as { code?: string }).code === '23505') {
      return ok({ accion: 'DUPLICADO_CARRERA', wa_message_id: msg.waMessageId })
    }
    throw errInsert
  }

  // Fase 0 = modo sombra: no se encola procesamiento ni se envían DMs.
  return ok({
    accion: 'PERSISTIDO',
    marcacion_raw_id: rawId,
    tipo_mensaje: msg.tipoMensaje,
    estado_proceso: estadoProceso,
    media_guardada: mediaUrl !== null,
    origen: esGrupoMonitoreado ? 'GRUPO' : 'DM',
  })
}
