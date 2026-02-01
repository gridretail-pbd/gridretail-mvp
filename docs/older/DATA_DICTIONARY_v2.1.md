# GridRetail - Diccionario de Datos
## Documento de Referencia de Base de Datos
**Versión:** 2.1  
**Última actualización:** 2026-01-25  
**Base de datos:** Supabase (PostgreSQL)

---

## 1. TABLAS CORE

### 1.1 usuarios

Almacena todo el personal del sistema (comercial y administrativo).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `auth_id` | UUID | YES | - | FK a auth.users de Supabase |
| `codigo_entel` | VARCHAR(50) | NO | - | Código Entel (ej: PBD_ASCHUMPITAZ) |
| `dni` | VARCHAR(8) | NO | - | DNI del usuario |
| `nombres` | VARCHAR(100) | NO | - | Nombres |
| `apellidos` | VARCHAR(100) | NO | - | Apellidos |
| `email` | VARCHAR(255) | YES | - | Email |
| `telefono` | VARCHAR(15) | YES | - | Teléfono |
| `rol` | VARCHAR(30) | NO | - | Rol (ver constraint) |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint de Roles:**
```sql
CHECK (rol IN (
    'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
    'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
    'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
    'VALIDADOR_ARRIBOS', 'ADMIN'
))
```

**Índices:**
- `idx_usuarios_codigo_entel` en `codigo_entel`
- `idx_usuarios_dni` en `dni`
- `idx_usuarios_rol` en `rol`

---

### 1.2 tiendas

Catálogo de las 21 tiendas TEX.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(30) | NO | - | Código único (ej: TE_AGUSTINO) |
| `nombre` | VARCHAR(100) | NO | - | Nombre completo |
| `direccion` | TEXT | YES | - | Dirección física |
| `distrito` | VARCHAR(50) | YES | - | Distrito |
| `activa` | BOOLEAN | NO | true | Estado activa |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:**
- UNIQUE en `codigo`

---

### 1.3 usuarios_tiendas

Relación muchos a muchos entre usuarios y tiendas.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `es_principal` | BOOLEAN | NO | false | Si es tienda principal del usuario |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:**
- UNIQUE (`usuario_id`, `tienda_id`)

---

### 1.4 tipos_venta

Catálogo de los 16 tipos de venta disponibles.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(20) | NO | - | Código único (ej: OSS_BASE) |
| `nombre` | VARCHAR(50) | NO | - | Nombre legible |
| `categoria` | VARCHAR(20) | NO | - | POSTPAGO, PACK, PACK_SS, RENO, PREPAGO, OTROS |
| `fuente_validacion` | VARCHAR(20) | NO | - | INAR, FICHA, INTERNO |
| `requiere_cedente` | BOOLEAN | NO | false | Si requiere operador cedente |
| `requiere_imei` | BOOLEAN | NO | false | Si requiere IMEI |
| `requiere_iccid` | BOOLEAN | NO | false | Si requiere ICCID |
| `permite_seguro` | BOOLEAN | NO | false | Si permite venta de seguro |
| `descripcion_ayuda` | TEXT | YES | - | Texto de ayuda contextual |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `orden` | INTEGER | NO | 0 | Orden de visualización |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:**
- UNIQUE en `codigo`
- `idx_tipos_venta_categoria` en `categoria`

**Datos actuales (16 registros):**
```
POSTPAGO: OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, 
          VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN (8 tipos)
PACK: PACK_VR, PACK_OPEN (2 tipos)
PACK_SS: PACK_OSS, PACK_VR_BASE (2 tipos)
RENO: RENO (1 tipo)
PREPAGO: PREPAGO, PORTA_PP (2 tipos)
OTROS: ACCESORIOS (1 tipo)
```

> **Nota v2.1:** Se eliminó OPP_MONO (no existía en operación real) y se agregó PACK_OPEN (equipo sin línea).

---

### 1.5 operadores_cedentes

Catálogo de operadores para portabilidad.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(20) | NO | - | Código (ej: MOVISTAR) |
| `nombre` | VARCHAR(50) | NO | - | Nombre completo |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `orden` | INTEGER | NO | 0 | Orden de visualización |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Datos actuales:**
- MOVISTAR, CLARO, BITEL

---

## 2. OPERACIONES DIARIAS

### 2.1 ventas

Registro declarativo de ventas (Boca de Urna).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (vendedor) |
| `fecha_venta` | DATE | NO | - | Fecha de la venta |
| `hora_venta` | TIME | YES | - | Hora de la venta |
| `rango_horario` | VARCHAR(20) | YES | - | Rango horario |
| `timestamp_registro` | TIMESTAMPTZ | NO | NOW() | Momento del registro |
| **Identificación** |||||
| `orden_venta` | VARCHAR(20) | YES | - | Número de orden |
| `telefono_linea` | VARCHAR(15) | YES | - | Número de línea |
| `numero_documento_cliente` | VARCHAR(15) | YES | - | DNI del cliente |
| `nombre_cliente` | VARCHAR(200) | YES | - | Nombre del cliente |
| **Clasificación** |||||
| `tipo_venta` | VARCHAR(20) | NO | - | FK lógica → tipos_venta.codigo |
| `categoria_venta` | VARCHAR(20) | YES | - | Categoría |
| `fuente_validacion` | VARCHAR(20) | YES | - | Fuente de validación |
| `operador_cedente` | VARCHAR(20) | YES | - | Operador origen (portabilidad) |
| **Plan y Equipo** |||||
| `plan_tarifario` | TEXT | YES | - | Plan contratado |
| `modo_pago` | VARCHAR(20) | YES | - | CONTADO, VEP |
| `imei` | VARCHAR(20) | YES | - | IMEI del equipo |
| `iccid` | VARCHAR(25) | YES | - | ICCID del chip |
| `modelo_equipo` | VARCHAR(100) | YES | - | Modelo del equipo |
| **Seguro y Accesorios** |||||
| `incluye_seguro` | BOOLEAN | NO | false | Si incluye MEP |
| `tipo_seguro` | VARCHAR(50) | YES | - | Tipo de seguro |
| `incluye_accesorios` | BOOLEAN | NO | false | Si incluye accesorios |
| `descripcion_accesorios` | TEXT | YES | - | Detalle de accesorios |
| **Control** |||||
| `es_venta_rezagada` | BOOLEAN | NO | false | Si es venta de día anterior |
| `motivo_rezago` | TEXT | YES | - | Motivo del rezago |
| `estado` | VARCHAR(20) | NO | 'registrada' | Estado del registro |
| `aprobado_por` | UUID | YES | - | FK → usuarios.id |
| `fecha_aprobacion` | TIMESTAMPTZ | YES | - | Fecha de aprobación |
| `motivo_rechazo` | TEXT | YES | - | Motivo si rechazada |
| `registrado_por` | UUID | YES | - | FK → usuarios.id |
| **Cruce INAR** |||||
| `inar_id` | BIGINT | YES | - | FK → lineas_inar.id |
| `inar_match_type` | VARCHAR(20) | YES | - | Tipo de match: orden_venta, telefono, dni |
| `inar_match_confidence` | INTEGER | YES | - | Confianza del match |
| `estado_cruce` | VARCHAR(20) | NO | 'pendiente' | pendiente, cruzado, sin_coincidencia |
| **Auditoría** |||||
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Índices:**
- `idx_ventas_tienda` en `tienda_id`
- `idx_ventas_usuario` en `usuario_id`
- `idx_ventas_fecha` en `fecha_venta`
- `idx_ventas_orden` en `orden_venta`
- `idx_ventas_telefono` en `telefono_linea`
- `idx_ventas_categoria` en `categoria_venta`
- `idx_ventas_tipo` en `tipo_venta`

---

### 2.2 arribos

Registro de clientes que ingresan a tienda.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `fecha` | DATE | NO | - | Fecha del arribo |
| `hora` | TIME | NO | - | Hora del arribo |
| `dni_cliente` | VARCHAR(8) | YES | - | DNI (opcional) |
| `es_cliente_entel` | VARCHAR(10) | YES | - | SI, NO, NO_SABE |
| `resultado` | VARCHAR(30) | YES | - | VENTA, NO_VENTA, POSTVENTA |
| `motivo_no_venta` | TEXT | YES | - | Motivo si no vendió |
| `validado` | BOOLEAN | NO | false | Si fue validado |
| `validado_por` | UUID | YES | - | FK → usuarios.id |
| `fecha_validacion` | TIMESTAMPTZ | YES | - | Fecha validación |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

---

## 3. MÓDULO INAR

### 3.1 lineas_inar

Líneas activadas importadas del INAR de Entel (49 campos seleccionados).

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | BIGSERIAL | NO | PK |
| `vchc_contratofs` | VARCHAR(50) | NO | Contrato único (UNIQUE) |
| `vchtelefono` | VARCHAR(15) | YES | Número de teléfono |
| `numnro_orden` | VARCHAR(20) | YES | Número de orden |
| `vchid_pdv` | VARCHAR(50) | YES | Código de tienda |
| `vchnombrePdv` | VARCHAR(100) | YES | Nombre de tienda |
| `vchvendedor_packsim` | VARCHAR(100) | YES | Vendedor PackSim |
| `vchvendedordni` | VARCHAR(20) | YES | DNI del vendedor |
| `vchn_plan` | VARCHAR(50) | YES | Plan |
| `vchmodopago` | VARCHAR(20) | YES | Modo de pago |
| `dtefecha_alta` | DATE | YES | Fecha de alta |
| ... | ... | ... | (49 campos en total) |
| `importacion_id` | UUID | YES | FK → inar_importaciones.id |
| `created_at` | TIMESTAMPTZ | NO | Fecha de importación |

**Índices:**
- UNIQUE en `vchc_contratofs`
- `idx_lineas_inar_telefono` en `vchtelefono`
- `idx_lineas_inar_orden` en `numnro_orden`
- `idx_lineas_inar_fecha` en `dtefecha_alta`
- `idx_lineas_inar_tienda` en `vchid_pdv`

---

### 3.2 inar_importaciones

Historial de importaciones de archivos INAR.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `nombre_archivo` | VARCHAR(255) | NO | - | Nombre del archivo |
| `fecha_archivo` | DATE | YES | - | Fecha del archivo |
| `periodo` | VARCHAR(7) | YES | - | Período (YYYY-MM) |
| `total_registros` | INTEGER | NO | 0 | Total de registros en archivo |
| `registros_nuevos` | INTEGER | NO | 0 | Registros insertados |
| `registros_existentes` | INTEGER | NO | 0 | Registros ya existentes |
| `registros_error` | INTEGER | NO | 0 | Registros con error |
| `importado_por` | UUID | YES | - | FK → usuarios.id |
| `estado` | VARCHAR(20) | NO | 'completado' | Estado de importación |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha de importación |

---

### 3.3 inar_mapeo_columnas

Mapeo de columnas del Excel INAR a campos de BD.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `columna_excel` | VARCHAR(100) | NO | - | Nombre en Excel |
| `columna_bd` | VARCHAR(100) | NO | - | Nombre en BD |
| `tipo_dato` | VARCHAR(30) | NO | - | Tipo de dato |
| `activo` | BOOLEAN | NO | true | Si se importa |
| `orden` | INTEGER | NO | 0 | Orden |

---

## 4. CONTROL Y AUDITORÍA

### 4.1 asesor_incidencias

Registro de incidencias por asesor.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `fecha` | DATE | NO | - | Fecha de incidencia |
| `tipo_incidencia` | VARCHAR(30) | NO | - | Tipo |
| `descripcion` | TEXT | YES | - | Descripción |
| `puntos` | INTEGER | NO | 0 | Puntos de penalización |
| `referencia_id` | UUID | YES | - | ID de referencia |
| `registrado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Tipos de incidencia:**
- VENTA_REZAGADA
- VENTA_RECHAZADA
- ARRIBO_INCONSISTENTE
- DATOS_INCORRECTOS

---

### 4.2 logs_auditoria

Logs generales del sistema.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tabla` | VARCHAR(50) | NO | - | Tabla afectada |
| `registro_id` | UUID | NO | - | ID del registro |
| `accion` | VARCHAR(20) | NO | - | INSERT, UPDATE, DELETE |
| `datos_anteriores` | JSONB | YES | - | Datos antes del cambio |
| `datos_nuevos` | JSONB | YES | - | Datos después del cambio |
| `usuario_id` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha |

---

## 5. VISTAS CORE

### 5.1 v_tipos_venta_config

Vista de configuración de tipos de venta activos.

```sql
SELECT 
    codigo,
    nombre,
    categoria,
    fuente_validacion,
    requiere_cedente,
    requiere_imei,
    permite_seguro,
    descripcion_ayuda
FROM tipos_venta
WHERE activo = true
ORDER BY orden;
```

---

### 5.2 v_inar_resumen_diario

Resumen de líneas INAR por día.

---

### 5.3 v_inar_resumen_tienda

Resumen de líneas INAR por tienda.

---

### 5.4 v_inar_resumen_vendedor

Resumen de líneas INAR por vendedor.

---

### 5.5 asesor_score_mensual

Score mensual calculado por asesor.

```sql
SELECT 
    usuario_id,
    DATE_TRUNC('month', fecha) AS mes,
    COUNT(*) AS total_incidencias,
    SUM(puntos) AS puntos_totales,
    COUNT(*) FILTER (WHERE tipo_incidencia = 'VENTA_REZAGADA') AS ventas_rezagadas,
    COUNT(*) FILTER (WHERE tipo_incidencia = 'VENTA_RECHAZADA') AS ventas_rechazadas,
    ...
FROM asesor_incidencias
GROUP BY usuario_id, DATE_TRUNC('month', fecha);
```

---

## 6. FUNCIONES Y TRIGGERS

### 6.1 trigger_set_updated_at()

Función reutilizable para actualizar `updated_at` automáticamente.

```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Uso en nuevas tablas:**
```sql
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON nueva_tabla
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
```

---

## 7. MÓDULO DE COMISIONES

Las siguientes tablas fueron creadas para el Modelador de Comisiones HC.

### 7.1 commission_item_types

Catálogo maestro de tipos de partida para esquemas de comisiones. Mapea con `tipos_venta` existente.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `code` | VARCHAR(50) | NO | - | Código único (ej: OSS, VR_CAPTURA) |
| `name` | VARCHAR(100) | NO | - | Nombre completo |
| `short_name` | VARCHAR(30) | YES | - | Nombre corto para UI |
| `category` | VARCHAR(30) | NO | - | Categoría (ver constraint) |
| `calculation_type` | VARCHAR(30) | NO | - | Tipo de cálculo (ver constraint) |
| `group_code` | VARCHAR(30) | YES | - | Agrupación (OSS, OPP, VR, etc.) |
| `parent_type_id` | UUID | YES | - | FK → commission_item_types.id |
| `tipos_venta_codigos` | TEXT[] | YES | - | Códigos de tipos_venta que mapean |
| `counts_to_ss_quota` | BOOLEAN | NO | false | ¿Suma a cuota SS? |
| `allows_overcap` | BOOLEAN | NO | true | ¿Permite >100%? |
| `also_counts_as` | TEXT[] | YES | - | Códigos para conteo múltiple |
| `description` | TEXT | YES | - | Descripción |
| `display_order` | INTEGER | NO | 0 | Orden de visualización |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `category` IN ('principal', 'adicional', 'pxq', 'postventa', 'bono')
- `calculation_type` IN ('percentage', 'pxq', 'binary', 'fixed')
- UNIQUE en `code`

**Índices:**
- `idx_commission_item_types_category` en `category`
- `idx_commission_item_types_group` en `group_code`
- `idx_commission_item_types_active` en `is_active`

**Datos precargados:** 25 tipos de partida (OSS, OPP, VR, RENO, PACK, PXQ, BONOS, etc.)

---

### 7.2 commission_schemes

Esquemas de comisiones con estados: oficial, draft, aprobado, archivado.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `name` | VARCHAR(150) | NO | - | Nombre del esquema |
| `code` | VARCHAR(50) | NO | - | Código único |
| `description` | TEXT | YES | - | Descripción |
| `scheme_type` | VARCHAR(30) | NO | - | Tipo: asesor/supervisor/encargado |
| `year` | INTEGER | NO | - | Año de aplicación |
| `month` | INTEGER | NO | - | Mes de aplicación (1-12) |
| `status` | VARCHAR(20) | NO | 'draft' | Estado del esquema |
| `source` | VARCHAR(20) | NO | 'socio' | Origen: entel/socio |
| `parent_scheme_id` | UUID | YES | - | FK → commission_schemes.id |
| `fixed_salary` | DECIMAL(10,2) | NO | 0 | Sueldo fijo |
| `variable_salary` | DECIMAL(10,2) | NO | 0 | Sueldo variable máximo |
| `total_ss_quota` | INTEGER | NO | 0 | Cuota total SS |
| `default_min_fulfillment` | DECIMAL(5,4) | YES | 0.50 | Cumplimiento mínimo global |
| `source_file_name` | VARCHAR(255) | YES | - | Nombre archivo origen |
| `source_file_url` | TEXT | YES | - | URL archivo origen |
| `ai_interpretation_log` | JSONB | YES | - | Log de interpretación AI |
| `approved_by` | UUID | YES | - | FK → usuarios.id |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobación |
| `approval_notes` | TEXT | YES | - | Notas de aprobación |
| `created_by` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `scheme_type` IN ('asesor', 'supervisor', 'encargado')
- `status` IN ('oficial', 'draft', 'aprobado', 'archivado')
- `source` IN ('entel', 'socio')
- `year` BETWEEN 2020 AND 2100
- `month` BETWEEN 1 AND 12
- UNIQUE en `code`

**Índices:**
- `idx_commission_schemes_period` en (`year`, `month`)
- `idx_commission_schemes_status` en `status`
- `idx_commission_schemes_type` en `scheme_type`
- `idx_commission_schemes_type_period` en (`scheme_type`, `year`, `month`, `status`)

**Trigger:** `ensure_single_approved_scheme` - Archiva automáticamente otros esquemas aprobados del mismo período.

---

### 7.3 commission_scheme_items

Partidas individuales de cada esquema.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `scheme_id` | UUID | NO | - | FK → commission_schemes.id (CASCADE) |
| `item_type_id` | UUID | **YES** | - | FK → commission_item_types.id (nullable desde v2.1) |
| `preset_id` | UUID | YES | - | FK → partition_presets.id (v2.1) |
| `custom_name` | VARCHAR(100) | YES | - | Nombre personalizado (v2.1) |
| `custom_description` | TEXT | YES | - | Descripción personalizada (v2.1) |
| `original_label` | VARCHAR(200) | YES | - | Etiqueta original del Excel |
| `quota` | INTEGER | YES | - | Meta en unidades |
| `quota_amount` | DECIMAL(10,2) | YES | - | Meta en monto |
| `weight` | DECIMAL(5,4) | YES | - | Peso % (0.0000 - 1.0000) |
| `mix_factor` | DECIMAL(5,4) | YES | - | Factor mix para subpartidas |
| `variable_amount` | DECIMAL(10,2) | NO | 0 | Monto variable máximo |
| `min_fulfillment` | DECIMAL(5,4) | YES | - | Override cumplimiento mínimo |
| `has_cap` | BOOLEAN | NO | false | ¿Tiene tope? |
| `cap_percentage` | DECIMAL(5,4) | YES | 1.00 | Porcentaje tope |
| `cap_amount` | DECIMAL(10,2) | YES | - | Monto tope |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `display_order` | INTEGER | NO | 0 | Orden de visualización |
| `notes` | TEXT | YES | - | Notas |
| `ai_confidence` | DECIMAL(3,2) | YES | - | Confianza AI (0.00-1.00) |
| `ai_warnings` | TEXT[] | YES | - | Advertencias AI |
| `source_cell_ref` | VARCHAR(20) | YES | - | Referencia celda origen |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- UNIQUE (`scheme_id`, `item_type_id`) - donde item_type_id no sea NULL

**Índices:**
- `idx_scheme_items_scheme` en `scheme_id`
- `idx_scheme_items_type` en `item_type_id`

> **Nota v2.1:** `item_type_id` ahora es NULLABLE para soportar partidas completamente personalizadas. Se agregaron `preset_id`, `custom_name` y `custom_description`.

---

### 7.4 commission_pxq_scales

Escalas de precio por cantidad (PxQ) escalonado.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `scheme_item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) |
| `min_fulfillment` | DECIMAL(5,4) | NO | - | Cumplimiento mínimo del rango |
| `max_fulfillment` | DECIMAL(5,4) | YES | - | Cumplimiento máximo del rango |
| `amount_per_unit` | DECIMAL(10,2) | NO | - | Monto por unidad |
| `display_order` | INTEGER | NO | 0 | Orden |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:**
- UNIQUE (`scheme_item_id`, `min_fulfillment`)

**Índices:**
- `idx_pxq_scales_item` en `scheme_item_id`

---

### 7.5 commission_item_locks

Candados que condicionan el pago de una partida.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `scheme_item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) |
| `lock_type` | VARCHAR(30) | NO | - | Tipo de candado |
| `required_item_type_id` | UUID | YES | - | FK → commission_item_types.id |
| `required_value` | DECIMAL(10,2) | NO | - | Valor requerido |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `description` | TEXT | YES | - | Descripción |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `lock_type` IN ('min_quantity', 'min_amount', 'min_percentage', 'min_fulfillment')

**Índices:**
- `idx_item_locks_scheme_item` en `scheme_item_id`

---

### 7.6 commission_item_restrictions

Restricciones de mix de productos.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `scheme_id` | UUID | NO | - | FK → commission_schemes.id (CASCADE) |
| `scheme_item_id` | UUID | YES | - | FK → commission_scheme_items.id (CASCADE) |
| `restriction_type` | VARCHAR(30) | NO | - | Tipo de restricción |
| `plan_code` | VARCHAR(30) | YES | - | Código de plan |
| `operator_code` | VARCHAR(30) | YES | - | Código de operador |
| `max_percentage` | DECIMAL(5,4) | YES | - | Porcentaje máximo |
| `max_quantity` | INTEGER | YES | - | Cantidad máxima |
| `min_percentage` | DECIMAL(5,4) | YES | - | Porcentaje mínimo |
| `scope` | VARCHAR(20) | NO | 'hc' | Alcance: hc/tex/global |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `description` | TEXT | YES | - | Descripción |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `restriction_type` IN ('max_percentage', 'max_quantity', 'min_percentage', 'operator_origin')
- `scope` IN ('hc', 'tex', 'global')

**Índices:**
- `idx_restrictions_scheme` en `scheme_id`
- `idx_restrictions_item` en `scheme_item_id`

---

### 7.7 commission_hc_assignments

Asignación de esquemas a usuarios HC.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → usuarios.id |
| `scheme_id` | UUID | NO | - | FK → commission_schemes.id |
| `valid_from` | DATE | NO | - | Válido desde |
| `valid_to` | DATE | YES | - | Válido hasta |
| `custom_quota` | INTEGER | YES | - | Cuota personalizada |
| `custom_fixed_salary` | DECIMAL(10,2) | YES | - | Sueldo fijo personalizado |
| `custom_variable_salary` | DECIMAL(10,2) | YES | - | Variable personalizado |
| `custom_min_fulfillment` | DECIMAL(5,4) | YES | - | Cumpl. mín personalizado |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `notes` | TEXT | YES | - | Notas |
| `created_by` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- UNIQUE (`user_id`, `scheme_id`, `valid_from`)

**Índices:**
- `idx_hc_assignments_user` en `user_id`
- `idx_hc_assignments_scheme` en `scheme_id`
- `idx_hc_assignments_active` en `is_active`

---

## 8. MÓDULO DE PENALIDADES

### 8.1 penalty_types

Catálogo de tipos de penalidad (Entel e internas).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `code` | VARCHAR(50) | NO | - | Código único |
| `name` | VARCHAR(150) | NO | - | Nombre completo |
| `short_name` | VARCHAR(50) | YES | - | Nombre corto |
| `source` | VARCHAR(30) | NO | - | Origen: entel/interno |
| `base_amount_ssnn` | DECIMAL(10,2) | YES | - | Monto base Entel al SSNN |
| `identified_by` | VARCHAR(30) | NO | 'user' | Identificado por: user/tex/ssnn |
| `description` | TEXT | YES | - | Descripción |
| `is_predictable` | BOOLEAN | NO | true | ¿Es predecible? |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `display_order` | INTEGER | NO | 0 | Orden |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `source` IN ('entel', 'interno')
- `identified_by` IN ('user', 'tex', 'ssnn')
- UNIQUE en `code`

**Datos precargados:** 18 tipos (DJ, PORT_OUT, SUSPENDIDA, MISS_OUT, TARDANZA, etc.)

---

### 8.2 penalty_equivalences

Equivalencias: cuánto del monto SSNN se traslada al HC.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `penalty_type_id` | UUID | NO | - | FK → penalty_types.id |
| `valid_from` | DATE | NO | - | Válido desde |
| `valid_to` | DATE | YES | - | Válido hasta |
| `transfer_type` | VARCHAR(30) | NO | - | Tipo de traslado |
| `transfer_percentage` | DECIMAL(5,4) | YES | - | Porcentaje a trasladar |
| `transfer_fixed_amount` | DECIMAL(10,2) | YES | - | Monto fijo a trasladar |
| `max_incidents` | INTEGER | YES | - | Máx incidencias a cobrar |
| `created_by` | UUID | YES | - | FK → usuarios.id |
| `notes` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `transfer_type` IN ('none', 'full', 'percentage', 'fixed', 'partial_count')
- UNIQUE (`penalty_type_id`, `valid_from`)

**Índices:**
- `idx_penalty_equivalences_type` en `penalty_type_id`
- `idx_penalty_equivalences_valid` en (`valid_from`, `valid_to`)

---

### 8.3 hc_penalties

Registro histórico de penalidades por HC.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → usuarios.id |
| `store_id` | UUID | YES | - | FK → tiendas.id |
| `penalty_type_id` | UUID | NO | - | FK → penalty_types.id |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes |
| `incident_date` | DATE | YES | - | Fecha del incidente |
| `quantity` | INTEGER | NO | 1 | Cantidad de incidencias |
| `original_amount` | DECIMAL(10,2) | YES | - | Monto original SSNN |
| `transferred_amount` | DECIMAL(10,2) | YES | - | Monto trasladado al HC |
| `source` | VARCHAR(30) | NO | - | Origen: import/manual/system |
| `import_reference` | VARCHAR(100) | YES | - | Referencia de importación |
| `status` | VARCHAR(20) | NO | 'pending' | Estado |
| `notes` | TEXT | YES | - | Notas |
| `waived_reason` | TEXT | YES | - | Motivo de condonación |
| `waived_by` | UUID | YES | - | FK → usuarios.id |
| `waived_at` | TIMESTAMPTZ | YES | - | Fecha condonación |
| `created_by` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `source` IN ('import', 'manual', 'system')
- `status` IN ('pending', 'applied', 'waived', 'disputed')

**Índices:**
- `idx_hc_penalties_user` en `user_id`
- `idx_hc_penalties_period` en (`year`, `month`)
- `idx_hc_penalties_user_period` en (`user_id`, `year`, `month`)
- `idx_hc_penalties_type` en `penalty_type_id`
- `idx_hc_penalties_status` en `status`
- `idx_hc_penalties_store` en `store_id`

---

### 8.4 penalty_imports

Historial de importaciones de penalidades.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `file_name` | VARCHAR(255) | NO | - | Nombre del archivo |
| `file_url` | TEXT | YES | - | URL del archivo |
| `file_size` | INTEGER | YES | - | Tamaño en bytes |
| `year` | INTEGER | NO | - | Año |
| `month` | INTEGER | NO | - | Mes |
| `total_rows` | INTEGER | NO | 0 | Total de filas |
| `imported_rows` | INTEGER | NO | 0 | Filas importadas |
| `error_rows` | INTEGER | NO | 0 | Filas con error |
| `errors` | JSONB | YES | - | Detalle de errores |
| `status` | VARCHAR(20) | NO | 'pending' | Estado |
| `imported_by` | UUID | YES | - | FK → usuarios.id |
| `imported_at` | TIMESTAMPTZ | YES | - | Fecha importación |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:**
- `status` IN ('pending', 'processing', 'completed', 'failed')

**Índices:**
- `idx_penalty_imports_period` en (`year`, `month`)

---

## 9. SISTEMA DE PRESETS DE PARTIDAS (v2.1)

> **Nuevo en v2.1:** Sistema de mapeo flexible entre partidas de comisiones y tipos de venta.

### 9.1 partition_presets

Catálogo de presets predefinidos para facilitar la creación de partidas.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `code` | VARCHAR(50) | NO | - | Código único (ej: OSS, VR_CAPTURA) |
| `name` | VARCHAR(100) | NO | - | Nombre mostrado |
| `short_name` | VARCHAR(30) | YES | - | Nombre corto para botones UI |
| `description` | TEXT | YES | - | Descripción de ayuda |
| `default_category` | VARCHAR(30) | NO | - | Categoría por defecto |
| `default_calculation_type` | VARCHAR(30) | NO | - | Tipo de cálculo por defecto |
| `preset_group` | VARCHAR(30) | NO | - | Grupo: 'agrupacion' o 'individual' |
| `display_order` | INTEGER | NO | 0 | Orden de visualización |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
- `default_category` IN ('principal', 'adicional', 'pxq', 'bono')
- `default_calculation_type` IN ('percentage', 'pxq', 'binary')
- `preset_group` IN ('agrupacion', 'individual')
- UNIQUE en `code`

**Índices:**
- `idx_presets_active` en (`is_active`, `preset_group`)
- `idx_presets_group` en (`preset_group`, `display_order`)

**Datos precargados (25 presets):**

| Grupo | Cantidad | Códigos |
|-------|----------|---------|
| Agrupaciones | 9 | OSS, OPP, VR_CAPTURA, VR_BASE_LLAA, PACK_SS, RENO, PREPAGO, MISS_IN, ACCESORIOS |
| Individuales | 16 | IND_OSS_CAPTURA, IND_OSS_BASE, IND_OPP_CAPTURA, IND_OPP_BASE, IND_VR_MONO, IND_VR_CAPTURA, IND_VR_BASE, IND_MISS_IN, IND_PACK_OSS, IND_PACK_VR_BASE, IND_PACK_VR, IND_PACK_OPEN, IND_RENO, IND_PREPAGO, IND_PORTA_PP, IND_ACCESORIOS |

---

### 9.2 partition_preset_ventas

Mapeo N:N entre presets y tipos de venta.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `preset_id` | UUID | NO | - | FK → partition_presets.id (CASCADE) |
| `tipo_venta_id` | UUID | NO | - | FK → tipos_venta.id (CASCADE) |
| `cuenta_linea` | BOOLEAN | NO | true | Si la línea suma a la partida |
| `cuenta_equipo` | BOOLEAN | NO | false | Si el equipo suma a la partida |
| `display_order` | INTEGER | NO | 0 | Orden de visualización |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:**
- UNIQUE (`preset_id`, `tipo_venta_id`)

**Índices:**
- `idx_preset_ventas_preset` en `preset_id`
- `idx_preset_ventas_tipo` en `tipo_venta_id`

**Ejemplo de mapeos:**

| Preset | tipo_venta | cuenta_linea | cuenta_equipo |
|--------|------------|--------------|---------------|
| OSS | OSS_BASE | true | false |
| OSS | OSS_CAPTURA | true | false |
| OSS | PACK_OSS | true | false |
| PACK_SS | PACK_OSS | false | true |
| PACK_SS | PACK_VR_BASE | false | true |

---

### 9.3 commission_item_ventas

Mapeo N:N entre partidas de un esquema específico y tipos de venta.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `scheme_item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) |
| `tipo_venta_id` | UUID | NO | - | FK → tipos_venta.id (CASCADE) |
| `cuenta_linea` | BOOLEAN | NO | true | Si la línea suma a esta partida |
| `cuenta_equipo` | BOOLEAN | NO | false | Si el equipo suma a esta partida |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:**
- UNIQUE (`scheme_item_id`, `tipo_venta_id`)

**Índices:**
- `idx_item_ventas_scheme_item` en `scheme_item_id`
- `idx_item_ventas_tipo_venta` en `tipo_venta_id`

**Uso:**
Permite que cada partida de un esquema tenga su propio mapeo de tipos de venta:
- Esquema A: Partida "OSS" → OSS_BASE + OSS_CAPTURA + PACK_OSS(línea)
- Esquema B: Partida "OSS CAPTURA" → solo OSS_CAPTURA

---

## 10. VISTAS DEL MÓDULO COMISIONES

### 10.1 vw_hc_penalties_summary

Vista de resumen de penalidades por HC y período.

```sql
SELECT 
    hp.user_id,
    u.codigo_asesor,
    u.nombre_completo,
    hp.year,
    hp.month,
    pt.code AS penalty_code,
    pt.name AS penalty_name,
    pt.source AS penalty_source,
    COUNT(*) AS incident_count,
    SUM(hp.quantity) AS total_quantity,
    SUM(hp.original_amount) AS total_original_amount,
    SUM(hp.transferred_amount) AS total_transferred_amount,
    SUM(CASE WHEN hp.status = 'applied' THEN hp.transferred_amount ELSE 0 END) AS applied_amount
FROM hc_penalties hp
JOIN penalty_types pt ON hp.penalty_type_id = pt.id
JOIN usuarios u ON hp.user_id = u.id
GROUP BY hp.user_id, u.codigo_asesor, u.nombre_completo, hp.year, hp.month, pt.code, pt.name, pt.source;
```

---

### 10.2 vw_partition_presets (v2.1)

Vista que consolida presets con sus tipos de venta en formato JSON.

```sql
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
```

---

### 10.3 vw_scheme_item_ventas (v2.1)

Vista de partidas de esquemas con sus tipos de venta mapeados.

```sql
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
```

---

## 11. FUNCIONES DEL MÓDULO COMISIONES

### 11.1 user_has_commission_access()

Verifica si el usuario actual tiene acceso a comisiones.

```sql
CREATE OR REPLACE FUNCTION user_has_commission_access()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'JEFE_VENTAS', 'BACKOFFICE_OPERACIONES')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 11.2 simulate_hc_commission()

Simula la comisión de un HC con datos de venta.

**Parámetros:**
- `p_scheme_id` UUID - ID del esquema
- `p_sales_data` JSONB - Datos de venta por código de partida
- `p_plan_breakdown` JSONB - Desglose por plan (opcional)
- `p_user_id` UUID - ID del usuario para predicción de penalidades

**Retorna:** `commission_calculation_result` con fixed_salary, variable, pxq, bonos, penalidades, neto.

### 11.3 predict_hc_penalties()

Predice penalidades futuras basado en histórico.

**Parámetros:**
- `p_user_id` UUID - ID del usuario
- `p_months_lookback` INTEGER - Meses de histórico (default 6)

**Retorna:** Tabla con penalty_code, penalty_name, predicted_quantity, predicted_amount, confidence.

### 11.4 get_sales_profile()

Genera perfil de ventas predefinido para simulación.

**Parámetros:**
- `p_scheme_id` UUID - ID del esquema
- `p_profile_type` VARCHAR - 'average', 'top20', 'new', 'quota100'

**Retorna:** JSONB con cantidades por tipo de partida.

### 11.5 compare_commission_scenarios()

Compara dos esquemas con los mismos datos de venta.

### 11.6 get_item_tipos_venta() (v2.1)

Obtiene los tipos de venta mapeados a una partida específica.

```sql
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
```

### 11.7 apply_preset_to_item() (v2.1)

Aplica un preset a una partida, copiando sus mapeos de tipos de venta.

```sql
CREATE OR REPLACE FUNCTION apply_preset_to_item(
    p_scheme_item_id UUID,
    p_preset_id UUID
) RETURNS void AS $$
BEGIN
    DELETE FROM commission_item_ventas WHERE scheme_item_id = p_scheme_item_id;
    
    INSERT INTO commission_item_ventas (scheme_item_id, tipo_venta_id, cuenta_linea, cuenta_equipo)
    SELECT 
        p_scheme_item_id,
        ppv.tipo_venta_id,
        ppv.cuenta_linea,
        ppv.cuenta_equipo
    FROM partition_preset_ventas ppv
    WHERE ppv.preset_id = p_preset_id;
    
    UPDATE commission_scheme_items 
    SET preset_id = p_preset_id
    WHERE id = p_scheme_item_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 12. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-24 | 1.0 | Diccionario inicial con 17 objetos |
| 2026-01-25 | 2.0 | Agregadas 11 tablas del módulo Comisiones y Penalidades |
| 2026-01-25 | **2.1** | **Sistema de partidas flexible: 3 tablas nuevas (partition_presets, partition_preset_ventas, commission_item_ventas), 2 vistas (vw_partition_presets, vw_scheme_item_ventas), 2 funciones (get_item_tipos_venta, apply_preset_to_item). Corrección tipos_venta: eliminado OPP_MONO, agregado PACK_OPEN. Modificado commission_scheme_items: item_type_id nullable, nuevas columnas preset_id, custom_name, custom_description.** |

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
| **Presets Partidas (v2.1)** | **3** | **2** | **2** |
| **TOTAL** | **26** | **8** | **9** |

---

## DIAGRAMA DE RELACIONES (Módulo Partidas v2.1)

```
┌─────────────────────┐
│    tipos_venta      │
│  (catálogo base)    │
└─────────┬───────────┘
          │
          │ FK
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│partition_preset_vent│◄────│  partition_presets  │
│  (mapeo N:N)        │     │  (catálogo presets) │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       │ FK (opcional)
                                       ▼
┌─────────────────────┐     ┌─────────────────────┐
│commission_item_venta│◄────│commission_scheme_   │
│  (mapeo N:N)        │     │      items          │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          │ FK                         │ FK
          ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐
│    tipos_venta      │     │ commission_schemes  │
│  (catálogo base)    │     │    (esquemas)       │
└─────────────────────┘     └─────────────────────┘
```

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen o modifiquen tablas.
