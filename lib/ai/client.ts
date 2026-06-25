// ═══════════════════════════════════════════════════════════════════════
// AI Service Layer — Client Wrapper
// Thin abstraction over provider SDKs. Currently only Anthropic.
// ═══════════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk'

// ─── Types ───────────────────────────────────────────────────────────

export interface AICallParams {
  model: string
  maxTokens: number
  systemPrompt?: string
  userPrompt: string
  apiKey: string
}

export interface AICallResult {
  text: string
  tokensInput: number
  tokensOutput: number
}

// ─── Anthropic ───────────────────────────────────────────────────────

export async function callAnthropicAI(params: AICallParams): Promise<AICallResult> {
  const client = new Anthropic({ apiKey: params.apiKey })

  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
    messages: [{ role: 'user', content: params.userPrompt }],
  })

  const text = response.content[0].type === 'text'
    ? response.content[0].text
    : ''

  return {
    text,
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  }
}
