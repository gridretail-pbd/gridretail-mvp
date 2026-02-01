-- ============================================================================
-- MIGRACIÓN 006: Módulo de Cuotas (CORREGIDA)
-- GridRetail - Sistema de Gestión de Cuotas Comerciales
-- Fecha: 2026-01-26
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABLAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS quota_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    total_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    errors JSONB,
    ai_interpretation_log JSONB,
    column_mapping JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    imported_by UUID REFERENCES usuarios(id),
    imported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (year, month, file_name)
);

CREATE TABLE IF NOT EXISTS store_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES tiendas(id),
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    ss_quota INTEGER NOT NULL CHECK (ss_quota >= 0),
    quota_breakdown JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(20) NOT NULL DEFAULT 'entel'
        CHECK (source IN ('entel', 'manual')),
    import_id UUID REFERENCES quota_imports(id),
    original_store_name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
    approved_by UUID REFERENCES usuarios(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (store_id, year, month)
);

CREATE TABLE IF NOT EXISTS hc_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id),
    store_quota_id UUID NOT NULL REFERENCES store_quotas(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES tiendas(id),
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    ss_quota INTEGER NOT NULL CHECK (ss_quota >= 0),
    quota_breakdown JSONB NOT NULL DEFAULT '{}',
    start_date DATE,
    proration_factor DECIMAL(5,4) DEFAULT 1.0000 CHECK (proration_factor > 0 AND proration_factor <= 1),
    prorated_ss_quota DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
    distributed_by UUID REFERENCES usuarios(id),
    distributed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES usuarios(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, year, month)
);

-- ============================================================================
-- PARTE 2: ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quota_imports_period ON quota_imports(year, month);
CREATE INDEX IF NOT EXISTS idx_quota_imports_status ON quota_imports(status);
CREATE INDEX IF NOT EXISTS idx_store_quotas_store ON store_quotas(store_id);
CREATE INDEX IF NOT EXISTS idx_store_quotas_period ON store_quotas(year, month);
CREATE INDEX IF NOT EXISTS idx_store_quotas_status ON store_quotas(status);
CREATE INDEX IF NOT EXISTS idx_store_quotas_import ON store_quotas(import_id);
CREATE INDEX IF NOT EXISTS idx_hc_quotas_user ON hc_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_hc_quotas_store ON hc_quotas(store_id);
CREATE INDEX IF NOT EXISTS idx_hc_quotas_period ON hc_quotas(year, month);
CREATE INDEX IF NOT EXISTS idx_hc_quotas_status ON hc_quotas(status);
CREATE INDEX IF NOT EXISTS idx_hc_quotas_store_quota ON hc_quotas(store_quota_id);

-- ============================================================================
-- PARTE 3: TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS set_updated_at_store_quotas ON store_quotas;
CREATE TRIGGER set_updated_at_store_quotas
    BEFORE UPDATE ON store_quotas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_hc_quotas ON hc_quotas;
CREATE TRIGGER set_updated_at_hc_quotas
    BEFORE UPDATE ON hc_quotas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- PARTE 4: VISTAS (sin codigo_entel)
-- ============================================================================

CREATE OR REPLACE VIEW vw_quotas_vigentes AS
SELECT 
    hq.id AS hc_quota_id,
    hq.user_id,
    u.codigo_asesor,
    u.nombre_completo,
    u.rol,
    u.zona,
    hq.store_id,
    t.codigo AS store_code,
    t.nombre AS store_name,
    hq.year,
    hq.month,
    hq.ss_quota AS hc_ss_quota,
    hq.prorated_ss_quota,
    hq.proration_factor,
    hq.start_date,
    hq.quota_breakdown AS hc_quota_breakdown,
    sq.ss_quota AS store_ss_quota,
    sq.quota_breakdown AS store_quota_breakdown,
    sq.status AS store_quota_status,
    hq.status AS hc_quota_status,
    ROUND(hq.ss_quota::numeric / NULLIF(sq.ss_quota, 0) * 100, 1) AS pct_of_store
FROM hc_quotas hq
JOIN usuarios u ON hq.user_id = u.id
JOIN tiendas t ON hq.store_id = t.id
JOIN store_quotas sq ON hq.store_quota_id = sq.id
ORDER BY t.nombre;

CREATE OR REPLACE VIEW vw_store_quotas_summary AS
SELECT 
    sq.id AS store_quota_id,
    sq.store_id,
    t.codigo AS store_code,
    t.nombre AS store_name,
    sq.year,
    sq.month,
    sq.ss_quota,
    sq.quota_breakdown,
    sq.status,
    sq.source,
    sq.approved_at,
    COUNT(hq.id)::INTEGER AS hc_count,
    COALESCE(SUM(hq.ss_quota), 0)::INTEGER AS total_distributed,
    (sq.ss_quota - COALESCE(SUM(hq.ss_quota), 0))::INTEGER AS remaining_quota,
    CASE 
        WHEN sq.ss_quota > 0 
        THEN ROUND(COALESCE(SUM(hq.ss_quota), 0)::numeric / sq.ss_quota * 100, 1)
        ELSE 0 
    END AS distribution_pct,
    COUNT(hq.id) FILTER (WHERE hq.proration_factor < 1)::INTEGER AS prorated_hc_count
FROM store_quotas sq
JOIN tiendas t ON sq.store_id = t.id
LEFT JOIN hc_quotas hq ON sq.id = hq.store_quota_id
GROUP BY sq.id, t.id
ORDER BY t.nombre;

-- ============================================================================
-- PARTE 5: FUNCIONES
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_quota_breakdown(
    p_store_breakdown JSONB,
    p_hc_quota INTEGER,
    p_store_quota INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_ratio DECIMAL(10,6);
    v_result JSONB := '{}';
    v_key TEXT;
    v_value NUMERIC;
BEGIN
    IF p_store_quota IS NULL OR p_store_quota = 0 THEN
        RETURN '{}';
    END IF;
    v_ratio := p_hc_quota::DECIMAL / p_store_quota;
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_store_breakdown)
    LOOP
        v_result := v_result || jsonb_build_object(v_key, ROUND(v_value::NUMERIC * v_ratio));
    END LOOP;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION distribute_store_quota(
    p_store_quota_id UUID,
    p_distributions JSONB
) RETURNS JSONB AS $$
DECLARE
    v_store_quota store_quotas%ROWTYPE;
    v_dist JSONB;
    v_total_distributed INTEGER := 0;
    v_user_id UUID;
    v_ss_quota INTEGER;
    v_start_date DATE;
    v_proration DECIMAL(5,4);
    v_days_in_month INTEGER;
    v_days_worked INTEGER;
    v_month_start DATE;
    v_inserted_count INTEGER := 0;
BEGIN
    SELECT * INTO v_store_quota FROM store_quotas WHERE id = p_store_quota_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Store quota not found');
    END IF;
    
    v_month_start := MAKE_DATE(v_store_quota.year, v_store_quota.month, 1);
    v_days_in_month := EXTRACT(DAY FROM 
        (DATE_TRUNC('month', v_month_start) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;
    
    DELETE FROM hc_quotas WHERE store_quota_id = p_store_quota_id AND status = 'draft';
    
    FOR v_dist IN SELECT * FROM jsonb_array_elements(p_distributions)
    LOOP
        v_user_id := (v_dist->>'user_id')::UUID;
        v_ss_quota := (v_dist->>'ss_quota')::INTEGER;
        v_start_date := (v_dist->>'start_date')::DATE;
        
        IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = v_user_id) THEN
            CONTINUE;
        END IF;
        
        IF v_start_date IS NOT NULL AND v_start_date > v_month_start THEN
            v_days_worked := v_days_in_month - EXTRACT(DAY FROM v_start_date)::INTEGER + 1;
            v_proration := ROUND(v_days_worked::DECIMAL / v_days_in_month, 4);
        ELSE
            v_start_date := NULL;
            v_proration := 1.0;
        END IF;
        
        INSERT INTO hc_quotas (
            user_id, store_quota_id, store_id, year, month,
            ss_quota, quota_breakdown, start_date, proration_factor, prorated_ss_quota,
            status, distributed_by, distributed_at
        ) VALUES (
            v_user_id, p_store_quota_id, v_store_quota.store_id,
            v_store_quota.year, v_store_quota.month, v_ss_quota, 
            calculate_quota_breakdown(v_store_quota.quota_breakdown, v_ss_quota, v_store_quota.ss_quota),
            v_start_date, v_proration, 
            CASE WHEN v_proration < 1.0 THEN ROUND(v_ss_quota * v_proration, 2) ELSE NULL END,
            'draft', auth.uid(), NOW()
        )
        ON CONFLICT (user_id, year, month) DO UPDATE SET
            store_quota_id = EXCLUDED.store_quota_id, store_id = EXCLUDED.store_id,
            ss_quota = EXCLUDED.ss_quota, quota_breakdown = EXCLUDED.quota_breakdown,
            start_date = EXCLUDED.start_date, proration_factor = EXCLUDED.proration_factor,
            prorated_ss_quota = EXCLUDED.prorated_ss_quota, status = 'draft',
            distributed_by = auth.uid(), distributed_at = NOW(), updated_at = NOW();
        
        v_total_distributed := v_total_distributed + v_ss_quota;
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true, 'inserted_count', v_inserted_count,
        'total_distributed', v_total_distributed, 'store_quota', v_store_quota.ss_quota,
        'difference', v_store_quota.ss_quota - v_total_distributed
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_store_quotas(
    p_store_quota_ids UUID[],
    p_approval_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_quota_id UUID;
    v_approved_count INTEGER := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('ADMIN', 'GERENTE_COMERCIAL')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    FOREACH v_quota_id IN ARRAY p_store_quota_ids
    LOOP
        UPDATE store_quotas SET status = 'approved', approved_by = auth.uid(), 
            approved_at = NOW(), approval_notes = p_approval_notes, updated_at = NOW()
        WHERE id = v_quota_id AND status IN ('draft', 'pending_approval');
        
        IF FOUND THEN
            UPDATE hc_quotas SET status = 'approved', approved_by = auth.uid(), 
                approved_at = NOW(), updated_at = NOW()
            WHERE store_quota_id = v_quota_id AND status IN ('draft', 'pending_approval');
            v_approved_count := v_approved_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('success', true, 'approved_count', v_approved_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_hc_effective_quota(
    p_user_id UUID, p_year INTEGER, p_month INTEGER
) RETURNS TABLE (
    ss_quota INTEGER, effective_quota DECIMAL(10,2), proration_factor DECIMAL(5,4),
    quota_breakdown JSONB, store_ss_quota INTEGER, store_quota_breakdown JSONB, status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT hq.ss_quota, COALESCE(hq.prorated_ss_quota, hq.ss_quota::DECIMAL),
        hq.proration_factor, hq.quota_breakdown, sq.ss_quota, sq.quota_breakdown, hq.status
    FROM hc_quotas hq JOIN store_quotas sq ON hq.store_quota_id = sq.id
    WHERE hq.user_id = p_user_id AND hq.year = p_year AND hq.month = p_month;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 6: RLS POLICIES
-- ============================================================================

ALTER TABLE quota_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quota_imports_select" ON quota_imports FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'JEFE_VENTAS', 'BACKOFFICE_OPERACIONES')));
CREATE POLICY "quota_imports_insert" ON quota_imports FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES')));
CREATE POLICY "quota_imports_update" ON quota_imports FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES')));

ALTER TABLE store_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_quotas_select" ON store_quotas FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (
        u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES')
        OR (u.rol IN ('JEFE_VENTAS', 'SUPERVISOR') AND store_id IN (
            SELECT tienda_id FROM usuarios_tiendas WHERE usuario_id = u.id)))));
CREATE POLICY "store_quotas_insert" ON store_quotas FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES')));
CREATE POLICY "store_quotas_update" ON store_quotas FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES', 'JEFE_VENTAS')));

ALTER TABLE hc_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hc_quotas_select_own" ON hc_quotas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hc_quotas_select_management" ON hc_quotas FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (
        u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES')
        OR (u.rol IN ('JEFE_VENTAS', 'SUPERVISOR') AND store_id IN (
            SELECT tienda_id FROM usuarios_tiendas WHERE usuario_id = u.id)))));
CREATE POLICY "hc_quotas_insert" ON hc_quotas FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES', 'JEFE_VENTAS')));
CREATE POLICY "hc_quotas_update" ON hc_quotas FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (
        u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES')
        OR (u.rol = 'JEFE_VENTAS' AND store_id IN (
            SELECT tienda_id FROM usuarios_tiendas WHERE usuario_id = u.id)))));

-- ============================================================================
-- PARTE 7: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON quota_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON store_quotas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON hc_quotas TO authenticated;
GRANT SELECT ON vw_quotas_vigentes TO authenticated;
GRANT SELECT ON vw_store_quotas_summary TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_quota_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_store_quota TO authenticated;
GRANT EXECUTE ON FUNCTION approve_store_quotas TO authenticated;
GRANT EXECUTE ON FUNCTION get_hc_effective_quota TO authenticated;

-- FIN
