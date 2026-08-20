/**
 * GridRetail — Asistencia vía WhatsApp
 * Adaptador de mensajería sobre Evolution API (Baileys).
 *
 * Toda la comunicación con el proveedor pasa por aquí. Si en el futuro se
 * migra a Meta Cloud API (plan de contingencia, spec §1.2), solo se reemplaza
 * este archivo: el procesador de marcaciones no cambia.
 */

import { getWhatsappEnv } from './config'

// ---------------------------------------------------------------------------
// Tipos del payload de webhook (Evolution v2)
// ---------------------------------------------------------------------------

export type EvolutionEvent =
  | 'messages.upsert'
  | 'connection.update'
  | (string & {})

export interface EvolutionWebhookBody {
  event?: EvolutionEvent
  instance?: string
  data?: Record<string, unknown>
  destination?: string
  date_time?: string
  sender?: string
  server_url?: string
  apikey?: string
  [k: string]: unknown
}

/** Mensaje ya normalizado, independiente del proveedor. */
export interface MensajeNormalizado {
  waMessageId: string
  chatJid: string // remoteJid: grupo (@g.us) o DM (@s.whatsapp.net / @lid)
  remitenteJid: string // participant en grupos; remoteJid en DMs
  remitenteTelefono: string | null
  pushName: string | null
  timestamp: Date
  esGrupo: boolean
  fromMe: boolean
  tipoMensaje: 'IMAGE' | 'TEXT' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'OTRO'
  caption: string | null
  /** Imagen en base64 (requiere webhook_base64 = true en Evolution). */
  base64: string | null
  mimetype: string | null
  /** wa_message_id citado, si el mensaje responde a otro. */
  quotedMessageId: string | null
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

const TIPO_POR_CLAVE: Record<string, MensajeNormalizado['tipoMensaje']> = {
  imageMessage: 'IMAGE',
  videoMessage: 'VIDEO',
  audioMessage: 'AUDIO',
  pttMessage: 'AUDIO',
  documentMessage: 'DOCUMENT',
  documentWithCaptionMessage: 'DOCUMENT',
  stickerMessage: 'STICKER',
  conversation: 'TEXT',
  extendedTextMessage: 'TEXT',
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** messageTimestamp puede llegar como number, string o { low, high }. */
function parseTimestamp(raw: unknown): Date {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return new Date(raw > 1e12 ? raw : raw * 1000)
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw)
    return new Date(n > 1e12 ? n : n * 1000)
  }
  const rec = asRecord(raw)
  if (rec && typeof rec.low === 'number') {
    return new Date(rec.low * 1000)
  }
  return new Date()
}

/** Extrae el base64 de la imagen buscando en las ubicaciones conocidas. */
function extraerBase64(data: Record<string, unknown>): string | null {
  const message = asRecord(data.message)
  const candidatos: unknown[] = [
    (data as Record<string, unknown>).base64,
    message?.base64,
    asRecord(message?.imageMessage)?.base64,
    asRecord(data.mediaBase64)?.base64,
    (data as Record<string, unknown>).mediaBase64,
  ]
  for (const c of candidatos) {
    if (typeof c === 'string' && c.length > 64) {
      // Acepta data URLs por si el proveedor cambia el formato
      const m = c.match(/^data:[^;]+;base64,(.*)$/)
      return m ? m[1] : c
    }
  }
  return null
}

function telefonoDesdeJid(jid: string): string | null {
  // 51947367258@s.whatsapp.net → 51947367258 ; 1234@lid no expone teléfono
  const m = jid.match(/^(\d{6,15})@s\.whatsapp\.net$/)
  return m ? m[1] : null
}

/**
 * Convierte el `data` de un evento `messages.upsert` en MensajeNormalizado.
 * Devuelve null si el payload no tiene la forma esperada.
 */
export function normalizarMensaje(
  data: Record<string, unknown> | undefined,
): MensajeNormalizado | null {
  if (!data) return null
  const key = asRecord(data.key)
  const waMessageId = typeof key?.id === 'string' ? key.id : null
  const chatJid = typeof key?.remoteJid === 'string' ? key.remoteJid : null
  if (!waMessageId || !chatJid) return null

  const esGrupo = chatJid.endsWith('@g.us')
  const participant =
    (typeof key?.participant === 'string' && key.participant) ||
    (typeof (data as Record<string, unknown>).participant === 'string'
      ? ((data as Record<string, unknown>).participant as string)
      : null)
  const remitenteJid = esGrupo ? participant ?? chatJid : chatJid

  const message = asRecord(data.message) ?? {}

  // messageType puede venir explícito; si no, se deduce de las claves de message
  let tipoMensaje: MensajeNormalizado['tipoMensaje'] = 'OTRO'
  const declarado =
    typeof data.messageType === 'string' ? data.messageType : undefined
  if (declarado && TIPO_POR_CLAVE[declarado]) {
    tipoMensaje = TIPO_POR_CLAVE[declarado]
  } else {
    for (const clave of Object.keys(message)) {
      if (TIPO_POR_CLAVE[clave]) {
        tipoMensaje = TIPO_POR_CLAVE[clave]
        break
      }
    }
  }

  const imageMessage = asRecord(message.imageMessage)
  const videoMessage = asRecord(message.videoMessage)
  const extended = asRecord(message.extendedTextMessage)

  const caption =
    (typeof imageMessage?.caption === 'string' && imageMessage.caption) ||
    (typeof videoMessage?.caption === 'string' && videoMessage.caption) ||
    (typeof message.conversation === 'string' && message.conversation) ||
    (typeof extended?.text === 'string' && extended.text) ||
    null

  const contextInfo =
    asRecord(imageMessage?.contextInfo) ?? asRecord(extended?.contextInfo)
  const quotedMessageId =
    typeof contextInfo?.stanzaId === 'string' ? contextInfo.stanzaId : null

  return {
    waMessageId,
    chatJid,
    remitenteJid,
    remitenteTelefono: telefonoDesdeJid(remitenteJid),
    pushName: typeof data.pushName === 'string' ? data.pushName : null,
    timestamp: parseTimestamp(data.messageTimestamp),
    esGrupo,
    fromMe: key?.fromMe === true,
    tipoMensaje,
    caption: caption ? String(caption).trim() : null,
    base64: tipoMensaje === 'IMAGE' ? extraerBase64(data) : null,
    mimetype:
      (typeof imageMessage?.mimetype === 'string' && imageMessage.mimetype) ||
      null,
    quotedMessageId,
  }
}

/** Elimina los base64 del payload antes de persistirlo en marcaciones_raw. */
export function payloadSinBase64<T>(body: T): T {
  const LIMITE = 512
  const limpiar = (v: unknown): unknown => {
    if (typeof v === 'string') {
      return v.length > LIMITE ? `[omitido:${v.length} chars]` : v
    }
    if (Array.isArray(v)) return v.map(limpiar)
    const rec = asRecord(v)
    if (!rec) return v
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(rec)) {
      if (k === 'base64' || k === 'mediaBase64') {
        out[k] = typeof val === 'string' ? `[omitido:${val.length} chars]` : val
      } else {
        out[k] = limpiar(val)
      }
    }
    return out
  }
  return limpiar(body) as T
}

// ---------------------------------------------------------------------------
// Cliente REST de Evolution
// ---------------------------------------------------------------------------

async function evolutionFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const env = getWhatsappEnv()
  const res = await fetch(`${env.evolutionApiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.evolutionApiKey,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  let body: unknown = null
  const text = await res.text()
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { ok: res.ok, status: res.status, body }
}

export const EVENTOS_WEBHOOK = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] as const

/**
 * Registra (o actualiza) el webhook de la instancia en Evolution.
 * Eventos: MESSAGES_UPSERT + CONNECTION_UPDATE, con webhook_base64 = true.
 */
export async function registrarWebhook(webhookUrl: string) {
  const env = getWhatsappEnv()
  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: [...EVENTOS_WEBHOOK],
    },
    // Compatibilidad con Evolution v1.x (payload plano)
    enabled: true,
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: true,
    events: [...EVENTOS_WEBHOOK],
  }

  const res = await evolutionFetch(
    `/webhook/set/${encodeURIComponent(env.evolutionInstance)}`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return res
}

/** Consulta el webhook configurado en la instancia. */
export async function consultarWebhook() {
  const env = getWhatsappEnv()
  return evolutionFetch(
    `/webhook/find/${encodeURIComponent(env.evolutionInstance)}`,
    { method: 'GET' },
  )
}

/** Estado de conexión de la instancia (open | connecting | close). */
export async function estadoInstancia() {
  const env = getWhatsappEnv()
  return evolutionFetch(
    `/instance/connectionState/${encodeURIComponent(env.evolutionInstance)}`,
    { method: 'GET' },
  )
}

/**
 * Envía un DM 1:1. NO se usa en Fase 0 (modo sombra): queda listo para Fase 1
 * y respeta el kill switch `asistencia.dm_habilitado` de system_config.
 */
export async function enviarDM(numeroJid: string, texto: string) {
  const env = getWhatsappEnv()
  return evolutionFetch(
    `/message/sendText/${encodeURIComponent(env.evolutionInstance)}`,
    {
      method: 'POST',
      body: JSON.stringify({ number: numeroJid, text: texto }),
    },
  )
}
