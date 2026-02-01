# GridRetail - Diccionario de Datos
## Documento de Referencia de Base de Datos
**Versión:** 2.5  
**Última actualización:** 2026-01-27  
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
| Cuotas (v2.3) | 3 | 2 | 4 |
| **TOTAL** | **29** | **10** | **14** |

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

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(30) | NO | - | Código único (ej: TE_AGUSTINO) |
| `nombre` | VARCHAR(100) | NO | - | Nombre completo |
| `direccion` | TEXT | YES | - | Dirección física |
| `distrito` | VARCHAR(50) | YES | - | Distrito |
| `activa` | BOOLEAN | NO | true | Estado activa |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

### 1.3 usuarios_tiendas
Relación M:N usuarios-tiendas.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `es_principal` | BOOLEAN | NO | false | Si es tienda principal del usuario |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:** UNIQUE (`usuario_id`, `tienda_id`)

### 1.4 tipos_venta
16 tipos de venta: OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN, PACK_VR, PACK_OPEN, PACK_OSS, PACK_VR_BASE, RENO, PREPAGO, PORTA_PP, ACCESORIOS.

| Categoría | Tipos |
|-----------|-------|
| POSTPAGO (8) | OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN |
| PACK (2) | PACK_VR, PACK_OPEN |
| PACK_SS (2) | PACK_OSS, PACK_VR_BASE |
| RENO (1) | RENO |
| PREPAGO (2) | PREPAGO, PORTA_PP |
| OTROS (1) | ACCESORIOS |

### 1.5 operadores_cedentes
Operadores: MOVISTAR, CLARO, BITEL.

---

## 2. OPERACIONES

### 2.1 ventas

Registro declarativo de ventas (Boca de Urna) del personal comercial.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PK |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha de la venta |
| `hora` | TIME | NO | CURRENT_TIME | Hora de registro |
| `tienda_id` | UUID | YES | - | FK → tiendas.id |
| `usuario_id` | UUID | YES | - | FK → usuarios.id (vendedor) |
| `codigo_asesor` | VARCHAR | YES | - | Código del asesor |
| `dni_asesor` | VARCHAR | YES | - | DNI del asesor |
| `registrado_por` | UUID | YES | - | FK → usuarios.id (quien registra) |
| `rango_horario` | VARCHAR | YES | - | Hora aproximada: '08'-'21' |
| `timestamp_registro` | TIMESTAMPTZ | YES | NOW() | Timestamp exacto de registro |
| `es_venta_rezagada` | BOOLEAN | YES | false | Si se registró tardíamente |
| `motivo_rezago` | TEXT | YES | - | Motivo del registro tardío |
| `estado` | VARCHAR | YES | 'registrada' | Estado de la venta |
| `aprobado_por` | UUID | YES | - | FK → usuarios.id |
| `fecha_aprobacion` | TIMESTAMPTZ | YES | - | Fecha de aprobación |
| `motivo_rechazo` | TEXT | YES | - | Motivo si fue rechazada |
| `orden_venta` | VARCHAR | NO | - | Número de contrato Entel (UNIQUE) |
| `telefono_linea` | TEXT | YES | - | Número de línea vendida |
| `telefono_asignado` | VARCHAR | YES | - | (Legacy) Número asignado |
| `tipo_documento_cliente` | VARCHAR | YES | - | Tipo de documento |
| `numero_documento_cliente` | VARCHAR | NO | - | Número de documento |
| `nombre_cliente` | VARCHAR | NO | - | Nombre del cliente |
| `tipo_venta` | VARCHAR | NO | - | Código del tipo de venta |
| `categoria_venta` | VARCHAR | YES | - | Categoría del tipo de venta |
| `fuente_validacion` | VARCHAR | YES | - | INAR/BU/NINGUNA |
| `base_captura` | VARCHAR | YES | - | BASE/CAPTURA |
| `operador_cedente` | VARCHAR | YES | - | Operador de origen (portabilidades) |
| `validacion_huella` | VARCHAR | YES | - | Tipo de validación biométrica |
| `vep_contado` | VARCHAR | YES | - | Forma de pago del equipo |
| `plan_tarifario` | TEXT | YES | - | Plan tarifario vendido |
| `imei_equipo` | VARCHAR | YES | - | IMEI del equipo |
| `imei` | VARCHAR | YES | - | (Legacy) IMEI |
| `modelo_equipo` | TEXT | YES | - | Modelo del equipo |
| `iccid_chip` | VARCHAR | YES | - | ICCID del chip |
| `iccid` | VARCHAR | YES | - | (Legacy) ICCID |
| `modelo_accesorio` | VARCHAR | YES | - | Modelo de accesorio |
| `incluye_seguro` | BOOLEAN | YES | false | Si incluye seguro MEP |
| `tipo_seguro` | VARCHAR | YES | - | Tipo de seguro |
| `incluye_accesorios` | BOOLEAN | YES | false | Si incluye accesorios |
| `descripcion_accesorios` | TEXT | YES | - | Descripción de accesorios |
| `monto_liquidado` | NUMERIC | NO | - | Monto calculado |
| `notas` | TEXT | YES | - | Observaciones adicionales |
| `estado_cruce` | TEXT | YES | 'PENDIENTE' | Estado de conciliación INAR |
| `orden_en_inar` | BOOLEAN | YES | false | Si ya está en INAR |
| `created_at` | TIMESTAMP | YES | NOW() | Fecha de creación |
| `updated_at` | TIMESTAMP | YES | NOW() | Fecha de actualización |
| `created_by` | VARCHAR | YES | - | Usuario que creó |
| `updated_by` | VARCHAR | YES | - | Usuario que actualizó |

**Constraints:**

```sql
-- Primary Key
CONSTRAINT ventas_pkey PRIMARY KEY (id)

-- Unique
CONSTRAINT ventas_orden_venta_key UNIQUE (orden_venta)

-- Foreign Keys
CONSTRAINT ventas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
CONSTRAINT ventas_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
CONSTRAINT ventas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES usuarios(id)

-- Check Constraints
CONSTRAINT ventas_tipo_documento_cliente_check 
  CHECK (tipo_documento_cliente IN ('DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP'))

CONSTRAINT ventas_base_captura_check 
  CHECK (base_captura IN ('BASE', 'CAPTURA'))

CONSTRAINT ventas_validacion_huella_check 
  CHECK (validacion_huella IN ('HUELLERO', 'DJ', 'VENTA EXTRANJERO'))

CONSTRAINT ventas_vep_contado_check 
  CHECK (vep_contado IN ('VEP', 'CONTADO'))

CONSTRAINT ventas_estado_check 
  CHECK (estado IN ('registrada', 'pendiente_aprobacion', 'aprobada', 'rechazada', 'anulada'))

CONSTRAINT ventas_estado_cruce_check 
  CHECK (estado_cruce IN ('PENDIENTE', 'COINCIDE', 'DISCREPANCIA', 'NO_ENCONTRADO'))
```

**Índices recomendados:**
- `idx_ventas_tienda_fecha` (tienda_id, fecha)
- `idx_ventas_usuario_fecha` (usuario_id, fecha)
- `idx_ventas_orden` (orden_venta)
- `idx_ventas_estado_cruce` (estado_cruce)

---

#### 2.1.1 Estados de la Venta (`estado`)

| Estado | Descripción |
|--------|-------------|
| `registrada` | Venta del día, aprobada automáticamente |
| `pendiente_aprobacion` | Venta rezagada sin permiso, requiere aprobación |
| `aprobada` | Venta rezagada aprobada por supervisor |
| `rechazada` | Venta rezagada rechazada |
| `anulada` | Venta anulada |

---

#### 2.1.2 Estados de Cruce INAR (`estado_cruce`)

| Estado | Descripción |
|--------|-------------|
| `PENDIENTE` | Esperando proceso de conciliación |
| `COINCIDE` | Encontrado en INAR, datos coinciden |
| `DISCREPANCIA` | Encontrado en INAR con diferencias |
| `NO_ENCONTRADO` | No existe en INAR |

---

#### 2.1.3 Tipos de Documento (`tipo_documento_cliente`)

| Código | Nombre | Patrón | Longitud |
|--------|--------|--------|----------|
| `DNI` | DNI | `/^\d{8}$/` | 8 |
| `CE` | Carné Extranjería | `/^\d{9}$/` | 9 |
| `RUC` | RUC | `/^(10\|20)\d{9}$/` | 11 |
| `PASAPORTE` | Pasaporte | `/^[A-Z0-9]{6,12}$/i` | 6-12 |
| `PTP` | PTP | `/^[A-Z0-9]{6,15}$/i` | 6-15 |

---

#### 2.1.4 Validación Biométrica (`validacion_huella`)

| Código | Descripción |
|--------|-------------|
| `HUELLERO` | Validación con huellero biométrico |
| `DJ` | Declaración Jurada (requiere autorización) |
| `VENTA EXTRANJERO` | Cliente extranjero sin huella en RENIEC |

---

#### 2.1.5 Forma de Pago Equipo (`vep_contado`)

| Código | Descripción |
|--------|-------------|
| `VEP` | Venta a Plazos (crédito) |
| `CONTADO` | Pago al contado |

---

#### 2.1.6 Campos Legacy (pendientes de limpieza)

Los siguientes campos están duplicados y se mantienen por compatibilidad:

| Campo Actual | Campo Legacy | Acción Pendiente |
|--------------|--------------|------------------|
| `telefono_linea` | `telefono_asignado` | Migrar y eliminar legacy |
| `imei_equipo` | `imei` | Migrar y eliminar legacy |
| `iccid_chip` | `iccid` | Migrar y eliminar legacy |

---

### 2.2 arribos

Registro de tráfico de clientes que ingresan a las tiendas TEX.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PK |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha del arribo |
| `hora` | TIME | NO | CURRENT_TIME | Hora del arribo |
| `tienda_id` | UUID | YES | - | FK → tiendas.id |
| `usuario_id` | UUID | YES | - | FK → usuarios.id (asesor que atiende) |
| `registrado_por` | VARCHAR | YES | - | Usuario que registra (ver nota) |
| `dni_cliente` | VARCHAR | YES | - | DNI del cliente (8 dígitos, opcional) |
| `es_cliente_entel` | BOOLEAN | YES | - | Si ya es cliente Entel (ver semántica) |
| `tipo_visita` | VARCHAR | YES | - | Propósito de la visita |
| `concreto_operacion` | BOOLEAN | YES | - | Si completó alguna operación |
| `se_vendio` | BOOLEAN | YES | - | Si se realizó venta (solo si tipo_visita=VENTA) |
| `motivo_no_venta` | VARCHAR | YES | - | Razón de no venta (solo si se_vendio=false) |
| `created_at` | TIMESTAMP | YES | NOW() | Fecha de creación |
| `updated_at` | TIMESTAMP | YES | NOW() | Fecha de actualización |

**Constraints:**

```sql
-- Primary Key
CONSTRAINT arribos_pkey PRIMARY KEY (id)

-- Foreign Keys
CONSTRAINT arribos_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
CONSTRAINT arribos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id)

-- Check Constraints
CONSTRAINT arribos_tipo_visita_check 
  CHECK (tipo_visita IN ('VENTA', 'POSVENTA'))

CONSTRAINT arribos_motivo_no_venta_check 
  CHECK (motivo_no_venta IS NULL OR motivo_no_venta IN (
    'SIN_STOCK', 'PRECIO_ALTO', 'NO_CALIFICA', 'SOLO_CONSULTA', 
    'DOCS_INCOMPLETOS', 'PROBLEMA_SISTEMA', 'OTRO'
  ))
```

**Índices recomendados:**
- `idx_arribos_tienda_fecha` (tienda_id, fecha)
- `idx_arribos_usuario_fecha` (usuario_id, fecha)

---

#### 2.2.1 Tipo de Visita (`tipo_visita`)

| Código | Descripción |
|--------|-------------|
| `VENTA` | Cliente viene a comprar/contratar |
| `POSVENTA` | Cliente viene por servicio post-venta |

---

#### 2.2.2 Semántica de `es_cliente_entel`

El campo es BOOLEAN pero representa 3 estados:

| Valor | Significado |
|-------|-------------|
| `true` | Sí es cliente Entel |
| `false` | No es cliente Entel |
| `null` | No se sabe / No preguntó |

---

#### 2.2.3 Motivos de No Venta (`motivo_no_venta`)

| Código | Descripción |
|--------|-------------|
| `SIN_STOCK` | Sin stock del producto solicitado |
| `PRECIO_ALTO` | Precio muy alto para el cliente |
| `NO_CALIFICA` | No califica para crédito |
| `SOLO_CONSULTA` | Cliente solo vino a consultar |
| `DOCS_INCOMPLETOS` | Documentos incompletos |
| `PROBLEMA_SISTEMA` | Problema con el sistema |
| `OTRO` | Otro motivo |

---

#### 2.2.4 Nota sobre `registrado_por`

⚠️ **Inconsistencia conocida:** Este campo es VARCHAR en lugar de UUID.
- En tabla `ventas`: `registrado_por` es UUID con FK a usuarios
- En tabla `arribos`: `registrado_por` es VARCHAR sin FK

**Pendiente:** Evaluar migración a UUID para consistencia con otros módulos.

---

#### 2.2.5 Métricas de Conversión

Los arribos se utilizan para calcular:

| Métrica | Fórmula |
|---------|---------|
| Tasa de Conversión | `(Ventas del día / Arribos del día) × 100` |
| Arribos por Hora | `Total Arribos / Horas Operativas` |
| Efectividad por Tienda | Comparación de conversión entre tiendas |

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

## 8. MÓDULO DE CUOTAS (v2.3)

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
| `ss_quota_entel` | INTEGER | NO | - | **Cuota SS original de Entel (inmutable)** |
| `ss_quota` | INTEGER | NO | - | **Cuota SS operativa SSNN (editable)** |
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

**Notas importantes (v2.3):**
- `ss_quota_entel`: Cuota original importada de Entel. NO debe modificarse después de importación.
- `ss_quota`: Cuota operativa del SSNN. Inicialmente igual a `ss_quota_entel`, pero puede ajustarse.
- La diferencia (`ss_quota - ss_quota_entel`) indica ajustes realizados por el SSNN.

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

## 9. VISTAS MÓDULO CUOTAS (v2.3)

### 9.1 vw_store_quotas_summary

Resumen por tienda con cuotas Entel/SSNN y estadísticas de distribución.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | ID de store_quota |
| `year` | INTEGER | Año |
| `month` | INTEGER | Mes |
| `store_id` | UUID | ID de tienda |
| `store_code` | VARCHAR | Código de tienda |
| `store_name` | VARCHAR | Nombre de tienda |
| `ss_quota_entel` | INTEGER | **Cuota original Entel (referencia)** |
| `ss_quota_ssnn` | INTEGER | **Cuota operativa SSNN (editable)** |
| `ss_quota_diferencia` | INTEGER | **Diferencia (SSNN - Entel)** |
| `quota_breakdown` | JSONB | Desglose por tipo |
| `status` | VARCHAR | Estado |
| `created_at` | TIMESTAMPTZ | Fecha creación |
| `approved_at` | TIMESTAMPTZ | Fecha aprobación |
| `hc_count` | BIGINT | Cantidad de HCs asignados |
| `ss_quota_distributed` | BIGINT | Cuota distribuida a HCs |
| `ss_quota_pending` | BIGINT | Cuota pendiente de distribuir |

**SQL:**
```sql
SELECT 
    sq.id, sq.year, sq.month, sq.store_id,
    t.codigo AS store_code, t.nombre AS store_name,
    sq.ss_quota_entel,
    sq.ss_quota AS ss_quota_ssnn,
    sq.ss_quota - sq.ss_quota_entel AS ss_quota_diferencia,
    sq.quota_breakdown, sq.status, sq.created_at, sq.approved_at,
    COUNT(hq.id) AS hc_count,
    COALESCE(SUM(hq.ss_quota), 0) AS ss_quota_distributed,
    sq.ss_quota - COALESCE(SUM(hq.ss_quota), 0) AS ss_quota_pending
FROM store_quotas sq
JOIN tiendas t ON sq.store_id = t.id
LEFT JOIN hc_quotas hq ON sq.id = hq.store_quota_id
GROUP BY sq.id, t.id;
```

### 9.2 vw_quotas_vigentes

Cuotas HC con detalles de tienda y usuario.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | ID de hc_quota |
| `user_id` | UUID | ID de usuario |
| `codigo_asesor` | VARCHAR | Código del asesor |
| `nombre_completo` | VARCHAR | Nombre del asesor |
| `rol` | VARCHAR | Rol del usuario |
| `zona` | VARCHAR | Zona asignada |
| `store_id` | UUID | ID de tienda |
| `store_code` | VARCHAR | Código de tienda |
| `store_name` | VARCHAR | Nombre de tienda |
| `year` | INTEGER | Año |
| `month` | INTEGER | Mes |
| `hc_ss_quota` | INTEGER | Cuota SS del HC |
| `prorated_ss_quota` | DECIMAL | Cuota prorrateada |
| `proration_factor` | DECIMAL | Factor de prorrateo |
| `store_ss_quota` | INTEGER | Cuota SS de tienda |
| `pct_of_store` | DECIMAL | % del HC respecto a tienda |

---

## 10. FUNCIONES MÓDULO CUOTAS (v2.3)

### 10.1 get_quota_period_summary(p_year, p_month)

Obtiene resumen consolidado del período con totales Entel vs SSNN.

**Parámetros:**
- `p_year` INTEGER - Año
- `p_month` INTEGER - Mes

**Retorna:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `total_stores` | INTEGER | Tiendas activas |
| `stores_with_quota` | INTEGER | Tiendas con cuota |
| `stores_distributed` | INTEGER | Tiendas con distribución |
| `total_ss_quota_entel` | INTEGER | **Total cuota Entel** |
| `total_ss_quota_ssnn` | INTEGER | **Total cuota SSNN** |
| `total_diferencia` | INTEGER | **Diferencia total** |
| `total_hc_assigned` | INTEGER | HCs con cuota |
| `total_ss_distributed` | INTEGER | Total distribuido |

**Ejemplo:**
```sql
SELECT * FROM get_quota_period_summary(2026, 1);
-- Retorna:
-- total_stores: 21
-- stores_with_quota: 19
-- stores_distributed: 2
-- total_ss_quota_entel: 2461
-- total_ss_quota_ssnn: 2461
-- total_diferencia: 0
-- total_hc_assigned: 5
-- total_ss_distributed: 325
```

### 10.2 update_store_quota_ssnn(p_store_quota_id, p_new_ss_quota, p_user_id)

Actualiza la cuota SSNN de una tienda con validaciones.

**Parámetros:**
- `p_store_quota_id` UUID - ID del store_quota
- `p_new_ss_quota` INTEGER - Nueva cuota SSNN
- `p_user_id` UUID - Usuario que modifica (para auditoría)

**Validaciones:**
- Nueva cuota ≥ suma de cuotas ya distribuidas a HCs
- Nueva cuota ≥ 0

**Retorna:** `store_quotas` (registro actualizado)

### 10.3 calculate_quota_breakdown(p_store_breakdown, p_hc_quota, p_store_quota)

Calcula desglose proporcional para HC.

**Retorna:** JSONB con cuotas por partida proporcionales.

### 10.4 distribute_store_quota(p_store_quota_id, p_distributions)

Distribuye cuota de tienda a HCs.

**p_distributions:** `[{"user_id": "...", "ss_quota": 60, "start_date": "2026-01-15"}]`

**Retorna:** `{"success": true, "inserted_count": 3, "total_distributed": 151}`

### 10.5 approve_store_quotas(p_store_quota_ids[], p_approval_notes)

Aprueba cuotas (solo ADMIN, GERENTE_COMERCIAL).

**Retorna:** `{"success": true, "approved_count": 21}`

### 10.6 get_hc_effective_quota(p_user_id, p_year, p_month)

Obtiene cuota efectiva para simulador.

**Retorna:** TABLE(ss_quota, effective_quota, proration_factor, quota_breakdown, ...)

---

## 11. DIAGRAMA MÓDULO CUOTAS (v2.3)

```
ENTEL (Excel) → quota_imports → store_quotas → hc_quotas → Simulador
                                     │               │
                              ┌──────┴──────┐        │
                              │             │        │
                        ss_quota_entel  ss_quota     │
                        (inmutable)    (editable)    │
                                     │               │
                                     ▼               ▼
                                 tiendas         usuarios
```

**Flujo:**
1. Analista importa Excel de Entel
2. Sistema crea store_quotas: `ss_quota_entel = ss_quota = valor_excel`
3. Analista puede ajustar `ss_quota` (cuota SSNN) si es necesario
4. Se distribuye `ss_quota` (no `ss_quota_entel`) a los HCs
5. Gerente aprueba
6. Simulador usa get_hc_effective_quota()

**Reglas de negocio:**
- `ss_quota_entel` es inmutable después de importación
- `ss_quota` puede ser mayor o menor que `ss_quota_entel`
- La diferencia indica ajustes del SSNN respecto a Entel
- Solo se puede reducir `ss_quota` si no hay distribución que lo exceda

---

## 12. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-24 | 1.0 | Diccionario inicial con 17 objetos |
| 2026-01-25 | 2.0 | Módulo Comisiones y Penalidades (11 tablas) |
| 2026-01-25 | 2.1 | Sistema partidas flexible (3 tablas, 2 vistas, 2 funciones) |
| 2026-01-26 | 2.2 | Módulo Cuotas: 3 tablas, 2 vistas, 4 funciones. Distribución Entel→Tienda→HC con prorrateo. |
| 2026-01-26 | 2.2.1 | Corrección tabla usuarios: codigo_asesor, nombre_completo, campo zona y password_hash. |
| 2026-01-27 | 2.3 | Sistema de cuota dual Entel/SSNN: columna `ss_quota_entel` en store_quotas, vista `vw_store_quotas_summary` con 3 columnas (entel, ssnn, diferencia), función `get_quota_period_summary` actualizada con totales duales, función `update_store_quota_ssnn` para edición con validación. |
| 2026-01-27 | **2.4** | **Documentación completa tabla `ventas`: 40+ columnas, constraints (tipo_documento, estado, estado_cruce, validacion_huella, vep_contado, base_captura), estados del flujo, campos legacy identificados. Detalle de tipos_venta con 16 tipos en 6 categorías.** |
| 2026-01-27 | **2.5** | **Documentación completa tabla `arribos`: 14 columnas, constraints (tipo_visita, motivo_no_venta), semántica de es_cliente_entel (boolean con null=NO_SABE), métricas de conversión. Identificada inconsistencia: registrado_por es VARCHAR en lugar de UUID.** |

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen o modifiquen tablas.
