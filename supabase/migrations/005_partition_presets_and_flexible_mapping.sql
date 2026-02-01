-- ============================================================================
-- MIGRACIÓN 005: Sistema de Partidas Flexible con Presets
-- Módulo: Comisiones - Editor de Esquemas
-- Fecha: 2026-01-25
-- ============================================================================
-- 
-- CAMBIOS:
-- 1. Corregir tipos_venta: eliminar OPP_MONO, agregar PACK_OPEN
-- 2. Crear tabla partition_presets (catálogo de presets)
-- 3. Crear tabla partition_preset_ventas (mapeo preset → tipos_venta)
-- 4. Crear tabla commission_item_ventas (mapeo partida esquema → tipos_venta)
-- 5. Modificar commission_scheme_items para soportar partidas personalizadas
-- 6. Crear vistas útiles
-- ============================================================================

-- ============================================================================
-- PARTE 1: CORRECCIÓN DE TIPOS_VENTA
-- ============================================================================

-- Eliminar OPP_MONO (no existe en la operación real)
DELETE FROM tipos_venta WHERE codigo = 'OPP_MONO';

-- Agregar PACK_OPEN (equipo sin línea)
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
)
VALUES (
    'PACK_OPEN',
    'Pack Open (Solo Equipo)',
    'PACK',
    'INTERNO',
    false,
    true,   -- Requiere IMEI
    false,  -- No requiere ICCID (no hay línea)
    true,   -- Permite seguro MEP
    'Equipo vendido sin línea asociada',
    true,
    25
)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- PARTE 2: TABLA PARTITION_PRESETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS partition_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificación
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(30),
    description TEXT,
    
    -- Configuración por defecto
    default_category VARCHAR(30) NOT NULL,
    default_calculation_type VARCHAR(30) NOT NULL,
    
    -- Clasificación para UI
    preset_group VARCHAR(30) NOT NULL,
    display_order INTEGER DEFAULT 0,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_preset_category CHECK (default_category IN ('principal', 'adicional', 'pxq', 'bono')),
    CONSTRAINT chk_preset_calc_type CHECK (default_calculation_type IN ('percentage', 'pxq', 'binary')),
    CONSTRAINT chk_preset_group CHECK (preset_group IN ('agrupacion', 'individual'))
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at ON partition_presets;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON partition_presets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_presets_active ON partition_presets(is_active, preset_group);
CREATE INDEX IF NOT EXISTS idx_presets_group ON partition_presets(preset_group, display_order);

-- ============================================================================
-- PARTE 3: TABLA PARTITION_PRESET_VENTAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS partition_preset_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    preset_id UUID NOT NULL REFERENCES partition_presets(id) ON DELETE CASCADE,
    tipo_venta_id UUID NOT NULL REFERENCES tipos_venta(id) ON DELETE CASCADE,
    
    -- Para ventas compuestas (PACKs)
    cuenta_linea BOOLEAN DEFAULT true,
    cuenta_equipo BOOLEAN DEFAULT false,
    
    -- Orden de visualización
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (preset_id, tipo_venta_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_preset_ventas_preset ON partition_preset_ventas(preset_id);
CREATE INDEX IF NOT EXISTS idx_preset_ventas_tipo ON partition_preset_ventas(tipo_venta_id);

-- ============================================================================
-- PARTE 4: TABLA COMMISSION_ITEM_VENTAS (mapeo partida → tipos_venta)
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_item_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    scheme_item_id UUID NOT NULL REFERENCES commission_scheme_items(id) ON DELETE CASCADE,
    tipo_venta_id UUID NOT NULL REFERENCES tipos_venta(id) ON DELETE CASCADE,
    
    -- Para ventas compuestas (PACKs): qué componente cuenta
    cuenta_linea BOOLEAN DEFAULT true,
    cuenta_equipo BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (scheme_item_id, tipo_venta_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_item_ventas_scheme_item ON commission_item_ventas(scheme_item_id);
CREATE INDEX IF NOT EXISTS idx_item_ventas_tipo_venta ON commission_item_ventas(tipo_venta_id);

-- ============================================================================
-- PARTE 5: MODIFICAR COMMISSION_SCHEME_ITEMS
-- ============================================================================

-- Hacer item_type_id opcional (puede ser NULL si es partida custom)
ALTER TABLE commission_scheme_items 
    ALTER COLUMN item_type_id DROP NOT NULL;

-- Agregar nombre personalizado para la partida
ALTER TABLE commission_scheme_items 
    ADD COLUMN IF NOT EXISTS custom_name VARCHAR(100);

-- Agregar descripción personalizada
ALTER TABLE commission_scheme_items 
    ADD COLUMN IF NOT EXISTS custom_description TEXT;

-- Agregar referencia al preset usado (para trazabilidad)
ALTER TABLE commission_scheme_items 
    ADD COLUMN IF NOT EXISTS preset_id UUID REFERENCES partition_presets(id);

-- ============================================================================
-- PARTE 6: SEED DE PRESETS - AGRUPACIONES COMUNES
-- ============================================================================

INSERT INTO partition_presets (code, name, short_name, description, default_category, default_calculation_type, preset_group, display_order) VALUES
('OSS', 'OSS', 'OSS', 'Portabilidad PostPago (Base + Captura)', 'principal', 'percentage', 'agrupacion', 1),
('OPP', 'OPP', 'OPP', 'Portabilidad PrePago (Base + Captura)', 'principal', 'percentage', 'agrupacion', 2),
('VR_CAPTURA', 'VR CAPTURA', 'VR CAP', 'Venta Regular Captura (Mono + Captura)', 'principal', 'percentage', 'agrupacion', 3),
('VR_BASE_LLAA', 'VR BASE / LLAA', 'LLAA', 'Venta Regular Base / Línea Adicional', 'principal', 'percentage', 'agrupacion', 4),
('PACK_SS', 'PACK SS', 'PACK SS', 'Equipos con línea postpago (OSS, VR Base)', 'adicional', 'percentage', 'agrupacion', 5),
('RENO', 'RENO', 'RENO', 'Renovación de equipo', 'adicional', 'percentage', 'agrupacion', 6),
('PREPAGO', 'PREPAGO', 'PP', 'Ventas prepago (nuevo + portabilidad)', 'adicional', 'percentage', 'agrupacion', 7),
('MISS_IN', 'MISS IN', 'MISS', 'Prepago Entel convertido a Postpago', 'adicional', 'percentage', 'agrupacion', 8),
('ACCESORIOS', 'ACCESORIOS', 'ACCS', 'Solo accesorios', 'adicional', 'percentage', 'agrupacion', 9)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PARTE 7: SEED DE PRESETS - TIPOS INDIVIDUALES
-- ============================================================================

INSERT INTO partition_presets (code, name, short_name, description, default_category, default_calculation_type, preset_group, display_order) VALUES
('IND_OSS_CAPTURA', 'OSS CAPTURA', 'OSS CAP', 'Solo OSS Captura', 'principal', 'percentage', 'individual', 101),
('IND_OSS_BASE', 'OSS BASE', 'OSS BAS', 'Solo OSS Base', 'principal', 'percentage', 'individual', 102),
('IND_OPP_CAPTURA', 'OPP CAPTURA', 'OPP CAP', 'Solo OPP Captura', 'principal', 'percentage', 'individual', 103),
('IND_OPP_BASE', 'OPP BASE', 'OPP BAS', 'Solo OPP Base', 'principal', 'percentage', 'individual', 104),
('IND_VR_MONO', 'VR MONO', 'VR MON', 'Solo VR Mono', 'principal', 'percentage', 'individual', 105),
('IND_VR_CAPTURA', 'VR CAPTURA', 'VR CAP', 'Solo VR Captura', 'principal', 'percentage', 'individual', 106),
('IND_VR_BASE', 'VR BASE', 'VR BAS', 'Solo VR Base', 'principal', 'percentage', 'individual', 107),
('IND_MISS_IN', 'MISS IN', 'MISS', 'Solo Miss In', 'adicional', 'percentage', 'individual', 108),
('IND_PACK_OSS', 'PACK OSS', 'PK OSS', 'Solo Pack OSS', 'adicional', 'percentage', 'individual', 109),
('IND_PACK_VR_BASE', 'PACK VR BASE', 'PK VRB', 'Solo Pack VR Base', 'adicional', 'percentage', 'individual', 110),
('IND_PACK_VR', 'PACK VR', 'PK VR', 'Solo Pack VR Captura', 'adicional', 'percentage', 'individual', 111),
('IND_PACK_OPEN', 'PACK OPEN', 'PK OPN', 'Solo Pack Open (sin línea)', 'adicional', 'percentage', 'individual', 112),
('IND_RENO', 'RENO', 'RENO', 'Solo Renovación', 'adicional', 'percentage', 'individual', 113),
('IND_PREPAGO', 'PREPAGO', 'PP', 'Solo Prepago nuevo', 'adicional', 'percentage', 'individual', 114),
('IND_PORTA_PP', 'PORTA PP', 'PTA PP', 'Solo Portabilidad Prepago', 'adicional', 'percentage', 'individual', 115),
('IND_ACCESORIOS', 'ACCESORIOS', 'ACCS', 'Solo Accesorios', 'adicional', 'percentage', 'individual', 116)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PARTE 8: FUNCIÓN PARA SEED DE MAPEOS PRESET → TIPOS_VENTA
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_preset_ventas() RETURNS void AS $$
DECLARE
    v_preset_id UUID;
    v_tipo_id UUID;
BEGIN
    -- ========================================
    -- AGRUPACIONES COMUNES
    -- ========================================

    -- OSS (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'OSS';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OSS_BASE';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OSS_CAPTURA';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 2) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_OSS';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 3) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- OPP (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'OPP';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OPP_BASE';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OPP_CAPTURA';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 2) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- VR_CAPTURA (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'VR_CAPTURA';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'VR_MONO';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'VR_CAPTURA';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 2) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_VR';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 3) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- VR_BASE_LLAA (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'VR_BASE_LLAA';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'VR_BASE';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_VR_BASE';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 2) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- PACK_SS (agrupación) - cuenta EQUIPO, no línea
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'PACK_SS';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_OSS';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, false, true, 1) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_VR_BASE';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, false, true, 2) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- RENO (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'RENO';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'RENO';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, true, 1) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- PREPAGO (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'PREPAGO';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PREPAGO';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
        END IF;
        
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PORTA_PP';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 2) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- MISS_IN (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'MISS_IN';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'MISS_IN';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- ACCESORIOS (agrupación)
    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'ACCESORIOS';
    IF v_preset_id IS NOT NULL THEN
        SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'ACCESORIOS';
        IF v_tipo_id IS NOT NULL THEN
            INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
            VALUES (v_preset_id, v_tipo_id, false, false, 1) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- ========================================
    -- TIPOS INDIVIDUALES
    -- ========================================

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_OSS_CAPTURA';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OSS_CAPTURA';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_OSS_BASE';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OSS_BASE';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_OPP_CAPTURA';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OPP_CAPTURA';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_OPP_BASE';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'OPP_BASE';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_VR_MONO';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'VR_MONO';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_VR_CAPTURA';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'VR_CAPTURA';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_VR_BASE';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'VR_BASE';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_MISS_IN';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'MISS_IN';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_PACK_OSS';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_OSS';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, true, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_PACK_VR_BASE';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_VR_BASE';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, true, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_PACK_VR';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_VR';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, true, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_PACK_OPEN';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PACK_OPEN';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, false, true, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_RENO';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'RENO';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, true, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_PREPAGO';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PREPAGO';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_PORTA_PP';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'PORTA_PP';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, true, false, 1) ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_preset_id FROM partition_presets WHERE code = 'IND_ACCESORIOS';
    SELECT id INTO v_tipo_id FROM tipos_venta WHERE codigo = 'ACCESORIOS';
    IF v_preset_id IS NOT NULL AND v_tipo_id IS NOT NULL THEN
        INSERT INTO partition_preset_ventas (preset_id, tipo_venta_id, cuenta_linea, cuenta_equipo, display_order) 
        VALUES (v_preset_id, v_tipo_id, false, false, 1) ON CONFLICT DO NOTHING;
    END IF;

END;
$$ LANGUAGE plpgsql;

-- Ejecutar el seed
SELECT seed_preset_ventas();

-- Limpiar función temporal
DROP FUNCTION IF EXISTS seed_preset_ventas();

-- ============================================================================
-- PARTE 9: VISTAS ÚTILES
-- ============================================================================

-- Vista de presets con sus tipos de venta en JSON
CREATE OR REPLACE VIEW vw_partition_presets AS
SELECT 
    pp.id AS preset_id,
    pp.code,
    pp.name,
    pp.short_name,
    pp.description,
    pp.default_category,
    pp.default_calculation_type,
    pp.preset_group,
    pp.display_order,
    pp.is_active,
    COALESCE(
        json_agg(
            json_build_object(
                'tipo_venta_id', tv.id,
                'codigo', tv.codigo,
                'nombre', tv.nombre,
                'categoria', tv.categoria,
                'cuenta_linea', ppv.cuenta_linea,
                'cuenta_equipo', ppv.cuenta_equipo
            ) ORDER BY ppv.display_order
        ) FILTER (WHERE tv.id IS NOT NULL),
        '[]'
    ) AS tipos_venta
FROM partition_presets pp
LEFT JOIN partition_preset_ventas ppv ON pp.id = ppv.preset_id
LEFT JOIN tipos_venta tv ON ppv.tipo_venta_id = tv.id
WHERE pp.is_active = true
GROUP BY pp.id
ORDER BY pp.preset_group, pp.display_order;

-- Vista de partidas de esquema con sus tipos de venta mapeados
CREATE OR REPLACE VIEW vw_scheme_item_ventas AS
SELECT 
    csi.id AS scheme_item_id,
    csi.scheme_id,
    cs.name AS scheme_name,
    cs.year,
    cs.month,
    cs.status AS scheme_status,
    COALESCE(csi.custom_name, cit.name, pp.name) AS item_name,
    csi.custom_name,
    cit.code AS item_type_code,
    pp.code AS preset_code,
    COALESCE(cit.category, pp.default_category) AS category,
    COALESCE(cit.calculation_type, pp.default_calculation_type) AS calculation_type,
    csi.quota,
    csi.weight,
    csi.variable_amount,
    csi.min_fulfillment,
    csi.has_cap,
    csi.is_active,
    csi.display_order,
    COALESCE(
        json_agg(
            json_build_object(
                'tipo_venta_id', tv.id,
                'codigo', tv.codigo,
                'nombre', tv.nombre,
                'cuenta_linea', civ.cuenta_linea,
                'cuenta_equipo', civ.cuenta_equipo
            ) ORDER BY tv.orden
        ) FILTER (WHERE tv.id IS NOT NULL),
        '[]'
    ) AS tipos_venta_mapeados
FROM commission_scheme_items csi
JOIN commission_schemes cs ON csi.scheme_id = cs.id
LEFT JOIN commission_item_types cit ON csi.item_type_id = cit.id
LEFT JOIN partition_presets pp ON csi.preset_id = pp.id
LEFT JOIN commission_item_ventas civ ON csi.id = civ.scheme_item_id
LEFT JOIN tipos_venta tv ON civ.tipo_venta_id = tv.id
GROUP BY csi.id, cs.id, cit.id, pp.id
ORDER BY cs.year DESC, cs.month DESC, csi.display_order;

-- ============================================================================
-- PARTE 10: FUNCIÓN HELPER PARA OBTENER TIPOS DE VENTA DE UNA PARTIDA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_item_tipos_venta(p_scheme_item_id UUID)
RETURNS TABLE (
    tipo_venta_id UUID,
    codigo VARCHAR(20),
    nombre VARCHAR(50),
    categoria VARCHAR(20),
    cuenta_linea BOOLEAN,
    cuenta_equipo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tv.id,
        tv.codigo,
        tv.nombre,
        tv.categoria,
        civ.cuenta_linea,
        civ.cuenta_equipo
    FROM commission_item_ventas civ
    JOIN tipos_venta tv ON civ.tipo_venta_id = tv.id
    WHERE civ.scheme_item_id = p_scheme_item_id
    ORDER BY tv.orden;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 11: FUNCIÓN PARA APLICAR PRESET A UNA PARTIDA
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_preset_to_item(
    p_scheme_item_id UUID,
    p_preset_id UUID
) RETURNS void AS $$
BEGIN
    -- Limpiar mapeos existentes
    DELETE FROM commission_item_ventas WHERE scheme_item_id = p_scheme_item_id;
    
    -- Copiar mapeos del preset
    INSERT INTO commission_item_ventas (scheme_item_id, tipo_venta_id, cuenta_linea, cuenta_equipo)
    SELECT 
        p_scheme_item_id,
        ppv.tipo_venta_id,
        ppv.cuenta_linea,
        ppv.cuenta_equipo
    FROM partition_preset_ventas ppv
    WHERE ppv.preset_id = p_preset_id;
    
    -- Actualizar referencia al preset en la partida
    UPDATE commission_scheme_items 
    SET preset_id = p_preset_id
    WHERE id = p_scheme_item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 12: RLS POLICIES
-- ============================================================================

-- Habilitar RLS
ALTER TABLE partition_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE partition_preset_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_item_ventas ENABLE ROW LEVEL SECURITY;

-- Políticas para partition_presets (lectura para todos los autenticados)
CREATE POLICY "presets_select_all" ON partition_presets
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "presets_modify_admin" ON partition_presets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL')
        )
    );

-- Políticas para partition_preset_ventas (lectura para todos)
CREATE POLICY "preset_ventas_select_all" ON partition_preset_ventas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "preset_ventas_modify_admin" ON partition_preset_ventas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL')
        )
    );

-- Políticas para commission_item_ventas (mismas que commission_scheme_items)
CREATE POLICY "item_ventas_select" ON commission_item_ventas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'JEFE_VENTAS', 'BACKOFFICE_OPERACIONES')
        )
    );

CREATE POLICY "item_ventas_modify" ON commission_item_ventas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES')
        )
    );

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
