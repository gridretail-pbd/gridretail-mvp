-- ============================================================================
-- Migración 010: Campo variable_source para partidas
-- Permite distinguir si el variable de una partida Adicional viene del Mix o es extra
-- ============================================================================

-- Agregar campo variable_source a commission_scheme_items
ALTER TABLE commission_scheme_items
ADD COLUMN IF NOT EXISTS variable_source VARCHAR(20) DEFAULT 'FROM_MIX';

-- Agregar constraint CHECK
ALTER TABLE commission_scheme_items
ADD CONSTRAINT chk_variable_source
CHECK (variable_source IN ('FROM_MIX', 'FIXED_EXTRA'));

-- Comentario
COMMENT ON COLUMN commission_scheme_items.variable_source IS
'Fuente del monto variable: FROM_MIX = parte del variable teórico (contribuye al 100% mix), FIXED_EXTRA = monto adicional (no cuenta en mix)';
