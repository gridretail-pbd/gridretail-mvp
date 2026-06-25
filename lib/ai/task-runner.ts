// ═══════════════════════════════════════════════════════════════════════
// AI Service Layer — Task Runner
// Central orchestrator: config → ai_tasks logging → AI call → results
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AI_CONFIG_KEYS,
  AI_TASK_ROUTING,
  estimateCost,
  getApiKeyForProvider,
  resolveModelWithOverrides,
  type AIProvider,
  type AITaskType,
} from '@/lib/ai/config'
import { callAnthropicAI } from '@/lib/ai/client'

// ─── Types ───────────────────────────────────────────────────────────

export interface RunAITaskParams {
  supabase: SupabaseClient
  tipo: AITaskType
  modulo: string
  entidad_tipo?: string
  entidad_id?: string
  systemPrompt?: string
  userPrompt: string
  promptVersion?: string
  solicitado_por?: string
}

export interface RunAITaskResult {
  success: true
  text: string
  taskId: string
  model: string
  tokensInput: number
  tokensOutput: number
  costoUsd: number
  latencyMs: number
}

export interface RunAITaskError {
  success: false
  error: string
  taskId?: string
}

export type RunAITaskReturn = RunAITaskResult | RunAITaskError

// ─── Config Reader ───────────────────────────────────────────────────

async function readAIConfig(
  supabase: SupabaseClient,
): Promise<Record<string, string>> {
  const { data: configRows } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', [...AI_CONFIG_KEYS])

  return Object.fromEntries(
    (configRows || []).map((r: { key: string; value: string }) => [r.key, r.value]),
  )
}

// ─── Main Runner ─────────────────────────────────────────────────────

export async function runAITask(params: RunAITaskParams): Promise<RunAITaskReturn> {
  const { supabase, tipo, modulo, entidad_tipo, entidad_id, systemPrompt, userPrompt, promptVersion, solicitado_por } = params

  // 1. Read AI configuration
  const config = await readAIConfig(supabase)

  // 2. Check if AI is enabled
  if (config.AI_ENABLED === 'false') {
    return { success: false, error: 'AI está deshabilitado en system_config' }
  }

  // 3. Resolve provider and model
  const provider = (config.AI_PROVIDER_DEFAULT || 'anthropic') as AIProvider
  const model = resolveModelWithOverrides(tipo, provider, config)
  const routing = AI_TASK_ROUTING[tipo]

  // 4. Get API key (system_config → env var fallback)
  const apiKey = getApiKeyForProvider(provider, config)
  if (!apiKey) {
    return { success: false, error: `API key no configurada para provider: ${provider}` }
  }

  // 5. Create ai_tasks record (PENDING)
  let taskId: string | undefined
  try {
    const { data: task } = await supabase
      .from('ai_tasks')
      .insert({
        tipo,
        modulo,
        entidad_tipo: entidad_tipo || null,
        entidad_id: entidad_id || null,
        modelo: model,
        prompt_version: promptVersion || null,
        input_summary: userPrompt.substring(0, 500),
        status: 'PENDING',
        solicitado_por: solicitado_por || null,
      })
      .select('id')
      .single()

    taskId = task?.id
  } catch (err) {
    console.error('Error creando ai_tasks record:', err)
    // Continue without logging — AI call is still useful
  }

  // 6. Update to PROCESSING
  if (taskId) {
    await supabase
      .from('ai_tasks')
      .update({ status: 'PROCESSING' })
      .eq('id', taskId)
  }

  // 7. Execute AI call with timing
  const startTime = Date.now()
  try {
    let result: { text: string; tokensInput: number; tokensOutput: number }

    if (provider === 'anthropic') {
      result = await callAnthropicAI({
        model,
        maxTokens: routing.maxTokens,
        systemPrompt,
        userPrompt,
        apiKey,
      })
    } else {
      // Future: callGoogleAI, callDeepSeekAI
      return {
        success: false,
        error: `Provider '${provider}' no implementado aún`,
        taskId,
      }
    }

    const latencyMs = Date.now() - startTime
    const costoUsd = estimateCost(model, result.tokensInput, result.tokensOutput)

    // 8. Update ai_tasks with success
    if (taskId) {
      await supabase
        .from('ai_tasks')
        .update({
          output: { text: result.text },
          tokens_input: result.tokensInput,
          tokens_output: result.tokensOutput,
          costo_estimado_usd: costoUsd,
          latency_ms: latencyMs,
          status: 'COMPLETED',
        })
        .eq('id', taskId)
    }

    return {
      success: true,
      text: result.text,
      taskId: taskId || '',
      model,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      costoUsd,
      latencyMs,
    }
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

    // 9. Update ai_tasks with failure
    if (taskId) {
      await supabase
        .from('ai_tasks')
        .update({
          status: 'FAILED',
          error_message: errorMessage,
          latency_ms: latencyMs,
          reintentos: 1,
        })
        .eq('id', taskId)
    }

    // 10. Try fallback if configured
    if (routing.fallbackTier && config.AI_FALLBACK_ENABLED !== 'false') {
      const fallbackOverrideKey = `AI_MODEL_${routing.fallbackTier.toUpperCase()}`
      const fallbackModel = config[fallbackOverrideKey] ||
        (await import('@/lib/ai/config')).AI_MODELS[provider][routing.fallbackTier]

      if (fallbackModel && fallbackModel !== model) {
        console.warn(`AI fallback: ${model} → ${fallbackModel} para ${tipo}`)

        const fallbackApiKey = getApiKeyForProvider(provider, config)
        if (fallbackApiKey) {
          try {
            const fallbackStartTime = Date.now()
            const fallbackResult = await callAnthropicAI({
              model: fallbackModel,
              maxTokens: routing.maxTokens,
              systemPrompt,
              userPrompt,
              apiKey: fallbackApiKey,
            })

            const fallbackLatency = Date.now() - fallbackStartTime
            const fallbackCost = estimateCost(fallbackModel, fallbackResult.tokensInput, fallbackResult.tokensOutput)

            // Log fallback as separate task
            const { data: fallbackTask } = await supabase
              .from('ai_tasks')
              .insert({
                tipo,
                modulo,
                entidad_tipo: entidad_tipo || null,
                entidad_id: entidad_id || null,
                modelo: fallbackModel,
                prompt_version: promptVersion || null,
                input_summary: `[FALLBACK] ${userPrompt.substring(0, 480)}`,
                output: { text: fallbackResult.text },
                tokens_input: fallbackResult.tokensInput,
                tokens_output: fallbackResult.tokensOutput,
                costo_estimado_usd: fallbackCost,
                latency_ms: fallbackLatency,
                status: 'COMPLETED',
                solicitado_por: solicitado_por || null,
              })
              .select('id')
              .single()

            return {
              success: true,
              text: fallbackResult.text,
              taskId: fallbackTask?.id || taskId || '',
              model: fallbackModel,
              tokensInput: fallbackResult.tokensInput,
              tokensOutput: fallbackResult.tokensOutput,
              costoUsd: fallbackCost,
              latencyMs: fallbackLatency,
            }
          } catch (fallbackError) {
            console.error('Error en fallback AI:', fallbackError)
          }
        }
      }
    }

    return { success: false, error: errorMessage, taskId }
  }
}
