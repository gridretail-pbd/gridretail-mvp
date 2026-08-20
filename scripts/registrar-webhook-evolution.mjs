#!/usr/bin/env node
/**
 * GridRetail — Registro del webhook de asistencia en Evolution API
 * Spec: SPEC_ASISTENCIA_WHATSAPP.md v1.1 §7.2, §10.1
 *
 * Uso:
 *   node scripts/registrar-webhook-evolution.mjs                 # registra
 *   node scripts/registrar-webhook-evolution.mjs --check         # solo consulta
 *   node scripts/registrar-webhook-evolution.mjs --url https://... # URL manual
 *
 * Variables requeridas (.env.local o entorno):
 *   EVOLUTION_API_URL        https://evolution-api-production-5177.up.railway.app
 *   EVOLUTION_API_KEY        AUTHENTICATION_API_KEY de Railway
 *   EVOLUTION_INSTANCE       pbd-asistencia
 *   WHATSAPP_WEBHOOK_SECRET  openssl rand -hex 32
 *   APP_URL | NEXT_PUBLIC_APP_URL   https://<gridretail>   (si no se pasa --url)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Carga de .env.local / .env (sin dependencias)
// ---------------------------------------------------------------------------

for (const archivo of ['.env.local', '.env']) {
  try {
    const contenido = readFileSync(resolve(process.cwd(), archivo), 'utf8')
    for (const linea of contenido.split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const [, clave, bruto] = m
      if (process.env[clave]) continue
      process.env[clave] = bruto.replace(/^['"]|['"]$/g, '')
    }
  } catch {
    /* archivo ausente: se ignora */
  }
}

const requerir = (nombre) => {
  const v = process.env[nombre]?.trim()
  if (!v) {
    console.error(`✗ Falta la variable ${nombre}`)
    process.exit(1)
  }
  return v
}

const API_URL = requerir('EVOLUTION_API_URL').replace(/\/+$/, '')
const API_KEY = requerir('EVOLUTION_API_KEY')
const INSTANCE = requerir('EVOLUTION_INSTANCE')
const SECRET = requerir('WHATSAPP_WEBHOOK_SECRET')

const args = process.argv.slice(2)
const soloConsulta = args.includes('--check')
const urlFlagIdx = args.indexOf('--url')
const urlManual = urlFlagIdx >= 0 ? args[urlFlagIdx + 1] : null

const APP_URL = (
  urlManual ||
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''
)
  .trim()
  .replace(/\/+$/, '')

if (!soloConsulta && !APP_URL) {
  console.error('✗ Define APP_URL / NEXT_PUBLIC_APP_URL o pasa --url https://tu-app')
  process.exit(1)
}

const WEBHOOK_URL = `${APP_URL}/api/whatsapp/webhook?token=${encodeURIComponent(SECRET)}`
const EVENTOS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']

const enmascarar = (u) => u.replace(/token=[^&]+/, 'token=***')

// ---------------------------------------------------------------------------

async function llamar(path, init = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...(init.headers ?? {}),
    },
  })
  const texto = await res.text()
  let cuerpo
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { ok: res.ok, status: res.status, cuerpo }
}

async function main() {
  console.log(`\n▸ Evolution : ${API_URL}`)
  console.log(`▸ Instancia : ${INSTANCE}`)

  const conexion = await llamar(`/instance/connectionState/${encodeURIComponent(INSTANCE)}`)
  console.log(`▸ Conexión  : ${JSON.stringify(conexion.cuerpo)}`)

  if (soloConsulta) {
    const actual = await llamar(`/webhook/find/${encodeURIComponent(INSTANCE)}`)
    console.log('\n── Webhook configurado ──')
    console.log(JSON.stringify(actual.cuerpo, null, 2))
    return
  }

  console.log(`▸ Webhook   : ${enmascarar(WEBHOOK_URL)}`)
  console.log(`▸ Eventos   : ${EVENTOS.join(', ')}`)
  console.log('▸ base64    : true\n')

  const payload = {
    // Evolution v2
    webhook: {
      enabled: true,
      url: WEBHOOK_URL,
      byEvents: false,
      base64: true,
      events: EVENTOS,
    },
    // Compatibilidad Evolution v1.x
    enabled: true,
    url: WEBHOOK_URL,
    webhook_by_events: false,
    webhook_base64: true,
    events: EVENTOS,
  }

  const res = await llamar(`/webhook/set/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error(`✗ Evolution respondió ${res.status}`)
    console.error(JSON.stringify(res.cuerpo, null, 2))
    process.exit(1)
  }

  console.log('✓ Webhook registrado')

  const verificacion = await llamar(`/webhook/find/${encodeURIComponent(INSTANCE)}`)
  console.log('\n── Verificación ──')
  console.log(JSON.stringify(verificacion.cuerpo, null, 2))

  console.log(
    '\nSiguiente paso: enviar una foto al grupo y confirmar que aparece una fila en marcaciones_raw.',
  )
}

main().catch((e) => {
  console.error('✗ Error:', e.message)
  process.exit(1)
})
