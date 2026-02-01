# Módulo de Gestión de Cuotas - Especificación Técnica
## GridRetail v2.3
**Última actualización:** 2026-01-27  
**Estado:** En Desarrollo

---

## 1. VISIÓN GENERAL

El módulo de Gestión de Cuotas permite importar, ajustar, distribuir y aprobar las cuotas comerciales mensuales de las tiendas TEX.

### 1.1 Flujo Principal

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  IMPORTAR   │───►│   AJUSTAR   │───►│ DISTRIBUIR  │───►│   APROBAR   │
│  Excel Entel│    │ Cuota SSNN  │    │  a Asesores │    │  Cuotas HC  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
   ss_quota_entel    ss_quota          hc_quotas          status=
   ss_quota          (editable)        (distribución)     'aprobado'
   (inicialmente =)
```

### 1.2 Estados del Período

| Estado | Descripción |
|--------|-------------|
| `sin_importar` | No se ha importado Excel de cuotas |
| `en_distribucion` | Cuotas importadas, pendiente distribuir |
| `pendiente_aprobacion` | Distribución completa, pendiente aprobar |
| `aprobado` | Cuotas aprobadas y vigentes |

---

## 2. MODELO DE DATOS

### 2.1 Tabla: quota_imports

Historial de importaciones de archivos Excel de cuotas.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `file_name` | VARCHAR(255) | NO | - | Nombre del archivo |
| `file_url` | TEXT | YES | - | URL en Storage |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `total_stores` | INTEGER | NO | 0 | Tiendas en archivo |
| `total_ss_quota` | INTEGER | NO | 0 | Suma de cuotas SS |
| `imported_by` | UUID | YES | - | FK → usuarios.id |
| `status` | VARCHAR(20) | NO | 'completed' | Estado |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha importación |

### 2.2 Tabla: store_quotas

Cuotas por tienda para cada período.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `import_id` | UUID | YES | - | FK → quota_imports.id |
| `store_id` | UUID | NO | - | FK → tiendas.id |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `ss_quota_entel` | INTEGER | NO | 0 | **Cuota SS original de Entel (inmutable)** |
| `ss_quota` | INTEGER | NO | 0 | **Cuota SS operativa SSNN (editable)** |
| `quota_breakdown` | JSONB | YES | - | Desglose por tipo de venta |
| `status` | VARCHAR(20) | NO | 'draft' | draft/approved |
| `approved_by` | UUID | YES | - | FK → usuarios.id |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobación |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- UNIQUE (`store_id`, `year`, `month`)

**Índices:**
- `idx_store_quotas_period` en (`year`, `month`)
- `idx_store_quotas_store` en `store_id`

### 2.3 Tabla: hc_quotas

Cuotas asignadas a cada asesor (HC).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `store_quota_id` | UUID | NO | - | FK → store_quotas.id |
| `user_id` | UUID | NO | - | FK → usuarios.id |
| `store_id` | UUID | NO | - | FK → tiendas.id |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `ss_quota` | INTEGER | NO | 0 | Cuota SS asignada |
| `prorated_ss_quota` | INTEGER | YES | - | Cuota prorrateada (ingreso tardío) |
| `proration_factor` | DECIMAL(5,4) | YES | - | Factor de prorrateo |
| `start_date` | DATE | YES | - | Fecha inicio (si no es día 1) |
| `quota_breakdown` | JSONB | YES | - | Desglose por tipo |
| `status` | VARCHAR(20) | NO | 'draft' | draft/approved |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- UNIQUE (`user_id`, `store_id`, `year`, `month`)

---

## 3. VISTAS

### 3.1 Vista: vw_store_quotas_summary

Resumen de cuotas por tienda con métricas de distribución.

```sql
SELECT 
    sq.id,
    sq.year,
    sq.month,
    sq.store_id,
    t.codigo AS store_code,
    t.nombre AS store_name,
    sq.ss_quota_entel,                           -- Cuota Entel (referencia)
    sq.ss_quota AS ss_quota_ssnn,                -- Cuota SSNN (operativa)
    sq.ss_quota - sq.ss_quota_entel AS ss_quota_diferencia,  -- Diferencia
    sq.quota_breakdown,
    sq.status,
    sq.created_at,
    sq.approved_at,
    -- Conteo de HCs asignados
    (SELECT COUNT(DISTINCT hq.user_id) 
     FROM hc_quotas hq 
     WHERE hq.store_quota_id = sq.id) AS hc_count,
    -- Suma distribuida
    (SELECT COALESCE(SUM(hq.ss_quota), 0) 
     FROM hc_quotas hq 
     WHERE hq.store_quota_id = sq.id) AS ss_quota_distributed,
    -- Pendiente de distribuir
    sq.ss_quota - COALESCE(...) AS ss_quota_pending
FROM store_quotas sq
JOIN tiendas t ON sq.store_id = t.id;
```

### 3.2 Vista: vw_quotas_vigentes

Cuotas vigentes por HC con información completa.

```sql
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
    -- Cuotas de tienda
    sq.ss_quota_entel AS store_ss_quota_entel,
    sq.ss_quota AS store_ss_quota_ssnn,
    sq.ss_quota - sq.ss_quota_entel AS store_quota_diferencia,
    sq.status AS store_quota_status,
    hq.status AS hc_quota_status,
    -- Porcentaje del HC
    ROUND(hq.ss_quota::numeric / NULLIF(sq.ss_quota, 0) * 100, 1) AS pct_of_store
FROM hc_quotas hq
JOIN usuarios u ON hq.user_id = u.id
JOIN tiendas t ON hq.store_id = t.id
JOIN store_quotas sq ON hq.store_quota_id = sq.id;
```

---

## 4. FUNCIONES SQL

### 4.1 update_store_quota_ssnn()

Actualiza la cuota SSNN de una tienda (editable).

```sql
SELECT update_store_quota_ssnn(
    'uuid-store-quota'::UUID,  -- ID de store_quota
    180,                        -- Nueva cuota SSNN
    'uuid-usuario'::UUID        -- Usuario que modifica (para auditoría)
);
```

**Validaciones:**
- Nueva cuota ≥ cuota ya distribuida
- Nueva cuota ≥ 0

### 4.2 get_quota_period_summary()

Obtiene resumen del período.

```sql
SELECT * FROM get_quota_period_summary(2026, 1);
```

**Retorna:**
| Campo | Descripción |
|-------|-------------|
| total_stores | Tiendas activas |
| stores_with_quota | Tiendas con cuota |
| stores_distributed | Tiendas con distribución |
| total_ss_quota_entel | Suma cuotas Entel |
| total_ss_quota_ssnn | Suma cuotas SSNN |
| total_diferencia | Diferencia total |
| total_hc_assigned | HCs con cuota |
| total_ss_distributed | Total distribuido |

---

## 5. INTERFAZ DE USUARIO

### 5.1 Panel Principal - Métricas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Cuota Total SSNN     │  Cuota Total Entel    │  Diferencia    │  Tiendas  │
│  ┌───────────────┐    │  ┌───────────────┐    │  ┌─────────┐   │  ┌──────┐ │
│  │   2,561 SS    │    │  │   2,461 SS    │    │  │ +100 ▲  │   │  │19/21 │ │
│  │  (operativa)  │    │  │  (referencia) │    │  │ (+4.1%) │   │  │      │ │
│  └───────────────┘    │  └───────────────┘    │  └─────────┘   │  └──────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Tabla de Cuotas por Tienda

```
┌──────────────────┬────────┬────────┬────────┬────┬─────────────┬─────────┬─────────┐
│ Tienda           │ Entel  │ SSNN   │ Dif    │ HC │ Distribuido │ Estado  │ Acción  │
├──────────────────┼────────┼────────┼────────┼────┼─────────────┼─────────┼─────────┤
│ TE HIGUERETA     │  151   │ [151]  │   -    │ 3  │   151 ✓     │Borrador │Distribuir│
│ TE HUANDOY       │  174   │ [184]  │ +10 ▲  │ 2  │   184 ✓     │Borrador │Distribuir│
│ TE LIMA SJM      │  235   │ [220]  │ -15 ▼  │ 0  │    0  ⚠-220 │Borrador │Distribuir│
│ TE NARANJAL      │  180   │ [180]  │   -    │ 0  │    0  ⚠-180 │Borrador │Distribuir│
└──────────────────┴────────┴────────┴────────┴────┴─────────────┴─────────┴─────────┘
                            ▲
                      Campo editable (input numérico)
```

### 5.3 Indicadores de Diferencia

| Diferencia | Icono | Color | Tooltip |
|------------|-------|-------|---------|
| `= 0` | `-` | Gris (#6B7280) | "Sin ajuste" |
| `> 0` | `▲` | Verde (#10B981) | "Cuota aumentada +N" |
| `< 0` | `▼` | Naranja (#F59E0B) | "Cuota reducida N" |

### 5.4 Edición de Cuota SSNN

**Comportamiento del input:**
- Tipo: `number`
- Min: 0
- Step: 1
- Validación en blur/enter
- Si valor < distribuido: mostrar error inline
- Guardar automáticamente con debounce (500ms)

**Estados visuales:**
- Normal: borde gris
- Modificado (≠ Entel): borde azul + fondo azul tenue
- Error: borde rojo + mensaje

---

## 6. REGLAS DE NEGOCIO

### 6.1 Importación

1. Al importar Excel, se crean `store_quotas` con:
   - `ss_quota_entel` = valor del Excel
   - `ss_quota` = valor del Excel (inicialmente iguales)
   - `status` = 'draft'

2. Si ya existe cuota para el período:
   - Opción A: Rechazar importación
   - Opción B: Actualizar `ss_quota_entel` y `ss_quota` si no hay distribución

### 6.2 Ajuste de Cuota SSNN

1. Solo editable si `status` = 'draft'
2. Nueva cuota ≥ suma de cuotas ya distribuidas a HCs
3. Nueva cuota puede ser mayor o menor que Entel
4. Guardar en log de auditoría

### 6.3 Distribución

1. Se distribuye `ss_quota` (SSNN), no `ss_quota_entel`
2. Suma de cuotas HC ≤ `ss_quota` de tienda
3. Puede haber cuota sin asignar (pendiente)

### 6.4 Aprobación

1. Requiere rol GERENTE_COMERCIAL o ADMIN
2. Cambia `status` a 'approved'
3. Bloquea edición de `ss_quota`

---

## 7. API ENDPOINTS

### 7.1 GET /api/cuotas/periodo

```typescript
// Request
GET /api/cuotas/periodo?year=2026&month=1

// Response
{
  summary: {
    total_ss_quota_entel: 2461,
    total_ss_quota_ssnn: 2561,
    total_diferencia: 100,
    stores_with_quota: 19,
    stores_distributed: 2,
    total_hc_assigned: 5
  },
  stores: [
    {
      id: "uuid",
      store_code: "TE_HIGUERETA",
      store_name: "TE HIGUERETA",
      ss_quota_entel: 151,
      ss_quota_ssnn: 151,
      diferencia: 0,
      hc_count: 3,
      ss_quota_distributed: 151,
      ss_quota_pending: 0,
      status: "draft"
    },
    // ...
  ]
}
```

### 7.2 PATCH /api/cuotas/tienda/:id

```typescript
// Request
PATCH /api/cuotas/tienda/uuid-store-quota
{
  ss_quota: 184
}

// Response
{
  success: true,
  data: {
    id: "uuid",
    ss_quota_entel: 174,
    ss_quota: 184,
    diferencia: 10
  }
}

// Error Response
{
  success: false,
  error: "Nueva cuota (150) no puede ser menor que cuota distribuida (160)"
}
```

---

## 8. COMPONENTES REACT

### 8.1 Estructura de Archivos

```
app/(dashboard)/cuotas/
├── page.tsx                    # Página principal
├── components/
│   ├── QuotaSummaryCards.tsx   # Cards de resumen (Entel, SSNN, Dif)
│   ├── StoreQuotaTable.tsx     # Tabla de tiendas
│   ├── StoreQuotaRow.tsx       # Fila con input editable
│   ├── QuotaDifferenceIndicator.tsx  # Indicador ▲▼
│   ├── ImportQuotaDialog.tsx   # Modal de importación
│   └── DistributeQuotaDialog.tsx  # Modal de distribución
├── hooks/
│   ├── useQuotaPeriod.ts       # Hook para datos del período
│   └── useUpdateStoreQuota.ts  # Hook para actualizar cuota
└── lib/
    └── quota-api.ts            # Funciones de API
```

### 8.2 Tipos TypeScript

```typescript
interface StoreQuota {
  id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  year: number;
  month: number;
  ss_quota_entel: number;    // Cuota original Entel
  ss_quota_ssnn: number;     // Cuota operativa SSNN
  diferencia: number;        // ss_quota_ssnn - ss_quota_entel
  hc_count: number;
  ss_quota_distributed: number;
  ss_quota_pending: number;
  status: 'draft' | 'approved';
}

interface QuotaPeriodSummary {
  total_ss_quota_entel: number;
  total_ss_quota_ssnn: number;
  total_diferencia: number;
  stores_with_quota: number;
  stores_distributed: number;
  total_hc_assigned: number;
}
```

---

## 9. MIGRACIONES APLICADAS

| Número | Nombre | Descripción | Fecha |
|--------|--------|-------------|-------|
| 006 | quota_module.sql | Tablas base del módulo | 2026-01-25 |
| 008 | store_quota_entel_reference.sql | Agregar ss_quota_entel | 2026-01-27 |

---

## 10. PERMISOS POR ROL

| Acción | ASESOR | SUPERVISOR | JEFE_VENTAS | GERENTE | ADMIN |
|--------|--------|------------|-------------|---------|-------|
| Ver cuotas propias | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver cuotas tienda | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ver todas las cuotas | ❌ | ❌ | ✅ | ✅ | ✅ |
| Importar cuotas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ajustar cuota SSNN | ❌ | ❌ | ❌ | ✅ | ✅ |
| Distribuir cuotas | ❌ | ❌ | ✅ | ✅ | ✅ |
| Aprobar cuotas | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-25 | 1.0 | Especificación inicial |
| 2026-01-27 | 2.0 | Agregado sistema de cuota dual (Entel/SSNN) |
