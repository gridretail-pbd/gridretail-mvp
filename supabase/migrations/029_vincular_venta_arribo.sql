-- ============================================================
-- MIGRACIÓN 029: Vinculación de Venta a Arribo
-- Fecha: 2026-06-14
-- Diseño: DISENO_VINCULACION_VENTA_ARRIBO.md v1.1
-- ------------------------------------------------------------
-- Precondición: tabla ventas SIN filas sin arribo (GridRetail no
-- está en producción). Si el entorno de desarrollo tiene filas de
-- prueba en ventas, reiniciarlas antes (TRUNCATE ventas o asignar
-- arribos); de lo contrario el ALTER ... arribo_id NOT NULL fallará.
--
-- Debe correr ANTES de 030_reporte_conversion_resultado.sql.
-- ============================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1) arribos.resultado (reemplaza se_vendio)
-- ---------------------------------------------------------------------
ALTER TABLE arribos ADD COLUMN resultado VARCHAR(30);

ALTER TABLE arribos ADD CONSTRAINT arribos_resultado_check CHECK (
  resultado IS NULL OR resultado IN (
    'NO_VENDIO',
    'VENTA_DECLARADA_PENDIENTE',
    'VENTA_PENDIENTE_APROBACION',
    'VENDIDO_CONFIRMADO',
    'VENTA_ANULADA'
  )
);

-- Coherencia con tipo_visita: POSVENTA nunca tiene resultado.
ALTER TABLE arribos ADD CONSTRAINT arribos_resultado_posventa_check CHECK (
  (tipo_visita = 'POSVENTA' AND resultado IS NULL)
  OR (tipo_visita = 'VENTA')
);

-- Eliminar el índice que dependía de se_vendio, luego la columna,
-- luego recrear el índice sobre resultado.
DROP INDEX IF EXISTS idx_arribos_conversion;
ALTER TABLE arribos DROP COLUMN IF EXISTS se_vendio;
CREATE INDEX idx_arribos_conversion
  ON arribos(tienda_id, fecha, tipo_visita, resultado);

-- ---------------------------------------------------------------------
-- 2) arribos: tipos de documento alineados con ventas + OTRO
-- ---------------------------------------------------------------------
ALTER TABLE arribos DROP CONSTRAINT IF EXISTS arribos_tipo_documento_cliente_check;
ALTER TABLE arribos ADD CONSTRAINT arribos_tipo_documento_cliente_check CHECK (
  tipo_documento_cliente IS NULL
  OR tipo_documento_cliente IN ('DNI','CE','RUC','PASAPORTE','PTP','OTRO')
);

ALTER TABLE arribos DROP CONSTRAINT IF EXISTS arribos_dni_cliente_format_check;
ALTER TABLE arribos ADD CONSTRAINT arribos_dni_cliente_format_check CHECK (
  dni_cliente IS NULL
  OR (tipo_documento_cliente = 'DNI'       AND dni_cliente ~ '^\d{8}$')
  OR (tipo_documento_cliente = 'CE'        AND dni_cliente ~ '^\d{9}$')
  OR (tipo_documento_cliente = 'RUC'       AND dni_cliente ~ '^(10|20)\d{9}$')
  OR (tipo_documento_cliente = 'PASAPORTE' AND dni_cliente ~ '^[A-Z0-9]{6,12}$')
  OR (tipo_documento_cliente = 'PTP'       AND dni_cliente ~ '^[A-Z0-9]{6,15}$')
  OR (tipo_documento_cliente = 'OTRO'      AND length(dni_cliente) > 0)
);
-- NOTA: json.pe autocompleta solo DNI y CE; RUC/PASAPORTE/PTP/OTRO se ingresan manualmente.

-- ---------------------------------------------------------------------
-- 3) ventas.arribo_id (FK NOT NULL, ON DELETE RESTRICT)
-- ---------------------------------------------------------------------
-- ⚠️ Si ventas tuviera filas de prueba sin arribo, este ALTER fallará.
--    Reiniciar datos de prueba antes (ver precondición arriba).
ALTER TABLE ventas ADD COLUMN arribo_id UUID NOT NULL;

ALTER TABLE ventas
  ADD CONSTRAINT ventas_arribo_id_fkey
  FOREIGN KEY (arribo_id) REFERENCES arribos(id)
  ON DELETE RESTRICT;

CREATE INDEX idx_ventas_arribo ON ventas(arribo_id);

-- ---------------------------------------------------------------------
-- 4) Función de recálculo de resultado
--    SECURITY DEFINER: permite actualizar arribos aunque el vendedor
--    no sea el dueño del arribo (venta sobre arribo de otro asesor).
--    Verificar que las políticas RLS de arribos permitan el UPDATE
--    al owner de la función.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_arribo_resultado(p_arribo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_visita TEXT;
  v_resultado_actual TEXT;
  v_activas INT;
  v_pendientes INT;
  v_terminales INT;
BEGIN
  SELECT tipo_visita, resultado
    INTO v_tipo_visita, v_resultado_actual
    FROM arribos WHERE id = p_arribo_id;

  IF v_tipo_visita = 'POSVENTA' THEN
    UPDATE arribos SET resultado = NULL, updated_at = NOW() WHERE id = p_arribo_id;
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE estado IN ('registrada','aprobada')),
    COUNT(*) FILTER (WHERE estado = 'pendiente_aprobacion'),
    COUNT(*) FILTER (WHERE estado IN ('anulada','rechazada'))
  INTO v_activas, v_pendientes, v_terminales
  FROM ventas WHERE arribo_id = p_arribo_id;

  IF v_activas > 0 THEN
    UPDATE arribos SET resultado = 'VENDIDO_CONFIRMADO', updated_at = NOW() WHERE id = p_arribo_id;
  ELSIF v_pendientes > 0 THEN
    UPDATE arribos SET resultado = 'VENTA_PENDIENTE_APROBACION', updated_at = NOW() WHERE id = p_arribo_id;
  ELSIF v_terminales > 0 THEN
    UPDATE arribos SET resultado = 'VENTA_ANULADA', updated_at = NOW() WHERE id = p_arribo_id;
  ELSE
    -- Sin filas de venta: respetar la declaración manual del asesor.
    -- No pisar NO_VENDIO; cualquier otro caso → declarada pendiente.
    IF v_resultado_actual IS DISTINCT FROM 'NO_VENDIO' THEN
      UPDATE arribos SET resultado = 'VENTA_DECLARADA_PENDIENTE', updated_at = NOW() WHERE id = p_arribo_id;
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) Trigger sobre ventas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_ventas_recompute_arribo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_arribo_resultado(OLD.arribo_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_arribo_resultado(NEW.arribo_id);
    -- Si en un UPDATE cambió el arribo_id (no debería), recalcular el anterior también.
    IF (TG_OP = 'UPDATE' AND OLD.arribo_id IS DISTINCT FROM NEW.arribo_id) THEN
      PERFORM recompute_arribo_resultado(OLD.arribo_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS ventas_recompute_arribo ON ventas;
CREATE TRIGGER ventas_recompute_arribo
AFTER INSERT OR DELETE OR UPDATE OF estado, arribo_id ON ventas
FOR EACH ROW EXECUTE FUNCTION trg_ventas_recompute_arribo();

COMMIT;

-- ============================================================
-- POST-MIGRACIÓN (verificación manual sugerida)
-- ------------------------------------------------------------
--  - Confirmar que recompute_arribo_resultado (SECURITY DEFINER) puede
--    actualizar arribos bajo RLS cuando el vendedor NO es dueño del arribo.
--  - Recordar que get_arribos_* (migración 028) referencian se_vendio y
--    fallarán hasta aplicar 030_reporte_conversion_resultado.sql.
-- ============================================================
-- FIN DE MIGRACIÓN 029
-- ============================================================
