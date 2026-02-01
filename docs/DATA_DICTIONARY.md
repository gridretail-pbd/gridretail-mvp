# GridRetail - Diccionario de Datos
## Documento de Referencia de Base de Datos
**Versión:** 2.6  
**Última actualización:** 2026-01-28  
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
| Configuración (v2.6) | 1 | - | - |
| **TOTAL** | **30** | **10** | **14** |

---

## 1. TABLAS CORE

### 1.1 usuarios

Personal del sistema (comercial y administrativo).

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo_asesor` | VARCHAR | NO | - | CÃ³digo del asesor (ej: PBD_ASCHUMPITAZ) |
| `dni` | VARCHAR | NO | - | DNI del usuario |
| `nombre_completo` | VARCHAR | NO | - | Nombre completo |
| `email` | VARCHAR | YES | - | Email |
| `rol` | VARCHAR | NO | - | Rol (ver constraint) |
| `zona` | VARCHAR | YES | - | Zona asignada (NORTE, SUR, etc.) |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `password_hash` | VARCHAR | YES | - | Hash de contraseÃ±a |
| `created_at` | TIMESTAMP | NO | NOW() | Fecha creaciÃ³n |
| `updated_at` | TIMESTAMP | NO | NOW() | Fecha actualizaciÃ³n |

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
CatÃ¡logo de 21 tiendas TEX.

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(30) | NO | - | CÃ³digo Ãºnico (ej: TE_AGUSTINO) |
| `nombre` | VARCHAR(100) | NO | - | Nombre completo |
| `direccion` | TEXT | YES | - | DirecciÃ³n fÃ­sica |
| `distrito` | VARCHAR(50) | YES | - | Distrito |
| `activa` | BOOLEAN | NO | true | Estado activa |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creaciÃ³n |

### 1.3 usuarios_tiendas
RelaciÃ³n M:N usuarios-tiendas.

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK â†’ usuarios.id |
| `tienda_id` | UUID | NO | - | FK â†’ tiendas.id |
| `es_principal` | BOOLEAN | NO | false | Si es tienda principal del usuario |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creaciÃ³n |

**Constraints:** UNIQUE (`usuario_id`, `tienda_id`)

### 1.4 tipos_venta
16 tipos de venta: OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN, PACK_VR, PACK_OPEN, PACK_OSS, PACK_VR_BASE, RENO, PREPAGO, PORTA_PP, ACCESORIOS.

| CategorÃ­a | Tipos |
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

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PK |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha de la venta |
| `hora` | TIME | NO | CURRENT_TIME | Hora de registro |
| `tienda_id` | UUID | YES | - | FK â†’ tiendas.id |
| `usuario_id` | UUID | YES | - | FK â†’ usuarios.id (vendedor) |
| `codigo_asesor` | VARCHAR | YES | - | CÃ³digo del asesor |
| `dni_asesor` | VARCHAR | YES | - | DNI del asesor |
| `registrado_por` | UUID | YES | - | FK â†’ usuarios.id (quien registra) |
| `rango_horario` | VARCHAR | YES | - | Hora aproximada: '08'-'21' |
| `timestamp_registro` | TIMESTAMPTZ | YES | NOW() | Timestamp exacto de registro |
| `es_venta_rezagada` | BOOLEAN | YES | false | Si se registrÃ³ tardÃ­amente |
| `motivo_rezago` | TEXT | YES | - | Motivo del registro tardÃ­o |
| `estado` | VARCHAR | YES | 'registrada' | Estado de la venta |
| `aprobado_por` | UUID | YES | - | FK â†’ usuarios.id |
| `fecha_aprobacion` | TIMESTAMPTZ | YES | - | Fecha de aprobaciÃ³n |
| `motivo_rechazo` | TEXT | YES | - | Motivo si fue rechazada |
| `orden_venta` | VARCHAR | NO | - | NÃºmero de contrato Entel (UNIQUE) |
| `telefono_linea` | TEXT | YES | - | NÃºmero de lÃ­nea vendida |
| `telefono_asignado` | VARCHAR | YES | - | (Legacy) NÃºmero asignado |
| `tipo_documento_cliente` | VARCHAR | YES | - | Tipo de documento |
| `numero_documento_cliente` | VARCHAR | NO | - | NÃºmero de documento |
| `nombre_cliente` | VARCHAR | NO | - | Nombre del cliente |
| `tipo_venta` | VARCHAR | NO | - | CÃ³digo del tipo de venta |
| `categoria_venta` | VARCHAR | YES | - | CategorÃ­a del tipo de venta |
| `fuente_validacion` | VARCHAR | YES | - | INAR/BU/NINGUNA |
| `base_captura` | VARCHAR | YES | - | BASE/CAPTURA |
| `operador_cedente` | VARCHAR | YES | - | Operador de origen (portabilidades) |
| `validacion_huella` | VARCHAR | YES | - | Tipo de validaciÃ³n biomÃ©trica |
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
| `descripcion_accesorios` | TEXT | YES | - | DescripciÃ³n de accesorios |
| `monto_liquidado` | NUMERIC | NO | - | Monto calculado |
| `notas` | TEXT | YES | - | Observaciones adicionales |
| `estado_cruce` | TEXT | YES | 'PENDIENTE' | Estado de conciliaciÃ³n INAR |
| `orden_en_inar` | BOOLEAN | YES | false | Si ya estÃ¡ en INAR |
| `created_at` | TIMESTAMP | YES | NOW() | Fecha de creaciÃ³n |
| `updated_at` | TIMESTAMP | YES | NOW() | Fecha de actualizaciÃ³n |
| `created_by` | VARCHAR | YES | - | Usuario que creÃ³ |
| `updated_by` | VARCHAR | YES | - | Usuario que actualizÃ³ |

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

**Ãndices recomendados:**
- `idx_ventas_tienda_fecha` (tienda_id, fecha)
- `idx_ventas_usuario_fecha` (usuario_id, fecha)
- `idx_ventas_orden` (orden_venta)
- `idx_ventas_estado_cruce` (estado_cruce)

---

#### 2.1.1 Estados de la Venta (`estado`)

| Estado | DescripciÃ³n |
|--------|-------------|
| `registrada` | Venta del dÃ­a, aprobada automÃ¡ticamente |
| `pendiente_aprobacion` | Venta rezagada sin permiso, requiere aprobaciÃ³n |
| `aprobada` | Venta rezagada aprobada por supervisor |
| `rechazada` | Venta rezagada rechazada |
| `anulada` | Venta anulada |

---

#### 2.1.2 Estados de Cruce INAR (`estado_cruce`)

| Estado | DescripciÃ³n |
|--------|-------------|
| `PENDIENTE` | Esperando proceso de conciliaciÃ³n |
| `COINCIDE` | Encontrado en INAR, datos coinciden |
| `DISCREPANCIA` | Encontrado en INAR con diferencias |
| `NO_ENCONTRADO` | No existe en INAR |

---

#### 2.1.3 Tipos de Documento (`tipo_documento_cliente`)

| CÃ³digo | Nombre | PatrÃ³n | Longitud |
|--------|--------|--------|----------|
| `DNI` | DNI | `/^\d{8}$/` | 8 |
| `CE` | CarnÃ© ExtranjerÃ­a | `/^\d{9}$/` | 9 |
| `RUC` | RUC | `/^(10\|20)\d{9}$/` | 11 |
| `PASAPORTE` | Pasaporte | `/^[A-Z0-9]{6,12}$/i` | 6-12 |
| `PTP` | PTP | `/^[A-Z0-9]{6,15}$/i` | 6-15 |

---

#### 2.1.4 ValidaciÃ³n BiomÃ©trica (`validacion_huella`)

| CÃ³digo | DescripciÃ³n |
|--------|-------------|
| `HUELLERO` | ValidaciÃ³n con huellero biomÃ©trico |
| `DJ` | DeclaraciÃ³n Jurada (requiere autorizaciÃ³n) |
| `VENTA EXTRANJERO` | Cliente extranjero sin huella en RENIEC |

---

#### 2.1.5 Forma de Pago Equipo (`vep_contado`)

| CÃ³digo | DescripciÃ³n |
|--------|-------------|
| `VEP` | Venta a Plazos (crÃ©dito) |
| `CONTADO` | Pago al contado |

---

#### 2.1.6 Campos Legacy (pendientes de limpieza)

Los siguientes campos estÃ¡n duplicados y se mantienen por compatibilidad:

| Campo Actual | Campo Legacy | AcciÃ³n Pendiente |
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
| `tipo_documento_cliente` | VARCHAR(20) | YES | - | Tipo de documento: DNI, CE, OTRO |
| `dni_cliente` | VARCHAR | YES | - | Número de documento (formato según tipo) |
| `nombre_cliente` | VARCHAR(200) | YES | - | Nombre obtenido de API (RENIEC/Migraciones) |
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

CONSTRAINT arribos_tipo_documento_cliente_check
  CHECK (tipo_documento_cliente IS NULL OR tipo_documento_cliente IN ('DNI', 'CE', 'OTRO'))

CONSTRAINT arribos_dni_cliente_format_check
  CHECK (
    dni_cliente IS NULL 
    OR (tipo_documento_cliente = 'DNI' AND dni_cliente ~ '^\d{8}$')
    OR (tipo_documento_cliente = 'CE' AND dni_cliente ~ '^\d{9}$')
    OR (tipo_documento_cliente = 'OTRO')
    OR (tipo_documento_cliente IS NULL)
  )
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

#### 2.2.2 Tipo de Documento (`tipo_documento_cliente`)

| Código | Descripción | Validación | Consulta API |
|--------|-------------|------------|--------------|
| `DNI` | Documento Nacional de Identidad | 8 dígitos | ✅ json.pe/api/dni |
| `CE` | Carné de Extranjería | 9 dígitos | ✅ json.pe/api/cee |
| `OTRO` | Otro documento | Libre | ❌ |
| `null` | No proporcionó documento | - | ❌ |

---

#### 2.2.3 Semántica de `es_cliente_entel`

El campo es BOOLEAN pero representa 3 estados:

| Valor | Significado |
|-------|-------------|
| `true` | Sí es cliente Entel |
| `false` | No es cliente Entel |
| `null` | No se sabe / No preguntó |

---

#### 2.2.4 Motivos de No Venta (`motivo_no_venta`)

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

#### 2.2.5 Nota sobre `registrado_por`

⚠️ **Inconsistencia conocida:** Este campo es VARCHAR en lugar de UUID.
- En tabla `ventas`: `registrado_por` es UUID con FK a usuarios
- En tabla `arribos`: `registrado_por` es VARCHAR sin FK

**Pendiente:** Evaluar migración a UUID para consistencia con otros módulos.

---

#### 2.2.6 Métricas de Conversión

Los arribos se utilizan para calcular:

| Métrica | Fórmula |
|---------|---------|
| Tasa de Conversión | `(Ventas del día / Arribos del día) × 100` |
| Arribos por Hora | `Total Arribos / Horas Operativas` |
| Efectividad por Tienda | Comparación de conversión entre tiendas |

**Query de ejemplo:**
```sql
SELECT 
    t.nombre AS tienda,
    COUNT(a.id) AS arribos,
    SUM(CASE WHEN a.se_vendio = true THEN 1 ELSE 0 END) AS ventas,
    ROUND(
        SUM(CASE WHEN a.se_vendio = true THEN 1 ELSE 0 END)::numeric / 
        NULLIF(COUNT(a.id), 0) * 100, 
        2
    ) AS tasa_conversion
FROM arribos a
JOIN tiendas t ON a.tienda_id = t.id
WHERE a.fecha = CURRENT_DATE
GROUP BY t.id, t.nombre;
```

---

## 3. MÓDULO INAR
## 3. MÃ“DULO INAR

### 3.1 lineas_inar
LÃ­neas activadas (49 campos). PK: vchc_contratofs.

### 3.2 inar_importaciones
Historial de importaciones.

### 3.3 inar_mapeo_columnas
Mapeo Excel â†’ BD.

---

## 4. CONTROL

### 4.1 asesor_incidencias
Incidencias por asesor.

### 4.2 logs_auditoria
Logs de cambios.

---

## 5. MÃ“DULO COMISIONES

### 5.1 commission_item_types
CatÃ¡logo de tipos de partida.

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
AsignaciÃ³n de esquemas a HC.

---

## 6. MÃ“DULO PENALIDADES

### 6.1 penalty_types
CatÃ¡logo de tipos (18 tipos).

### 6.2 penalty_equivalences
Equivalencias SSNN â†’ HC.

### 6.3 hc_penalties
Registro histÃ³rico.

### 6.4 penalty_imports
Historial de importaciones.

---

## 7. PRESETS PARTIDAS (v2.1)

### 7.1 partition_presets
25 presets (9 agrupaciones + 16 individuales).

### 7.2 partition_preset_ventas
Mapeo N:N preset â†’ tipo_venta.

### 7.3 commission_item_ventas
Mapeo N:N partida â†’ tipo_venta.

---

## 8. MÃ“DULO DE CUOTAS (v2.3)

### 8.1 quota_imports

Historial de importaciones de archivos de cuotas de Entel.

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `file_name` | VARCHAR(255) | NO | - | Nombre del archivo |
| `file_url` | TEXT | YES | - | URL del archivo |
| `file_size` | INTEGER | YES | - | TamaÃ±o en bytes |
| `year` | INTEGER | NO | - | AÃ±o |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `total_rows` | INTEGER | NO | 0 | Total de filas |
| `imported_rows` | INTEGER | NO | 0 | Filas importadas |
| `error_rows` | INTEGER | NO | 0 | Filas con error |
| `errors` | JSONB | YES | - | Detalle de errores |
| `ai_interpretation_log` | JSONB | YES | - | Log AI |
| `column_mapping` | JSONB | YES | - | Mapeo columnas |
| `status` | VARCHAR(20) | NO | 'pending' | pending/processing/completed/failed |
| `imported_by` | UUID | YES | - | FK â†’ usuarios.id |
| `imported_at` | TIMESTAMPTZ | YES | - | Fecha importaciÃ³n |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creaciÃ³n |

**Ãndices:** `idx_quota_imports_period`, `idx_quota_imports_status`

---

### 8.2 store_quotas

Cuotas mensuales por tienda (importadas de Entel).

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `store_id` | UUID | NO | - | FK â†’ tiendas.id |
| `year` | INTEGER | NO | - | AÃ±o |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `ss_quota_entel` | INTEGER | NO | - | **Cuota SS original de Entel (inmutable)** |
| `ss_quota` | INTEGER | NO | - | **Cuota SS operativa SSNN (editable)** |
| `quota_breakdown` | JSONB | NO | '{}' | Desglose por partida |
| `source` | VARCHAR(20) | NO | 'entel' | entel/manual |
| `import_id` | UUID | YES | - | FK â†’ quota_imports.id |
| `original_store_name` | VARCHAR(200) | YES | - | Nombre en Excel |
| `status` | VARCHAR(20) | NO | 'draft' | draft/pending_approval/approved/archived |
| `approved_by` | UUID | YES | - | FK â†’ usuarios.id |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobaciÃ³n |
| `approval_notes` | TEXT | YES | - | Notas |
| `created_by` | UUID | YES | - | FK â†’ usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creaciÃ³n |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualizaciÃ³n |

**Constraints:** UNIQUE (`store_id`, `year`, `month`)

**Ãndices:** `idx_store_quotas_store`, `idx_store_quotas_period`, `idx_store_quotas_status`

**Notas importantes (v2.3):**
- `ss_quota_entel`: Cuota original importada de Entel. NO debe modificarse despuÃ©s de importaciÃ³n.
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

| Columna | Tipo | Nullable | Default | DescripciÃ³n |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK â†’ usuarios.id |
| `store_quota_id` | UUID | NO | - | FK â†’ store_quotas.id (CASCADE) |
| `store_id` | UUID | NO | - | FK â†’ tiendas.id |
| `year` | INTEGER | NO | - | AÃ±o |
| `month` | INTEGER | NO | - | Mes (1-12) |
| `ss_quota` | INTEGER | NO | - | Cuota SS asignada |
| `quota_breakdown` | JSONB | NO | '{}' | Desglose proporcional |
| `start_date` | DATE | YES | - | Fecha inicio (prorrateo) |
| `proration_factor` | DECIMAL(5,4) | NO | 1.0000 | Factor 0-1 |
| `prorated_ss_quota` | DECIMAL(10,2) | YES | - | Cuota prorrateada |
| `status` | VARCHAR(20) | NO | 'draft' | draft/pending_approval/approved/archived |
| `distributed_by` | UUID | YES | - | FK â†’ usuarios.id |
| `distributed_at` | TIMESTAMPTZ | YES | - | Fecha distribuciÃ³n |
| `approved_by` | UUID | YES | - | FK â†’ usuarios.id |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobaciÃ³n |
| `notes` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creaciÃ³n |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualizaciÃ³n |

**Constraints:** UNIQUE (`user_id`, `year`, `month`)

**Ãndices:** `idx_hc_quotas_user`, `idx_hc_quotas_store`, `idx_hc_quotas_period`, `idx_hc_quotas_status`

**Prorrateo:** Si HC inicia dÃ­a 15 de mes con 31 dÃ­as â†’ `proration_factor = 17/31 = 0.5484`

---

## 9. VISTAS MÃ“DULO CUOTAS (v2.3)

### 9.1 vw_store_quotas_summary

Resumen por tienda con cuotas Entel/SSNN y estadÃ­sticas de distribuciÃ³n.

| Columna | Tipo | DescripciÃ³n |
|---------|------|-------------|
| `id` | UUID | ID de store_quota |
| `year` | INTEGER | AÃ±o |
| `month` | INTEGER | Mes |
| `store_id` | UUID | ID de tienda |
| `store_code` | VARCHAR | CÃ³digo de tienda |
| `store_name` | VARCHAR | Nombre de tienda |
| `ss_quota_entel` | INTEGER | **Cuota original Entel (referencia)** |
| `ss_quota_ssnn` | INTEGER | **Cuota operativa SSNN (editable)** |
| `ss_quota_diferencia` | INTEGER | **Diferencia (SSNN - Entel)** |
| `quota_breakdown` | JSONB | Desglose por tipo |
| `status` | VARCHAR | Estado |
| `created_at` | TIMESTAMPTZ | Fecha creaciÃ³n |
| `approved_at` | TIMESTAMPTZ | Fecha aprobaciÃ³n |
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

| Columna | Tipo | DescripciÃ³n |
|---------|------|-------------|
| `id` | UUID | ID de hc_quota |
| `user_id` | UUID | ID de usuario |
| `codigo_asesor` | VARCHAR | CÃ³digo del asesor |
| `nombre_completo` | VARCHAR | Nombre del asesor |
| `rol` | VARCHAR | Rol del usuario |
| `zona` | VARCHAR | Zona asignada |
| `store_id` | UUID | ID de tienda |
| `store_code` | VARCHAR | CÃ³digo de tienda |
| `store_name` | VARCHAR | Nombre de tienda |
| `year` | INTEGER | AÃ±o |
| `month` | INTEGER | Mes |
| `hc_ss_quota` | INTEGER | Cuota SS del HC |
| `prorated_ss_quota` | DECIMAL | Cuota prorrateada |
| `proration_factor` | DECIMAL | Factor de prorrateo |
| `store_ss_quota` | INTEGER | Cuota SS de tienda |
| `pct_of_store` | DECIMAL | % del HC respecto a tienda |

---

## 10. FUNCIONES MÃ“DULO CUOTAS (v2.3)

### 10.1 get_quota_period_summary(p_year, p_month)

Obtiene resumen consolidado del perÃ­odo con totales Entel vs SSNN.

**ParÃ¡metros:**
- `p_year` INTEGER - AÃ±o
- `p_month` INTEGER - Mes

**Retorna:**
| Campo | Tipo | DescripciÃ³n |
|-------|------|-------------|
| `total_stores` | INTEGER | Tiendas activas |
| `stores_with_quota` | INTEGER | Tiendas con cuota |
| `stores_distributed` | INTEGER | Tiendas con distribuciÃ³n |
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

**ParÃ¡metros:**
- `p_store_quota_id` UUID - ID del store_quota
- `p_new_ss_quota` INTEGER - Nueva cuota SSNN
- `p_user_id` UUID - Usuario que modifica (para auditorÃ­a)

**Validaciones:**
- Nueva cuota â‰¥ suma de cuotas ya distribuidas a HCs
- Nueva cuota â‰¥ 0

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

## 11. DIAGRAMA MÃ“DULO CUOTAS (v2.3)

```
ENTEL (Excel) â†’ quota_imports â†’ store_quotas â†’ hc_quotas â†’ Simulador
                                     â”‚               â”‚
                              â”Œâ”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”        â”‚
                              â”‚             â”‚        â”‚
                        ss_quota_entel  ss_quota     â”‚
                        (inmutable)    (editable)    â”‚
                                     â”‚               â”‚
                                     â–¼               â–¼
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
- `ss_quota_entel` es inmutable despuÃ©s de importaciÃ³n
- `ss_quota` puede ser mayor o menor que `ss_quota_entel`
- La diferencia indica ajustes del SSNN respecto a Entel
- Solo se puede reducir `ss_quota` si no hay distribuciÃ³n que lo exceda

---


## 12. CONFIGURACIÓN DEL SISTEMA

### 12.1 system_config

Tabla de configuración general del sistema para almacenar parámetros, tokens de APIs y configuraciones.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `key` | VARCHAR(100) | NO | - | PK, clave única de configuración |
| `value` | TEXT | NO | - | Valor de la configuración |
| `description` | TEXT | YES | - | Descripción del parámetro |
| `is_secret` | BOOLEAN | NO | false | Si es true, no exponer en APIs públicas |
| `category` | VARCHAR(50) | NO | 'general' | Categoría de la configuración |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha de actualización |
| `updated_by` | UUID | YES | - | FK → usuarios.id |

**Constraints:**
```sql
CONSTRAINT system_config_pkey PRIMARY KEY (key)
CONSTRAINT system_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES usuarios(id)
```

**RLS:** Solo rol ADMIN puede leer/escribir.

---

#### 12.1.1 Categorías de Configuración (`category`)

| Categoría | Descripción | Ejemplos |
|-----------|-------------|----------|
| `general` | Configuración general del sistema | Nombre empresa, timezone |
| `api` | Credenciales y URLs de APIs externas | Tokens, endpoints |
| `limits` | Límites y umbrales | Max registros, timeouts |
| `features` | Feature flags | Habilitar/deshabilitar funciones |

---

#### 12.1.2 Configuraciones Iniciales

| Key | Categoría | Secreto | Descripción |
|-----|-----------|---------|-------------|
| `JSON_PE_TOKEN` | api | ✅ | Token para API de consulta DNI/CE (json.pe) |
| `JSON_PE_URL` | api | ❌ | URL del endpoint de consulta DNI |

---

#### 12.1.3 Uso en Backend

```typescript
// El backend usa supabaseAdmin (service_role) que bypasea RLS
const { data } = await supabaseAdmin
  .from('system_config')
  .select('key, value')
  .eq('key', 'JSON_PE_TOKEN')
  .single()
```

**Importante:** 
- Los valores con `is_secret = true` nunca deben exponerse en endpoints públicos
- El backend implementa cache de 5 minutos para reducir consultas a BD

---

## 13. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-24 | 1.0 | Diccionario inicial con 17 objetos |
| 2026-01-25 | 2.0 | Módulo Comisiones y Penalidades (11 tablas) |
| 2026-01-25 | 2.1 | Sistema partidas flexible (3 tablas, 2 vistas, 2 funciones) |
| 2026-01-26 | 2.2 | Módulo Cuotas: 3 tablas, 2 vistas, 4 funciones. Distribución Entel→Tienda→HC con prorrateo. |
| 2026-01-26 | 2.2.1 | Corrección tabla usuarios: codigo_asesor, nombre_completo, campo zona y password_hash. |
| 2026-01-27 | 2.3 | Sistema de cuota dual Entel/SSNN: columna `ss_quota_entel` en store_quotas, vista `vw_store_quotas_summary` con 3 columnas (entel, ssnn, diferencia), función `get_quota_period_summary` actualizada con totales duales, función `update_store_quota_ssnn` para edición con validación. |
| 2026-01-27 | 2.4 | Documentación completa tabla `ventas`: 40+ columnas, constraints (tipo_documento, estado, estado_cruce, validacion_huella, vep_contado, base_captura), estados del flujo, campos legacy identificados. Detalle de tipos_venta con 16 tipos en 6 categorías. |
| 2026-01-27 | 2.5 | Documentación completa tabla `arribos`: 14 columnas, constraints (tipo_visita, motivo_no_venta), semántica de es_cliente_entel (boolean con null=NO_SABE), métricas de conversión. Identificada inconsistencia: registrado_por es VARCHAR en lugar de UUID. |
| 2026-01-28 | **2.6** | **Módulo Arribos v1.2:** Nueva tabla `system_config` para configuración del sistema. Nuevas columnas en `arribos`: `tipo_documento_cliente`, `nombre_cliente`. Nuevos constraints para validación de documentos. Integración con API json.pe para consulta DNI/CE. |

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen o modifiquen tablas.
