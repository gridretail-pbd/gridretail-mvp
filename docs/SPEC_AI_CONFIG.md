# GridRetail — Configuración de Inteligencia Artificial
## Especificación de Model Routing, Costos y Gobernanza AI

**Versión:** 1.0  
**Fecha:** 2026-02-16  
**Alcance:** Transversal a todos los módulos  
**Dependencias:** Tablas `system_config`, `ai_tasks`  
**Prerrequisito:** API Key de Anthropic (y opcionalmente Google AI, DeepSeek)

---

## 1. VISIÓN

GridRetail es una plataforma **AI First**. La inteligencia artificial no es un add-on sino un componente estructural. Sin embargo, no todas las tareas AI requieren el mismo nivel de inteligencia. Usar el modelo más caro para todo es un desperdicio; usar el más barato para todo compromete la calidad.

**Principio rector:** Usar el modelo más barato que resuelva bien cada tarea específica.

---

## 2. MODELOS DISPONIBLES

### 2.1 Catálogo de Modelos

| Modelo | Provider | Tier | Input $/1M | Output $/1M | Velocidad | Inteligencia |
|--------|----------|------|-----------|-------------|-----------|--------------|
| `claude-haiku-4-5` | Anthropic | 💚 Economy | $0.80 | $4.00 | ⚡ Muy rápida | Buena |
| `claude-sonnet-4-5` | Anthropic | 💛 Standard | $3.00 | $15.00 | 🔵 Rápida | Muy buena |
| `claude-opus-4-5` | Anthropic | 🔴 Premium | $15.00 | $75.00 | 🟡 Media | Excelente |
| `gemini-2.0-flash` | Google | 💚 Economy | $0.10 | $0.40 | ⚡ Muy rápida | Buena |
| `deepseek-v3` | DeepSeek | 💚 Economy | $0.27 | $1.10 | ⚡ Rápida | Buena |

> **Nota:** Precios aproximados a feb-2026. Actualizar periódicamente en `system_config`.

### 2.2 Criterios de Selección por Tarea

| Criterio | Economy (Haiku/Flash) | Standard (Sonnet) | Premium (Opus) |
|----------|----------------------|-------------------|----------------|
| Structured data extraction | ✅ Ideal | ⬆️ Overkill | ❌ No usar |
| Column mapping / normalization | ✅ Suficiente | ✅ Si hay ambigüedad | ❌ No usar |
| Text classification / enums | ✅ Ideal | ⬆️ Overkill | ❌ No usar |
| OCR + data extraction | ✅ Suficiente | ✅ Si docs complejos | ❌ No usar |
| Summarization / reports | 🟡 Básico | ✅ Ideal | ⬆️ Si ejecutivo |
| Complex reasoning / analysis | ❌ Insuficiente | ✅ Ideal | ✅ Si crítico |
| Free-form generation (contracts) | ❌ Insuficiente | ✅ Ideal | ✅ Si legal |
| Chatbot / Q&A | ✅ Ideal | ⬆️ Para consultas complejas | ❌ No usar |
| Anomaly detection | 🟡 Patrones simples | ✅ Ideal | ❌ No usar |
| Risk scoring / predictions | ❌ Insuficiente | ✅ Ideal | ❌ No usar |

---

## 3. MODEL ROUTING POR TAREA

### 3.1 Asignación de Modelos a Tipos de Tarea AI

Referencia cruzada con `ai_tasks.tipo` (ver DATA_DICTIONARY §13.3.1):

| Tipo (`ai_tasks.tipo`) | Módulo | Modelo Default | Fallback | Justificación |
|------------------------|--------|---------------|----------|---------------|
| `CV_PARSING` | Reclutamiento | `claude-haiku-4-5` | `gemini-2.0-flash` | Extracción estructurada, no requiere razonamiento complejo |
| `ENTREVISTA_TRANSCRIPCION` | Reclutamiento | Whisper API | — | Audio → texto, modelo especializado |
| `ENTREVISTA_ANALISIS` | Reclutamiento | `claude-sonnet-4-5` | — | Evaluación cualitativa, requiere juicio |
| `SCORING_CANDIDATO` | Reclutamiento | `claude-haiku-4-5` | `gemini-2.0-flash` | Score numérico sobre datos estructurados |
| `RENOVACION_RESUMEN` | Contratos | `claude-sonnet-4-5` | `claude-haiku-4-5` | Resumen ejecutivo con recomendación |
| `CONTRATO_GENERACION` | Contratos | `claude-sonnet-4-5` | — | Generación de texto legal, requiere precisión |
| `RIESGO_FUGA` | Gestión | `claude-sonnet-4-5` | — | Análisis predictivo multi-señal |
| `CHATBOT_QUERY` | Autoservicio | `claude-haiku-4-5` | `gemini-2.0-flash` | Respuestas rápidas, alto volumen |
| `DOCUMENTO_OCR` | Documentos | `claude-haiku-4-5` | `gemini-2.0-flash` | Extracción de texto de imágenes |
| `EMAIL_DRAFT` | Comunicaciones | `claude-haiku-4-5` | — | Generación simple con template |
| `ANOMALIA_DETECCION` | Dashboard | `claude-sonnet-4-5` | `claude-haiku-4-5` | Pattern matching, requiere contexto |
| `INDUCCION_PLAN` | Reclutamiento | `claude-haiku-4-5` | — | Plan basado en template + datos |
| `OFFBOARDING_CHECKLIST` | Offboarding | `claude-haiku-4-5` | — | Selección de tareas por tipo de salida |
| `IMPORTACION_MAPEO`* | Importación | `claude-haiku-4-5` | `gemini-2.0-flash` | Mapeo de columnas Excel → BD |
| `IMPORTACION_NORMALIZACION`* | Importación | `claude-haiku-4-5` | `gemini-2.0-flash` | Normalización de enums |
| `IMPORTACION_BRECHAS`* | Importación | `claude-haiku-4-5` | — | Análisis de datos faltantes |

> *Nuevos tipos a agregar al constraint de `ai_tasks.tipo`

### 3.2 Resumen de Distribución

| Tier | Tareas | % del total |
|------|--------|-------------|
| 💚 **Haiku/Economy** | 10 de 16 | 62% |
| 💛 **Sonnet/Standard** | 5 de 16 | 31% |
| 🔴 **Opus/Premium** | 0 de 16 | 0% |
| 🔊 **Whisper** | 1 de 16 | 6% |

**Resultado:** La mayoría de tareas AI de GridRetail corren con el modelo más económico.

---

## 4. ESTIMACIONES DE COSTO MENSUAL

### 4.1 Supuestos (PBD: 21 tiendas, ~100 colaboradores)

| Actividad | Frecuencia mensual | Tokens/call (in+out) | Modelo |
|-----------|-------------------|---------------------|--------|
| Chatbot queries | 200 | ~2,000 | Haiku |
| CV parsing (3-5 candidatos/mes) | 5 | ~4,000 | Haiku |
| Scoring candidatos | 5 | ~3,000 | Haiku |
| Renovación resúmenes (~100 batch) | 100 | ~3,000 | Sonnet |
| Contrato generación | 10 | ~5,000 | Sonnet |
| Anomalía detección | 4 | ~5,000 | Sonnet |
| Riesgo fuga (mensual) | 100 | ~3,000 | Sonnet |
| Offboarding checklists | 5 | ~2,000 | Haiku |
| OCR documentos | 20 | ~3,000 | Haiku |
| Email drafts | 10 | ~1,500 | Haiku |
| Importación RRHH | 0.1 (esporádico) | ~13,000 | Haiku |

### 4.2 Costo Estimado Mensual

| Categoría | Tokens/mes (M) | Modelo | Costo |
|-----------|---------------|--------|-------|
| **Economy (Haiku)** | ~0.8M in / ~0.4M out | Haiku | **~$2.25** |
| **Standard (Sonnet)** | ~0.7M in / ~0.3M out | Sonnet | **~$6.60** |
| **Total mensual** | | | **~$8.85** |

### 4.3 Escenarios

| Escenario | Costo/mes | Nota |
|-----------|-----------|------|
| **PBD operación normal** | ~$9 | 21 tiendas, 100 colaboradores |
| **PBD pico (renovaciones)** | ~$14 | Mes con ciclo de renovación |
| **Nuevo tenant onboarding** | +$0.05 | Importación inicial one-shot |
| **3 tenants simultáneos** | ~$27 | Escalamiento lineal |
| **Si todo fuera Opus** | ~$175 | 20x más caro, innecesario |

> **El costo AI de GridRetail es menor que una hamburguesa al mes.** 🍔

---

## 5. CONFIGURACIÓN EN BASE DE DATOS

### 5.1 Registros en `system_config`

```sql
-- ═══════════════════════════════════════════
-- AI Provider Keys
-- ═══════════════════════════════════════════
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES 
  ('AI_ANTHROPIC_API_KEY', 'sk-ant-api03-...', 'Anthropic API Key', true, 'ai'),
  ('AI_GOOGLE_API_KEY', '', 'Google AI API Key (opcional)', true, 'ai'),
  ('AI_DEEPSEEK_API_KEY', '', 'DeepSeek API Key (opcional)', true, 'ai')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ═══════════════════════════════════════════
-- Model Routing Configuration
-- ═══════════════════════════════════════════
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES 
  ('AI_MODEL_ECONOMY', 'claude-haiku-4-5', 'Modelo para tareas simples', false, 'ai'),
  ('AI_MODEL_STANDARD', 'claude-sonnet-4-5', 'Modelo para tareas complejas', false, 'ai'),
  ('AI_MODEL_PREMIUM', 'claude-opus-4-5', 'Modelo para tareas críticas (no usado actualmente)', false, 'ai'),
  ('AI_PROVIDER_DEFAULT', 'anthropic', 'Provider por defecto: anthropic, google, deepseek', false, 'ai')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ═══════════════════════════════════════════
-- Cost Controls
-- ═══════════════════════════════════════════
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES 
  ('AI_MONTHLY_BUDGET_USD', '25.00', 'Presupuesto máximo mensual en USD', false, 'ai'),
  ('AI_ALERT_THRESHOLD_PCT', '80', 'Alertar cuando se consuma X% del presupuesto', false, 'ai'),
  ('AI_ENABLED', 'true', 'Feature flag global para AI', false, 'ai'),
  ('AI_FALLBACK_ENABLED', 'true', 'Permitir fallback a modelo alternativo si falla', false, 'ai')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

### 5.2 Actualizar constraint de `ai_tasks.tipo`

```sql
-- Agregar nuevos tipos para Importación
ALTER TABLE ai_tasks DROP CONSTRAINT IF EXISTS ai_tasks_tipo_check;
ALTER TABLE ai_tasks ADD CONSTRAINT ai_tasks_tipo_check CHECK (tipo IN (
  -- Reclutamiento
  'CV_PARSING', 'ENTREVISTA_TRANSCRIPCION', 'ENTREVISTA_ANALISIS', 
  'SCORING_CANDIDATO', 'INDUCCION_PLAN',
  -- Contratos
  'CONTRATO_GENERACION', 'RENOVACION_RESUMEN',
  -- Gestión
  'RIESGO_FUGA', 'OFFBOARDING_CHECKLIST',
  -- Documentos
  'DOCUMENTO_OCR',
  -- Comunicaciones
  'EMAIL_DRAFT',
  -- Dashboard
  'ANOMALIA_DETECCION',
  -- Autoservicio
  'CHATBOT_QUERY',
  -- Importación RRHH
  'IMPORTACION_MAPEO', 'IMPORTACION_NORMALIZACION', 'IMPORTACION_BRECHAS'
));
```

---

## 6. IMPLEMENTACIÓN: AI SERVICE LAYER

### 6.1 Estructura de Archivos

```
lib/
└── ai/
    ├── config.ts           # Configuración y model routing
    ├── client.ts           # Cliente unificado (Anthropic/Google/DeepSeek)
    ├── task-runner.ts       # Ejecutor con logging a ai_tasks
    ├── cost-tracker.ts      # Monitoreo de costos
    └── prompts/
        ├── rrhh/
        │   ├── cv-parsing.ts
        │   ├── importacion-mapeo.ts
        │   ├── importacion-normalizacion.ts
        │   ├── importacion-brechas.ts
        │   ├── scoring-candidato.ts
        │   ├── renovacion-resumen.ts
        │   ├── riesgo-fuga.ts
        │   └── offboarding-checklist.ts
        ├── contratos/
        │   └── generacion-contrato.ts
        ├── ventas/
        │   └── anomalia-deteccion.ts
        └── shared/
            └── chatbot-query.ts
```

### 6.2 Configuración y Model Routing (`lib/ai/config.ts`)

```typescript
// ═══════════════════════════════════════════
// AI Model Configuration
// ═══════════════════════════════════════════

export type AIProvider = 'anthropic' | 'google' | 'deepseek';
export type AITier = 'economy' | 'standard' | 'premium';

export type AITaskType = 
  | 'CV_PARSING' | 'ENTREVISTA_TRANSCRIPCION' | 'ENTREVISTA_ANALISIS'
  | 'SCORING_CANDIDATO' | 'INDUCCION_PLAN'
  | 'CONTRATO_GENERACION' | 'RENOVACION_RESUMEN'
  | 'RIESGO_FUGA' | 'OFFBOARDING_CHECKLIST'
  | 'DOCUMENTO_OCR' | 'EMAIL_DRAFT' | 'ANOMALIA_DETECCION'
  | 'CHATBOT_QUERY'
  | 'IMPORTACION_MAPEO' | 'IMPORTACION_NORMALIZACION' | 'IMPORTACION_BRECHAS';

// ─── Model Routing Table ───────────────────
// Maps each task type to its recommended tier and fallback
export const AI_TASK_ROUTING: Record<AITaskType, {
  tier: AITier;
  fallbackTier?: AITier;
  maxTokens: number;
  description: string;
}> = {
  CV_PARSING:                    { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Extract structured data from CV' },
  ENTREVISTA_TRANSCRIPCION:      { tier: 'economy',  maxTokens: 4000, description: 'Transcribe interview audio' },
  ENTREVISTA_ANALISIS:           { tier: 'standard', maxTokens: 3000, description: 'Analyze interview quality and fit' },
  SCORING_CANDIDATO:             { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 1500, description: 'Score candidate on criteria' },
  INDUCCION_PLAN:                { tier: 'economy',  maxTokens: 2000, description: 'Generate onboarding plan' },
  CONTRATO_GENERACION:           { tier: 'standard', maxTokens: 4000, description: 'Generate contract text' },
  RENOVACION_RESUMEN:            { tier: 'standard', fallbackTier: 'economy',  maxTokens: 2000, description: 'Summarize renewal decision data' },
  RIESGO_FUGA:                   { tier: 'standard', maxTokens: 2000, description: 'Predict attrition risk' },
  OFFBOARDING_CHECKLIST:         { tier: 'economy',  maxTokens: 1500, description: 'Generate exit checklist' },
  DOCUMENTO_OCR:                 { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Extract text from document image' },
  EMAIL_DRAFT:                   { tier: 'economy',  maxTokens: 1000, description: 'Draft email from template' },
  ANOMALIA_DETECCION:            { tier: 'standard', fallbackTier: 'economy',  maxTokens: 2000, description: 'Detect anomalies in data' },
  CHATBOT_QUERY:                 { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 1500, description: 'Answer user query' },
  IMPORTACION_MAPEO:             { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 2000, description: 'Map Excel columns to DB fields' },
  IMPORTACION_NORMALIZACION:     { tier: 'economy',  fallbackTier: 'economy',  maxTokens: 1500, description: 'Normalize enum values' },
  IMPORTACION_BRECHAS:           { tier: 'economy',  maxTokens: 3000, description: 'Analyze data gaps' },
};

// ─── Model Registry ────────────────────────
// Provider-specific model identifiers per tier
export const AI_MODELS: Record<AIProvider, Record<AITier, string>> = {
  anthropic: {
    economy:  'claude-haiku-4-5',
    standard: 'claude-sonnet-4-5',
    premium:  'claude-opus-4-5',
  },
  google: {
    economy:  'gemini-2.0-flash',
    standard: 'gemini-2.0-pro',
    premium:  'gemini-2.0-ultra',
  },
  deepseek: {
    economy:  'deepseek-chat',       // DeepSeek V3
    standard: 'deepseek-reasoner',   // DeepSeek R1
    premium:  'deepseek-reasoner',
  },
};

// ─── Cost per 1M tokens (USD) ──────────────
export const AI_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':    { input: 0.80,  output: 4.00 },
  'claude-sonnet-4-5':   { input: 3.00,  output: 15.00 },
  'claude-opus-4-5':     { input: 15.00, output: 75.00 },
  'gemini-2.0-flash':    { input: 0.10,  output: 0.40 },
  'deepseek-chat':       { input: 0.27,  output: 1.10 },
  'deepseek-reasoner':   { input: 0.55,  output: 2.19 },
};

// ─── Helper Functions ──────────────────────

/**
 * Resolve which model to use for a given task type.
 * Reads provider from system_config, maps tier → model string.
 */
export function resolveModel(
  taskType: AITaskType, 
  provider: AIProvider = 'anthropic'
): string {
  const routing = AI_TASK_ROUTING[taskType];
  return AI_MODELS[provider][routing.tier];
}

/**
 * Estimate cost for a given model and token usage.
 */
export function estimateCost(
  model: string, 
  tokensInput: number, 
  tokensOutput: number
): number {
  const costs = AI_COSTS[model];
  if (!costs) return 0;
  return (tokensInput / 1_000_000) * costs.input 
       + (tokensOutput / 1_000_000) * costs.output;
}
```

### 6.3 Task Runner con Logging (`lib/ai/task-runner.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { resolveModel, estimateCost, AI_TASK_ROUTING } from './config';
import type { AITaskType, AIProvider } from './config';

interface AITaskParams {
  tipo: AITaskType;
  modulo: string;
  entidad_tipo?: string;
  entidad_id?: string;
  prompt: string;
  systemPrompt?: string;
  solicitado_por?: string;
}

interface AITaskResult {
  output: any;
  taskId: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costoUsd: number;
  latencyMs: number;
}

export async function runAITask(params: AITaskParams): Promise<AITaskResult> {
  const supabase = await createClient();
  const startTime = Date.now();
  
  // 1. Get provider config from system_config
  const { data: configRows } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', ['AI_PROVIDER_DEFAULT', 'AI_ENABLED', 'AI_ANTHROPIC_API_KEY']);
  
  const config = Object.fromEntries(
    (configRows || []).map(r => [r.key, r.value])
  );
  
  if (config.AI_ENABLED === 'false') {
    throw new Error('AI está deshabilitado en system_config');
  }

  const provider = (config.AI_PROVIDER_DEFAULT || 'anthropic') as AIProvider;
  const model = resolveModel(params.tipo, provider);
  const routing = AI_TASK_ROUTING[params.tipo];

  // 2. Create ai_tasks record (PENDING)
  const { data: task } = await supabase
    .from('ai_tasks')
    .insert({
      tipo: params.tipo,
      modulo: params.modulo,
      entidad_tipo: params.entidad_tipo,
      entidad_id: params.entidad_id,
      modelo: model,
      input_summary: params.prompt.substring(0, 500),
      status: 'PENDING',
      solicitado_por: params.solicitado_por,
    })
    .select('id')
    .single();

  const taskId = task!.id;

  try {
    // 3. Update to PROCESSING
    await supabase
      .from('ai_tasks')
      .update({ status: 'PROCESSING' })
      .eq('id', taskId);

    // 4. Execute AI call
    let output: any;
    let tokensInput = 0;
    let tokensOutput = 0;

    if (provider === 'anthropic') {
      const client = new Anthropic({ 
        apiKey: config.AI_ANTHROPIC_API_KEY 
      });
      
      const response = await client.messages.create({
        model,
        max_tokens: routing.maxTokens,
        system: params.systemPrompt || '',
        messages: [{ role: 'user', content: params.prompt }],
      });

      output = response.content[0].type === 'text' 
        ? response.content[0].text 
        : response.content;
      tokensInput = response.usage.input_tokens;
      tokensOutput = response.usage.output_tokens;
    }
    // TODO: Add Google and DeepSeek providers

    const latencyMs = Date.now() - startTime;
    const costoUsd = estimateCost(model, tokensInput, tokensOutput);

    // 5. Update ai_tasks with results
    await supabase
      .from('ai_tasks')
      .update({
        output: typeof output === 'string' ? { text: output } : output,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        costo_estimado_usd: costoUsd,
        latency_ms: latencyMs,
        status: 'COMPLETED',
      })
      .eq('id', taskId);

    return { output, taskId, model, tokensInput, tokensOutput, costoUsd, latencyMs };

  } catch (error: any) {
    // 6. Handle failure
    await supabase
      .from('ai_tasks')
      .update({
        status: 'FAILED',
        error_message: error.message,
        reintentos: 1,
      })
      .eq('id', taskId);

    // 7. Try fallback if configured
    const fallbackTier = routing.fallbackTier;
    if (fallbackTier && config.AI_FALLBACK_ENABLED !== 'false') {
      // Recursive call with fallback could go here
      // For now, re-throw
    }

    throw error;
  }
}
```

### 6.4 Cost Tracker (`lib/ai/cost-tracker.ts`)

```typescript
import { createClient } from '@/lib/supabase/server';

interface CostSummary {
  totalUsd: number;
  budgetUsd: number;
  usagePercent: number;
  byModule: Record<string, number>;
  byModel: Record<string, number>;
  taskCount: number;
  alertThresholdReached: boolean;
}

/**
 * Get AI cost summary for the current month.
 * Used in admin dashboard and budget alerts.
 */
export async function getMonthlyCostSummary(): Promise<CostSummary> {
  const supabase = await createClient();
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Get completed tasks this month
  const { data: tasks } = await supabase
    .from('ai_tasks')
    .select('modulo, modelo, costo_estimado_usd')
    .eq('status', 'COMPLETED')
    .gte('created_at', startOfMonth.toISOString());

  // Get budget config
  const { data: configRows } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', ['AI_MONTHLY_BUDGET_USD', 'AI_ALERT_THRESHOLD_PCT']);

  const config = Object.fromEntries(
    (configRows || []).map(r => [r.key, r.value])
  );

  const budgetUsd = parseFloat(config.AI_MONTHLY_BUDGET_USD || '25');
  const alertThreshold = parseInt(config.AI_ALERT_THRESHOLD_PCT || '80');

  const byModule: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  let totalUsd = 0;

  for (const task of tasks || []) {
    const cost = task.costo_estimado_usd || 0;
    totalUsd += cost;
    byModule[task.modulo] = (byModule[task.modulo] || 0) + cost;
    byModel[task.modelo] = (byModel[task.modelo] || 0) + cost;
  }

  const usagePercent = (totalUsd / budgetUsd) * 100;

  return {
    totalUsd,
    budgetUsd,
    usagePercent,
    byModule,
    byModel,
    taskCount: tasks?.length || 0,
    alertThresholdReached: usagePercent >= alertThreshold,
  };
}
```

---

## 7. ENVIRONMENT VARIABLES

### 7.1 En `.env.local` (desarrollo)

```bash
# ═══════════════════════════════════════════
# AI Configuration (development)
# ═══════════════════════════════════════════
# Primary: Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Google AI (for fallback/economy)
GOOGLE_AI_API_KEY=

# Optional: DeepSeek (for fallback/economy)
DEEPSEEK_API_KEY=
```

### 7.2 En Vercel (producción)

Agregar las mismas variables en **Settings → Environment Variables** de Vercel.

### 7.3 Dual Storage Strategy

Las API keys se almacenan en **dos lugares**:

| Lugar | Uso | Quién accede |
|-------|-----|-------------|
| **Environment Variables** | API routes del server | Next.js server-side |
| **`system_config`** | Configuración dinámica (cambiar modelo sin deploy) | `task-runner.ts` |

**Prioridad:** `system_config` > env vars. Esto permite cambiar el modelo desde un panel admin sin re-deploy.

---

## 8. PANEL DE ADMINISTRACIÓN AI (futuro)

### 8.1 Ruta: `/admin/ai`

Vista para ADMIN con:

- **Dashboard de costos:** Gasto mensual vs presupuesto (gráfico de barras)
- **Desglose por módulo:** Tabla con costo por módulo
- **Desglose por modelo:** Cuánto se gasta en Haiku vs Sonnet
- **Últimas tareas:** Lista de `ai_tasks` recientes con status, costo, latencia
- **Configuración:** Editar provider default, modelo por tier, budget, desde UI

### 8.2 Alertas de Costo

Cuando `usagePercent >= AI_ALERT_THRESHOLD_PCT`:
- Notificación en el dashboard del ADMIN
- Opcionalmente: email al ADMIN/GERENTE_GENERAL

Cuando `usagePercent >= 100`:
- AI se deshabilita automáticamente (`AI_ENABLED = false`)
- Todas las funciones AI muestran: *"Presupuesto AI del mes agotado. Contactar administrador."*

---

## 9. SEGURIDAD

| Aspecto | Implementación |
|---------|---------------|
| API Keys | Nunca en frontend. Solo server-side (API routes / server actions) |
| `system_config` secrets | `is_secret = true`, no expuesto en queries frontend |
| RLS | `ai_tasks` solo visible para BACKOFFICE + ADMIN |
| Prompt injection | Inputs sanitizados antes de enviar al modelo |
| PII en prompts | Minimizar datos personales. No enviar DNI, CCI, remuneraciones al modelo si no es estrictamente necesario |
| Logs | `ai_tasks.input_summary` es un resumen truncado, no el prompt completo |
| Rate limiting | Máximo 10 tareas AI por minuto por usuario |

---

## 10. MULTI-TENANT

| Aspecto | Implementación |
|---------|---------------|
| API Keys | Cada tenant puede usar su propia API key o la del SaaS |
| Budget | Presupuesto configurable por tenant |
| Model routing | Misma tabla de routing, override por tenant posible |
| Cost tracking | `ai_tasks` filtrado por tenant vía RLS |
| Feature flags | `AI_ENABLED` per-tenant en `system_config` |

Para el modelo SaaS:
- **Self-service:** Tenant usa su propia API key → costo directo
- **Managed service:** GridRetail provee AI como parte del paquete → incluido en suscripción

---

## 11. ROADMAP AI

| Fase | Funcionalidad | Modelo | Prioridad |
|------|---------------|--------|-----------|
| **v1.0** | Importación RRHH (mapeo, normalización, brechas) | Haiku | 🔴 Alta |
| **v1.1** | CV Parsing + Scoring candidatos | Haiku | 🔴 Alta |
| **v1.2** | Generación de contratos | Sonnet | 🟡 Media |
| **v1.3** | Resumen ejecutivo de renovaciones | Sonnet | 🟡 Media |
| **v2.0** | Chatbot autoservicio para asesores | Haiku | 🟡 Media |
| **v2.1** | Detección de anomalías en ventas | Sonnet | 🟡 Media |
| **v2.2** | Predicción de riesgo de fuga | Sonnet | 🟢 Baja |
| **v3.0** | Panel admin AI con dashboard de costos | — | 🟢 Baja |

---

## 12. CHANGELOG

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-16 | 1.0 | Spec inicial: catálogo de modelos, model routing por tarea, estimaciones de costo, service layer, cost tracker, seguridad, multi-tenant |
