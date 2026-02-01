# GridRetail - Diccionario de Datos
## Documento de Referencia de Base de Datos
**Versión:** 2.2  
**Última actualización:** 2026-01-26  
**Base de datos:** Supabase (PostgreSQL)

---

## RESUMEN DE OBJETOS

| Módulo | Tablas | Vistas | Funciones |
|--------|--------|--------|-----------|
| Core | 5 | 1 | 1 |
| Operaciones | 2 | - | - |
| INAR | 3 | 3 | - |
| Control | 2 | 1 | - |
| Comisiones | 7 | - | 5 |
| Penalidades | 4 | 1 | 1 |
| Presets Partidas (v2.1) | 3 | 2 | 2 |
| **Cuotas (v2.2)** | **3** | **2** | **4** |
| **TOTAL** | **29** | **10** | **13** |

---

## 1. TABLAS CORE

### 1.1 usuarios

Personal del sistema (comercial y administrativo).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo_asesor` | VARCHAR | NO | - | Código del asesor (ej: PBD_ASCHUMPITAZ) |
| `dni` | VARCHAR | NO | - | DNI del usuario |
| `nombre_completo` | VARCHAR | NO | - | Nombre completo |
| `email` | VARCHAR | YES | - | Email |
| `rol` | VARCHAR | NO | - | Rol (ver constraint) |
| `zona` | VARCHAR | YES | - | Zona asignada (NORTE, SUR, etc.) |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `password_hash` | VARCHAR | YES | - | Hash de contraseña |
| `created_at` | TIMESTAMP | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMP | NO | NOW() | Fecha actualización |

**Constraint de Roles:**
```sql
CHECK (rol IN (
    'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
    'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
    'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
    'VALIDADOR_ARRIBOS', 'ADMIN'
))
```

12 roles definidos por constraint.

### 1.2 tiendas
Catálogo de 21 tiendas TEX.

### 1.3 usuarios_tiendas
Relación M:N usuarios-tiendas.

### 1.4 tipos_venta
16 tipos de venta: OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN, PACK_VR, PACK_OPEN, PACK_OSS, PACK_VR_BASE, RENO, PREPAGO, PORTA_PP, ACCESORIOS.

### 1.5 operadores_cedentes
Operadores: MOVISTAR, CLARO, BITEL.

---

## 2. OPERACIONES

### 2.1 ventas
Registro declarativo (Boca de Urna).

### 2.2 arribos
Conteo de clientes.

---

## 3. MÓDULO INAR

### 3.1 lineas_inar
Líneas activadas (49 campos). PK: vchc_contratofs.

### 3.2 inar_importaciones
Historial de importaciones.

### 3.3 inar_mapeo_columnas
Mapeo Excel → BD.

---

## 4. CONTROL

### 4.1 asesor_incidencias
Incidencias por asesor.

### 4.2 logs_auditoria
Logs de cambios.

---

## 5. MÓDULO COMISIONES

### 5.1 commission_item_types
Catálogo de tipos de partida.

### 5.2 commission_schemes
Esquemas con estados: oficial, draft, aprobado, archivado.

### 5.3 commission_scheme_items
Partidas individuales. `item_type_id` nullable desde v2.1.

### 5.4 commission_pxq_scales
Escalas PxQ.

### 5.5 commission_item_locks
Candados.

### 5.6 commission_item_restrictions
Restricciones de mix.

### 5.7 commission_hc_assignments
Asignación de esquemas a HC.

---

## 6. MÓDULO PENALIDADES

### 6.1 penalty_types
Catálogo de tipos (18 tipos).

### 6.2 penalty_equivalences
Equivalencias SSNN → HC.

### 6.3 hc_penalties
Registro histórico.

### 6.4 penalty_imports
Historial de importaciones.

---

## 7. PRESETS PARTIDAS (v2.1)

### 7.1 partition_presets
25 presets (9 agrupaciones + 16 individuales).

### 7.2 partition_preset_ventas
Mapeo N:N preset → tipo_venta.

### 7.3 commission_item_ventas
Mapeo N:N partida → tipo_venta.

---

## 8. MÓDULO DE CUOTAS (v2.2) - NUEVO

### 8.1 quota_imports

Historial de importaciones de archivos de cuotas de Entel.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `file_name` | VARCHAR(255) | NO | - | Nombre del archivo |
| `file_url` | TEXT | YES | - | URL del archivo |
| `file_size` | INTEGER | YES | - | Tamaño en bytes |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `total_rows` | INTEGER | NO | 0 | Total de filas |
| `imported_rows` | INTEGER | NO | 0 | Filas importadas |
| `error_rows` | INTEGER | NO | 0 | Filas con error |
| `errors` | JSONB | YES | - | Detalle de errores |
| `ai_interpretation_log` | JSONB | YES | - | Log AI |
| `column_mapping` | JSONB | YES | - | Mapeo columnas |
| `status` | VARCHAR(20) | NO | 'pending' | pending/processing/completed/failed |
| `imported_by` | UUID | YES | - | FK → usuarios.id |
| `imported_at` | TIMESTAMPTZ | YES | - | Fecha importación |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_quota_imports_period`, `idx_quota_imports_status`

---

### 8.2 store_quotas

Cuotas mensuales por tienda (importadas de Entel).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `store_id` | UUID | NO | - | FK → tiendas.id |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `ss_quota` | INTEGER | NO | - | Cuota SS total |
| `quota_breakdown` | JSONB | NO | '{}' | Desglose por partida |
| `source` | VARCHAR(20) | NO | 'entel' | entel/manual |
| `import_id` | UUID | YES | - | FK → quota_imports.id |
| `original_store_name` | VARCHAR(200) | YES | - | Nombre en Excel |
| `status` | VARCHAR(20) | NO | 'draft' | draft/pending_approval/approved/archived |
| `approved_by` | UUID | YES | - | FK → usuarios.id |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobación |
| `approval_notes` | TEXT | YES | - | Notas |
| `created_by` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:** UNIQUE (`store_id`, `year`, `month`)

**Índices:** `idx_store_quotas_store`, `idx_store_quotas_period`, `idx_store_quotas_status`

**Ejemplo quota_breakdown:**
```json
{
    "VR": 75, "VR_CAPTURA": 30, "VR_BASE": 45,
    "OSS": 68, "OSS_CAPTURA": 54, "OSS_BASE": 14,
    "OPP": 8, "PACKS": 15, "RENO": 54, "PREPAGO": 111
}
```

---

### 8.3 hc_quotas

Cuotas individuales por HC (distribuidas desde store_quotas).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → usuarios.id |
| `store_quota_id` | UUID | NO | - | FK → store_quotas.id (CASCADE) |
| `store_id` | UUID | NO | - | FK → tiendas.id |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `ss_quota` | INTEGER | NO | - | Cuota SS asignada |
| `quota_breakdown` | JSONB | NO | '{}' | Desglose proporcional |
| `start_date` | DATE | YES | - | Fecha inicio (prorrateo) |
| `proration_factor` | DECIMAL(5,4) | NO | 1.0000 | Factor 0-1 |
| `prorated_ss_quota` | DECIMAL(10,2) | YES | - | Cuota prorrateada |
| `status` | VARCHAR(20) | NO | 'draft' | draft/pending_approval/approved/archived |
| `distributed_by` | UUID | YES | - | FK → usuarios.id |
| `distributed_at` | TIMESTAMPTZ | YES | - | Fecha distribución |
| `approved_by` | UUID | YES | - | FK → usuarios.id |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobación |
| `notes` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:** UNIQUE (`user_id`, `year`, `month`)

**Índices:** `idx_hc_quotas_user`, `idx_hc_quotas_store`, `idx_hc_quotas_period`, `idx_hc_quotas_status`

**Prorrateo:** Si HC inicia día 15 de mes con 31 días → `proration_factor = 17/31 = 0.5484`

---

## 9. VISTAS MÓDULO CUOTAS (v2.2)

### 9.1 vw_quotas_vigentes

Cuotas HC con detalles de tienda y usuario.

```sql
SELECT 
    hq.id, hq.user_id, u.codigo_asesor, u.nombre_completo, u.rol, u.zona,
    hq.store_id, t.codigo AS store_code, t.nombre AS store_name,
    hq.year, hq.month, hq.ss_quota AS hc_ss_quota, hq.prorated_ss_quota,
    hq.proration_factor, sq.ss_quota AS store_ss_quota,
    ROUND(hq.ss_quota::numeric / NULLIF(sq.ss_quota, 0) * 100, 1) AS pct_of_store
FROM hc_quotas hq
JOIN usuarios u ON hq.user_id = u.id
JOIN tiendas t ON hq.store_id = t.id
JOIN store_quotas sq ON hq.store_quota_id = sq.id;
```

### 9.2 vw_store_quotas_summary

Resumen por tienda con estadísticas de distribución.

```sql
SELECT 
    sq.id, sq.store_id, t.nombre AS store_name, sq.year, sq.month, sq.ss_quota,
    COUNT(hq.id) AS hc_count,
    COALESCE(SUM(hq.ss_quota), 0) AS total_distributed,
    sq.ss_quota - COALESCE(SUM(hq.ss_quota), 0) AS remaining_quota
FROM store_quotas sq
JOIN tiendas t ON sq.store_id = t.id
LEFT JOIN hc_quotas hq ON sq.id = hq.store_quota_id
GROUP BY sq.id, t.id;
```

---

## 10. FUNCIONES MÓDULO CUOTAS (v2.2)

### 10.1 calculate_quota_breakdown(p_store_breakdown, p_hc_quota, p_store_quota)

Calcula desglose proporcional para HC.

**Retorna:** JSONB con cuotas por partida proporcionales.

### 10.2 distribute_store_quota(p_store_quota_id, p_distributions)

Distribuye cuota de tienda a HCs.

**p_distributions:** `[{"user_id": "...", "ss_quota": 60, "start_date": "2026-01-15"}]`

**Retorna:** `{"success": true, "inserted_count": 3, "total_distributed": 151}`

### 10.3 approve_store_quotas(p_store_quota_ids[], p_approval_notes)

Aprueba cuotas (solo ADMIN, GERENTE_COMERCIAL).

**Retorna:** `{"success": true, "approved_count": 21}`

### 10.4 get_hc_effective_quota(p_user_id, p_year, p_month)

Obtiene cuota efectiva para simulador.

**Retorna:** TABLE(ss_quota, effective_quota, proration_factor, quota_breakdown, ...)

---

## 11. DIAGRAMA MÓDULO CUOTAS

```
ENTEL (Excel) → quota_imports → store_quotas → hc_quotas → Simulador
                                     │               │
                                     ▼               ▼
                                 tiendas         usuarios
```

**Flujo:**
1. Analista importa Excel de Entel
2. Sistema crea store_quotas por tienda
3. Analista distribuye a HC (equitativo o manual)
4. Gerente aprueba
5. Simulador usa get_hc_effective_quota()

---

## 12. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-24 | 1.0 | Diccionario inicial con 17 objetos |
| 2026-01-25 | 2.0 | Módulo Comisiones y Penalidades (11 tablas) |
| 2026-01-25 | 2.1 | Sistema partidas flexible (3 tablas, 2 vistas, 2 funciones) |
| 2026-01-26 | 2.2 | Módulo Cuotas: 3 tablas, 2 vistas, 4 funciones. Distribución Entel→Tienda→HC con prorrateo. |
| 2026-01-26 | **2.2.1** | **Corrección tabla usuarios: codigo_asesor (no codigo_entel), nombre_completo (no nombres+apellidos), agregado campo zona y password_hash.** |

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen o modifiquen tablas.
