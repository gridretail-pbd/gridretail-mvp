-- Agregar nuevo tipo de venta
INSERT INTO tipos_venta (codigo, nombre, categoria, descripcion, requiere_imei, requiere_cedente)
VALUES ('RENO_LLAA', 'Renovación + Línea Adicional', 'RENO', 
        'RENO vendida con una VR BASE (attach). Cuenta para RENO y VR_BASE en comisiones.',
        true, false);

-- Actualizar constraint si existe
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_tipo_venta_check;
-- (Agregar el nuevo tipo al constraint si aplica)