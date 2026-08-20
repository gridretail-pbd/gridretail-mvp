/**
 * GridRetail — Asistencia vía WhatsApp
 * Configuración y cliente Supabase con service role.
 *
 * Spec: SPEC_ASISTENCIA_WHATSAPP.md v1.1 §10.1
 *
 * NOTA: el resto del proyecto usa `createClient()` de `@/lib/supabase/server`
 * (anon key + cookies SSR), que funciona porque RLS está deshabilitado
 * (008_disable_rls_for_mvp). Aquí se usa service role a propósito: un webhook
 * no tiene sesión ni cookies, y la subida a Storage necesita permisos plenos.
 * `SUPABASE_SERVICE_ROLE_KEY` ya está declarada en `.env.example`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Env vars (ya cargadas en Vercel — ver spec §10.1)
// ---------------------------------------------------------------------------

export interface WhatsappEnv {
  evolutionApiUrl: string
  evolutionApiKey: string
  evolutionInstance: string
  grupoJid: string
  webhookSecret: string
  storageBucket: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Falta la variable de entorno ${name}`)
  }
  return value.trim()
}

export function getWhatsappEnv(): WhatsappEnv {
  return {
    evolutionApiUrl: requireEnv('EVOLUTION_API_URL').replace(/\/+$/, ''),
    evolutionApiKey: requireEnv('EVOLUTION_API_KEY'),
    evolutionInstance: requireEnv('EVOLUTION_INSTANCE'),
    grupoJid: requireEnv('WHATSAPP_GRUPO_JID'),
    webhookSecret: requireEnv('WHATSAPP_WEBHOOK_SECRET'),
    // Coincide con system_config['asistencia.wa.storage_bucket'] (migración 031)
    storageBucket: process.env.WHATSAPP_STORAGE_BUCKET?.trim() || 'asistencia',
  }
}

// ---------------------------------------------------------------------------
// Supabase (service role — bypasea RLS, solo servidor)
// ---------------------------------------------------------------------------

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    requireEnv('SUPABASE_SERVICE_KEY')

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

// ---------------------------------------------------------------------------
// Zona horaria operativa (Perú)
// ---------------------------------------------------------------------------

export const TZ_OPERACION = 'America/Lima'

/** Devuelve las partes YYYY/MM/DD de una fecha en la zona horaria operativa. */
export function fechaPartes(d: Date): { yyyy: string; mm: string; dd: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_OPERACION,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [yyyy, mm, dd] = fmt.format(d).split('-')
  return { yyyy, mm, dd }
}
