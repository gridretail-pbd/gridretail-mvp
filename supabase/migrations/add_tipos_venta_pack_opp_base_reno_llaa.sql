-- ============================================================================
-- MIGRACIÓN: Agregar tipos de venta PACK_OPP_BASE y RENO_LLAA
-- Fecha: 2026-02-03
-- Descripción: Completa el catálogo de tipos de venta según glosario TEX
-- ============================================================================

-- 1. PACK_OPP_BASE: Pack con portabilidad OPP de cliente BASE
-- Categoría PACK_SS (igual que PACK_OSS y PACK_VR_BASE)
-- Conteo múltiple: suma a PACKS + OPP_BASE

INSERT INTO tipos_venta (
  codigo, 
  nombre, 
  categoria, 
  fuente_validacion,
  requiere_cedente, 
  requiere_imei, 
  requiere_iccid, 
  permite_seguro,
  descripcion_ayuda, 
  activo, 
  orden
) VALUES (
  'PACK_OPP_BASE', 
  'Pack Porta OPP LLAA', 
  'PACK_SS', 
  'INAR',
  true,     -- Sí requiere cedente (es portabilidad)
  true,     -- Sí requiere IMEI (incluye equipo)
  false,    -- No requiere ICCID
  true,     -- Permite seguro MEP
  'Portabilidad OPP de cliente BASE con equipo incluido. Cuenta para partidas PACKS y OPP_BASE en comisiones.',
  true,
  17
);

-- 2. RENO_LLAA: Renovación con línea adicional (attach)
-- Categoría RENO
-- Conteo múltiple: suma a RENO + VR_BASE

INSERT INTO tipos_venta (
  codigo, 
  nombre, 
  categoria, 
  fuente_validacion,
  requiere_cedente, 
  requiere_imei, 
  requiere_iccid, 
  permite_seguro,
  descripcion_ayuda, 
  activo, 
  orden
) VALUES (
  'RENO_LLAA', 
  'Renovación + LLAA', 
  'RENO', 
  'FICHA',
  false,    -- No requiere cedente (no es portabilidad)
  true,     -- Sí requiere IMEI (incluye equipo)
  false,    -- No requiere ICCID
  true,     -- Permite seguro MEP
  'Renovación con línea adicional (attach). Cuenta para partidas RENO y VR_BASE en comisiones.',
  true,
  18
);

-- ============================================================================
-- VERIFICACIÓN: Ejecutar después del INSERT
-- ============================================================================
-- SELECT codigo, nombre, categoria, orden FROM tipos_venta ORDER BY orden;
