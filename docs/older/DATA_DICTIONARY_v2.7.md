# GridRetail - Diccionario de Datos
## Documento de Referencia de Base de Datos
**Versión:** 2.7  
**Última actualización:** 2026-02-03  
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

Catálogo de 18 tipos de venta.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(30) | NO | - | Código único (UNIQUE) |
| `nombre` | VARCHAR(100) | NO | - | Nombre descriptivo |
| `categoria` | VARCHAR(30) | YES | - | Categoría de agrupación |
| `fuente_validacion` | VARCHAR(20) | YES | - | INAR, FICHA, BU |
| `requiere_cedente` | BOOLEAN | NO | false | Si requiere operador cedente |
| `requiere_imei` | BOOLEAN | NO | false | Si requiere IMEI de equipo |
| `requiere_iccid` | BOOLEAN | NO | false | Si requiere ICCID de chip |
| `permite_seguro` | BOOLEAN | NO | false | Si permite seguro MEP |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `descripcion_ayuda` | TEXT | YES | - | Texto de ayuda para el usuario |
| `orden` | INTEGER | NO | 0 | Orden de visualización |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**18 Tipos de Venta:**

| # | Código | Nombre | Categoría | Req. Cedente | Req. IMEI | Permite Seguro |
|---|--------|--------|-----------|--------------|-----------|----------------|
| 1 | OSS_BASE | Porta OSS - Base | POSTPAGO | ✅ | ❌ | ❌ |
| 2 | OSS_CAPTURA | Porta OSS - Captura | POSTPAGO | ✅ | ❌ | ❌ |
| 3 | OPP_CAPTURA | Porta OPP Captura | POSTPAGO | ✅ | ❌ | ❌ |
| 4 | OPP_BASE | Porta OPP LLAA | POSTPAGO | ✅ | ❌ | ❌ |
| 5 | VR_MONO | VR Mono | POSTPAGO | ❌ | ❌ | ❌ |
| 6 | VR_CAPTURA | VR Captura | POSTPAGO | ❌ | ❌ | ❌ |
| 7 | VR_BASE | VR LLAA | POSTPAGO | ❌ | ❌ | ❌ |
| 8 | MISS_IN | Miss In (Pre→Pos Entel) | POSTPAGO | ❌ | ❌ | ❌ |
| 9 | PACK_VR | Pack + VR Mono | PACK | ❌ | ✅ | ✅ |
| 10 | PACK_OPEN | Pack Open (Solo Equipo) | PACK | ❌ | ✅ | ✅ |
| 11 | PACK_OSS | Pack Porta OSS | PACK_SS | ✅ | ✅ | ✅ |
| 12 | PACK_VR_BASE | Pack VR | PACK_SS | ❌ | ✅ | ✅ |
| 13 | **PACK_OPP_BASE** | Pack Porta OPP LLAA | PACK_SS | ✅ | ✅ | ✅ |
| 14 | RENO | Renovación Equipo | RENO | ❌ | ✅ | ✅ |
| 15 | **RENO_LLAA** | Renovación + LLAA | RENO | ❌ | ✅ | ✅ |
| 16 | PREPAGO | Venta Prepago | PREPAGO | ❌ | ❌ | ❌ |
| 17 | PORTA_PP | Portabilidad Prepago | PREPAGO | ✅ | ❌ | ❌ |
| 18 | ACCESORIOS | Solo Accesorios | OTROS | ❌ | ❌ | ❌ |

**Resumen por Categoría:**

| Categoría | Cantidad | Tipos |
|-----------|----------|-------|
| POSTPAGO | 8 | OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN |
| PACK | 2 | PACK_VR, PACK_OPEN |
| PACK_SS | 3 | PACK_OSS, PACK_VR_BASE, PACK_OPP_BASE |
| RENO | 2 | RENO, RENO_LLAA |
| PREPAGO | 2 | PREPAGO, PORTA_PP |
| OTROS | 1 | ACCESORIOS |

**Conteo Múltiple para Comisiones:**

Algunos tipos de venta cuentan para más de una partida de comisión:

| Tipo | Partida 1 | Partida 2 |
|------|-----------|-----------|
| PACK_OSS | PACKS | OSS |
| PACK_VR_BASE | PACKS | VR_BASE |
| PACK_OPP_BASE | PACKS | OPP_BASE |
| RENO_LLAA | RENO | VR_BASE |

**Fuentes de Validación:**

| Fuente | Descripción | Tipos |
|--------|-------------|-------|
| `INAR` | Base de líneas activadas de Entel | POSTPAGO, PACK_SS |
| `FICHA` | Documento mensual de comisiones | RENO, PACK |
| `BU` | Solo registro declarativo | PREPAGO, ACCESORIOS |

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

| Tabla | Estado | Descripción |
|-------|--------|-------------|
| `commission_item_types` | ✅ v1.0 | Catálogo de tipos de partida |
| `commission_schemes` | ✅ v1.0, actualizado v3.2/v3.3 | Esquemas de comisiones |
| `commission_scheme_items` | ✅ v1.0, actualizado v2.1/v3.0.1/v3.2/v3.3/v3.4 | Partidas individuales |
| `commission_pxq_scales` | ✅ v1.0 | Escalas PxQ |
| `commission_item_locks` | ✅ v1.0 (legacy) | Candados (migrar a multipliers) |
| `commission_item_restrictions` | ✅ v1.0 | Restricciones de mix |
| `commission_hc_assignments` | ✅ v1.0 | Asignación de esquemas a HC |
| `commission_item_multipliers` | 🆕 v3.2 | Sistema unificado de multiplicadores |

---

### 5.1 commission_item_types

Catálogo de tipos de partida (presets del sistema).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `code` | VARCHAR(50) | NO | - | Código único (ej: OSS, VR, OPP) |
| `name` | VARCHAR(100) | NO | - | Nombre descriptivo |
| `category` | VARCHAR(50) | YES | - | Categoría (POSTPAGO, PREPAGO, etc.) |
| `calculation_type` | VARCHAR(20) | YES | - | Tipo cálculo: percentage, pxq, binary |
| `description` | TEXT | YES | - | Descripción extendida |
| `tipos_venta_codigos` | TEXT[] | YES | - | Array de códigos de tipos_venta mapeados |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `display_order` | INTEGER | YES | 0 | Orden de visualización |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_commission_item_types_code` (UNIQUE)

---

### 5.2 commission_schemes

Esquemas de comisiones por período.

| Columna | Tipo | Nullable | Default | Descripción | Versión |
|---------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | gen_random_uuid() | PK | v1.0 |
| `name` | VARCHAR(200) | NO | - | Nombre del esquema | v1.0 |
| `code` | VARCHAR(50) | YES | - | Código único del esquema | v1.0 |
| `description` | TEXT | YES | - | Descripción | v1.0 |
| `year` | INTEGER | NO | - | Año | v1.0 |
| `month` | INTEGER | NO | - | Mes (1-12) | v1.0 |
| `status` | VARCHAR(20) | NO | 'draft' | Estado del esquema | v1.0 |
| `scheme_type` | VARCHAR(30) | NO | 'asesor' | Tipo: asesor, supervisor | v1.0 |
| `level` | VARCHAR(30) | NO | 'socio' | Nivel: entel, socio, individual | v1.0 |
| `fixed_salary` | DECIMAL(10,2) | NO | 1130.00 | Sueldo fijo | v1.0 |
| `variable_salary` | DECIMAL(10,2) | NO | 1200.00 | Sueldo variable máximo | v1.0 |
| `total_ss_quota` | INTEGER | YES | - | Cuota SS total del esquema | v1.0 |
| `default_min_fulfillment` | DECIMAL(5,4) | YES | 0.5000 | Cumplimiento mínimo global (0.5 = 50%) | v1.0 |
| `conversion_table` | JSONB | YES | NULL | Tabla conversión no-lineal (estilo TPF) | v3.2 |
| `global_range_method` | VARCHAR(30) | YES | NULL | Método rango global: VOLUMEN_TOTAL | v3.2 |
| `accelerator_base` | VARCHAR(25) | YES | 'VARIABLE_TEORICO' | Base para aceleradores | v3.3 |
| `accelerator_config` | JSONB | YES | NULL | Configuración de aceleradores globales | v3.3 |
| `created_by` | UUID | YES | - | FK → usuarios.id | v1.0 |
| `approved_by` | UUID | YES | - | FK → usuarios.id | v1.0 |
| `approved_at` | TIMESTAMPTZ | YES | - | Fecha aprobación | v1.0 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación | v1.0 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización | v1.0 |

**Constraints:**
```sql
CHECK (status IN ('oficial', 'draft', 'aprobado', 'archivado'))
CHECK (scheme_type IN ('asesor', 'supervisor', 'encargado'))
CHECK (level IN ('entel', 'socio', 'individual'))
CHECK (global_range_method IS NULL OR global_range_method IN ('VOLUMEN_TOTAL'))
CHECK (accelerator_base IS NULL OR accelerator_base IN ('VARIABLE_TEORICO', 'VARIABLE_CALCULADO'))
UNIQUE (year, month, scheme_type, level, status) WHERE status = 'aprobado'
```

**Índices:** `idx_commission_schemes_period`, `idx_commission_schemes_status`

---

#### 5.2.1 Estados de Esquema (`status`)

| Estado | Descripción |
|--------|-------------|
| `oficial` | Importado de Entel (solo lectura) |
| `draft` | En edición (pueden existir múltiples) |
| `aprobado` | Vigente para el período (solo uno por tipo/nivel) |
| `archivado` | Histórico |

---

#### 5.2.2 Base de Aceleradores (`accelerator_base`) — v3.3

| Valor | Descripción | Ejemplo |
|-------|-------------|---------|
| `VARIABLE_TEORICO` | Aceleradores aplican ±% sobre `variable_salary` fijo | TPF: +10% = +S/.120 fijo |
| `VARIABLE_CALCULADO` | Aceleradores aplican ±% sobre variable ya calculado | TEX: +10% = +S/.X según ponderadas |

---

#### 5.2.3 Estructura `conversion_table` (JSONB) — v3.2

Tabla de conversión no-lineal estilo TPF:

```json
{
  "description": "Tabla de conversión TPF",
  "ranges": [
    { "min": 0, "max": 49.99, "effective": 0, "label": "Sin comisión" },
    { "min": 50, "max": 74.99, "effective": 50, "label": "Mínimo" },
    { "min": 75, "max": 89.99, "effective": 75, "label": "Base" },
    { "min": 90, "max": 99.99, "effective": 90, "label": "Estándar" },
    { "min": 100, "max": 119.99, "effective": 100, "label": "Meta" },
    { "min": 120, "max": null, "effective": "+10", "label": "Sobrecumplimiento" }
  ]
}
```

---

### 5.3 commission_scheme_items

Partidas individuales de cada esquema.

| Columna | Tipo | Nullable | Default | Descripción | Versión |
|---------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | gen_random_uuid() | PK | v1.0 |
| `scheme_id` | UUID | NO | - | FK → commission_schemes.id (CASCADE) | v1.0 |
| `item_type_id` | UUID | YES | - | FK → commission_item_types.id (nullable desde v2.1) | v1.0 |
| `preset_id` | UUID | YES | - | FK → partition_presets.id | v2.1 |
| `custom_name` | VARCHAR(100) | YES | - | Nombre personalizado si no usa preset | v2.1 |
| `custom_description` | TEXT | YES | - | Descripción personalizada | v2.1 |
| `original_label` | VARCHAR | YES | - | Etiqueta original del Excel (importación AI) | v2.1 |
| `quota` | INTEGER | YES | - | Meta/cuota de la partida (unidades) | v1.0 |
| `quota_amount` | DECIMAL | YES | - | Meta en monto (si aplica) | v1.0 |
| `weight` | DECIMAL | YES | - | Peso (0.45 = 45%) | v1.0 |
| `mix_factor` | DECIMAL | YES | - | Factor mix (0.27 = 27%) | v1.0 |
| `variable_amount` | DECIMAL | NO | 0 | Monto variable máximo | v1.0 |
| `variable_source` | VARCHAR(20) | YES | 'FROM_MIX' | Fuente del variable: FROM_MIX o FIXED_EXTRA | v3.4 |
| `min_fulfillment` | DECIMAL | YES | NULL | Cumplimiento mínimo override | v1.0 |
| `has_cap` | BOOLEAN | YES | false | Si tiene tope (legacy) | v1.0 |
| `cap_percentage` | DECIMAL | YES | 1.00 | Tope porcentaje (legacy, default 100%) | v1.0 |
| `cap_amount` | DECIMAL | YES | - | Tope monto (legacy) | v1.0 |
| `contribution_type` | VARCHAR(25) | YES | 'PONDERADA' | Cómo aporta al total | v3.2 |
| `range_source` | VARCHAR(25) | YES | 'CUOTA_PROPIA' | Fuente de input | v3.2 |
| `uses_conversion_table` | BOOLEAN | YES | false | Si usa tabla del esquema | v3.2 |
| `accelerator_ranges` | JSONB | YES | NULL | Rangos ±% para aceleradores | v3.2 |
| `overcompliance_mode` | VARCHAR(20) | YES | 'none' | Modo sobrecumplimiento | v3.0.1 |
| `cap_units` | DECIMAL | YES | - | Unidades máximas (sobrecumplimiento) | v3.0.1 |
| `pxq_bonus_amount` | DECIMAL | YES | - | Monto PxQ bonus por unidad extra | v3.0.1 |
| `overcap_max_units` | DECIMAL | YES | - | Máximo unidades bonus | v3.0.1 |
| `overcap_max_amount` | DECIMAL | YES | - | Máximo monto bonus | v3.0.1 |
| `measurement_type` | VARCHAR(20) | YES | 'UNIT_COUNT' | Cómo se mide el logro | v3.3 |
| `fulfillment_method` | VARCHAR(20) | YES | 'RATIO' | Cómo se calcula cumplimiento | v3.3 |
| `measurement_config` | JSONB | YES | NULL | Config según measurement_type | v3.3 |
| `display_order` | INTEGER | YES | 0 | Orden de visualización | v1.0 |
| `is_active` | BOOLEAN | YES | true | Estado activo | v1.0 |
| `notes` | TEXT | YES | - | Notas | v1.0 |
| `ai_confidence` | DECIMAL | YES | - | Nivel de confianza del AI (0-1) | v2.1 |
| `ai_warnings` | TEXT[] | YES | - | Warnings del proceso AI | v2.1 |
| `source_cell_ref` | VARCHAR | YES | - | Referencia a celda Excel origen | v2.1 |
| `created_at` | TIMESTAMPTZ | YES | NOW() | Fecha creación | v1.0 |
| `updated_at` | TIMESTAMPTZ | YES | NOW() | Fecha actualización | v1.0 |

**Constraints:**
```sql
CHECK (contribution_type IS NULL OR contribution_type IN ('PONDERADA', 'ACELERADOR', 'PXQ_INDEPENDIENTE', 'BONO'))
CHECK (range_source IS NULL OR range_source IN ('CUOTA_PROPIA', 'VOLUMEN_GLOBAL', 'CUOTA_GLOBAL_SS'))
CHECK (overcompliance_mode IS NULL OR overcompliance_mode IN ('none', 'proportional', 'pxq_bonus'))
CHECK (measurement_type IS NULL OR measurement_type IN ('UNIT_COUNT', 'AVERAGE_VALUE', 'TOTAL_VALUE', 'RATE', 'MANUAL'))
CHECK (fulfillment_method IS NULL OR fulfillment_method IN ('RATIO', 'ABSOLUTE_RANGES'))
CHECK (variable_source IS NULL OR variable_source IN ('FROM_MIX', 'FIXED_EXTRA'))
```

**Índices:** `idx_commission_items_scheme`, `idx_commission_items_type`

---

#### 5.3.0 Campos Derivados (de JOINs) — v2.7

⚠️ **IMPORTANTE:** Los siguientes campos **NO existen** en la tabla `commission_scheme_items`. Se obtienen mediante JOINs con `partition_presets` o `commission_item_types`:

| Campo | Fuente Principal | Fuente Alternativa | Default |
|-------|------------------|-------------------|---------|
| `category` | `preset.default_category` | `item_type.category` | 'adicional' |
| `calculation_type` | `preset.default_calculation_type` | `item_type.calculation_type` | 'percentage' |

**Query para obtener datos completos:**
```sql
SELECT 
  csi.*,
  COALESCE(pp.default_category, cit.category, 'adicional') as category,
  COALESCE(pp.default_calculation_type, cit.calculation_type, 'percentage') as calculation_type,
  pp.name as preset_name,
  pp.code as preset_code,
  cit.name as item_type_name,
  cit.code as item_type_code
FROM commission_scheme_items csi
LEFT JOIN partition_presets pp ON csi.preset_id = pp.id
LEFT JOIN commission_item_types cit ON csi.item_type_id = cit.id
WHERE csi.scheme_id = '...'
ORDER BY csi.display_order;
```

---

#### 5.3.1 Relación con Presets y Tipos

Una partida puede definirse de tres formas:

| Modo | `preset_id` | `item_type_id` | `custom_name` | Obtiene category/calculation_type de |
|------|-------------|----------------|---------------|--------------------------------------|
| **Preset** | ✅ Set | NULL | Opcional | `partition_presets` |
| **Tipo directo** | NULL | ✅ Set | Opcional | `commission_item_types` |
| **Custom** | NULL | NULL | ✅ Requerido | Defaults: 'adicional', 'percentage' |

**Prioridad de resolución:**
1. Si tiene `preset_id` → usar `partition_presets.default_category/default_calculation_type`
2. Si tiene `item_type_id` → usar `commission_item_types.category/calculation_type`
3. Si es custom → usar defaults: category='adicional', calculation_type='percentage'

---

#### 5.3.2 Tipo de Contribución (`contribution_type`) — v3.2

| Valor | Descripción | Ejemplo |
|-------|-------------|---------|
| `PONDERADA` | Contribuye al variable con peso% | TEX: OSS con peso 27% |
| `ACELERADOR` | Ajusta ±% del variable base | TPF: Accesorios +5% |
| `PXQ_INDEPENDIENTE` | Monto independiente por unidad | Netcall: S/.15 por unidad |
| `BONO` | Todo o nada si cumple condición | NPS Venta: S/.50 si >60% |

---

#### 5.3.3 Tipo de Medición (`measurement_type`) — v3.3

| Valor | Mide | Ejemplo |
|-------|------|---------|
| `UNIT_COUNT` | Conteo de ventas (default) | 45 OSS vendidas |
| `AVERAGE_VALUE` | Promedio de un campo | Cargo Fijo Promedio: S/.52.3 |
| `TOTAL_VALUE` | Suma de un campo | Ingresos brutos: S/.12,500 |
| `RATE` | Ratio condición/total × 100 | Tasa descuento: 35% con descuento |
| `MANUAL` | Valor externo | NPS: 78 puntos |

---

#### 5.3.4 Método de Cumplimiento (`fulfillment_method`) — v3.3

| Valor | Fórmula | Uso |
|-------|---------|-----|
| `RATIO` | `(logro / meta) × 100` | Mayoría de partidas con meta numérica |
| `ABSOLUTE_RANGES` | Valor directo busca en rangos | Cargo Fijo Promedio sin meta |

---

#### 5.3.5 Estructura `measurement_config` (JSONB) — v3.3

Según `measurement_type`:

**AVERAGE_VALUE / TOTAL_VALUE:**
```json
{
  "value_field": "cargo_fijo",
  "description": "Promedio del cargo fijo de ventas OSS"
}
```

**RATE:**
```json
{
  "condition_field": "tiene_descuento",
  "condition_value": true,
  "scope_tipos_venta": ["OSS_BASE", "OSS_CAPTURA"],
  "description": "% de ventas OSS con descuento aplicado"
}
```

---

#### 5.3.6 Modo de Sobrecumplimiento (`overcompliance_mode`) — v3.0.1

| Valor | Descripción |
|-------|-------------|
| `none` | Comisión se detiene al 100% de cumplimiento |
| `proportional` | Continúa proporcional sin tope (o con `cap_units`/`overcap_max_*`) |
| `pxq_bonus` | A partir del 100%, paga `pxq_bonus_amount` por unidad extra |

---

#### 5.3.7 Fuente de Variable (`variable_source`) — v3.4

| Valor | Descripción | Uso |
|-------|-------------|-----|
| `FROM_MIX` | Variable calculado: `mix_factor × variable_salary` | Partidas que contribuyen al 100% del Mix |
| `FIXED_EXTRA` | Variable es monto fijo independiente | Partidas Adicionales con pago extra (no afecta Mix) |

**Contexto:** Las partidas "Adicional" pueden tener dos comportamientos:
1. Contribuir al Mix (su peso% suma con las principales al 100%)
2. Ser un monto extra que no afecta la validación Mix = 100%

---

### 5.4 commission_pxq_scales

Escalas de Precio por Cantidad para partidas PxQ.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) |
| `min_percentage` | DECIMAL(5,2) | NO | - | % cumplimiento mínimo del rango |
| `max_percentage` | DECIMAL(5,2) | YES | - | % cumplimiento máximo (NULL = sin límite) |
| `amount_per_unit` | DECIMAL(10,2) | NO | - | Monto por unidad en este rango |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Ejemplo:** Cumplimiento 50-60% paga S/.10/unidad, 61-70% paga S/.15/unidad, etc.

**Índice:** `idx_pxq_scales_item`

---

### 5.5 commission_item_locks (Legacy)

⚠️ **Nota:** Tabla legacy. Nuevos candados deben crearse en `commission_item_multipliers` con `multiplier_type = 'LOCK'`.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) |
| `lock_type` | VARCHAR(50) | NO | - | Tipo de candado: MIN_QUANTITY, PRODUCT_REQUIRED |
| `required_product_id` | UUID | YES | - | FK → commission_item_types.id |
| `required_quantity` | DECIMAL(10,2) | YES | - | Cantidad requerida |
| `lock_description` | VARCHAR(200) | YES | - | Descripción |
| `is_active` | BOOLEAN | NO | true | Estado |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índice:** `idx_locks_item`

---

### 5.6 commission_item_restrictions

Restricciones de mix de productos.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) |
| `restriction_type` | VARCHAR(50) | NO | - | Tipo: MAX_PERCENTAGE, MAX_QUANTITY |
| `plan_code` | VARCHAR(50) | YES | - | Código del plan restringido |
| `max_percentage` | DECIMAL(5,2) | YES | - | % máximo permitido |
| `max_quantity` | INTEGER | YES | - | Cantidad máxima permitida |
| `restriction_description` | VARCHAR(200) | YES | - | Descripción |
| `is_active` | BOOLEAN | NO | true | Estado |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Ejemplo:** Máx 10% plan 39.90, Máx 20 unidades plan 34.90

**Índice:** `idx_restrictions_item`

---

### 5.7 commission_hc_assignments

Asignación de esquemas personalizados a HC individuales.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → usuarios.id |
| `scheme_id` | UUID | NO | - | FK → commission_schemes.id |
| `effective_from` | DATE | NO | - | Fecha inicio vigencia |
| `effective_until` | DATE | YES | - | Fecha fin vigencia (NULL = indefinido) |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `notes` | TEXT | YES | - | Notas de asignación |
| `assigned_by` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraint:** UNIQUE (`user_id`, `scheme_id`, `effective_from`)

**Índices:** `idx_hc_assignments_user`, `idx_hc_assignments_scheme`, `idx_hc_assignments_dates`

---

### 5.8 commission_item_multipliers — 🆕 v3.2

Sistema unificado de multiplicadores (candados, aceleradores, penalizadores, restricciones).

| Columna | Tipo | Nullable | Default | Descripción | Versión |
|---------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | gen_random_uuid() | PK | v3.2 |
| `item_id` | UUID | NO | - | FK → commission_scheme_items.id (CASCADE) | v3.2 |
| `multiplier_type` | VARCHAR(20) | NO | - | Tipo de multiplicador (ver 5.8.1) | v3.2 |
| `activation_criteria` | VARCHAR(25) | NO | - | Criterio de activación (ver 5.8.2) | v3.2 |
| `source_description` | VARCHAR(200) | NO | - | Descripción del multiplicador | v3.2 |
| `source_item_id` | UUID | YES | - | FK → commission_scheme_items.id (para CROSS_PRODUCT) | v3.2 |
| `threshold_value` | DECIMAL(10,2) | YES | - | Umbral de activación | v3.2 |
| `factor_if_met` | DECIMAL(6,4) | NO | 1.0 | Factor si cumple condición | v3.2 |
| `factor_if_not_met` | DECIMAL(6,4) | NO | 0.0 | Factor si no cumple (0 = bloqueo) | v3.2 |
| `tiered_ranges` | JSONB | YES | - | Rangos para tipo TIERED | v3.2 |
| `operator_cedente` | VARCHAR(30) | YES | - | Operador para OPERATOR_ORIGIN | v3.2 |
| `measurement_type` | VARCHAR(20) | NO | 'UNIT_COUNT' | Cómo se mide el KPI | v3.3 |
| `measurement_config` | JSONB | YES | - | Config del KPI complejo | v3.3 |
| `is_active` | BOOLEAN | NO | true | Estado activo | v3.2 |
| `display_order` | INTEGER | NO | 0 | Orden de evaluación | v3.2 |
| `notes` | TEXT | YES | - | Notas internas | v3.2 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación | v3.2 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización | v3.2 |

**Constraints:**
```sql
CHECK (multiplier_type IN ('LOCK', 'ACCELERATOR', 'DECELERATOR', 'PROPORTIONAL', 'CROSS_PRODUCT', 'TIERED'))
CHECK (activation_criteria IN ('MIN_QUANTITY', 'OWN_ATTAINMENT', 'OTHER_ATTAINMENT', 'GLOBAL_ATTAINMENT', 'ATTAINMENT_RANGE', 'OPERATOR_ORIGIN'))
CHECK (measurement_type IN ('UNIT_COUNT', 'RATE', 'AVERAGE_VALUE', 'MANUAL'))
```

**Índices:** `idx_multipliers_item`, `idx_multipliers_source`, `idx_multipliers_type`

**RLS:** SELECT para todos los usuarios autenticados, ALL para ADMIN y GERENTE_COMERCIAL

---

#### 5.8.1 Tipos de Multiplicador (`multiplier_type`)

| Tipo | Factor típico | Descripción |
|------|---------------|-------------|
| `LOCK` | 0.0 / 1.0 | Candado binario (bloquea si no cumple) |
| `ACCELERATOR` | 1.05 - 1.30 | Bonus por buen desempeño |
| `DECELERATOR` | 0.70 - 0.95 | Penalización por bajo desempeño |
| `PROPORTIONAL` | 0.0 - 1.0 | Factor proporcional al cumplimiento |
| `CROSS_PRODUCT` | Variable | Factor depende de otra partida |
| `TIERED` | Variable | Factor según rangos escalonados |

---

#### 5.8.2 Criterios de Activación (`activation_criteria`)

| Criterio | Evalúa | Ejemplo |
|----------|--------|---------|
| `MIN_QUANTITY` | Cantidad mínima vendida | Mín 2 MEP para desbloquear RENO |
| `OWN_ATTAINMENT` | % cumplimiento de esta partida | >70% OSS → factor 1.10 |
| `OTHER_ATTAINMENT` | % cumplimiento de otra partida | Si VR >100% → bonus en OSS |
| `GLOBAL_ATTAINMENT` | % cumplimiento global SS | Si SS >80% → todos reciben +5% |
| `ATTAINMENT_RANGE` | Rango de cumplimiento | 80-90% → factor 0.9, 90-100% → factor 1.0 |
| `OPERATOR_ORIGIN` | % de ventas de operador X | >40% origen Claro → bonus |

---

#### 5.8.3 Estructura `tiered_ranges` (JSONB)

Para multiplicadores tipo TIERED o ATTAINMENT_RANGE:

```json
{
  "ranges": [
    { "min": 0, "max": 49.99, "factor": 0.0, "label": "Sin comisión" },
    { "min": 50, "max": 69.99, "factor": 0.7, "label": "Básico" },
    { "min": 70, "max": 89.99, "factor": 0.9, "label": "Estándar" },
    { "min": 90, "max": 100, "factor": 1.0, "label": "Meta" },
    { "min": 100.01, "max": null, "factor": 1.15, "label": "Sobrecumplimiento" }
  ]
}
```

---

#### 5.8.4 Ejemplo: Tasa de Uso de Descuento (v3.3)

Multiplicador con medición tipo RATE sobre partida OSS:

```json
{
  "multiplier_type": "TIERED",
  "activation_criteria": "OWN_ATTAINMENT",
  "source_description": "Tasa de uso de descuento en OSS",
  "measurement_type": "RATE",
  "measurement_config": {
    "condition_field": "tiene_descuento",
    "condition_value": true,
    "description": "% de ventas OSS con descuento aplicado"
  },
  "tiered_ranges": {
    "ranges": [
      { "min": 0, "max": 39.99, "factor": 1.05, "label": "Bajo uso → premio +5%" },
      { "min": 40, "max": 60, "factor": 1.0, "label": "Uso normal" },
      { "min": 60.01, "max": 100, "factor": 0.85, "label": "Uso excesivo → castigo -15%" }
    ]
  }
}
```

**Cálculo:** 
1. Motor cuenta ventas OSS con `tiene_descuento = true`
2. Calcula ratio: `(OSS con descuento / OSS totales) × 100`
3. Busca en `tiered_ranges` el factor correspondiente
4. Aplica factor sobre la comisión calculada de OSS

---

## Resumen de Objetos por Versión

| Versión | Tablas | Columnas Nuevas | Fecha |
|---------|--------|-----------------|-------|
| v1.0 | 7 tablas base | - | 2026-01-25 |
| v2.1 | +3 (presets) | item_type_id nullable | 2026-01-26 |
| v3.0.1 | - | 5 cols sobrecumplimiento | 2026-02-02 |
| v3.2 | +1 (multipliers) | 5 cols en schemes/items | 2026-02-02 |
| v3.3 | - | 6 cols measurement | 2026-02-02 |
| v3.4 | - | 1 col variable_source | 2026-02-03 |
| **Total** | **11 tablas** | **~51 columnas** | - |

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

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `code` | VARCHAR(50) | NO | - | Código único |
| `name` | VARCHAR(100) | NO | - | Nombre descriptivo |
| `short_name` | VARCHAR(50) | YES | - | Nombre corto |
| `default_category` | VARCHAR(50) | YES | 'adicional' | Categoría por defecto |
| `default_calculation_type` | VARCHAR(20) | YES | 'percentage' | Tipo cálculo por defecto |
| `description` | TEXT | YES | - | Descripción |
| `is_active` | BOOLEAN | NO | true | Estado activo |
| `display_order` | INTEGER | YES | 0 | Orden |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

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
| 2026-01-28 | 2.6 | **Módulo Arribos v1.2:** Nueva tabla `system_config` para configuración del sistema. Nuevas columnas en `arribos`: `tipo_documento_cliente`, `nombre_cliente`. Nuevos constraints para validación de documentos. Integración con API json.pe para consulta DNI/CE. |
| 2026-02-03 | **2.7** | **Corrección crítica tabla commission_scheme_items:** Eliminados campos inexistentes (`category`, `weight_percent`, `calculation_type`) que nunca existieron en la BD. Renombrado `weight_percent` → `weight`. Agregados campos faltantes (`preset_id`, `custom_description`, `original_label`, `quota_amount`, campos AI). Nueva sección 5.3.0 documentando obtención de `category` y `calculation_type` via JOINs. Nueva sección 5.3.1 explicando relación con presets/tipos. Renumeradas subsecciones 5.3.x. |

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen o modifiquen tablas.
