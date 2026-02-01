-- ============================================================================
-- MIGRACIÓN 008: Agregar cuota Entel de referencia a store_quotas
-- GridRetail - Módulo de Gestión de Cuotas
-- Fecha: 2026-01-27
-- ============================================================================
-- 
-- PROPÓSITO:
-- Permitir que el SSNN ajuste las cuotas por tienda manteniendo la referencia
-- original de Entel. Esto permite:
-- - Comparar cuota operativa vs cuota oficial de Entel
-- - Ajustar cuotas según capacidad real de cada tienda
-- - Mantener trazabilidad de cambios
--
-- CAMBIOS:
-- - Agrega columna ss_quota_entel (cuota original de Entel, inmutable)
-- - ss_quota pasa a ser la cuota operativa del SSNN (editable)
-- ============================================================================

-- ============================================================================
-- PARTE 1: MODIFICAR TABLA store_quotas
-- ============================================================================

-- 1.1 Agregar columna para cuota original de Entel
ALTER TABLE store_quotas 
ADD COLUMN IF NOT EXISTS ss_quota_entel INTEGER;

-- 1.2 Copiar valores actuales como "originales de Entel"
-- (Solo si hay datos existentes)
UPDATE store_quotas 
SET ss_quota_entel = ss_quota 
WHERE ss_quota_entel IS NULL;

-- 1.3 Hacer NOT NULL después de poblar
ALTER TABLE store_quotas 
ALTER COLUMN ss_quota_entel SET NOT NULL;

-- 1.4 Agregar DEFAULT para futuros inserts
ALTER TABLE store_quotas 
ALTER COLUMN ss_quota_entel SET DEFAULT 0;

-- 1.5 Comentarios descriptivos
COMMENT ON COLUMN store_quotas.ss_quota_entel IS 
'Cuota SS original importada de Entel (inmutable después de importación)';

COMMENT ON COLUMN store_quotas.ss_quota IS 
'Cuota SS operativa del SSNN (editable, puede diferir de Entel)';

-- ============================================================================
-- PARTE 2: ACTUALIZAR VISTA vw_store_quotas_summary
-- ============================================================================

-- Recrear vista con las nuevas columnas
DROP VIEW IF EXISTS vw_store_quotas_summary;

CREATE OR REPLACE VIEW vw_store_quotas_summary AS
SELECT 
    sq.id,
    sq.year,
    sq.month,
    sq.store_id,
    t.codigo AS store_code,
    t.nombre AS store_name,
    sq.ss_quota_entel,
    sq.ss_quota AS ss_quota_ssnn,
    sq.ss_quota - sq.ss_quota_entel AS ss_quota_diferencia,
    sq.quota_breakdown,
    sq.status,
    sq.created_at,
    sq.approved_at,
    -- Conteo de HCs asignados a la tienda
    (SELECT COUNT(DISTINCT hq.user_id) 
     FROM hc_quotas hq 
     WHERE hq.store_quota_id = sq.id) AS hc_count,
    -- Suma de cuotas distribuidas a HCs
    (SELECT COALESCE(SUM(hq.ss_quota), 0) 
     FROM hc_quotas hq 
     WHERE hq.store_quota_id = sq.id) AS ss_quota_distributed,
    -- Cuota pendiente de distribuir
    sq.ss_quota - COALESCE(
        (SELECT SUM(hq.ss_quota) 
         FROM hc_quotas hq 
         WHERE hq.store_quota_id = sq.id), 0
    ) AS ss_quota_pending
FROM store_quotas sq
JOIN tiendas t ON sq.store_id = t.id
ORDER BY t.codigo;

-- ============================================================================
-- PARTE 3: ACTUALIZAR VISTA vw_quotas_vigentes
-- ============================================================================

DROP VIEW IF EXISTS vw_quotas_vigentes;

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
    -- Cuotas de tienda (Entel y SSNN)
    sq.ss_quota_entel AS store_ss_quota_entel,
    sq.ss_quota AS store_ss_quota_ssnn,
    sq.ss_quota - sq.ss_quota_entel AS store_quota_diferencia,
    sq.quota_breakdown AS store_quota_breakdown,
    sq.status AS store_quota_status,
    hq.status AS hc_quota_status,
    -- Porcentaje del HC respecto a cuota SSNN de tienda
    ROUND(hq.ss_quota::numeric / NULLIF(sq.ss_quota, 0) * 100, 1) AS pct_of_store
FROM hc_quotas hq
JOIN usuarios u ON hq.user_id = u.id
JOIN tiendas t ON hq.store_id = t.id
JOIN store_quotas sq ON hq.store_quota_id = sq.id;

-- ============================================================================
-- PARTE 4: FUNCIÓN PARA ACTUALIZAR CUOTA SSNN
-- ============================================================================

CREATE OR REPLACE FUNCTION update_store_quota_ssnn(
    p_store_quota_id UUID,
    p_new_ss_quota INTEGER,
    p_user_id UUID DEFAULT NULL
) RETURNS store_quotas AS $$
DECLARE
    v_result store_quotas;
    v_old_quota INTEGER;
    v_distributed INTEGER;
BEGIN
    -- Obtener cuota actual y distribuida
    SELECT sq.ss_quota, COALESCE(SUM(hq.ss_quota), 0)
    INTO v_old_quota, v_distributed
    FROM store_quotas sq
    LEFT JOIN hc_quotas hq ON hq.store_quota_id = sq.id
    WHERE sq.id = p_store_quota_id
    GROUP BY sq.ss_quota;
    
    -- Validar que nueva cuota no sea menor que lo ya distribuido
    IF p_new_ss_quota < v_distributed THEN
        RAISE EXCEPTION 'Nueva cuota (%) no puede ser menor que cuota ya distribuida (%)', 
            p_new_ss_quota, v_distributed;
    END IF;
    
    -- Validar que nueva cuota sea positiva
    IF p_new_ss_quota < 0 THEN
        RAISE EXCEPTION 'La cuota no puede ser negativa';
    END IF;
    
    -- Actualizar
    UPDATE store_quotas
    SET 
        ss_quota = p_new_ss_quota,
        updated_at = NOW()
    WHERE id = p_store_quota_id
    RETURNING * INTO v_result;
    
    -- Log de auditoría (opcional)
    IF p_user_id IS NOT NULL THEN
        INSERT INTO logs_auditoria (tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario_id)
        VALUES (
            'store_quotas',
            p_store_quota_id,
            'UPDATE',
            jsonb_build_object('ss_quota', v_old_quota),
            jsonb_build_object('ss_quota', p_new_ss_quota),
            p_user_id
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_store_quota_ssnn IS 
'Actualiza la cuota SSNN de una tienda. Valida que no sea menor que lo distribuido.';

-- ============================================================================
-- PARTE 5: FUNCIÓN PARA OBTENER RESUMEN DE CUOTAS DEL PERÍODO
-- ============================================================================

CREATE OR REPLACE FUNCTION get_quota_period_summary(
    p_year INTEGER,
    p_month INTEGER
) RETURNS TABLE (
    total_stores INTEGER,
    stores_with_quota INTEGER,
    stores_distributed INTEGER,
    total_ss_quota_entel INTEGER,
    total_ss_quota_ssnn INTEGER,
    total_diferencia INTEGER,
    total_hc_assigned INTEGER,
    total_ss_distributed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM tiendas WHERE activa = true) AS total_stores,
        COUNT(DISTINCT sq.store_id)::INTEGER AS stores_with_quota,
        COUNT(DISTINCT sq.store_id) FILTER (
            WHERE EXISTS (
                SELECT 1 FROM hc_quotas hq 
                WHERE hq.store_quota_id = sq.id
            )
        )::INTEGER AS stores_distributed,
        COALESCE(SUM(sq.ss_quota_entel), 0)::INTEGER AS total_ss_quota_entel,
        COALESCE(SUM(sq.ss_quota), 0)::INTEGER AS total_ss_quota_ssnn,
        COALESCE(SUM(sq.ss_quota - sq.ss_quota_entel), 0)::INTEGER AS total_diferencia,
        (SELECT COUNT(DISTINCT hq.user_id)::INTEGER 
         FROM hc_quotas hq 
         JOIN store_quotas sq2 ON hq.store_quota_id = sq2.id 
         WHERE sq2.year = p_year AND sq2.month = p_month) AS total_hc_assigned,
        (SELECT COALESCE(SUM(hq.ss_quota), 0)::INTEGER 
         FROM hc_quotas hq 
         JOIN store_quotas sq2 ON hq.store_quota_id = sq2.id 
         WHERE sq2.year = p_year AND sq2.month = p_month) AS total_ss_distributed
    FROM store_quotas sq
    WHERE sq.year = p_year AND sq.month = p_month;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_quota_period_summary IS 
'Obtiene resumen de cuotas del período incluyendo totales Entel vs SSNN.';

-- ============================================================================
-- PARTE 6: VERIFICACIÓN
-- ============================================================================

-- Ver estructura actualizada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'store_quotas'
ORDER BY ordinal_position;

-- Ver datos con diferencias
SELECT 
    t.codigo,
    sq.ss_quota_entel AS cuota_entel,
    sq.ss_quota AS cuota_ssnn,
    sq.ss_quota - sq.ss_quota_entel AS diferencia,
    sq.status
FROM store_quotas sq
JOIN tiendas t ON sq.store_id = t.id
WHERE sq.year = 2026 AND sq.month = 1
ORDER BY t.codigo;

-- Ver resumen del período
SELECT * FROM get_quota_period_summary(2026, 1);
