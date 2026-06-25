-- ============================================================
-- MIGRACIÓN 030: Reporte de Arribos — migración se_vendio → resultado
-- Fecha: 2026-06-14
-- Diseño: DISENO_VINCULACION_VENTA_ARRIBO.md v1.1
-- Depende de: 029_vincular_venta_arribo.sql (columna arribos.resultado)
-- ------------------------------------------------------------
-- Reemplaza toda referencia a se_vendio (eliminada en 029) por la
-- nueva semántica basada en resultado:
--   se_vendio = true   →  resultado = 'VENDIDO_CONFIRMADO'
--   se_vendio = false  →  resultado = 'NO_VENDIO'
-- Las firmas (RETURNS TABLE) NO cambian: CREATE OR REPLACE es drop-in,
-- los GRANT existentes se conservan, y la API/TS no requiere cambios.
-- get_arribos_matriz no se modifica (no usa se_vendio).
-- ============================================================

BEGIN;

-- ============================================================
-- get_arribos_metricas (N-1 / N-7 / AVG-4W)
-- ============================================================
CREATE OR REPLACE FUNCTION get_arribos_metricas(
  p_fecha DATE,
  p_zona TEXT DEFAULT NULL,
  p_comparacion TEXT DEFAULT 'N-7'  -- 'N-1', 'N-7', 'AVG-4W'
)
RETURNS TABLE (
  tienda_id UUID,
  tienda_nombre TEXT,
  tienda_codigo TEXT,
  zona TEXT,
  trafico INTEGER,
  trafico_comparacion NUMERIC,
  delta_pct NUMERIC,
  conversion INTEGER,
  hora_pico INTEGER,
  tiene_alerta BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fecha_comp DATE;
  v_fechas_avg DATE[];
BEGIN
  -- Calcular fecha(s) de comparación
  CASE p_comparacion
    WHEN 'N-1' THEN
      v_fecha_comp := p_fecha - INTERVAL '1 day';
    WHEN 'N-7' THEN
      v_fecha_comp := p_fecha - INTERVAL '7 days';
    WHEN 'AVG-4W' THEN
      v_fechas_avg := ARRAY[
        p_fecha - INTERVAL '7 days',
        p_fecha - INTERVAL '14 days',
        p_fecha - INTERVAL '21 days',
        p_fecha - INTERVAL '28 days'
      ];
  END CASE;

  IF p_comparacion IN ('N-1', 'N-7') THEN
    RETURN QUERY
    WITH metricas_hoy AS (
      SELECT
        a.tienda_id,
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE tipo_visita = 'VENTA')::INTEGER AS visitas_venta,
        COUNT(*) FILTER (WHERE tipo_visita = 'VENTA' AND resultado = 'VENDIDO_CONFIRMADO')::INTEGER AS ventas,
        MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM hora)::INTEGER) AS hora_pico
      FROM arribos a
      JOIN tiendas t ON a.tienda_id = t.id
      WHERE a.fecha = p_fecha
        AND (p_zona IS NULL OR t.zona = p_zona)
      GROUP BY a.tienda_id
    ),
    metricas_comp AS (
      SELECT
        a.tienda_id,
        COUNT(*)::INTEGER AS total
      FROM arribos a
      JOIN tiendas t ON a.tienda_id = t.id
      WHERE a.fecha = v_fecha_comp
        AND (p_zona IS NULL OR t.zona = p_zona)
      GROUP BY a.tienda_id
    )
    SELECT
      t.id AS tienda_id,
      t.nombre AS tienda_nombre,
      t.codigo AS tienda_codigo,
      t.zona,
      COALESCE(h.total, 0)::INTEGER AS trafico,
      COALESCE(c.total, 0)::NUMERIC AS trafico_comparacion,
      CASE
        WHEN COALESCE(c.total, 0) = 0 THEN NULL
        ELSE ROUND(((h.total - c.total)::NUMERIC / c.total) * 100, 1)
      END AS delta_pct,
      CASE
        WHEN COALESCE(h.visitas_venta, 0) = 0 THEN 0
        ELSE ROUND((h.ventas::NUMERIC / h.visitas_venta) * 100, 0)::INTEGER
      END AS conversion,
      COALESCE(h.hora_pico, 14)::INTEGER AS hora_pico,
      -- Alerta si conversión < 35% o delta < -5%
      (
        CASE WHEN COALESCE(h.visitas_venta, 0) = 0 THEN 0
             ELSE ROUND((h.ventas::NUMERIC / h.visitas_venta) * 100, 0)
        END < 35
        OR
        CASE WHEN COALESCE(c.total, 0) = 0 THEN 0
             ELSE ROUND(((h.total - c.total)::NUMERIC / c.total) * 100, 1)
        END < -5
      ) AS tiene_alerta
    FROM tiendas t
    LEFT JOIN metricas_hoy h ON t.id = h.tienda_id
    LEFT JOIN metricas_comp c ON t.id = c.tienda_id
    WHERE t.activa = true
      AND (p_zona IS NULL OR t.zona = p_zona)
      AND COALESCE(h.total, 0) > 0
    ORDER BY COALESCE(h.total, 0) DESC;

  ELSIF p_comparacion = 'AVG-4W' THEN
    RETURN QUERY
    WITH metricas_hoy AS (
      SELECT
        a.tienda_id,
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE tipo_visita = 'VENTA')::INTEGER AS visitas_venta,
        COUNT(*) FILTER (WHERE tipo_visita = 'VENTA' AND resultado = 'VENDIDO_CONFIRMADO')::INTEGER AS ventas,
        MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM hora)::INTEGER) AS hora_pico
      FROM arribos a
      JOIN tiendas t ON a.tienda_id = t.id
      WHERE a.fecha = p_fecha
        AND (p_zona IS NULL OR t.zona = p_zona)
      GROUP BY a.tienda_id
    ),
    metricas_avg AS (
      SELECT
        a.tienda_id,
        ROUND(COUNT(*)::NUMERIC / 4, 1) AS promedio
      FROM arribos a
      JOIN tiendas t ON a.tienda_id = t.id
      WHERE a.fecha = ANY(v_fechas_avg)
        AND (p_zona IS NULL OR t.zona = p_zona)
      GROUP BY a.tienda_id
    )
    SELECT
      t.id AS tienda_id,
      t.nombre AS tienda_nombre,
      t.codigo AS tienda_codigo,
      t.zona,
      COALESCE(h.total, 0)::INTEGER AS trafico,
      COALESCE(avg.promedio, 0)::NUMERIC AS trafico_comparacion,
      CASE
        WHEN COALESCE(avg.promedio, 0) = 0 THEN NULL
        ELSE ROUND(((h.total - avg.promedio) / avg.promedio) * 100, 1)
      END AS delta_pct,
      CASE
        WHEN COALESCE(h.visitas_venta, 0) = 0 THEN 0
        ELSE ROUND((h.ventas::NUMERIC / h.visitas_venta) * 100, 0)::INTEGER
      END AS conversion,
      COALESCE(h.hora_pico, 14)::INTEGER AS hora_pico,
      (
        CASE WHEN COALESCE(h.visitas_venta, 0) = 0 THEN 0
             ELSE ROUND((h.ventas::NUMERIC / h.visitas_venta) * 100, 0)
        END < 35
        OR
        CASE WHEN COALESCE(avg.promedio, 0) = 0 THEN 0
             ELSE ROUND(((h.total - avg.promedio) / avg.promedio) * 100, 1)
        END < -5
      ) AS tiene_alerta
    FROM tiendas t
    LEFT JOIN metricas_hoy h ON t.id = h.tienda_id
    LEFT JOIN metricas_avg avg ON t.id = avg.tienda_id
    WHERE t.activa = true
      AND (p_zona IS NULL OR t.zona = p_zona)
      AND COALESCE(h.total, 0) > 0
    ORDER BY COALESCE(h.total, 0) DESC;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_arribos_metricas IS
'Retorna métricas de arribos por tienda con comparación temporal para el tab Métricas. Conversión basada en resultado=VENDIDO_CONFIRMADO (v030).';

-- ============================================================
-- get_arribos_resumen_red (KPIs header)
-- ============================================================
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
  WITH hoy AS (
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
  n7 AS (
    SELECT COUNT(*)::INTEGER AS total
    FROM arribos a
    JOIN tiendas t ON a.tienda_id = t.id
    WHERE a.fecha = p_fecha - INTERVAL '7 days'
      AND (p_zona IS NULL OR t.zona = p_zona)
  ),
  conversion AS (
    SELECT
      COUNT(*) FILTER (WHERE tipo_visita = 'VENTA')::INTEGER AS visitas_venta,
      COUNT(*) FILTER (WHERE tipo_visita = 'VENTA' AND resultado = 'VENDIDO_CONFIRMADO')::INTEGER AS ventas
    FROM arribos a
    JOIN tiendas t ON a.tienda_id = t.id
    WHERE a.fecha = p_fecha
      AND (p_zona IS NULL OR t.zona = p_zona)
  ),
  hora_pico AS (
    SELECT
      hora_slot,
      SUM(cantidad)::INTEGER AS total_hora
    FROM hoy
    GROUP BY hora_slot
    ORDER BY total_hora DESC
    LIMIT 1
  ),
  tienda_lider AS (
    SELECT
      tienda_id,
      SUM(cantidad)::INTEGER AS total
    FROM hoy
    GROUP BY tienda_id
    ORDER BY total DESC
    LIMIT 1
  )
  SELECT
    COALESCE((SELECT SUM(cantidad)::INTEGER FROM hoy), 0) AS total_arribos,
    COALESCE((SELECT total FROM n7), 0) AS total_comparacion,
    CASE
      WHEN COALESCE((SELECT total FROM n7), 0) = 0 THEN NULL
      ELSE ROUND((((SELECT SUM(cantidad) FROM hoy) - (SELECT total FROM n7))::NUMERIC / (SELECT total FROM n7)) * 100, 1)
    END AS delta_pct,
    CASE
      WHEN COALESCE((SELECT visitas_venta FROM conversion), 0) = 0 THEN 0
      ELSE ROUND(((SELECT ventas FROM conversion)::NUMERIC / (SELECT visitas_venta FROM conversion)) * 100, 0)::INTEGER
    END AS conversion_promedio,
    COALESCE((SELECT hora_slot FROM hora_pico), 14) AS hora_pico,
    COALESCE((SELECT total_hora FROM hora_pico), 0) AS hora_pico_cantidad,
    (SELECT tienda_id FROM tienda_lider) AS tienda_lider_id,
    (SELECT t.codigo FROM tiendas t WHERE t.id = (SELECT tienda_id FROM tienda_lider)) AS tienda_lider_codigo,
    COALESCE((SELECT total FROM tienda_lider), 0) AS tienda_lider_total,
    (SELECT COUNT(DISTINCT tienda_id)::INTEGER FROM hoy) AS tiendas_activas;
END;
$$;

COMMENT ON FUNCTION get_arribos_resumen_red IS
'Retorna KPIs de resumen de toda la red para el header del reporte. Conversión basada en resultado=VENDIDO_CONFIRMADO (v030).';

-- ============================================================
-- get_arribos_detalle_tienda (sidebar y página expandida)
-- ============================================================
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
  WITH hoy AS (
    SELECT * FROM arribos
    WHERE tienda_id = p_tienda_id AND fecha = p_fecha
  ),
  n7 AS (
    SELECT COUNT(*)::INTEGER AS total
    FROM arribos
    WHERE tienda_id = p_tienda_id AND fecha = p_fecha - INTERVAL '7 days'
  ),
  ranking AS (
    SELECT
      tienda_id,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)::INTEGER AS rank
    FROM arribos
    WHERE fecha = p_fecha
    GROUP BY tienda_id
  ),
  por_hora AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'hora', hora_slot,
        'cantidad', cantidad,
        'cantidad_n7', cantidad_n7
      ) ORDER BY hora_slot
    ) AS data
    FROM (
      SELECT
        EXTRACT(HOUR FROM h.hora)::INTEGER AS hora_slot,
        COUNT(*)::INTEGER AS cantidad,
        COALESCE((
          SELECT COUNT(*)::INTEGER
          FROM arribos
          WHERE tienda_id = p_tienda_id
            AND fecha = p_fecha - INTERVAL '7 days'
            AND EXTRACT(HOUR FROM hora) = EXTRACT(HOUR FROM h.hora)
        ), 0) AS cantidad_n7
      FROM hoy h
      WHERE EXTRACT(HOUR FROM h.hora) BETWEEN 8 AND 21
      GROUP BY EXTRACT(HOUR FROM h.hora)
    ) sub
  ),
  motivos AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'motivo', motivo_no_venta,
        'cantidad', cantidad,
        'porcentaje', porcentaje
      ) ORDER BY cantidad DESC
    ) AS data
    FROM (
      SELECT
        motivo_no_venta,
        COUNT(*)::INTEGER AS cantidad,
        ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 0)::INTEGER AS porcentaje
      FROM hoy
      WHERE tipo_visita = 'VENTA'
        AND resultado = 'NO_VENDIO'
        AND motivo_no_venta IS NOT NULL
      GROUP BY motivo_no_venta
    ) sub
  )
  SELECT
    -- Métricas generales
    (SELECT COUNT(*)::INTEGER FROM hoy) AS trafico,
    (SELECT total FROM n7) AS trafico_n7,
    CASE
      WHEN (SELECT total FROM n7) = 0 THEN NULL
      ELSE ROUND((((SELECT COUNT(*) FROM hoy) - (SELECT total FROM n7))::NUMERIC / (SELECT total FROM n7)) * 100, 1)
    END AS delta_pct,
    CASE
      WHEN (SELECT COUNT(*) FROM hoy WHERE tipo_visita = 'VENTA') = 0 THEN 0
      ELSE ROUND((SELECT COUNT(*) FROM hoy WHERE tipo_visita = 'VENTA' AND resultado = 'VENDIDO_CONFIRMADO')::NUMERIC /
                 (SELECT COUNT(*) FROM hoy WHERE tipo_visita = 'VENTA') * 100, 0)::INTEGER
    END AS conversion,
    (SELECT MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM hora)::INTEGER) FROM hoy)::INTEGER AS hora_pico,
    (SELECT rank FROM ranking WHERE tienda_id = p_tienda_id) AS ranking,
    -- Por hora
    (SELECT data FROM por_hora) AS por_hora,
    -- Embudo
    (SELECT COUNT(*)::INTEGER FROM hoy) AS total_arribos,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_visita = 'VENTA') AS visitas_venta,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_visita = 'POSVENTA') AS visitas_posventa,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_visita = 'VENTA' AND resultado = 'VENDIDO_CONFIRMADO') AS vendio,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_visita = 'VENTA' AND resultado = 'NO_VENDIO') AS no_vendio,
    -- crosssell_posventa: bajo el modelo v1.1 los arribos POSVENTA tienen resultado = NULL,
    -- por lo que este conteo es 0 (paridad con el comportamiento actual del formulario).
    -- Rastrear venta cruzada real en posventa es una decisión de producto separada.
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_visita = 'POSVENTA' AND resultado = 'VENDIDO_CONFIRMADO') AS crosssell_posventa,
    -- Segmentación
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE es_cliente_entel = true) AS clientes_base,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE es_cliente_entel = false) AS clientes_nuevos,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE es_cliente_entel IS NULL) AS clientes_sin_dato,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_documento_cliente = 'DNI') AS peruanos,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_documento_cliente = 'CE') AS extranjeros,
    (SELECT COUNT(*)::INTEGER FROM hoy WHERE tipo_documento_cliente IS NULL OR tipo_documento_cliente = 'OTRO') AS sin_documento,
    -- Motivos
    (SELECT data FROM motivos) AS motivos;
END;
$$;

COMMENT ON FUNCTION get_arribos_detalle_tienda IS
'Retorna detalle completo de una tienda para sidebar y página expandida. Embudo/conversión basados en resultado (v030).';

-- ============================================================
-- GRANT (re-afirmar; CREATE OR REPLACE conserva permisos, se incluye por idempotencia)
-- ============================================================
GRANT EXECUTE ON FUNCTION get_arribos_metricas TO authenticated;
GRANT EXECUTE ON FUNCTION get_arribos_resumen_red TO authenticated;
GRANT EXECUTE ON FUNCTION get_arribos_detalle_tienda TO authenticated;

COMMIT;

-- ============================================================
-- NOTA — Métricas de control (OPCIONAL, no incluido aquí)
-- ------------------------------------------------------------
-- Para exponer en el reporte los nuevos estados como métricas accionables:
--   - VENTA_DECLARADA_PENDIENTE  (worklist de reconciliación / "fantasmas")
--   - VENTA_PENDIENTE_APROBACION (ventas rezagadas esperando visado)
-- habría que AGREGAR columnas a get_arribos_resumen_red y/o
-- get_arribos_detalle_tienda. Eso CAMBIA la firma RETURNS TABLE, que requiere
-- DROP FUNCTION + CREATE (no CREATE OR REPLACE) y re-aplicar GRANT, además de
-- actualizar la API y los tipos TS que consumen esas funciones.
-- Se deja como ítem separado para no romper consumidores existentes.
-- ============================================================
-- FIN DE MIGRACIÓN 030
-- ============================================================
