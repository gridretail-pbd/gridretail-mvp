-- ============================================================================
-- MIGRACIÓN 008: Deshabilitar RLS para MVP
-- ============================================================================
-- Descripción: Desactiva Row Level Security en todas las tablas para desarrollo
-- Nota: En producción, se deben implementar políticas RLS apropiadas
-- ============================================================================

-- ============================================================================
-- TABLAS CORE
-- ============================================================================
ALTER TABLE IF EXISTS usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios_tiendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tipos_venta DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS operadores_cedentes DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS DE OPERACIONES
-- ============================================================================
ALTER TABLE IF EXISTS ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS arribos DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS INAR
-- ============================================================================
ALTER TABLE IF EXISTS lineas_inar DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inar_importaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inar_mapeo_columnas DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS DE CONTROL
-- ============================================================================
ALTER TABLE IF EXISTS asesor_incidencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS logs_auditoria DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS DE COMISIONES
-- ============================================================================
ALTER TABLE IF EXISTS commission_item_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_schemes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_scheme_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_pxq_scales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_item_locks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_item_restrictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_hc_assignments DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS DE PENALIDADES
-- ============================================================================
ALTER TABLE IF EXISTS penalty_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS penalty_equivalences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hc_penalties DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS penalty_imports DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS DE PRESETS
-- ============================================================================
ALTER TABLE IF EXISTS partition_presets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS partition_preset_ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commission_item_ventas DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLAS DE CUOTAS (Módulo nuevo)
-- ============================================================================
ALTER TABLE IF EXISTS quota_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_quotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hc_quotas DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMENTARIO PARA PRODUCCIÓN
-- ============================================================================
COMMENT ON SCHEMA public IS 'MVP Schema - RLS deshabilitado para desarrollo. Implementar políticas RLS antes de producción.';
