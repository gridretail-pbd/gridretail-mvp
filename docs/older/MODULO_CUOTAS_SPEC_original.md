# Módulo de Cuotas - Especificación Completa
## GridRetail - Gestión de Cuotas Comerciales

**Versión:** 1.0  
**Fecha:** 2026-01-26  
**Para:** Claude Code - Desarrollo Full Stack  

---

## 1. RESUMEN EJECUTIVO

El Módulo de Cuotas gestiona el ciclo completo de las metas comerciales mensuales:
1. **Importar** cuotas por tienda desde Excel de Entel
2. **Distribuir** cuotas de tienda a asesores individuales
3. **Aprobar** la distribución de cuotas
4. **Consultar** estado de cuotas vigentes

### Flujo General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE CUOTAS MENSUAL                             │
└─────────────────────────────────────────────────────────────────────────────┘

     ENTEL                    ANALISTA                 JV/GERENTE
       │                         │                         │
       ▼                         │                         │
  ┌─────────┐                    │                         │
  │ Excel   │                    │                         │
  │ Cuotas  │                    │                         │
  └────┬────┘                    │                         │
       │                         ▼                         │
       │              ┌──────────────────┐                 │
       └─────────────►│ 1. IMPORTAR      │                 │
                      │    Cuotas TEX    │                 │
                      └────────┬─────────┘                 │
                               │                           │
                               ▼                           │
                      ┌──────────────────┐                 │
                      │ 2. DISTRIBUIR    │                 │
                      │    a Asesores    │◄────────────────┤ Puede ajustar
                      └────────┬─────────┘                 │
                               │                           │
                               ▼                           ▼
                      ┌──────────────────┐        ┌──────────────────┐
                      │ 3. ENVIAR A      │───────►│ 4. APROBAR       │
                      │    APROBACIÓN    │        │    Cuotas        │
                      └──────────────────┘        └────────┬─────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │ 5. CUOTAS        │
                                                  │    VIGENTES      │
                                                  └──────────────────┘
```

---

## 2. MODELO DE DATOS

### 2.1 Nuevas Tablas

```sql
-- ============================================================================
-- TABLA: quota_imports
-- Historial de importaciones de archivos de cuotas
-- ============================================================================
CREATE TABLE quota_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- Estadísticas de importación
    total_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    errors JSONB,
    
    -- AI interpretation
    ai_interpretation_log JSONB,
    column_mapping JSONB,          -- Mapeo de columnas detectado
    
    -- Estado y auditoría
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    imported_by UUID REFERENCES usuarios(id),
    imported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (year, month, file_name)
);

-- ============================================================================
-- TABLA: store_quotas
-- Cuotas mensuales por tienda (importadas de Entel)
-- ============================================================================
CREATE TABLE store_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES tiendas(id),
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- Cuota SS total de la tienda
    ss_quota INTEGER NOT NULL CHECK (ss_quota >= 0),
    
    -- Desglose por partida (JSONB flexible para variabilidad mensual)
    quota_breakdown JSONB NOT NULL DEFAULT '{}',
    /*
    Ejemplo quota_breakdown:
    {
        "VR": 75,
        "VR_CAPTURA": 30,
        "VR_BASE": 45,
        "OSS": 68,
        "OSS_CAPTURA": 54,
        "OSS_BASE": 14,
        "OPP": 8,
        "OPP_CAPTURA": 0,
        "OPP_BASE": 8,
        "PACKS": 15,
        "RENO": 54,
        "PREPAGO": 111,
        "MISS_IN": 10,
        "ACCESORIOS": 2155
    }
    */
    
    -- Origen y referencia
    source VARCHAR(20) NOT NULL DEFAULT 'entel'
        CHECK (source IN ('entel', 'manual')),
    import_id UUID REFERENCES quota_imports(id),
    original_store_name VARCHAR(200),   -- Nombre en el Excel (para matching)
    
    -- Estado y aprobación
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
    approved_by UUID REFERENCES usuarios(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Auditoría
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (store_id, year, month)
);

-- ============================================================================
-- TABLA: hc_quotas
-- Cuotas individuales por HC (distribuidas desde store_quotas)
-- ============================================================================
CREATE TABLE hc_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id),
    store_quota_id UUID NOT NULL REFERENCES store_quotas(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES tiendas(id),
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- Cuota SS asignada al HC
    ss_quota INTEGER NOT NULL CHECK (ss_quota >= 0),
    
    -- Desglose por partida (calculado desde store_quota usando ratios)
    quota_breakdown JSONB NOT NULL DEFAULT '{}',
    
    -- Prorrateo por ingreso tardío
    start_date DATE,                    -- NULL = desde día 1
    proration_factor DECIMAL(5,4) DEFAULT 1.0000,  -- 1.0 = mes completo
    prorated_ss_quota DECIMAL(10,2),    -- Cuota ajustada por prorrateo
    
    -- Estado
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
    
    -- Quién distribuyó y aprobó
    distributed_by UUID REFERENCES usuarios(id),
    distributed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES usuarios(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, year, month)
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================
CREATE INDEX idx_quota_imports_period ON quota_imports(year, month);
CREATE INDEX idx_quota_imports_status ON quota_imports(status);

CREATE INDEX idx_store_quotas_store ON store_quotas(store_id);
CREATE INDEX idx_store_quotas_period ON store_quotas(year, month);
CREATE INDEX idx_store_quotas_status ON store_quotas(status);

CREATE INDEX idx_hc_quotas_user ON hc_quotas(user_id);
CREATE INDEX idx_hc_quotas_store ON hc_quotas(store_id);
CREATE INDEX idx_hc_quotas_period ON hc_quotas(year, month);
CREATE INDEX idx_hc_quotas_status ON hc_quotas(status);
CREATE INDEX idx_hc_quotas_store_quota ON hc_quotas(store_quota_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER set_updated_at_store_quotas
    BEFORE UPDATE ON store_quotas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_hc_quotas
    BEFORE UPDATE ON hc_quotas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

### 2.2 Relación con Tablas Existentes

```
┌─────────────────────┐
│   quota_imports     │
│   (importaciones)   │
└─────────┬───────────┘
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│   store_quotas      │────►│      tiendas        │
│   (cuotas TEX)      │     │   (21 tiendas)      │
└─────────┬───────────┘     └─────────────────────┘
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│    hc_quotas        │────►│      usuarios       │
│   (cuotas HC)       │     │   (asesores)        │
└─────────────────────┘     └─────────────────────┘
          │
          │ Referencia lógica (user_id + year + month)
          ▼
┌─────────────────────┐
│commission_hc_assign │  ← El simulador usa hc_quotas.ss_quota
│   ments             │    como override de la cuota del esquema
└─────────────────────┘
```

### 2.3 Vista Consolidada

```sql
-- Vista: Cuotas vigentes con detalles
CREATE OR REPLACE VIEW vw_quotas_vigentes AS
SELECT 
    hq.id AS hc_quota_id,
    hq.user_id,
    u.codigo_asesor,
    u.nombre_completo,
    u.rol,
    u.zona,
    hq.store_id,
    t.codigo AS store_code,
    t.nombre AS store_name,
    hq.year,
    hq.month,
    hq.ss_quota AS hc_ss_quota,
    hq.prorated_ss_quota,
    hq.proration_factor,
    hq.start_date,
    hq.quota_breakdown AS hc_quota_breakdown,
    sq.ss_quota AS store_ss_quota,
    sq.quota_breakdown AS store_quota_breakdown,
    sq.status AS store_quota_status,
    hq.status AS hc_quota_status,
    -- Calcular % de la cuota de tienda
    ROUND(hq.ss_quota::numeric / NULLIF(sq.ss_quota, 0) * 100, 1) AS pct_of_store
FROM hc_quotas hq
JOIN usuarios u ON hq.user_id = u.id
JOIN tiendas t ON hq.store_id = t.id
JOIN store_quotas sq ON hq.store_quota_id = sq.id
WHERE hq.status = 'approved'
ORDER BY t.nombre, u.nombre_completo;
```

---

## 3. FLUJOS DE USUARIO

### 3.1 Analista / Backoffice Operaciones

#### Flujo A: Importar Cuotas de Entel

```
1. Navegar a Cuotas > Importar
2. Seleccionar período (Año/Mes)
3. Subir archivo Excel de Entel
4. Sistema procesa con AI:
   - Detecta estructura del archivo
   - Mapea columnas a campos conocidos
   - Identifica tiendas por nombre
   - Extrae cuotas por partida
5. Ver preview de importación:
   - Tiendas reconocidas vs no reconocidas
   - Cuotas detectadas por partida
   - Advertencias de AI
6. Confirmar importación
7. Sistema crea store_quotas en estado 'draft'
```

#### Flujo B: Distribuir Cuotas a Asesores

```
1. Navegar a Cuotas > Distribución
2. Seleccionar período con cuotas importadas
3. Seleccionar tienda
4. Ver:
   - Cuota total de la tienda: 151 SS
   - Asesores asignados: 3
   - Propuesta equitativa: 50.3 SS c/u
5. Ajustar distribución si es necesario:
   - Juan: 60 SS
   - María: 55 SS  
   - Pedro: 36 SS (nuevo, cuota reducida)
   - Total: 151 SS ✓
6. Opcional: Marcar asesor con fecha de inicio tardía
   - Pedro inició el 15/01 → proration_factor = 0.5
7. Guardar distribución (estado 'draft')
8. Repetir para cada tienda
9. Enviar todas a aprobación
```

#### Flujo C: Distribución Masiva

```
1. Navegar a Cuotas > Distribución Masiva
2. Seleccionar período
3. Sistema propone distribución equitativa para todas las tiendas
4. Ver tabla resumen:
   | Tienda      | Cuota | Asesores | Cuota/Asesor |
   |-------------|-------|----------|--------------|
   | TE HIGUERETA| 151   | 3        | 50.3         |
   | TE HUANDOY  | 174   | 2        | 87           |
   | ...         | ...   | ...      | ...          |
5. Marcar tiendas que requieren ajuste manual
6. Aplicar distribución equitativa a las demás
7. Enviar a aprobación
```

### 3.2 Jefe de Ventas

#### Flujo: Ajustar Distribución de su Zona

```
1. Navegar a Cuotas > Mi Zona
2. Ver tiendas de su zona con distribución propuesta
3. Seleccionar tienda para ajustar
4. Modificar cuotas individuales
5. Guardar cambios (mantiene estado 'pending_approval')
6. Nota: No puede aprobar, solo ajustar
```

### 3.3 Gerente Comercial

#### Flujo: Aprobar Cuotas

```
1. Navegar a Cuotas > Pendientes de Aprobación
2. Ver resumen por tienda:
   - Cuota Entel vs Cuota distribuida
   - Diferencias o alertas
3. Revisar detalle por tienda si es necesario
4. Aprobar individual o masivamente
5. Sistema cambia estado a 'approved'
6. Cuotas quedan vigentes para el mes
```

### 3.4 Asesor / Supervisor (Solo Consulta)

#### Flujo: Ver Mi Cuota

```
1. Navegar a Mi Comisión (dashboard)
2. Ver widget "Mi Cuota del Mes":
   - Cuota SS: 50 líneas
   - Desglose: OSS 22, VR 25, OPP 3
3. Nota: No puede modificar, solo consultar
```

---

## 4. PANTALLAS Y WIREFRAMES

### 4.1 Importador de Cuotas (`/cuotas/importar`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Importar Cuotas de Entel                                      [? Ayuda]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PASO 1: Seleccionar Período                                         │   │
│  │                                                                     │   │
│  │ Año: [2026 ▼]    Mes: [Enero ▼]                                    │   │
│  │                                                                     │   │
│  │ ⚠️ Ya existe una importación para este período (draft)              │   │
│  │    [ ] Reemplazar importación existente                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PASO 2: Subir Archivo                                               │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                                                             │   │   │
│  │  │     📁 Arrastra el archivo Excel aquí                       │   │   │
│  │  │        o haz clic para seleccionar                          │   │   │
│  │  │                                                             │   │   │
│  │  │     Formatos: .xlsx, .xls                                   │   │   │
│  │  │                                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  Archivo: Cuota_TEX_SS_PP_y_Packs_Ene-26_PBD.xlsx                  │   │
│  │  Tamaño: 45 KB                                                      │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                                    [Procesar con AI →]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Preview de Importación (Post-AI)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Preview de Importación - Enero 2026                           [← Volver]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ INTERPRETACIÓN AI                                      Confianza: 95%│   │
│  │                                                                     │   │
│  │ ✓ Hoja detectada: "PBD"                                            │   │
│  │ ✓ 21 tiendas reconocidas de 23 filas                               │   │
│  │ ⚠️ 2 filas ignoradas (vacías o totales)                             │   │
│  │ ✓ 15 columnas de cuota mapeadas                                     │   │
│  │                                                                     │   │
│  │ [Ver mapeo de columnas ▼]                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CUOTAS DETECTADAS                                                   │   │
│  │                                                                     │   │
│  │  Tienda              │ SS  │ VR │OSS │OPP│PACK│RENO│PP  │ Match    │   │
│  │ ─────────────────────┼─────┼────┼────┼───┼────┼────┼────┼────────  │   │
│  │  TE HIGUERETA        │ 151 │ 75 │ 68 │ 8 │ 15 │ 54 │111 │ ✓ Auto   │   │
│  │  TE HUANDOY          │ 174 │ 87 │ 78 │ 9 │ 17 │ 47 │ 90 │ ✓ Auto   │   │
│  │  TE LIMA SJM         │ 235 │117 │106 │12 │ 24 │ 53 │119 │ ✓ Auto   │   │
│  │  TE NARANJAL         │ 180 │ 90 │ 81 │ 9 │ 18 │ 58 │ 94 │ ✓ Auto   │   │
│  │  TIENDA EXPRES LIMA  │ 193 │ 96 │ 87 │10 │ 19 │ 33 │ 26 │ ⚠️ Manual │   │
│  │  ...                 │ ... │... │... │...│ ...│ ...│... │ ...      │   │
│  │ ─────────────────────┼─────┼────┼────┼───┼────┼────┼────┼────────  │   │
│  │  TOTAL SSNN          │2713 │1341│1231│141│ 272│ 713│1399│          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIENDAS NO RECONOCIDAS (requieren match manual)                     │   │
│  │                                                                     │   │
│  │  "TIENDA EXPRES LIMA PBD" → [Seleccionar tienda ▼]                 │   │
│  │                              TE LIMA SJM                            │   │
│  │                              TE AGUSTINO                            │   │
│  │                              (crear nueva)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Cancelar]                                         [Confirmar Importación] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Distribución de Cuotas (`/cuotas/distribucion`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Distribución de Cuotas - Enero 2026                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Período: [Enero 2026 ▼]     Estado: 🟡 En distribución (15/21 tiendas)    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ RESUMEN POR TIENDA                                    [Expandir todo]│   │
│  │                                                                     │   │
│  │  Tienda          │Cuota TEX│Asesores│Distribuido│Estado    │Acción │   │
│  │ ─────────────────┼─────────┼────────┼───────────┼──────────┼─────  │   │
│  │ ▶ TE HIGUERETA   │   151   │   3    │  151 ✓    │✅ Listo   │[Ver]  │   │
│  │ ▶ TE HUANDOY     │   174   │   2    │  174 ✓    │✅ Listo   │[Ver]  │   │
│  │ ▼ TE LIMA SJM    │   235   │   4    │  235 ✓    │✅ Listo   │[Edit] │   │
│  │   ├─ Juan Pérez  │         │        │   60      │          │       │   │
│  │   ├─ María López │         │        │   60      │          │       │   │
│  │   ├─ Carlos Ruiz │         │        │   60      │          │       │   │
│  │   └─ Ana Torres  │         │        │   55      │          │       │   │
│  │ ▶ TE NARANJAL    │   180   │   2    │  180 ✓    │✅ Listo   │[Ver]  │   │
│  │ ▶ TE PACHACUTEC  │   160   │   0    │    0 ⚠️   │❌ Sin HC  │[—]    │   │
│  │ ▶ TE PBD CHIMU   │   155   │   2    │    0      │🔴 Pendiente│[Dist]│   │
│  │ ...              │   ...   │  ...   │   ...     │  ...     │       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Distribución Masiva]              [Enviar a Aprobación (15 tiendas)]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Editor de Distribución por Tienda (Modal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Distribuir Cuota - TE LIMA SJM                                    [✕]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Cuota de Tienda: 235 SS                                                    │
│  Asesores activos: 4                                                        │
│  Propuesta equitativa: 58.75 SS/asesor                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ DISTRIBUCIÓN                                                        │   │
│  │                                                                     │   │
│  │  Asesor           │ Cuota SS │ Inicio  │ Factor │ Cuota Prorrat.   │   │
│  │ ──────────────────┼──────────┼─────────┼────────┼────────────────  │   │
│  │  Juan Pérez       │ [__60__] │ 01/01   │ 1.00   │ 60.0             │   │
│  │  María López      │ [__60__] │ 01/01   │ 1.00   │ 60.0             │   │
│  │  Carlos Ruiz      │ [__60__] │ 01/01   │ 1.00   │ 60.0             │   │
│  │  Ana Torres       │ [__55__] │ [15/01] │ 0.55   │ 30.3             │   │
│  │ ──────────────────┼──────────┼─────────┼────────┼────────────────  │   │
│  │  TOTAL            │   235    │         │        │ 210.3            │   │
│  │                   │   ✓ OK   │         │        │                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⚠️ Ana Torres inició el 15/01. Su cuota se prorratea a 55% del mes.       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ DESGLOSE POR PARTIDA (automático según ratios de tienda)            │   │
│  │                                                                     │   │
│  │  Partida    │ Ratio │ Juan │ María │ Carlos │ Ana (prorrat.)       │   │
│  │ ────────────┼───────┼──────┼───────┼────────┼──────────────────    │   │
│  │  VR         │ 49.8% │  30  │   30  │   30   │   27 (15)            │   │
│  │  OSS        │ 45.1% │  27  │   27  │   27   │   25 (14)            │   │
│  │  OPP        │  5.1% │   3  │    3  │    3   │    3 (2)             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Cancelar]            [Distribuir Equitativo]       [Guardar Distribución] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Aprobación de Cuotas (`/cuotas/aprobacion`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Aprobar Cuotas - Enero 2026                                    [? Ayuda]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pendientes de aprobación: 21 tiendas                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ RESUMEN                                                             │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Cuota SSNN   │  │ Distribuida  │  │ Diferencia   │              │   │
│  │  │    2,713     │  │    2,713     │  │     0 ✓      │              │   │
│  │  │      SS      │  │      SS      │  │              │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  ✅ 21 tiendas con distribución completa                            │   │
│  │  ⚠️ 3 asesores con fecha de inicio tardía (cuota prorrateada)       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ DETALLE POR TIENDA                              [☐] Seleccionar todo│   │
│  │                                                                     │   │
│  │  [☐]│ Tienda        │Cuota│Asesores│Distribuido│Alertas   │Acción │   │
│  │ ────┼───────────────┼─────┼────────┼───────────┼──────────┼─────  │   │
│  │  [☑]│ TE HIGUERETA  │ 151 │   3    │    151    │    —     │[Ver]  │   │
│  │  [☑]│ TE HUANDOY    │ 174 │   2    │    174    │    —     │[Ver]  │   │
│  │  [☑]│ TE LIMA SJM   │ 235 │   4    │    235    │ 1 prorrat│[Ver]  │   │
│  │  [☑]│ TE NARANJAL   │ 180 │   2    │    180    │    —     │[Ver]  │   │
│  │  ...│ ...           │ ... │  ...   │    ...    │   ...    │       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Notas de aprobación (opcional):                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Aprobado según distribución propuesta por JV.                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Rechazar Seleccionadas]                        [Aprobar Seleccionadas]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Dashboard de Cuotas (`/cuotas`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Gestión de Cuotas                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Período: [Enero 2026 ▼]                                                    │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ CUOTA SSNN      │  │ TIENDAS         │  │ HC ASIGNADOS    │             │
│  │                 │  │                 │  │                 │             │
│  │    2,713 SS     │  │   21 / 21       │  │   48 / 52       │             │
│  │                 │  │   100% ✓        │  │   92%           │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ESTADO DEL PERÍODO                                                  │   │
│  │                                                                     │   │
│  │  ✅ Cuotas importadas (21 tiendas)                    15 Ene 2026  │   │
│  │  ✅ Distribución completada                           18 Ene 2026  │   │
│  │  ✅ Cuotas aprobadas                                  19 Ene 2026  │   │
│  │                                                                     │   │
│  │  Estado actual: CUOTAS VIGENTES                                     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ACCIONES RÁPIDAS                                                           │
│                                                                             │
│  [📥 Importar Cuotas]  [📊 Ver Distribución]  [📋 Exportar Resumen]       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ HISTÓRICO DE PERÍODOS                                               │   │
│  │                                                                     │   │
│  │  Período    │ Cuota SSNN │ Tiendas │ Estado     │ Acción           │   │
│  │ ────────────┼────────────┼─────────┼────────────┼────────────────  │   │
│  │  Ene 2026   │   2,713    │   21    │ ✅ Vigente  │ [Ver]            │   │
│  │  Dic 2025   │   2,580    │   21    │ 📁 Archivado│ [Ver]            │   │
│  │  Nov 2025   │   2,650    │   20    │ 📁 Archivado│ [Ver]            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. INTEGRACIÓN CON OTROS MÓDULOS

### 5.1 Integración con Simulador de Ingresos

El Simulador debe usar la cuota del HC desde `hc_quotas`:

```typescript
// Al cargar datos para simulación de un HC específico
async function loadHCQuotaForSimulation(userId: string, year: number, month: number) {
  const { data: hcQuota } = await supabase
    .from('hc_quotas')
    .select(`
      ss_quota,
      prorated_ss_quota,
      proration_factor,
      quota_breakdown,
      store_quota:store_quotas(ss_quota, quota_breakdown)
    `)
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'approved')
    .single();

  return {
    // Usar cuota prorrateada si existe, sino la cuota normal
    effectiveQuota: hcQuota.prorated_ss_quota || hcQuota.ss_quota,
    quotaBreakdown: hcQuota.quota_breakdown,
    prorationFactor: hcQuota.proration_factor,
    storeQuota: hcQuota.store_quota.ss_quota
  };
}
```

### 5.2 Integración con Editor de Esquemas

El esquema define el **variable máximo** y los **ratios/mix** por partida.
La cuota define la **meta en unidades** para cada HC.

```
ESQUEMA (commission_schemes)           HC_QUOTA (hc_quotas)
─────────────────────────────         ─────────────────────
variable_salary: S/. 1,025            ss_quota: 50
default_min_fulfillment: 50%          quota_breakdown: {
                                        "OSS": 22,
PARTIDA OSS:                            "VR": 25,
  weight: 27%                           "OPP": 3
  variable_amount: S/. 277              ...
                                      }
                                      proration_factor: 1.0

                    ▼ CÁLCULO ▼

Meta OSS del HC = 22 unidades
Si vende 22 → cumplimiento = 100%
Comisión OSS = S/. 277 × 100% = S/. 277

(El variable NO se ajusta por cuota menor,
 solo por prorrateo de días trabajados)
```

### 5.3 Integración con Calculador de Comisiones

```sql
-- Al calcular comisiones, usar la cuota del HC
SELECT 
    u.id AS user_id,
    hq.ss_quota,
    hq.proration_factor,
    hq.quota_breakdown,
    cs.variable_salary,
    -- Si hay prorrateo, ajustar el variable
    CASE 
        WHEN hq.proration_factor < 1.0 
        THEN cs.variable_salary * hq.proration_factor
        ELSE cs.variable_salary
    END AS effective_variable
FROM usuarios u
JOIN hc_quotas hq ON u.id = hq.user_id
JOIN commission_hc_assignments cha ON u.id = cha.user_id
JOIN commission_schemes cs ON cha.scheme_id = cs.id
WHERE hq.year = 2026 AND hq.month = 1
AND hq.status = 'approved';
```

---

## 6. IMPORTADOR AI DE CUOTAS

### 6.1 Objetivo

Manejar la **variabilidad mensual** en los archivos Excel de Entel:
- Columnas pueden cambiar de nombre
- Nuevas partidas pueden aparecer (ej: OSS_CAPTURA antes no existía)
- Nombres de tiendas pueden variar ligeramente

### 6.2 Flujo del Importador AI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUJO IMPORTADOR AI                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Usuario sube Excel
           │
           ▼
    ┌──────────────┐
    │ 1. PARSEAR   │ → Leer hojas, detectar estructura
    │    EXCEL     │ → Identificar fila de headers
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ 2. LLAMAR    │ → Enviar headers + muestra de datos
    │    CLAUDE    │ → Prompt: "Mapea estas columnas..."
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐     Columnas detectadas:
    │ 3. MAPEAR    │ →   "SS" → ss_quota
    │    COLUMNAS  │     "PDVS" → store_name
    └──────┬───────┘     "VR CAPTURA" → quota_breakdown.VR_CAPTURA
           │
           ▼
    ┌──────────────┐
    │ 4. MATCH     │ → "TE HIGUERETA" → tienda.id = xxx
    │    TIENDAS   │ → "TIENDA EXPRES LIMA" → ¿manual?
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ 5. PREVIEW   │ → Mostrar al usuario para confirmar
    │              │ → Permitir correcciones manuales
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ 6. GUARDAR   │ → Crear store_quotas
    │              │ → Guardar log de interpretación
    └──────────────┘
```

### 6.3 Prompt para Claude API

```typescript
const prompt = `
Eres un asistente que interpreta archivos Excel de cuotas comerciales.

CONTEXTO:
- El archivo contiene cuotas mensuales por tienda para un socio de Entel Perú
- Cada fila es una tienda, cada columna es una métrica de cuota
- Los nombres de columnas pueden variar mes a mes

COLUMNAS DEL ARCHIVO:
${headers.join(', ')}

MUESTRA DE DATOS (primeras 3 filas):
${sampleRows.map(r => JSON.stringify(r)).join('\n')}

COLUMNAS CONOCIDAS A MAPEAR:
- store_name: Nombre de la tienda/PDV
- ss_quota: Cuota total de líneas postpago (SS)
- Partidas de cuota: VR, VR_CAPTURA, VR_BASE, OSS, OSS_CAPTURA, OSS_BASE, 
  OPP, OPP_CAPTURA, OPP_BASE, PACKS, RENO, PREPAGO, MISS_IN, ACCESORIOS

RESPONDE EN JSON:
{
  "column_mapping": {
    "PDVS": "store_name",
    "SS": "ss_quota",
    "VR": "quota_breakdown.VR",
    "VR CAPTURA": "quota_breakdown.VR_CAPTURA",
    ...
  },
  "ignored_columns": ["SOCIO", "ESTADO", "KAM - TEX", ...],
  "confidence": 0.95,
  "warnings": ["La columna 'ATTACH LLAA RENO' no tiene mapeo estándar"]
}
`;
```

### 6.4 Matching de Tiendas

```typescript
// Estrategia de matching de nombres de tienda
function matchStoreName(excelName: string, stores: Store[]): MatchResult {
  // 1. Match exacto
  const exact = stores.find(s => 
    s.nombre.toUpperCase() === excelName.toUpperCase()
  );
  if (exact) return { store: exact, confidence: 1.0, method: 'exact' };

  // 2. Match por código
  const byCode = stores.find(s => 
    excelName.toUpperCase().includes(s.codigo.replace('TE_', 'TE '))
  );
  if (byCode) return { store: byCode, confidence: 0.9, method: 'code' };

  // 3. Match por similitud (Levenshtein)
  const similarities = stores.map(s => ({
    store: s,
    similarity: levenshteinSimilarity(excelName, s.nombre)
  }));
  const best = similarities.sort((a, b) => b.similarity - a.similarity)[0];
  
  if (best.similarity > 0.7) {
    return { store: best.store, confidence: best.similarity, method: 'fuzzy' };
  }

  // 4. No match → requiere intervención manual
  return { store: null, confidence: 0, method: 'manual_required' };
}
```

---

## 7. API Y TIPOS TYPESCRIPT

### 7.1 Tipos

```typescript
// types/quotas.ts

interface QuotaImport {
  id: string;
  file_name: string;
  file_url?: string;
  year: number;
  month: number;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  errors?: Record<string, any>;
  ai_interpretation_log?: AIInterpretationLog;
  column_mapping?: ColumnMapping;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imported_by?: string;
  imported_at?: string;
  created_at: string;
}

interface AIInterpretationLog {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  confidence: number;
  warnings: string[];
  raw_response?: string;
}

interface ColumnMapping {
  [excelColumn: string]: string; // "PDVS" → "store_name"
}

interface StoreQuota {
  id: string;
  store_id: string;
  year: number;
  month: number;
  ss_quota: number;
  quota_breakdown: QuotaBreakdown;
  source: 'entel' | 'manual';
  import_id?: string;
  original_store_name?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'archived';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  // Joins
  store?: Store;
}

interface QuotaBreakdown {
  VR?: number;
  VR_CAPTURA?: number;
  VR_BASE?: number;
  OSS?: number;
  OSS_CAPTURA?: number;
  OSS_BASE?: number;
  OPP?: number;
  OPP_CAPTURA?: number;
  OPP_BASE?: number;
  PACKS?: number;
  RENO?: number;
  PREPAGO?: number;
  MISS_IN?: number;
  ACCESORIOS?: number;
  [key: string]: number | undefined; // Para nuevas partidas
}

interface HCQuota {
  id: string;
  user_id: string;
  store_quota_id: string;
  store_id: string;
  year: number;
  month: number;
  ss_quota: number;
  quota_breakdown: QuotaBreakdown;
  start_date?: string;
  proration_factor: number;
  prorated_ss_quota?: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'archived';
  distributed_by?: string;
  distributed_at?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joins
  user?: User;
  store?: Store;
  store_quota?: StoreQuota;
}

interface QuotaDistributionInput {
  store_quota_id: string;
  distributions: {
    user_id: string;
    ss_quota: number;
    start_date?: string; // Para prorrateo
  }[];
}
```

### 7.2 Hooks

```typescript
// hooks/useQuotas.ts

export function useStoreQuotas(year: number, month: number) {
  return useQuery({
    queryKey: ['store-quotas', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_quotas')
        .select(`
          *,
          store:tiendas(*),
          hc_quotas(count)
        `)
        .eq('year', year)
        .eq('month', month)
        .order('store(nombre)');
      
      if (error) throw error;
      return data;
    }
  });
}

export function useHCQuotas(storeId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['hc-quotas', storeId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hc_quotas')
        .select(`
          *,
          user:usuarios(id, codigo_asesor, nombre_completo, rol, zona)
        `)
        .eq('store_id', storeId)
        .eq('year', year)
        .eq('month', month)
        .order('user(nombre_completo)');
      
      if (error) throw error;
      return data;
    }
  });
}

export function useDistributeQuotas() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: QuotaDistributionInput) => {
      const { data, error } = await supabase
        .rpc('distribute_store_quota', {
          p_store_quota_id: input.store_quota_id,
          p_distributions: input.distributions
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hc-quotas'] });
      queryClient.invalidateQueries({ queryKey: ['store-quotas'] });
    }
  });
}
```

### 7.3 Función de Distribución (PostgreSQL)

```sql
CREATE OR REPLACE FUNCTION distribute_store_quota(
    p_store_quota_id UUID,
    p_distributions JSONB
) RETURNS void AS $$
DECLARE
    v_store_quota store_quotas%ROWTYPE;
    v_dist JSONB;
    v_total_distributed INTEGER := 0;
    v_user_id UUID;
    v_ss_quota INTEGER;
    v_start_date DATE;
    v_proration DECIMAL(5,4);
    v_days_in_month INTEGER;
    v_days_worked INTEGER;
BEGIN
    -- Obtener cuota de tienda
    SELECT * INTO v_store_quota 
    FROM store_quotas 
    WHERE id = p_store_quota_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Store quota not found: %', p_store_quota_id;
    END IF;
    
    -- Calcular días del mes
    v_days_in_month := EXTRACT(DAY FROM 
        (DATE_TRUNC('month', MAKE_DATE(v_store_quota.year, v_store_quota.month, 1)) 
         + INTERVAL '1 month' - INTERVAL '1 day')
    );
    
    -- Eliminar distribuciones previas (draft)
    DELETE FROM hc_quotas 
    WHERE store_quota_id = p_store_quota_id 
    AND status = 'draft';
    
    -- Procesar cada distribución
    FOR v_dist IN SELECT * FROM jsonb_array_elements(p_distributions)
    LOOP
        v_user_id := (v_dist->>'user_id')::UUID;
        v_ss_quota := (v_dist->>'ss_quota')::INTEGER;
        v_start_date := (v_dist->>'start_date')::DATE;
        
        -- Calcular prorrateo si hay fecha de inicio
        IF v_start_date IS NOT NULL AND v_start_date > MAKE_DATE(v_store_quota.year, v_store_quota.month, 1) THEN
            v_days_worked := v_days_in_month - EXTRACT(DAY FROM v_start_date) + 1;
            v_proration := v_days_worked::DECIMAL / v_days_in_month;
        ELSE
            v_start_date := NULL;
            v_proration := 1.0;
        END IF;
        
        -- Insertar cuota del HC
        INSERT INTO hc_quotas (
            user_id, store_quota_id, store_id, year, month,
            ss_quota, quota_breakdown,
            start_date, proration_factor, prorated_ss_quota,
            status, distributed_by, distributed_at
        ) VALUES (
            v_user_id, p_store_quota_id, v_store_quota.store_id,
            v_store_quota.year, v_store_quota.month,
            v_ss_quota, 
            calculate_quota_breakdown(v_store_quota.quota_breakdown, v_ss_quota, v_store_quota.ss_quota),
            v_start_date, v_proration, 
            CASE WHEN v_proration < 1.0 THEN ROUND(v_ss_quota * v_proration, 2) ELSE NULL END,
            'draft', auth.uid(), NOW()
        );
        
        v_total_distributed := v_total_distributed + v_ss_quota;
    END LOOP;
    
    -- Validar que la suma sea correcta (advertencia, no error)
    IF v_total_distributed != v_store_quota.ss_quota THEN
        RAISE WARNING 'Total distributed (%) differs from store quota (%)', 
            v_total_distributed, v_store_quota.ss_quota;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Calcular breakdown proporcional
CREATE OR REPLACE FUNCTION calculate_quota_breakdown(
    p_store_breakdown JSONB,
    p_hc_quota INTEGER,
    p_store_quota INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_ratio DECIMAL(10,6);
    v_result JSONB := '{}';
    v_key TEXT;
    v_value NUMERIC;
BEGIN
    v_ratio := p_hc_quota::DECIMAL / NULLIF(p_store_quota, 0);
    
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_store_breakdown)
    LOOP
        v_result := v_result || jsonb_build_object(
            v_key, 
            ROUND(v_value::NUMERIC * v_ratio)
        );
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 8. PERMISOS Y RLS

### 8.1 Matriz de Permisos

| Acción | ASESOR | SUPERVISOR | JV | GC | ADMIN | BO_OPS |
|--------|--------|------------|----|----|-------|--------|
| Ver cuota propia | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver cuotas tienda | ❌ | ✅ (su tienda) | ✅ (su zona) | ✅ | ✅ | ✅ |
| Ver todas las cuotas | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Importar cuotas | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Distribuir cuotas | ❌ | ❌ | ✅ (su zona) | ✅ | ✅ | ✅ |
| Aprobar cuotas | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

### 8.2 Políticas RLS

```sql
-- store_quotas
ALTER TABLE store_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_quotas_select" ON store_quotas
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND (
            u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES')
            OR (u.rol = 'JEFE_VENTAS' AND store_id IN (
                SELECT tienda_id FROM usuarios_tiendas WHERE usuario_id = u.id
            ))
        )
    )
);

-- hc_quotas
ALTER TABLE hc_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hc_quotas_select_own" ON hc_quotas
FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 
                      'BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'SUPERVISOR')
    )
);
```

---

## 9. NAVEGACIÓN Y MENÚ

```
📊 Comisiones
├── 📋 Esquemas
├── 📥 Importar Esquemas
├── ⚡ Simulador
└── ⚠️ Penalidades

📈 Cuotas                    ← NUEVO
├── 🏠 Dashboard             ← Vista general del período
├── 📥 Importar              ← Subir Excel de Entel
├── 📊 Distribución          ← Asignar a HC
└── ✅ Aprobación            ← Solo GC/Admin

👤 Mi Cuenta
├── 💰 Mi Comisión
├── 🎯 Mi Cuota              ← Vista personal de cuota
└── ...
```

---

## 10. PRÓXIMOS PASOS

### Orden de Desarrollo Recomendado

1. **Migración BD** - Crear tablas `quota_imports`, `store_quotas`, `hc_quotas`
2. **Importador básico** - Sin AI, mapeo manual de columnas
3. **Dashboard de cuotas** - Vista general
4. **Distribuidor de cuotas** - Asignación a HC
5. **Integración con Simulador** - Usar `hc_quotas` como fuente de cuota
6. **Importador AI** - Agregar interpretación con Claude
7. **Workflow de aprobación** - Estados y permisos

### Dependencias

- Requiere: `tiendas`, `usuarios`, `usuarios_tiendas` (existentes)
- Integra con: `commission_schemes`, `commission_hc_assignments`, Simulador

---

**Este documento es la guía completa para implementar el Módulo de Cuotas. Adjuntar a Claude Code junto con GRIDRETAIL_QUICK_REFERENCE.md**
