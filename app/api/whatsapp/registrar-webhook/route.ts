/**
 * GridRetail — /api/whatsapp/registrar-webhook
 * Registra el webhook de GridRetail en la instancia de Evolution API.
 *
 * Spec: SPEC_ASISTENCIA_WHATSAPP.md v1.1 §7.2, §10.1
 *
 *   GET  → devuelve el webhook actualmente configurado + estado de la instancia
 *   POST → (re)registra el webhook con MESSAGES_UPSERT + CONNECTION_UPDATE
 *          y webhook_base64 = true
 *
 * Protección: header `x-cron-secret` (o `Authorization: Bearer <CRON_SECRET>`),
 * igual que los crons del proyecto. Es una operación de administración: no se
 * expone a la UI de asesores.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

import { getWhatsappEnv } from '@/lib/whatsapp/config'
import {
  EVENTOS_WEBHOOK,
  consultarWebhook,
  estadoInstancia,
  registrarWebhook,
} from '@/lib/whatsapp/evolution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const candidatos = [
    req.headers.get('x-cron-secret'),
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null,
    req.nextUrl.searchParams.get('secret'),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)
  return candidatos.some((c) => comparaSegura(c, secret))
}

/** URL pública del webhook, con el token del spec §10.1 en el query string. */
function construirWebhookUrl(req: NextRequest, secret: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    req.nextUrl.origin

  return `${base}/api/whatsapp/webhook?token=${encodeURIComponent(secret)}`
}

/** Oculta el token al devolver la URL en la respuesta. */
function enmascarar(url: string): string {
  return url.replace(/token=[^&]+/, 'token=***')
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  }
  try {
    const env = getWhatsappEnv()
    const [webhook, conexion] = await Promise.all([
      consultarWebhook(),
      estadoInstancia(),
    ])
    return NextResponse.json({
      ok: true,
      instancia: env.evolutionInstance,
      grupo_jid: env.grupoJid,
      webhook_configurado: webhook.body,
      estado_instancia: conexion.body,
      webhook_esperado: enmascarar(construirWebhookUrl(req, env.webhookSecret)),
      eventos_esperados: EVENTOS_WEBHOOK,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  }

  try {
    const env = getWhatsappEnv()

    // Permite forzar una URL distinta (p. ej. un túnel para pruebas locales).
    let urlOverride: string | undefined
    try {
      const body = (await req.json()) as { url?: string } | null
      if (body?.url) urlOverride = body.url
    } catch {
      /* body vacío: se usa la URL derivada del entorno */
    }

    const webhookUrl =
      urlOverride ?? construirWebhookUrl(req, env.webhookSecret)

    const res = await registrarWebhook(webhookUrl)
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Evolution rechazó el registro',
          status: res.status,
          respuesta: res.body,
        },
        { status: 502 },
      )
    }

    const verificacion = await consultarWebhook()

    return NextResponse.json({
      ok: true,
      instancia: env.evolutionInstance,
      webhook_url: enmascarar(webhookUrl),
      eventos: EVENTOS_WEBHOOK,
      webhook_base64: true,
      respuesta_evolution: res.body,
      verificacion: verificacion.body,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    )
  }
}
