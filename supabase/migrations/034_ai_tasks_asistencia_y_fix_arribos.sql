-- ============================================================================
-- MIGRACIÓN 034: Tipos AI de asistencia + corrección de funciones de arribos
-- Módulos: RRHH (asistencia WhatsApp) · Operaciones (reporte de arribos)
-- Fecha:  2026-08-20
-- ============================================================================
--
-- Contenido:
--   1. ai_tasks.tipo  → + ASISTENCIA_EXTRACCION, ASISTENCIA_CLASIFICACION
--                       (desbloquea la Fase 1 del agente de asistencia)
--   2. get_arribos_resumen_red     → corrige error 42804 (varchar vs TEXT)
--   3. get_arribos_detalle_tienda  → corrige error 42803 (columna no agrupada)
--
-- Los dos bugs de arribos están documentados en DATA_DICTIONARY §2.3 desde
-- v3.1 y hacen fallar en runtime el header del reporte y el sidebar por tienda.
--
-- Orden: se aplica después de la 033 y de la 031. Numeración correlativa real.
--
-- ⚠️ PREFLIGHT (ejecutar ANTES, debe devolver 0 filas):
--     SELECT DISTINCT tipo FROM ai_tasks
--     WHERE tipo NOT IN (
--       'CV_PARSING','ENTREVISTA_TRANSCRIPCION','ENTREVISTA_ANALISIS',
--       'SCORING_CANDIDATO','INDUCCION_PLAN','CONTRATO_GENERACION',
--       'RENOVACION_RESUMEN','RIESGO_FUGA','OFFBOARDING_CHECKLIST',
--       'DOCUMENTO_OCR','EMAIL_DRAFT','ANOMALIA_DETECCION','CHATBOT_QUERY',
--       'IMPORTACION_MAPEO','IMPORTACION_NORMALIZACION','IMPORTACION_BRECHAS',
--       'MAPEO_COLUMNAS_IMPORT'
--     );
--   Si devuelve algo, agrégalo a la lista del paso 1 antes de ejecutar; de lo
--   contrario el ADD CONSTRAINT aborta la transacción completa.
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ai_tasks.tipo — tipos del agente de asistencia
-- Lista base tomada de 026_ai_config.sql (17 tipos) + 2 nuevos.
-- ============================================================================

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
  'IMPORTACION_MAPEO', 'IMPORTACION_NORMALIZACION', 'IMPORTACION_BRECHAS',
  -- Legacy (backward compat)
  'MAPEO_COLUMNAS_IMPORT',
  -- Asistencia WhatsApp (034) — SPEC_ASISTENCIA_WHATSAPP §4.2 / §4.3
  'ASISTENCIA_EXTRACCION',      -- Claude Vision: watermark + validación de la selfie
  'ASISTENCIA_CLASIFICACION'    -- Fallback AI para clasificar el caption → tipo
));

COMMENT ON COLUMN ai_tasks.tipo IS
  'Tipo de tarea AI. 19 valores (ver CHECK). ASISTENCIA_EXTRACCION y ASISTENCIA_CLASIFICACION agregados en la migración 034.';


-- ============================================================================
-- 2. get_arribos_resumen_red — FIX error 42804
-- Causa: `tienda_lider_codigo` se declara TEXT pero se devuelve `tiendas.codigo`
--        (VARCHAR(30)). Postgres no hace el cast implícito en RETURNS TABLE.
-- Fix:   cast explícito `t.codigo::TEXT`.
-- Extra: se renombran los CTEs que colisionaban con nombres de parámetros OUT
--        (`hora_pico`, `tienda_lider`, `conversion`) para evitar ambigüedades
--        de plpgsql una vez resuelto el error de tipo.
-- Firma sin cambios → la API/TS no requiere modificaciones.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_arribos_resumen_red(
  p_fecha DATE,
  p_zona TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_arribos INTEGER,
  total_comparacion INTEGER,
  delta_pct NUMERIC,
  conversion_promedio INTEGER,
  hora_pico INTEGER,
  hora_pico_cantidad INTEGER,
  tienda_lider_id UUID,
  tienda_lider_codigo TEXT,
  tienda_lider_total INTEGER,
  tiendas_activas INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH cte_hoy AS (
    SELECT
      a.tienda_id,
      EXTRACT(HOUR FROM a.hora)::INTEGER AS hora_slot,
      COUNT(*)::INTEGER AS cantidad
    FROM arribos a
    JOIN tiendas t ON a.tienda_id = t.id
    WHERE a.fecha = p_fecha
      AND EXTRACT(HOUR FROM a.hora) BETWEEN 8 AND 21
      AND (p_zona IS NULL OR t.zona = p_zona)
    GROUP BY a.tienda_id, EXTRACT(HOUR FROM a.hora)
  ),
  cte_n7 AS (
    SELECT COUNT(*)::INTEGER AS total
    FROM arribos a
    JOIN tiendas t ON a.tienda_id = t.id
    WHERE a.fecha = p_fecha - INTERVAL '7 days'
      AND (p_zona IS NULL OR t.zona = p_zona)
  ),
  cte_conversion AS (
    SELECT
      COUNT(*) FILTER (WHERE a.tipo_visita = 'VENTA')::INTEGER AS visitas_venta,
      COUNT(*) FILTER (WHERE a.tipo_visita = 'VENTA' AND a.resultado = 'VENDIDO_CONFIRMADO')::INTEGER AS ventas
    FROM arribos a
    JOIN tiendas t ON a.tienda_id = t.id
    WHERE a.fecha = p_fecha
      AND (p_zona IS NULL OR t.zona = p_zona)
  ),
  cte_hora_pico AS (
    SELECT
      h.hora_slot,
      SUM(h.cantidad)::INTEGER AS total_hora
    FROM cte_hoy h
    GROUP BY h.hora_slot
    ORDER BY total_hora DESC
    LIMIT 1
  ),
  cte_tienda_lider AS (
    SELECT
      h.tienda_id,
      SUM(h.cantidad)::INTEGER AS total
    FROM cte_hoy h
    GROUP BY h.tienda_id
    ORDER BY total DESC
    LIMIT 1
  )
  SELECT
    COALESCE((SELECT SUM(h.cantidad)::INTEGER FROM cte_hoy h), 0) AS total_arribos,
    COALESCE((SELECT n.total FROM cte_n7 n), 0) AS total_comparacion,
    CASE
      WHEN COALESCE((SELECT n.total FROM cte_n7 n), 0) = 0 THEN NULL
      ELSE ROUND(
        (((SELECT SUM(h.cantidad) FROM cte_hoy h) - (SELECT n.total FROM cte_n7 n))::NUMERIC
         / (SELECT n.total FROM cte_n7 n)) * 100, 1)
    END AS delta_pct,
    CASE
      WHEN COALESCE((SELECT c.visitas_venta FROM cte_conversion c), 0) = 0 THEN 0
      ELSE ROUND(((SELECT c.ventas FROM cte_conversion c)::NUMERIC
                  / (SELECT c.visitas_venta FROM cte_conversion c)) * 100, 0)::INTEGER
    END AS conversion_promedio,
    COALESCE((SELECT hp.hora_slot FROM cte_hora_pico hp), 14) AS hora_pico,
    COALESCE((SELECT hp.total_hora FROM cte_hora_pico hp), 0) AS hora_pico_cantidad,
    (SELECT tl.tienda_id FROM cte_tienda_lider tl) AS tienda_lider_id,
    -- FIX 42804: cast explícito varchar(30) → TEXT
    (SELECT t.codigo::TEXT FROM tiendas t
      WHERE t.id = (SELECT tl.tienda_id FROM cte_tienda_lider tl)) AS tienda_lider_codigo,
    COALESCE((SELECT tl.total FROM cte_tienda_lider tl), 0) AS tienda_lider_total,
    (SELECT COUNT(DISTINCT h.tienda_id)::INTEGER FROM cte_hoy h) AS tiendas_activas;
END;
$$;

COMMENT ON FUNCTION get_arribos_resumen_red IS
'Retorna KPIs de resumen de toda la red para el header del reporte. Conversión basada en resultado=VENDIDO_CONFIRMADO (v030). Fix 42804 en la migración 034.';


-- ============================================================================
-- 3. get_arribos_detalle_tienda — FIX error 42803
-- Causa: dentro del CTE `por_hora`, la subconsulta correlacionada referenciaba
--        `h.hora` (columna del query externo) mientras el GROUP BY agrupaba por
--        `EXTRACT(HOUR FROM h.hora)` → "subquery uses ungrouped column".
-- Fix:   se agrupa primero en una subconsulta (`g`) que expone `hora_slot`, y la
--        correlación pasa a usar esa columna ya agrupada.
-- Extra: CTEs renombrados para no colisionar con parámetros OUT homónimos
--        (`ranking`, `por_hora`, `motivos`).
-- Firma sin cambios → la API/TS no requiere modificaciones.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_arribos_detalle_tienda(
  p_tienda_id UUID,
  p_fecha DATE
)
RETURNS TABLE (
  -- Métricas generales
  trafico INTEGER,
  trafico_n7 INTEGER,
  delta_pct NUMERIC,
  conversion INTEGER,
  hora_pico INTEGER,
  ranking INTEGER,
  -- Por hora (JSON)
  por_hora JSONB,
  -- Embudo
  total_arribos INTEGER,
  visitas_venta INTEGER,
  visitas_posventa INTEGER,
  vendio INTEGER,
  no_vendio INTEGER,
  crosssell_posventa INTEGER,
  -- Segmentación
  clientes_base INTEGER,
  clientes_nuevos INTEGER,
  clientes_sin_dato INTEGER,
  peruanos INTEGER,
  extranjeros INTEGER,
  sin_documento INTEGER,
  -- Motivos (JSON)
  motivos JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH cte_hoy AS (
    SELECT * FROM arribos a
    WHERE a.tienda_id = p_tienda_id AND a.fecha = p_fecha
  ),
  cte_n7 AS (
    SELECT COUNT(*)::INTEGER AS total
    FROM arribos a
    WHERE a.tienda_id = p_tienda_id AND a.fecha = p_fecha - INTERVAL '7 days'
  ),
  cte_ranking AS (
    SELECT
      a.tienda_id,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)::INTEGER AS rank
    FROM arribos a
    WHERE a.fecha = p_fecha
    GROUP BY a.tienda_id
  ),
  cte_por_hora AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'hora', g.hora_slot,
        'cantidad', g.cantidad,
        'cantidad_n7', COALESCE((
          SELECT COUNT(*)::INTEGER
          FROM arribos a7
          WHERE a7.tienda_id = p_tienda_id
            AND a7.fecha = p_fecha - INTERVAL '7 days'
            AND EXTRACT(HOUR FROM a7.hora)::INTEGER = g.hora_slot
        ), 0)
      ) ORDER BY g.hora_slot
    ) AS data
    FROM (
      -- FIX 42803: la agrupación se resuelve aquí y expone `hora_slot`,
      -- que ya es una columna agrupada y puede correlacionarse hacia afuera.
      SELECT
        EXTRACT(HOUR FROM h.hora)::INTEGER AS hora_slot,
        COUNT(*)::INTEGER AS cantidad
      FROM cte_hoy h
      WHERE EXTRACT(HOUR FROM h.hora) BETWEEN 8 AND 21
      GROUP BY EXTRACT(HOUR FROM h.hora)
    ) g
  ),
  cte_motivos AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'motivo', sub.motivo_no_venta,
        'cantidad', sub.cantidad,
        'porcentaje', sub.porcentaje
      ) ORDER BY sub.cantidad DESC
    ) AS data
    FROM (
      SELECT
        h.motivo_no_venta,
        COUNT(*)::INTEGER AS cantidad,
        ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 0)::INTEGER AS porcentaje
      FROM cte_hoy h
      WHERE h.tipo_visita = 'VENTA'
        AND h.resultado = 'NO_VENDIO'
        AND h.motivo_no_venta IS NOT NULL
      GROUP BY h.motivo_no_venta
    ) sub
  )
  SELECT
    -- Métricas generales
    (SELECT COUNT(*)::INTEGER FROM cte_hoy) AS trafico,
    (SELECT n.total FROM cte_n7 n) AS trafico_n7,
    CASE
      WHEN (SELECT n.total FROM cte_n7 n) = 0 THEN NULL
      ELSE ROUND((((SELECT COUNT(*) FROM cte_hoy) - (SELECT n.total FROM cte_n7 n))::NUMERIC
                  / (SELECT n.total FROM cte_n7 n)) * 100, 1)
    END AS delta_pct,
    CASE
      WHEN (SELECT COUNT(*) FROM cte_hoy h WHERE h.tipo_visita = 'VENTA') = 0 THEN 0
      ELSE ROUND((SELECT COUNT(*) FROM cte_hoy h
                   WHERE h.tipo_visita = 'VENTA' AND h.resultado = 'VENDIDO_CONFIRMADO')::NUMERIC
                 / (SELECT COUNT(*) FROM cte_hoy h WHERE h.tipo_visita = 'VENTA') * 100, 0)::INTEGER
    END AS conversion,
    (SELECT MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM h.hora)::INTEGER)
       FROM cte_hoy h)::INTEGER AS hora_pico,
    (SELECT r.rank FROM cte_ranking r WHERE r.tienda_id = p_tienda_id) AS ranking,
    -- Por hora
    (SELECT ph.data FROM cte_por_hora ph) AS por_hora,
    -- Embudo
    (SELECT COUNT(*)::INTEGER FROM cte_hoy) AS total_arribos,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.tipo_visita = 'VENTA') AS visitas_venta,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.tipo_visita = 'POSVENTA') AS visitas_posventa,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h
       WHERE h.tipo_visita = 'VENTA' AND h.resultado = 'VENDIDO_CONFIRMADO') AS vendio,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h
       WHERE h.tipo_visita = 'VENTA' AND h.resultado = 'NO_VENDIO') AS no_vendio,
    -- crosssell_posventa: bajo el modelo v1.1 los arribos POSVENTA tienen
    -- resultado = NULL, por lo que este conteo es 0 (paridad con el formulario).
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h
       WHERE h.tipo_visita = 'POSVENTA' AND h.resultado = 'VENDIDO_CONFIRMADO') AS crosssell_posventa,
    -- Segmentación
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.es_cliente_entel = true) AS clientes_base,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.es_cliente_entel = false) AS clientes_nuevos,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.es_cliente_entel IS NULL) AS clientes_sin_dato,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.tipo_documento_cliente = 'DNI') AS peruanos,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h WHERE h.tipo_documento_cliente = 'CE') AS extranjeros,
    (SELECT COUNT(*)::INTEGER FROM cte_hoy h
       WHERE h.tipo_documento_cliente IS NULL OR h.tipo_documento_cliente = 'OTRO') AS sin_documento,
    -- Motivos
    (SELECT m.data FROM cte_motivos m) AS motivos;
END;
$$;

COMMENT ON FUNCTION get_arribos_detalle_tienda IS
'Retorna detalle completo de una tienda para sidebar y página expandida. Embudo/conversión basados en resultado (v030). Fix 42803 en la migración 034.';


-- ============================================================================
-- 4. GRANT (CREATE OR REPLACE conserva permisos; se re-afirma por idempotencia)
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_arribos_resumen_red TO authenticated;
GRANT EXECUTE ON FUNCTION get_arribos_detalle_tienda TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- -- 1. Los dos tipos nuevos son aceptados
-- SELECT 'ASISTENCIA_EXTRACCION'::text = ANY (
--   SELECT unnest(string_to_array(
--     regexp_replace(pg_get_constraintdef(oid), '.*ARRAY\[|\]\)\)|''| ', '', 'g'), ','))
--   FROM pg_constraint WHERE conname = 'ai_tasks_tipo_check') AS tipo_aceptado;
--
-- -- 2. Las dos funciones ya no fallan (sustituye la fecha y el UUID por reales)
-- SELECT * FROM get_arribos_resumen_red(CURRENT_DATE);
-- SELECT * FROM get_arribos_detalle_tienda(
--   (SELECT id FROM tiendas WHERE activa LIMIT 1), CURRENT_DATE);

-- ============================================================================
-- ROLLBACK (referencia — restaura el estado previo a esta migración)
-- ============================================================================
-- BEGIN;
--   -- Solo el CHECK: las funciones quedan corregidas (no tiene sentido volver
--   -- a una versión que falla en runtime). Para revertirlas, re-ejecutar
--   -- 030_reporte_conversion_resultado.sql.
--   ALTER TABLE ai_tasks DROP CONSTRAINT IF EXISTS ai_tasks_tipo_check;
--   ALTER TABLE ai_tasks ADD CONSTRAINT ai_tasks_tipo_check CHECK (tipo IN (
--     'CV_PARSING','ENTREVISTA_TRANSCRIPCION','ENTREVISTA_ANALISIS',
--     'SCORING_CANDIDATO','INDUCCION_PLAN','CONTRATO_GENERACION',
--     'RENOVACION_RESUMEN','RIESGO_FUGA','OFFBOARDING_CHECKLIST',
--     'DOCUMENTO_OCR','EMAIL_DRAFT','ANOMALIA_DETECCION','CHATBOT_QUERY',
--     'IMPORTACION_MAPEO','IMPORTACION_NORMALIZACION','IMPORTACION_BRECHAS',
--     'MAPEO_COLUMNAS_IMPORT'));
-- COMMIT;
