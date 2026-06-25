-- Migración 027: Corrige el CHECK constraint del documento del cliente en arribos
--
-- Problema: arribos_dni_cliente_format_check exigía exactamente 8 dígitos
-- (^\d{8}$) para dni_cliente, pero el formulario almacena en esa misma columna
-- documentos CE (9 dígitos) y OTRO. Registrar un arribo con CE o un documento
-- alfanumérico fallaba con violación de constraint.
--
-- Solución: el formato exigido ahora depende de tipo_documento_cliente:
--   DNI  -> exactamente 8 dígitos
--   CE   -> exactamente 9 dígitos
--   OTRO -> cualquier valor no vacío (hasta el límite de la columna, 20)
-- dni_cliente NULL siempre es válido (cliente sin documento / "No lo dio").

ALTER TABLE public.arribos
  DROP CONSTRAINT IF EXISTS arribos_dni_cliente_format_check;

ALTER TABLE public.arribos
  ADD CONSTRAINT arribos_dni_cliente_format_check CHECK (
    dni_cliente IS NULL
    OR (tipo_documento_cliente = 'DNI'  AND dni_cliente ~ '^\d{8}$')
    OR (tipo_documento_cliente = 'CE'   AND dni_cliente ~ '^\d{9}$')
    OR (tipo_documento_cliente = 'OTRO' AND length(dni_cliente) > 0)
  );
