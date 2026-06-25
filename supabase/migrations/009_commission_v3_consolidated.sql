-- ============================================================================
-- MIGRACIÓN CONSOLIDADA: Comisiones v3.0 + v3.0.1 + v3.2 + v3.3
-- Módulo: Comisiones - Arquitectura Multi-Esquema
-- Fecha: 2026-02-02
-- Prerequisitos: Migraciones 001-005 ya ejecutadas
-- ============================================================================
-- Esta migración consolida todos los cambios pendientes:
--   v3.0   - Correcciones de partidas (sin cambios de BD)
--   v3.0.1 - Sobrecumplimiento (5 campos en commission_scheme_items)
--   v3.2   - Multi-esquema (3 campos en schemes, 4 en items, tabla multipliers)
--   v3.3   - Medición compleja (1 campo en schemes, 3 en items, 2 en multipliers)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE A: Nuevos campos en commission_schemes (Nivel 1)
-- ────────────────────────────────────────────────────────────────────────────

-- v3.2: Tabla de conversión no-lineal (estilo TPF)
ALTER TABLE commission_schemes
  ADD COLUMN IF NOT EXISTS conversion_table JSONB DEFAULT NULL;

-- v3.2: Método de rango global (NULL = cuota individual, VOLUMEN_TOTAL = suma absoluta)
ALTER TABLE commission_schemes
  ADD COLUMN IF NOT EXISTS global_range_method VARCHAR(30) DEFAULT NULL;

-- v3.3: Base para aceleradores (teórico = fijo, calculado = depende del rendimiento)
ALTER TABLE commission_schemes
  ADD COLUMN IF NOT EXISTS accelerator_base VARCHAR(25) DEFAULT 'VARIABLE_TEORICO';

-- Constraints
DO $$ BEGIN
  ALTER TABLE commission_schemes
    ADD CONSTRAINT commission_schemes_global_range_method_check
    CHECK (global_range_method IS NULL OR global_range_method IN ('VOLUMEN_TOTAL'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE commission_schemes
    ADD CONSTRAINT commission_schemes_accelerator_base_check
    CHECK (accelerator_base IN ('VARIABLE_TEORICO', 'VARIABLE_CALCULADO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN commission_schemes.conversion_table IS
  'Tabla de conversión no-lineal: mapea % cumplimiento real → % efectivo. Estructura: {ranges: [{min, max, effective, label}]}';
COMMENT ON COLUMN commission_schemes.global_range_method IS
  'Método de rango global: NULL (cuota individual por partida), VOLUMEN_TOTAL (suma absoluta de ventas)';
COMMENT ON COLUMN commission_schemes.accelerator_base IS
  'Base para aceleradores: VARIABLE_TEORICO (% del variable fijo), VARIABLE_CALCULADO (% del variable ya calculado)';

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE B: Nuevos campos en commission_scheme_items (Nivel 2)
-- ────────────────────────────────────────────────────────────────────────────

-- v3.2: Tipo de contribución
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(25) DEFAULT 'PONDERADA';

-- v3.2: Fuente de rango
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS range_source VARCHAR(25) DEFAULT 'CUOTA_PROPIA';

-- v3.2: Si usa tabla de conversión del esquema
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS uses_conversion_table BOOLEAN DEFAULT false;

-- v3.2: Rangos de acelerador (para tipo ACELERADOR)
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS accelerator_ranges JSONB DEFAULT NULL;

-- v3.3: Tipo de medición
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS measurement_type VARCHAR(20) DEFAULT 'UNIT_COUNT';

-- v3.3: Método de cumplimiento
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS fulfillment_method VARCHAR(20) DEFAULT 'RATIO';

-- v3.3: Configuración de medición
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS measurement_config JSONB DEFAULT NULL;

-- v3.0.1: Modo de sobrecumplimiento
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS overcompliance_mode VARCHAR(20) DEFAULT 'none';

-- v3.0.1: Tope en unidades
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS cap_units DECIMAL(10,2);

-- v3.0.1: Monto bono por unidad adicional
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS pxq_bonus_amount DECIMAL(10,2);

-- v3.0.1: Máximo unidades adicionales (con tope)
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS overcap_max_units DECIMAL(10,2);

-- v3.0.1: Máximo monto adicional (con tope)
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS overcap_max_amount DECIMAL(12,2);

-- Constraints
DO $$ BEGIN
  ALTER TABLE commission_scheme_items
    ADD CONSTRAINT commission_scheme_items_contribution_type_check
    CHECK (contribution_type IN ('PONDERADA', 'ACELERADOR', 'PXQ_INDEPENDIENTE', 'BONO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE commission_scheme_items
    ADD CONSTRAINT commission_scheme_items_range_source_check
    CHECK (range_source IN ('CUOTA_PROPIA', 'VOLUMEN_GLOBAL', 'CUOTA_GLOBAL_SS'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE commission_scheme_items
    ADD CONSTRAINT commission_scheme_items_measurement_type_check
    CHECK (measurement_type IN ('UNIT_COUNT', 'AVERAGE_VALUE', 'TOTAL_VALUE', 'RATE', 'MANUAL'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE commission_scheme_items
    ADD CONSTRAINT commission_scheme_items_fulfillment_method_check
    CHECK (fulfillment_method IN ('RATIO', 'ABSOLUTE_RANGES'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE commission_scheme_items
    ADD CONSTRAINT commission_scheme_items_overcompliance_mode_check
    CHECK (overcompliance_mode IN ('none', 'proportional', 'pxq_bonus'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN commission_scheme_items.contribution_type IS
  'Cómo aporta al total: PONDERADA (peso% del variable), ACELERADOR (±% del variable), PXQ_INDEPENDIENTE (monto aparte), BONO (todo o nada)';
COMMENT ON COLUMN commission_scheme_items.range_source IS
  'Fuente de input: CUOTA_PROPIA (Real/Meta propia), VOLUMEN_GLOBAL (total absoluto), CUOTA_GLOBAL_SS (% cuota SS total)';
COMMENT ON COLUMN commission_scheme_items.accelerator_ranges IS
  'Rangos ±% para tipo ACELERADOR. Estructura: {source_item_name, ranges: [{min, max, pct_effect, label}]}';
COMMENT ON COLUMN commission_scheme_items.measurement_type IS
  'Cómo se mide el logro: UNIT_COUNT, AVERAGE_VALUE, TOTAL_VALUE, RATE, MANUAL';
COMMENT ON COLUMN commission_scheme_items.fulfillment_method IS
  'Cómo se convierte logro a cumplimiento: RATIO (logro/meta), ABSOLUTE_RANGES (valor directo en rango)';
COMMENT ON COLUMN commission_scheme_items.measurement_config IS
  'Config JSON según measurement_type. AVERAGE/TOTAL: {value_field}. RATE: {condition_field, condition_value, scope_tipos_venta}';
COMMENT ON COLUMN commission_scheme_items.overcompliance_mode IS
  'Modo de sobrecumplimiento: none (tope 100%), proportional, pxq_bonus';

-- Migrar datos existentes: si has_cap=true y tiene cap_percentage → proporcional
UPDATE commission_scheme_items
SET overcompliance_mode = 'proportional'
WHERE has_cap = true
  AND (cap_percentage IS NOT NULL OR cap_amount IS NOT NULL)
  AND overcompliance_mode = 'none';

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE C: Nueva tabla commission_item_multipliers (Nivel 3)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_item_multipliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES commission_scheme_items(id) ON DELETE CASCADE,

    -- Clasificación
    multiplier_type VARCHAR(20) NOT NULL,
    activation_criteria VARCHAR(25) NOT NULL,

    -- Descripción y origen
    source_description VARCHAR(200) NOT NULL,
    source_item_id UUID REFERENCES commission_scheme_items(id) ON DELETE SET NULL,

    -- Umbrales y factores
    threshold_value DECIMAL(10,2),
    factor_if_met DECIMAL(6,4) DEFAULT 1.0,
    factor_if_not_met DECIMAL(6,4) DEFAULT 0.0,

    -- Para tipo TIERED
    tiered_ranges JSONB,

    -- Para OPERATOR_ORIGIN
    operator_cedente VARCHAR(30),

    -- v3.3: Medición compleja del multiplicador
    measurement_type VARCHAR(20) DEFAULT 'UNIT_COUNT',
    measurement_config JSONB,

    -- Control
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT multiplier_type_check CHECK (multiplier_type IN (
      'LOCK', 'ACCELERATOR', 'DECELERATOR', 'PROPORTIONAL', 'CROSS_PRODUCT', 'TIERED'
    )),
    CONSTRAINT activation_criteria_check CHECK (activation_criteria IN (
      'MIN_QUANTITY', 'OWN_ATTAINMENT', 'OTHER_ATTAINMENT',
      'GLOBAL_ATTAINMENT', 'ATTAINMENT_RANGE', 'OPERATOR_ORIGIN'
    )),
    CONSTRAINT multiplier_measurement_type_check CHECK (measurement_type IN (
      'UNIT_COUNT', 'RATE', 'AVERAGE_VALUE', 'MANUAL'
    ))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_multipliers_item ON commission_item_multipliers(item_id);
CREATE INDEX IF NOT EXISTS idx_multipliers_source ON commission_item_multipliers(source_item_id);
CREATE INDEX IF NOT EXISTS idx_multipliers_type ON commission_item_multipliers(multiplier_type);

-- Trigger updated_at (reutilizar función existente)
DROP TRIGGER IF EXISTS set_updated_at ON commission_item_multipliers;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON commission_item_multipliers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- RLS (deshabilitado para MVP, consistente con 008_disable_rls_for_mvp.sql)
ALTER TABLE commission_item_multipliers ENABLE ROW LEVEL SECURITY;

-- Política permisiva para MVP (consistente con otras tablas)
DO $$ BEGIN
  CREATE POLICY "multipliers_allow_all" ON commission_item_multipliers
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE D: Migrar candados existentes a multiplicadores
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO commission_item_multipliers (
    item_id, multiplier_type, activation_criteria,
    source_description, threshold_value,
    factor_if_met, factor_if_not_met, is_active, notes
)
SELECT
    il.scheme_item_id,
    'LOCK',
    CASE
      WHEN il.lock_type = 'min_quantity' THEN 'MIN_QUANTITY'
      WHEN il.lock_type = 'min_fulfillment' THEN 'OWN_ATTAINMENT'
      WHEN il.lock_type = 'min_percentage' THEN 'OWN_ATTAINMENT'
      ELSE 'MIN_QUANTITY'
    END,
    COALESCE(il.description, 'Migrado de candado: ' || il.lock_type),
    il.required_value,
    1.0,
    0.0,
    il.is_active,
    'migrated_from_locks'
FROM commission_item_locks il
WHERE NOT EXISTS (
    SELECT 1 FROM commission_item_multipliers m
    WHERE m.item_id = il.scheme_item_id
    AND m.notes = 'migrated_from_locks'
);

-- Nota: NO eliminamos commission_item_locks. Se mantienen ambas tablas
-- durante la transición. Eliminar en versión futura.

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE E: Configuraciones default en system_config
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES
  ('DEFAULT_FIXED_SALARY', '1130', 'Sueldo fijo default para nuevos esquemas (Entel)', false, 'comisiones'),
  ('DEFAULT_VARIABLE_SALARY', '1200', 'Sueldo variable default para nuevos esquemas (Entel)', false, 'comisiones'),
  ('DEFAULT_MIN_FULFILLMENT', '50', 'Cumplimiento mínimo global default (%)', false, 'comisiones')
ON CONFLICT (key) DO NOTHING;

COMMIT;
