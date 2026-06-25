// ═══════════════════════════════════════════════════════════════════════
// AI Service Layer — Configuration & Model Routing
// Pure module: no side effects, no external dependencies
// ═══════════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'google' | 'deepseek'
export type AITier = 'economy' | 'standard' | 'premium'

export type AITaskType =
  // Reclutamiento
  | 'CV_PARSING'
  | 'ENTREVISTA_TRANSCRIPCION'
  | 'ENTREVISTA_ANALISIS'
  | 'SCORING_CANDIDATO'
  | 'INDUCCION_PLAN'
  // Contratos
  | 'CONTRATO_GENERACION'
  | 'RENOVACION_RESUMEN'
  // Gestión
  | 'RIESGO_FUGA'
  | 'OFFBOARDING_CHECKLIST'
  // Documentos
  | 'DOCUMENTO_OCR'
  // Comunicaciones
  | 'EMAIL_DRAFT'
  // Dashboard
  | 'ANOMALIA_DETECCION'
  // Autoservicio
  | 'CHATBOT_QUERY'
  // Arribos
  | 'REPARACION_NOMBRE'
  // Importación RRHH
  | 'IMPORTACION_MAPEO'
  | 'IMPORTACION_NORMALIZACION'
  | 'IMPORTACION_BRECHAS'
  // Backward compat
  | 'MAPEO_COLUMNAS_IMPORT'

export type AITaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// ─── Model Routing Table ─────────────────────────────────────────────

interface AITaskRouting {
  tier: AITier
  fallbackTier?: AITier
  maxTokens: number
  description: string
}

export const AI_TASK_ROUTING: Record<AITaskType, AITaskRouting> = {
  CV_PARSING:                { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Extract structured data from CV' },
  ENTREVISTA_TRANSCRIPCION:  { tier: 'economy',  maxTokens: 4000, description: 'Transcribe interview audio' },
  ENTREVISTA_ANALISIS:       { tier: 'standard', maxTokens: 3000, description: 'Analyze interview quality and fit' },
  SCORING_CANDIDATO:         { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 1500, description: 'Score candidate on criteria' },
  INDUCCION_PLAN:            { tier: 'economy',  maxTokens: 2000, description: 'Generate onboarding plan' },
  CONTRATO_GENERACION:       { tier: 'standard', maxTokens: 4000, description: 'Generate contract text' },
  RENOVACION_RESUMEN:        { tier: 'standard', fallbackTier: 'economy',  maxTokens: 2000, description: 'Summarize renewal decision data' },
  RIESGO_FUGA:               { tier: 'standard', maxTokens: 2000, description: 'Predict attrition risk' },
  OFFBOARDING_CHECKLIST:     { tier: 'economy',  maxTokens: 1500, description: 'Generate exit checklist' },
  DOCUMENTO_OCR:             { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Extract text from document image' },
  EMAIL_DRAFT:               { tier: 'economy',  maxTokens: 1000, description: 'Draft email from template' },
  ANOMALIA_DETECCION:        { tier: 'standard', fallbackTier: 'economy',  maxTokens: 2000, description: 'Detect anomalies in data' },
  CHATBOT_QUERY:             { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 1500, description: 'Answer user query' },
  REPARACION_NOMBRE:         { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 200,  description: 'Restore lost Spanish accents/ñ in RENIEC names' },
  IMPORTACION_MAPEO:         { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Map Excel columns to DB fields' },
  IMPORTACION_NORMALIZACION: { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 1500, description: 'Normalize enum values' },
  IMPORTACION_BRECHAS:       { tier: 'economy',  maxTokens: 3000, description: 'Analyze data gaps' },
  MAPEO_COLUMNAS_IMPORT:     { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Map Excel columns to DB fields (legacy)' },
}

// ─── Model Registry ──────────────────────────────────────────────────

export const AI_MODELS: Record<AIProvider, Record<AITier, string>> = {
  anthropic: {
    economy:  'claude-haiku-4-5-20251001',
    standard: 'claude-sonnet-4-5-20250929',
    premium:  'claude-opus-4-5-20250918',
  },
  google: {
    economy:  'gemini-2.0-flash',
    standard: 'gemini-2.0-pro',
    premium:  'gemini-2.0-ultra',
  },
  deepseek: {
    economy:  'deepseek-chat',
    standard: 'deepseek-reasoner',
    premium:  'deepseek-reasoner',
  },
}

// ─── Cost per 1M tokens (USD) ────────────────────────────────────────

export const AI_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001':   { input: 0.80,  output: 4.00 },
  'claude-sonnet-4-5-20250929':  { input: 3.00,  output: 15.00 },
  'claude-opus-4-5-20250918':    { input: 15.00, output: 75.00 },
  'gemini-2.0-flash':            { input: 0.10,  output: 0.40 },
  'deepseek-chat':               { input: 0.27,  output: 1.10 },
  'deepseek-reasoner':           { input: 0.55,  output: 2.19 },
}

// ─── system_config keys used by AI layer ─────────────────────────────

export const AI_CONFIG_KEYS = [
  'AI_ENABLED',
  'AI_FALLBACK_ENABLED',
  'AI_PROVIDER_DEFAULT',
  'AI_ANTHROPIC_API_KEY',
  'AI_GOOGLE_API_KEY',
  'AI_DEEPSEEK_API_KEY',
  'AI_MODEL_ECONOMY',
  'AI_MODEL_STANDARD',
  'AI_MODEL_PREMIUM',
  'AI_MONTHLY_BUDGET_USD',
  'AI_ALERT_THRESHOLD_PCT',
] as const

export type AIConfigKey = typeof AI_CONFIG_KEYS[number]

// ─── Helper Functions ────────────────────────────────────────────────

export function resolveModel(taskType: AITaskType, provider: AIProvider = 'anthropic'): string {
  const routing = AI_TASK_ROUTING[taskType]
  return AI_MODELS[provider][routing.tier]
}

export function resolveModelWithOverrides(
  taskType: AITaskType,
  provider: AIProvider,
  configOverrides: Partial<Record<string, string>>,
): string {
  const routing = AI_TASK_ROUTING[taskType]
  const overrideKey = `AI_MODEL_${routing.tier.toUpperCase()}`
  const override = configOverrides[overrideKey]
  if (override) return override
  return AI_MODELS[provider][routing.tier]
}

export function estimateCost(model: string, tokensInput: number, tokensOutput: number): number {
  const costs = AI_COSTS[model]
  if (!costs) return 0
  return (tokensInput / 1_000_000) * costs.input + (tokensOutput / 1_000_000) * costs.output
}

export function getApiKeyForProvider(
  provider: AIProvider,
  config: Partial<Record<string, string>>,
): string | undefined {
  const keyMap: Record<AIProvider, { configKey: string; envVar: string }> = {
    anthropic: { configKey: 'AI_ANTHROPIC_API_KEY', envVar: 'ANTHROPIC_API_KEY' },
    google:    { configKey: 'AI_GOOGLE_API_KEY',    envVar: 'GOOGLE_AI_API_KEY' },
    deepseek:  { configKey: 'AI_DEEPSEEK_API_KEY',  envVar: 'DEEPSEEK_API_KEY' },
  }
  const { configKey, envVar } = keyMap[provider]
  return config[configKey] || process.env[envVar] || undefined
}
