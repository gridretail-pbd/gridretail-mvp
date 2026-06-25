-- 025_rrhh_importacion.sql
-- Módulo de Importación Inicial de Colaboradores
-- Dependencia: 024_rrhh_gestion.sql (alertas_rrhh, movimientos_personal)

-- ===========================================
-- 1. NUEVA TABLA: importaciones_rrhh
-- ===========================================

CREATE TABLE importaciones_rrhh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_nombre VARCHAR(255) NOT NULL,
  archivo_url TEXT NOT NULL,
  archivo_tamano_bytes INTEGER,
  archivo_tipo VARCHAR(50),
  hoja_procesada VARCHAR(100),
  fila_encabezados INTEGER,
  total_filas_datos INTEGER NOT NULL,
  mapeo_columnas JSONB NOT NULL DEFAULT '{}',
  mapeo_ai_task_id UUID REFERENCES ai_tasks(id),
  mapeo_confianza_promedio DECIMAL(5,2),
  estado VARCHAR(30) NOT NULL DEFAULT 'EN_PROCESO',
  -- EN_PROCESO, ANALIZADO, MAPEADO, VALIDADO, IMPORTADO, ERROR, CANCELADO
  total_validos INTEGER DEFAULT 0,
  total_warnings INTEGER DEFAULT 0,
  total_errores INTEGER DEFAULT 0,
  total_importados INTEGER DEFAULT 0,
  total_actualizados INTEGER DEFAULT 0,
  total_saltados INTEGER DEFAULT 0,
  total_activos_importados INTEGER DEFAULT 0,
  total_cesados_importados INTEGER DEFAULT 0,
  reporte_brechas JSONB,
  reporte_brechas_url TEXT,
  completitud_promedio DECIMAL(5,2),
  total_alertas_generadas INTEGER DEFAULT 0,
  alerta_resumen_id UUID REFERENCES alertas_rrhh(id),
  detalle_filas JSONB,
  ejecutado_por UUID REFERENCES usuarios(id),
  fecha_ejecucion TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER set_importaciones_rrhh_updated_at
  BEFORE UPDATE ON importaciones_rrhh
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_importaciones_rrhh_estado ON importaciones_rrhh(estado);
CREATE INDEX idx_importaciones_rrhh_fecha ON importaciones_rrhh(created_at DESC);

ALTER TABLE importaciones_rrhh ENABLE ROW LEVEL SECURITY;

CREATE POLICY importaciones_rrhh_select ON importaciones_rrhh
  FOR SELECT USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid())
    IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY importaciones_rrhh_all ON importaciones_rrhh
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid())
    IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 2. ALTER: alertas_rrhh — agregar fecha_limite
-- ===========================================

ALTER TABLE alertas_rrhh ADD COLUMN IF NOT EXISTS fecha_limite DATE;

CREATE INDEX IF NOT EXISTS idx_alertas_rrhh_fecha_limite
  ON alertas_rrhh(fecha_limite)
  WHERE fecha_limite IS NOT NULL AND estado = 'PENDIENTE';

COMMENT ON COLUMN alertas_rrhh.fecha_limite IS
  'Fecha límite para actuar. Permite priorizar alertas por urgencia en dashboard.';

-- ===========================================
-- 3. CONFIG: prefijo código asesor del tenant
-- ===========================================

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES ('TENANT_CODIGO_ASESOR_PREFIX', 'PBD',
        'Prefijo para códigos de asesor autogenerados (ej: PBD, CLR, MOV)',
        false, 'tenant')
ON CONFLICT (key) DO NOTHING;
