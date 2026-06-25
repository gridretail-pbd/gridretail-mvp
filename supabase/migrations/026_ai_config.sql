-- ═══════════════════════════════════════════════════════════════════════
-- 026: AI Configuration
-- Actualiza constraint de ai_tasks.tipo + inserta config de AI en system_config
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Actualizar constraint de ai_tasks.tipo ──────────────────────

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
  -- Importación RRHH (nuevos)
  'IMPORTACION_MAPEO', 'IMPORTACION_NORMALIZACION', 'IMPORTACION_BRECHAS',
  -- Legacy (backward compat)
  'MAPEO_COLUMNAS_IMPORT'
));

-- ─── 2. AI Provider Keys ────────────────────────────────────────────

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES
  ('AI_ANTHROPIC_API_KEY', '', 'Anthropic API Key', true, 'ai'),
  ('AI_GOOGLE_API_KEY', '', 'Google AI API Key (opcional)', true, 'ai'),
  ('AI_DEEPSEEK_API_KEY', '', 'DeepSeek API Key (opcional)', true, 'ai')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. Model Routing Configuration ─────────────────────────────────

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES
  ('AI_MODEL_ECONOMY', 'claude-haiku-4-5-20251001', 'Modelo para tareas simples (economy tier)', false, 'ai'),
  ('AI_MODEL_STANDARD', 'claude-sonnet-4-5-20250929', 'Modelo para tareas complejas (standard tier)', false, 'ai'),
  ('AI_MODEL_PREMIUM', 'claude-opus-4-5-20250918', 'Modelo para tareas críticas (premium tier, no usado)', false, 'ai'),
  ('AI_PROVIDER_DEFAULT', 'anthropic', 'Provider por defecto: anthropic, google, deepseek', false, 'ai')
ON CONFLICT (key) DO NOTHING;

-- ─── 4. Cost Controls ───────────────────────────────────────────────

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES
  ('AI_MONTHLY_BUDGET_USD', '25.00', 'Presupuesto máximo mensual en USD', false, 'ai'),
  ('AI_ALERT_THRESHOLD_PCT', '80', 'Alertar cuando se consuma X% del presupuesto', false, 'ai'),
  ('AI_ENABLED', 'true', 'Feature flag global para AI', false, 'ai'),
  ('AI_FALLBACK_ENABLED', 'true', 'Permitir fallback a modelo alternativo si falla', false, 'ai')
ON CONFLICT (key) DO NOTHING;
