# GridRetail - Diccionario de Datos
## Documento de Referencia de Base de Datos
**Versión:** 3.1  
**Última actualización:** 2026-06-24  
**Base de datos:** Supabase (PostgreSQL)

> **v3.1 (2026-06-24):** Migraciones 027–030 (módulo Arribos / vinculación Venta↔Arribo).
> Validado contra la BD real (`arribos.resultado` existe, `se_vendio` eliminada,
> `ventas.arribo_id` poblada, funciones de reporte de arribos presentes).

---

## RESUMEN DE OBJETOS

> **Conteos verificados contra la BD real (PostgREST) el 2026-06-24.** La columna
> "Funciones" cuenta solo las **expuestas como RPC** (24 en total); las funciones de
> trigger (`trigger_set_updated_at`, `trg_ventas_recompute_arribo`, etc.) no se cuentan.
> Asignación por módulo según dominio de la función.

| Módulo | Tablas | Vistas | Funciones (RPC) |
|--------|--------|--------|-----------------|
| Core | 5 | - | - |
| Operaciones | 2 | - | 5 |
| INAR | 3 | 3 | 1 |
| Control | 2 | 2 | - |
| Comisiones | 8 | - | 11 |
| Penalidades | 4 | 1 | 1 |
| Presets Partidas (v2.1) | 3 | 2 | - |
| Cuotas (v2.3) | 3 | 2 | 6 |
| Configuración (v2.6) | 1 | - | - |
| RRHH (v3.0/v3.1) | 26 | - | - |
| **TOTAL** | **57** | **10** | **24** |

> **Documentadas a nivel columna (v3.1):** las 5 tablas RRHH de las migraciones 025/026 —
> `importaciones_rrhh` (§13.22), `historial_bancario` (§13.23), `historial_direcciones`
> (§13.24), `historial_cambios_rrhh` (§13.25) y `entrevistas_colaborador` (§13.26); la
> ampliación de `usuarios_rrhh` a 46 columnas (migr. 026, §13.1); y la vista de Control
> `asesor_score_mensual` (§4.3).
>
> **⚠️ Pendiente menor:** volcar el `CREATE VIEW` de `asesor_score_mensual` a una
> migración versionada (hoy existe en la BD pero no en `supabase/migrations/`).

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
| `gps_lat` | DECIMAL(10,7) | YES | - | Latitud GPS de la tienda *(v3.0)* |
| `gps_lng` | DECIMAL(10,7) | YES | - | Longitud GPS de la tienda *(v3.0)* |
| `radio_validacion_metros` | INTEGER | YES | 100 | Radio en metros para validar marcación GPS asistencia *(v3.0)* |
| `zona` | VARCHAR(50) | YES | - | Zona geográfica (NORTE, SUR, ESTE, CENTRO) *(v3.0)* |
| `hora_apertura` | TIME | YES | '09:00' | Hora estándar de apertura *(v3.0)* |
| `hora_cierre` | TIME | YES | '21:00' | Hora estándar de cierre *(v3.0)* |
| `hc_minimo` | INTEGER | YES | 2 | Headcount mínimo requerido para operar *(v3.0)* |
| `hc_ideal` | INTEGER | YES | 3 | Headcount ideal de operación *(v3.0)* |

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
| `arribo_id` | UUID | **NO** | - | FK → arribos.id (ON DELETE RESTRICT). Cada venta nace de un arribo *(v3.1)* |
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
CONSTRAINT ventas_arribo_id_fkey FOREIGN KEY (arribo_id) REFERENCES arribos(id) ON DELETE RESTRICT  -- v3.1
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
- `idx_ventas_arribo` (arribo_id) *(v3.1)*
- `idx_ventas_tienda_fecha` (tienda_id, fecha)
- `idx_ventas_usuario_fecha` (usuario_id, fecha)
- `idx_ventas_orden` (orden_venta)
- `idx_ventas_estado_cruce` (estado_cruce)

> **Vinculación Venta↔Arribo (v3.1):** `arribo_id` es **NOT NULL** — toda venta
> debe originarse en un arribo. Al insertar/actualizar/eliminar una venta, un
> trigger recalcula `arribos.resultado` del arribo asociado (ver §2.4).

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
| `resultado` | VARCHAR(30) | YES | - | Resultado del arribo (reemplaza `se_vendio` desde v3.1). NULL si POSVENTA. Ver §2.2.7 *(v3.1)* |
| `motivo_no_venta` | VARCHAR | YES | - | Razón de no venta (solo si `resultado = 'NO_VENDIO'`) |
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

-- v3.1 (migración 029): nuevo estado de resultado
CONSTRAINT arribos_resultado_check
  CHECK (resultado IS NULL OR resultado IN (
    'NO_VENDIO', 'VENTA_DECLARADA_PENDIENTE', 'VENTA_PENDIENTE_APROBACION',
    'VENDIDO_CONFIRMADO', 'VENTA_ANULADA'
  ))

-- v3.1: POSVENTA nunca tiene resultado (debe ser NULL)
CONSTRAINT arribos_resultado_posventa_check
  CHECK (
    (tipo_visita = 'POSVENTA' AND resultado IS NULL)
    OR (tipo_visita = 'VENTA')
  )

-- v3.1 (migración 029): tipos de documento alineados con ventas + OTRO
CONSTRAINT arribos_tipo_documento_cliente_check
  CHECK (tipo_documento_cliente IS NULL OR tipo_documento_cliente IN (
    'DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP', 'OTRO'
  ))

-- v3.1 (migración 029): formato por tipo de documento
CONSTRAINT arribos_dni_cliente_format_check
  CHECK (
    dni_cliente IS NULL 
    OR (tipo_documento_cliente = 'DNI'       AND dni_cliente ~ '^\d{8}$')
    OR (tipo_documento_cliente = 'CE'        AND dni_cliente ~ '^\d{9}$')
    OR (tipo_documento_cliente = 'RUC'       AND dni_cliente ~ '^(10|20)\d{9}$')
    OR (tipo_documento_cliente = 'PASAPORTE' AND dni_cliente ~ '^[A-Z0-9]{6,12}$')
    OR (tipo_documento_cliente = 'PTP'       AND dni_cliente ~ '^[A-Z0-9]{6,15}$')
    OR (tipo_documento_cliente = 'OTRO'      AND length(dni_cliente) > 0)
  )
```

> **Historia del constraint de documento:** la migración 027 lo extendió a
> `DNI`/`CE`/`OTRO`; la migración 029 lo alineó con `ventas` agregando
> `RUC`/`PASAPORTE`/`PTP`. json.pe autocompleta solo DNI y CE; el resto se
> ingresa manualmente.

**Índices recomendados:**
- `idx_arribos_tienda_fecha` (tienda_id, fecha) *(028)*
- `idx_arribos_usuario_fecha` (usuario_id, fecha)
- `idx_arribos_fecha_hora` (fecha, EXTRACT(HOUR FROM hora)) *(028)*
- `idx_arribos_conversion` (tienda_id, fecha, tipo_visita, **resultado**) — recreado sobre `resultado` en 029 *(028/029)*
- `idx_arribos_segmentacion` (tienda_id, fecha, es_cliente_entel, tipo_documento_cliente) *(028)*

---

#### 2.2.1 Tipo de Visita (`tipo_visita`)

| Código | Descripción |
|--------|-------------|
| `VENTA` | Cliente viene a comprar/contratar |
| `POSVENTA` | Cliente viene por servicio post-venta |

---

#### 2.2.2 Tipo de Documento (`tipo_documento_cliente`)

> **⚠️ Actualizado en v3.1 (migración 029).** El constraint ahora acepta
> **6 valores**, alineados con `ventas`: `DNI` (8 dígitos), `CE` (9 dígitos),
> `RUC` (11 dígitos, `^(10|20)\d{9}$`), `PASAPORTE` (6-12 alfanumérico),
> `PTP` (6-15 alfanumérico) y `OTRO` (texto no vacío). json.pe solo autocompleta
> DNI y CE; RUC/PASAPORTE/PTP/OTRO se ingresan manualmente. La tabla siguiente
> conserva el detalle base (v2.6).

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

**Query de ejemplo (v3.1 — basado en `resultado`):**
```sql
-- Conversión = arribos de venta confirmados / arribos de venta del día.
-- Nota: el denominador suele ser solo tipo_visita = 'VENTA' (excluye POSVENTA).
SELECT 
    t.nombre AS tienda,
    COUNT(*) FILTER (WHERE a.tipo_visita = 'VENTA') AS visitas_venta,
    COUNT(*) FILTER (WHERE a.tipo_visita = 'VENTA' AND a.resultado = 'VENDIDO_CONFIRMADO') AS ventas,
    ROUND(
        COUNT(*) FILTER (WHERE a.tipo_visita = 'VENTA' AND a.resultado = 'VENDIDO_CONFIRMADO')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE a.tipo_visita = 'VENTA'), 0) * 100,
        2
    ) AS tasa_conversion
FROM arribos a
JOIN tiendas t ON a.tienda_id = t.id
WHERE a.fecha = CURRENT_DATE
GROUP BY t.id, t.nombre;
```

---

#### 2.2.7 Resultado del Arribo (`resultado`) — v3.1

Reemplaza al antiguo booleano `se_vendio` (eliminado en migración 029). Captura el
ciclo de vida del intento de venta vinculado al arribo. **Siempre NULL cuando
`tipo_visita = 'POSVENTA'`** (constraint `arribos_resultado_posventa_check`).

| Valor | Significado |
|-------|-------------|
| `NO_VENDIO` | El asesor declaró que no hubo venta (usa `motivo_no_venta`) |
| `VENTA_DECLARADA_PENDIENTE` | Venta declarada en el arribo, aún sin fila en `ventas` (worklist de reconciliación / "fantasmas") |
| `VENTA_PENDIENTE_APROBACION` | Existe venta asociada en estado `pendiente_aprobacion` |
| `VENDIDO_CONFIRMADO` | Existe venta asociada activa (`registrada` o `aprobada`) |
| `VENTA_ANULADA` | Las ventas asociadas están `anulada`/`rechazada` |

**Recálculo automático:** la función `recompute_arribo_resultado(uuid)` deriva el
valor a partir de las filas de `ventas` con ese `arribo_id` (ver §2.4). El trigger
`ventas_recompute_arribo` la invoca en cada INSERT/UPDATE(estado,arribo_id)/DELETE.
Si no hay filas de venta, respeta la declaración manual (`NO_VENDIO` o
`VENTA_DECLARADA_PENDIENTE`).

**Equivalencia con `se_vendio` (legacy):**

| `se_vendio` (≤v3.0) | `resultado` (v3.1) |
|---------------------|--------------------|
| `true` | `VENDIDO_CONFIRMADO` |
| `false` | `NO_VENDIO` |

---

### 2.3 Funciones de Reporte de Arribos (v2.0 / migración 028, actualizadas en 030)

Funciones `plpgsql` que alimentan el módulo de Reporte de Arribos. Creadas en la
migración 028 (usaban `se_vendio`) y reescritas en la 030 con la nueva semántica
`resultado = 'VENDIDO_CONFIRMADO'`. Las firmas (`RETURNS TABLE`) **no cambiaron**:
`CREATE OR REPLACE` conservó los `GRANT ... TO authenticated` y la API/TS no
requirió cambios.

| Función | Parámetros | Devuelve | Uso |
|---------|-----------|----------|-----|
| `get_arribos_matriz` | `p_fecha DATE, p_zona TEXT=NULL` | Tabla pivote tienda × hora (8–21) + total + hora_pico | Vista principal (matriz). No usa `resultado` |
| `get_arribos_metricas` | `p_fecha DATE, p_zona TEXT=NULL, p_comparacion TEXT='N-7'` | Tráfico, comparación (N-1/N-7/AVG-4W), delta%, conversión, hora_pico, alerta | Tab Métricas |
| `get_arribos_resumen_red` | `p_fecha DATE, p_zona TEXT=NULL` | KPIs de toda la red (total, delta%, conversión promedio, hora pico, tienda líder) | Header del reporte |
| `get_arribos_detalle_tienda` | `p_tienda_id UUID, p_fecha DATE` | Detalle por tienda: por hora (JSONB), embudo, segmentación, motivos (JSONB) | Sidebar / página expandida |

- **Conversión** = `COUNT(resultado='VENDIDO_CONFIRMADO') / COUNT(tipo_visita='VENTA') × 100`.
- **Alerta** (`get_arribos_metricas`): conversión < 35 % **o** delta de tráfico < −5 %.
- En `get_arribos_detalle_tienda`, `crosssell_posventa` es 0 bajo el modelo v1.1
  (los arribos POSVENTA tienen `resultado = NULL`).
- Todas con `GRANT EXECUTE ... TO authenticated`.

> **⚠️ Bugs conocidos (verificados contra la BD, 2026-06-24):** dos funciones
> fallan en runtime y deben corregirse aparte del diccionario:
> - `get_arribos_resumen_red`: error `42804` — devuelve `tienda_lider_codigo`
>   como `varchar(20)` pero la firma declara `TEXT` (castear `t.codigo::TEXT`).
> - `get_arribos_detalle_tienda`: error `42803` — subconsulta usa la columna no
>   agrupada `h.hora` del query externo.

---

### 2.4 Función y Trigger de Vinculación Venta↔Arribo (v3.1 / migración 029)

| Objeto | Tipo | Descripción |
|--------|------|-------------|
| `recompute_arribo_resultado(p_arribo_id UUID)` | Función `VOID`, **SECURITY DEFINER** | Recalcula `arribos.resultado` a partir de las filas de `ventas` con ese `arribo_id`. POSVENTA → NULL. Prioridad: activas (`registrada`/`aprobada`) → `VENDIDO_CONFIRMADO`; `pendiente_aprobacion` → `VENTA_PENDIENTE_APROBACION`; terminales (`anulada`/`rechazada`) → `VENTA_ANULADA`; sin filas → respeta `NO_VENDIO` o asigna `VENTA_DECLARADA_PENDIENTE` |
| `trg_ventas_recompute_arribo()` | Función trigger | Invoca `recompute_arribo_resultado` para el `arribo_id` afectado (y el anterior si cambió en un UPDATE) |
| `ventas_recompute_arribo` | Trigger `AFTER INSERT OR DELETE OR UPDATE OF estado, arribo_id ON ventas FOR EACH ROW` | Mantiene `arribos.resultado` sincronizado con el estado de las ventas |

`SECURITY DEFINER` permite actualizar el arribo aunque el vendedor no sea su dueño
(venta sobre arribo de otro asesor). Las políticas RLS de `arribos` deben permitir
el UPDATE al owner de la función.

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

### 4.3 asesor_score_mensual *(VISTA)*

Vista de scoring mensual del asesor. Agrega `asesor_incidencias` por colaborador y mes,
contando incidencias y sumando puntos de penalización, con desglose por tipo. Alimenta
indicadores de desempeño/disciplina del personal comercial.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `usuario_id` | UUID | FK → usuarios.id (asesor evaluado) |
| `mes` | TIMESTAMPTZ | Mes agregado (truncado al inicio de mes) |
| `total_incidencias` | BIGINT | Número total de incidencias del asesor en el mes |
| `puntos_totales` | BIGINT | Suma de puntos de penalización acumulados |
| `ventas_rezagadas` | BIGINT | Conteo de incidencias por ventas rezagadas |
| `ventas_rechazadas` | BIGINT | Conteo de incidencias por ventas rechazadas |
| `arribos_inconsistentes` | BIGINT | Conteo de incidencias por arribos inconsistentes |
| `datos_incorrectos` | BIGINT | Conteo de incidencias por datos incorrectos |

> **Nota:** la definición SQL de esta vista **no está en las migraciones versionadas**
> (`supabase/migrations/`); las columnas aquí listadas se verificaron contra la BD real
> (PostgREST, 2026-06-24). Conviene volcar su `CREATE VIEW` a una migración para versionarla.

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
| v3.0 (RRHH) | +21 tablas | +8 cols en tiendas | 2026-02-13 |
| v3.1 (Arribos) | - | +1 col `ventas.arribo_id`, `arribos.resultado` (reemplaza `se_vendio`); +6 funciones | 2026-06-24 |
| **Total** | **32 tablas** | **~60 columnas** | - |

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


## 13. MÓDULO RRHH (v3.0 + v3.1)

26 tablas organizadas en 7 grupos de migración.

| Grupo | Tablas | Descripción |
|-------|--------|-------------|
| Core (020) | 3 | Extensión usuarios, status log, AI tasks |
| Reclutamiento (021) | 4 | Pipeline de candidatos |
| Contratos (022) | 3 | Contratos y ciclo de renovación |
| Operativo (023) | 7 | Asistencia, turnos, incidencias, permisos |
| Gestión (024) | 4 | Movimientos, offboarding, documentos, alertas |
| Importación (025) | 1 | `importaciones_rrhh` (wizard de carga inicial) — §13.22 |
| Ampliación (026) | 4 | `historial_bancario`, `historial_direcciones`, `historial_cambios_rrhh`, `entrevistas_colaborador` — §13.23–13.26 |

**Tablas existentes referenciadas:** `usuarios`, `tiendas`, `usuarios_tiendas`

---

### 13.1 usuarios_rrhh

Extensión 1:1 de `usuarios` con datos laborales, personales y bancarios. El `id` es FK directa a `usuarios.id`.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | - | PK + FK → usuarios.id (CASCADE) |
| `fecha_nacimiento` | DATE | YES | - | Fecha de nacimiento |
| `genero` | VARCHAR(20) | YES | - | Género (ver constraint) |
| `estado_civil` | VARCHAR(20) | YES | - | Estado civil (ver constraint) |
| `telefono_personal` | VARCHAR(20) | YES | - | Teléfono personal |
| `direccion_domiciliaria` | TEXT | YES | - | Dirección completa |
| `distrito_residencia` | VARCHAR(100) | YES | - | Distrito de residencia |
| `gps_domicilio_lat` | DECIMAL(10,7) | YES | - | Latitud GPS domicilio |
| `gps_domicilio_lng` | DECIMAL(10,7) | YES | - | Longitud GPS domicilio |
| `contacto_emergencia_nombre` | VARCHAR(200) | YES | - | Nombre contacto emergencia |
| `contacto_emergencia_telefono` | VARCHAR(20) | YES | - | Teléfono contacto emergencia |
| `contacto_emergencia_parentesco` | VARCHAR(50) | YES | - | Parentesco contacto emergencia |
| `banco` | VARCHAR(100) | YES | - | Entidad bancaria |
| `numero_cuenta` | VARCHAR(50) | YES | - | Número de cuenta |
| `cci` | VARCHAR(25) | YES | - | Código de cuenta interbancario |
| `fecha_ingreso` | DATE | NO | - | Fecha de ingreso a la empresa |
| `fecha_fin_contrato` | DATE | YES | - | Fecha fin de contrato vigente |
| `tipo_contrato_actual` | VARCHAR(20) | YES | 'PLAZO_FIJO' | Tipo de contrato (ver constraint) |
| `regimen_laboral` | VARCHAR(50) | YES | - | Régimen laboral |
| `cargo_formal` | VARCHAR(100) | YES | - | Cargo formal en contrato |
| `area_funcional` | VARCHAR(30) | YES | 'COMERCIAL' | Área funcional (ver constraint) |
| `jefe_directo_id` | UUID | YES | - | FK → usuarios.id |
| `remuneracion_actual` | DECIMAL(10,2) | YES | - | Remuneración mensual actual |
| `status` | VARCHAR(20) | NO | 'ACTIVO' | Estado RRHH del colaborador (ver 13.1.1) |
| `talla_uniforme` | VARCHAR(10) | YES | - | Talla de uniforme |
| `tiene_equipo_corporativo` | BOOLEAN | YES | false | Si tiene equipo asignado |
| `equipo_corporativo_detalle` | TEXT | YES | - | Detalle del equipo (marca, modelo, IMEI) |
| `foto_url` | TEXT | YES | - | URL foto del colaborador |
| `notas` | TEXT | YES | - | Notas internas RRHH |
| *Seguridad social y tributario* | | | | *(migración 026)* |
| `sistema_pensionario` | VARCHAR(10) | YES | - | AFP u ONP (ver constraint) *(026)* |
| `afp_nombre` | VARCHAR(50) | YES | - | Nombre de la AFP (Integra, Prima, Habitat, Profuturo) *(026)* |
| `cuspp` | VARCHAR(20) | YES | - | Código Único del SPP (formato XXX-XXXXXXXX-X) *(026)* |
| `eps_nombre` | VARCHAR(50) | YES | - | EPS contratada (Rímac, Pacífico, Mapfre, Sanitas, etc.) *(026)* |
| `tiene_sctr` | BOOLEAN | YES | false | Seguro Complementario de Trabajo de Riesgo *(026)* |
| `asignacion_familiar` | BOOLEAN | YES | false | Percibe asignación familiar (10% RMV) *(026)* |
| `numero_dependientes` | INTEGER | YES | - | Dependientes declarados (≥ 0) *(026)* |
| `numero_hijos` | INTEGER | YES | - | Hijos; base para asignación familiar (≥ 0) *(026)* |
| *Identificación adicional* | | | | *(migración 026)* |
| `tipo_documento` | VARCHAR(15) | YES | 'DNI' | Tipo de documento de identidad (ver constraint) *(026)* |
| `lugar_nacimiento` | VARCHAR(100) | YES | - | Ciudad/departamento de nacimiento *(026)* |
| `nacionalidad` | VARCHAR(50) | YES | 'PERUANA' | Nacionalidad (sin constraint) *(026)* |
| `ruc` | VARCHAR(11) | YES | - | RUC personal (relevante para contratos RxH) *(026)* |
| *Educación* | | | | *(migración 026)* |
| `nivel_educativo` | VARCHAR(30) | YES | - | Nivel educativo máximo (ver constraint) *(026)* |
| `profesion_carrera` | VARCHAR(100) | YES | - | Carrera o profesión (texto libre) *(026)* |
| *Salud* | | | | *(migración 026)* |
| `grupo_sanguineo` | VARCHAR(5) | YES | - | Grupo sanguíneo y factor Rh (ver constraint) *(026)* |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

> **Total: 46 columnas** tras la migración 026 (las 15 marcadas *(026)* son nuevas). El valor *vigente* de banco/dirección vive aquí; el histórico en `historial_bancario` (§13.23) e `historial_direcciones` (§13.24).

**Constraints:**
```sql
CHECK (genero IS NULL OR genero IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'))
CHECK (estado_civil IS NULL OR estado_civil IN ('SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'))
CHECK (tipo_contrato_actual IN ('PLAZO_FIJO', 'INDETERMINADO', 'RXH', 'PERIODO_PRUEBA'))
CHECK (area_funcional IN ('COMERCIAL', 'OPERACIONES', 'RRHH', 'MANTENIMIENTO', 'ADMINISTRACION'))
CHECK (status IN ('CANDIDATO', 'EN_INDUCCION', 'EN_SOMBRA', 'PERIODO_PRUEBA', 'ACTIVO', 'SUSPENDIDO', 'LICENCIA', 'PRE_CESE', 'CESADO'))
-- migración 026:
CHECK (sistema_pensionario IS NULL OR sistema_pensionario IN ('AFP', 'ONP'))
CHECK (tipo_documento IS NULL OR tipo_documento IN ('DNI', 'CE', 'PASAPORTE', 'PTP'))
CHECK (nivel_educativo IS NULL OR nivel_educativo IN (
  'SECUNDARIA_INCOMPLETA', 'SECUNDARIA', 'TECNICO_INCOMPLETO', 'TECNICO',
  'UNIVERSITARIO_INCOMPLETO', 'UNIVERSITARIO', 'POSTGRADO'))
CHECK (grupo_sanguineo IS NULL OR grupo_sanguineo IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'))
CHECK (numero_dependientes IS NULL OR numero_dependientes >= 0)
CHECK (numero_hijos IS NULL OR numero_hijos >= 0)
```

**Índices:** `idx_usuarios_rrhh_status`, `idx_usuarios_rrhh_fecha_ingreso`, `idx_usuarios_rrhh_fecha_fin_contrato`, `idx_usuarios_rrhh_jefe_directo`, `idx_usuarios_rrhh_area`

**RLS:**
- SELECT: propia ficha (id = auth.uid()) + gestión (BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, SUPERVISOR)
- INSERT: BACKOFFICE_RRHH, ADMIN
- UPDATE: propia ficha + gestión (BACKOFFICE_RRHH, ADMIN)

---

#### 13.1.1 Estados del Colaborador (`status`)

| Estado | Descripción | Transiciones posibles |
|--------|-------------|----------------------|
| `CANDIDATO` | En pipeline de reclutamiento | → EN_INDUCCION, CESADO |
| `EN_INDUCCION` | En proceso de inducción | → EN_SOMBRA, CESADO |
| `EN_SOMBRA` | En período de sombra en tienda | → PERIODO_PRUEBA, EN_INDUCCION, CESADO |
| `PERIODO_PRUEBA` | Contratado, en evaluación inicial | → ACTIVO, CESADO |
| `ACTIVO` | Colaborador activo operando | → SUSPENDIDO, LICENCIA, PRE_CESE, CESADO |
| `SUSPENDIDO` | Suspendido temporalmente | → ACTIVO, PRE_CESE, CESADO |
| `LICENCIA` | En licencia (médica, maternidad, etc.) | → ACTIVO |
| `PRE_CESE` | En proceso de salida (offboarding) | → CESADO |
| `CESADO` | Ya no labora (estado terminal) | — |

---

#### 13.1.2 Tipos de Contrato (`tipo_contrato_actual`)

| Valor | Descripción |
|-------|-------------|
| `PLAZO_FIJO` | Contrato a plazo fijo (mensual, típico en TEX) |
| `INDETERMINADO` | Contrato a plazo indeterminado |
| `RXH` | Recibo por honorarios |
| `PERIODO_PRUEBA` | En período de prueba (3 meses legales) |

---

#### 13.1.3 Áreas Funcionales (`area_funcional`)

| Valor | Personal típico |
|-------|-----------------|
| `COMERCIAL` | Asesores, coordinadores, supervisores, JV |
| `OPERACIONES` | Backoffice operaciones, repartidores |
| `RRHH` | Backoffice RRHH, capacitador |
| `MANTENIMIENTO` | Operarios de mantenimiento |
| `ADMINISTRACION` | Gerencia, KAM |

---

### 13.2 usuarios_status_log

Historial de cambios de estado del colaborador. Cada cambio en `usuarios_rrhh.status` genera un registro.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (CASCADE) |
| `status_anterior` | VARCHAR(20) | YES | - | Estado anterior (NULL si es primer registro) |
| `status_nuevo` | VARCHAR(20) | NO | - | Nuevo estado |
| `motivo` | TEXT | YES | - | Motivo del cambio |
| `fecha_efectiva` | DATE | NO | CURRENT_DATE | Fecha efectiva del cambio |
| `registrado_por` | UUID | YES | - | FK → usuarios.id (quien registró) |
| `metadata` | JSONB | YES | - | Datos adicionales del contexto |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraints:** Mismos CHECK de status que `usuarios_rrhh`

**Índices:** `idx_status_log_usuario`, `idx_status_log_fecha`, `idx_status_log_status_nuevo`

**RLS:** SELECT para propio usuario + gestión; INSERT solo BACKOFFICE_RRHH, ADMIN

---

### 13.3 ai_tasks

Log centralizado de todas las tareas AI ejecutadas. Permite auditoría, mejora de prompts, monitoreo de costos y medición de calidad. Aunque nace en RRHH, es **compartida** por todos los módulos que usen AI.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tipo` | VARCHAR(40) | NO | - | Tipo de tarea AI (ver 13.3.1) |
| `modulo` | VARCHAR(30) | NO | 'RRHH' | Módulo que originó la tarea |
| `entidad_tipo` | VARCHAR(30) | YES | - | Tipo de entidad (CANDIDATO, USUARIO, CONTRATO) |
| `entidad_id` | UUID | YES | - | ID de la entidad relacionada |
| `modelo` | VARCHAR(50) | YES | - | Modelo Claude usado (claude-sonnet-4-5, etc.) |
| `prompt_version` | VARCHAR(20) | YES | - | Versión del prompt |
| `input_summary` | TEXT | YES | - | Resumen del input (no el input completo) |
| `output` | JSONB | YES | - | Resultado completo del AI |
| `ai_confidence` | DECIMAL(5,4) | YES | - | Nivel de confianza (0.0000-1.0000) |
| `tokens_input` | INTEGER | YES | - | Tokens consumidos (input) |
| `tokens_output` | INTEGER | YES | - | Tokens consumidos (output) |
| `costo_estimado_usd` | DECIMAL(8,6) | YES | - | Costo estimado en USD |
| `latency_ms` | INTEGER | YES | - | Tiempo de respuesta en ms |
| `status` | VARCHAR(20) | NO | 'PENDING' | Estado de la tarea (ver 13.3.2) |
| `error_message` | TEXT | YES | - | Mensaje de error si falló |
| `reintentos` | INTEGER | YES | 0 | Cantidad de reintentos |
| `solicitado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:**
```sql
CHECK (tipo IN ('CV_PARSING', 'ENTREVISTA_TRANSCRIPCION', 'ENTREVISTA_ANALISIS', 'CONTRATO_GENERACION', 'RENOVACION_RESUMEN', 'SCORING_CANDIDATO', 'RIESGO_FUGA', 'CHATBOT_QUERY', 'DOCUMENTO_OCR', 'EMAIL_DRAFT', 'ANOMALIA_DETECCION', 'INDUCCION_PLAN', 'OFFBOARDING_CHECKLIST'))
CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
```

**Índices:** `idx_ai_tasks_tipo`, `idx_ai_tasks_status`, `idx_ai_tasks_entidad`, `idx_ai_tasks_created`

**RLS:** SELECT para BACKOFFICE_RRHH, ADMIN, BACKOFFICE_OPERACIONES, GERENTE_COMERCIAL, GERENTE_GENERAL; ALL para BACKOFFICE_RRHH, ADMIN

---

#### 13.3.1 Tipos de Tarea AI (`tipo`)

| Tipo | Módulo | Modelo sugerido | Frecuencia |
|------|--------|-----------------|------------|
| `CV_PARSING` | Reclutamiento | Sonnet | Alta |
| `ENTREVISTA_TRANSCRIPCION` | Reclutamiento | Whisper + Sonnet | Media |
| `ENTREVISTA_ANALISIS` | Reclutamiento | Sonnet/Opus | Media |
| `SCORING_CANDIDATO` | Reclutamiento | Sonnet | Alta |
| `RENOVACION_RESUMEN` | Contratos | Sonnet | Mensual |
| `CONTRATO_GENERACION` | Contratos | Sonnet | Media |
| `RIESGO_FUGA` | Gestión | Sonnet | Periódico |
| `CHATBOT_QUERY` | Autoservicio | Sonnet | Alta |
| `DOCUMENTO_OCR` | Documentos | Sonnet | Media |
| `EMAIL_DRAFT` | Comunicaciones | Sonnet | Baja |
| `ANOMALIA_DETECCION` | Dashboard | Sonnet | Periódico |
| `INDUCCION_PLAN` | Reclutamiento | Sonnet | Media |
| `OFFBOARDING_CHECKLIST` | Offboarding | Sonnet | Media |

---

#### 13.3.2 Estados de Tarea AI (`status`)

| Estado | Descripción |
|--------|-------------|
| `PENDING` | Creada, esperando procesamiento |
| `PROCESSING` | En ejecución |
| `COMPLETED` | Completada exitosamente |
| `FAILED` | Falló (ver error_message) |
| `CANCELLED` | Cancelada por usuario o sistema |

---

### 13.4 candidatos

Registro central del pipeline de reclutamiento. Contiene datos del candidato y el estado de todas las etapas inline (Entel, inducción, sombra, descarte).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `dni` | VARCHAR(8) | NO | - | DNI del candidato |
| `nombre_completo` | VARCHAR(200) | NO | - | Nombre completo |
| `telefono` | VARCHAR(20) | NO | - | Teléfono de contacto |
| `email` | VARCHAR(200) | YES | - | Email |
| `fecha_nacimiento` | DATE | YES | - | Fecha de nacimiento |
| `genero` | VARCHAR(20) | YES | - | Género |
| `distrito_residencia` | VARCHAR(100) | YES | - | Distrito de residencia |
| `direccion` | TEXT | YES | - | Dirección completa |
| `gps_domicilio_lat` | DECIMAL(10,7) | YES | - | Latitud GPS domicilio |
| `gps_domicilio_lng` | DECIMAL(10,7) | YES | - | Longitud GPS domicilio |
| `experiencia_telecom` | BOOLEAN | NO | false | ¿Tiene experiencia en telecom? |
| `experiencia_detalle` | TEXT | YES | - | Detalle de experiencia |
| `disponibilidad_horario` | VARCHAR(50) | YES | - | Disponibilidad horaria |
| `disponibilidad_detalle` | TEXT | YES | - | Detalle de disponibilidad |
| `etapa_actual` | VARCHAR(30) | NO | 'CAPTACION' | Etapa actual del pipeline (ver 13.4.1) |
| `fecha_captacion` | DATE | NO | CURRENT_DATE | Fecha de captación |
| `fecha_ultima_actualizacion` | TIMESTAMPTZ | YES | NOW() | Última actualización de etapa |
| `fuente_captacion` | VARCHAR(30) | NO | 'CONVOCATORIA' | Fuente de captación (ver 13.4.2) |
| `referido_por` | UUID | YES | - | FK → usuarios.id (quien lo refirió) |
| `tienda_destino_id` | UUID | YES | - | FK → tiendas.id (tienda destino si ya se sabe) |
| `ai_score` | DECIMAL(5,2) | YES | - | Puntaje AI del candidato (0-100) |
| `ai_score_detalle` | JSONB | YES | - | Desglose del scoring AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `cv_url` | TEXT | YES | - | URL del CV en Storage |
| `cv_datos_extraidos` | JSONB | YES | - | Datos parseados del CV por AI |
| `foto_url` | TEXT | YES | - | URL de foto del candidato |
| `entel_fecha_envio` | DATE | YES | - | Fecha de envío a consulta Entel |
| `entel_estado` | VARCHAR(20) | YES | - | Estado consulta Entel |
| `entel_fecha_respuesta` | DATE | YES | - | Fecha respuesta de Entel |
| `entel_observaciones` | TEXT | YES | - | Observaciones de Entel |
| `entel_usuario_fecha_solicitud` | DATE | YES | - | Fecha solicitud de usuario Entel |
| `entel_usuario_estado` | VARCHAR(20) | YES | - | Estado del usuario Entel |
| `entel_usuario_confirmado` | BOOLEAN | YES | false | ¿Usuario Entel confirmado? |
| `induccion_fecha_inicio` | DATE | YES | - | Fecha inicio inducción |
| `induccion_fecha_fin` | DATE | YES | - | Fecha fin inducción |
| `induccion_capacitador_id` | UUID | YES | - | FK → usuarios.id |
| `induccion_checklist` | JSONB | YES | - | Checklist de inducción (ver SPEC §8.3) |
| `induccion_evaluacion` | VARCHAR(20) | YES | - | Resultado inducción |
| `sombra_tienda_id` | UUID | YES | - | FK → tiendas.id |
| `sombra_mentor_id` | UUID | YES | - | FK → usuarios.id |
| `sombra_fecha_inicio` | DATE | YES | - | Fecha inicio sombra |
| `sombra_fecha_fin` | DATE | YES | - | Fecha fin sombra |
| `sombra_evaluacion_mentor` | JSONB | YES | - | Evaluación del mentor |
| `sombra_evaluacion_supervisor` | JSONB | YES | - | Evaluación del supervisor |
| `sombra_resultado` | VARCHAR(20) | YES | - | Resultado sombra |
| `descartado` | BOOLEAN | NO | false | ¿Está descartado? |
| `descarte_etapa` | VARCHAR(30) | YES | - | Etapa en que fue descartado |
| `descarte_motivo` | TEXT | YES | - | Motivo del descarte |
| `descarte_fecha` | DATE | YES | - | Fecha de descarte |
| `descartado_por` | UUID | YES | - | FK → usuarios.id |
| `usuario_generado_id` | UUID | YES | - | FK → usuarios.id (si fue dado de alta) |
| `notas` | TEXT | YES | - | Notas generales |
| `registrado_por` | UUID | NO | - | FK → usuarios.id (quien lo registró) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints principales:**
```sql
CHECK (etapa_actual IN ('CAPTACION', 'FILTRO_CV', 'ENTREVISTAS', 'CONSULTA_ENTEL', 'USUARIO_ENTEL', 'INDUCCION', 'SOMBRA', 'ALTA', 'DESCARTADO'))
CHECK (fuente_captacion IN ('REFERIDO', 'PORTAL_EMPLEO', 'CONVOCATORIA', 'REINGRESO', 'BANCO_TALENTO'))
CHECK (entel_estado IS NULL OR entel_estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'OBSERVADO'))
CHECK (entel_usuario_estado IS NULL OR entel_usuario_estado IN ('SOLICITADO', 'EN_PROCESO', 'ENTREGADO'))
CHECK (induccion_evaluacion IS NULL OR induccion_evaluacion IN ('APROBADO', 'DESAPROBADO', 'EN_CURSO'))
CHECK (sombra_resultado IS NULL OR sombra_resultado IN ('APROBADO', 'DESAPROBADO', 'EXTENDER'))
```

**Índices:** `idx_candidatos_dni`, `idx_candidatos_etapa`, `idx_candidatos_descartado`, `idx_candidatos_fuente`, `idx_candidatos_fecha_captacion`, `idx_candidatos_referido_por`, `idx_candidatos_tienda_destino`

**RLS:**
- SELECT: BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS + propios referidos
- INSERT: cualquier usuario activo (para referir candidatos)
- UPDATE/DELETE: BACKOFFICE_RRHH, ADMIN (DELETE solo ADMIN)

---

#### 13.4.1 Etapas del Pipeline (`etapa_actual`)

| Etapa | Descripción | Transiciones válidas |
|-------|-------------|---------------------|
| `CAPTACION` | Candidato registrado | → FILTRO_CV, DESCARTADO |
| `FILTRO_CV` | CV en evaluación | → ENTREVISTAS, DESCARTADO |
| `ENTREVISTAS` | En proceso de entrevistas | → CONSULTA_ENTEL, DESCARTADO |
| `CONSULTA_ENTEL` | Esperando aprobación de Entel | → USUARIO_ENTEL, DESCARTADO |
| `USUARIO_ENTEL` | Esperando credenciales de Entel | → INDUCCION, DESCARTADO |
| `INDUCCION` | En proceso de inducción | → SOMBRA, DESCARTADO |
| `SOMBRA` | En período de sombra en tienda | → ALTA, INDUCCION, DESCARTADO |
| `ALTA` | Dado de alta como colaborador | — (terminal) |
| `DESCARTADO` | No continúa en proceso (banco de talento) | — (terminal) |

---

#### 13.4.2 Fuentes de Captación (`fuente_captacion`)

| Valor | Descripción |
|-------|-------------|
| `REFERIDO` | Referido por un colaborador activo |
| `PORTAL_EMPLEO` | Portal de empleo (Computrabajo, Bumeran, etc.) |
| `CONVOCATORIA` | Convocatoria directa (redes sociales, volantes) |
| `REINGRESO` | Ex-colaborador que regresa |
| `BANCO_TALENTO` | Candidato previamente descartado, re-evaluado |

---

### 13.5 candidatos_etapas

Historial de movimientos del candidato por el pipeline. Permite medir tiempos por etapa y tasas de conversión.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `candidato_id` | UUID | NO | - | FK → candidatos.id (CASCADE) |
| `etapa` | VARCHAR(30) | NO | - | Etapa (mismos valores que candidatos.etapa_actual) |
| `fecha_entrada` | TIMESTAMPTZ | NO | NOW() | Timestamp de entrada a la etapa |
| `fecha_salida` | TIMESTAMPTZ | YES | - | Timestamp de salida de la etapa |
| `resultado` | VARCHAR(20) | YES | - | APROBADO, RECHAZADO, EN_CURSO, PENDIENTE |
| `notas` | TEXT | YES | - | Notas |
| `registrado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_candidatos_etapas_candidato`, `idx_candidatos_etapas_etapa`

---

### 13.6 candidatos_entrevistas

Entrevistas multi-nivel con scorecard humana y análisis AI paralelo.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `candidato_id` | UUID | NO | - | FK → candidatos.id (CASCADE) |
| `nivel` | INTEGER | NO | 1 | Nivel de entrevista (1, 2, 3...) |
| `entrevistador_id` | UUID | NO | - | FK → usuarios.id |
| `fecha_programada` | TIMESTAMPTZ | YES | - | Fecha programada |
| `fecha_realizada` | TIMESTAMPTZ | YES | - | Fecha efectivamente realizada |
| `tipo_captura` | VARCHAR(10) | YES | - | VIDEO, AUDIO, TEXTO |
| `media_url` | TEXT | YES | - | URL de grabación en Storage |
| `duracion_segundos` | INTEGER | YES | - | Duración de la grabación |
| `transcripcion_texto` | TEXT | YES | - | Transcripción completa |
| `transcripcion_ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `ai_analisis` | JSONB | YES | - | Análisis AI de la entrevista |
| `ai_analisis_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `scorecard` | JSONB | YES | - | Evaluación humana estructurada |
| `observaciones` | TEXT | YES | - | Observaciones del entrevistador |
| `resultado` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, APROBADO, RECHAZADO |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Estructura `scorecard` (JSONB):**
```json
{
  "criterios": [
    {"nombre": "Comunicación", "puntaje": 4, "peso": 25, "observacion": "..."},
    {"nombre": "Actitud de servicio", "puntaje": 5, "peso": 25}
  ],
  "observaciones_generales": "..."
}
```

**Índices:** `idx_entrevistas_candidato`, `idx_entrevistas_entrevistador`, `idx_entrevistas_resultado`

---

### 13.7 candidatos_documentos

Repositorio de documentos del candidato en Supabase Storage.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `candidato_id` | UUID | NO | - | FK → candidatos.id (CASCADE) |
| `tipo` | VARCHAR(30) | NO | - | CV, FOTO, DNI, CERTIFICADO, ANTECEDENTES, OTRO |
| `nombre_archivo` | VARCHAR(200) | NO | - | Nombre del archivo |
| `url` | TEXT | NO | - | URL en Storage |
| `mime_type` | VARCHAR(100) | YES | - | Tipo MIME del archivo |
| `tamano_bytes` | INTEGER | YES | - | Tamaño en bytes |
| `ai_texto_extraido` | TEXT | YES | - | Texto extraído por OCR/AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `subido_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_candidatos_docs_candidato`, `idx_candidatos_docs_tipo`

---

### 13.8 contratos

Historial completo de contratos por colaborador con soporte de firma electrónica.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo_contrato` | VARCHAR(20) | NO | - | PLAZO_FIJO, INDETERMINADO, RXH, PERIODO_PRUEBA |
| `fecha_inicio` | DATE | NO | - | Fecha inicio vigencia |
| `fecha_fin` | DATE | YES | - | Fecha fin vigencia (NULL = indeterminado) |
| `cargo` | VARCHAR(100) | NO | - | Cargo en el contrato |
| `remuneracion` | DECIMAL(10,2) | NO | - | Remuneración mensual |
| `tienda_asignada_id` | UUID | YES | - | FK → tiendas.id |
| `estado` | VARCHAR(20) | NO | 'BORRADOR' | Estado del contrato (ver 13.8.1) |
| `documento_url` | TEXT | YES | - | URL del documento PDF |
| `documento_generado_por_ai` | BOOLEAN | YES | false | Si fue generado por AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `firma_colaborador_timestamp` | TIMESTAMPTZ | YES | - | Timestamp de firma electrónica |
| `firma_colaborador_ip` | VARCHAR(45) | YES | - | IP del dispositivo al firmar |
| `firma_colaborador_geo` | JSONB | YES | - | Coordenadas GPS al firmar |
| `firma_colaborador_user_agent` | TEXT | YES | - | User agent del dispositivo |
| `contrato_anterior_id` | UUID | YES | - | FK → contratos.id (self-reference) |
| `lote_renovacion_id` | UUID | YES | - | FK → renovacion_lotes.id |
| `motivo_no_renovacion` | TEXT | YES | - | Motivo si no se renovó |
| `notas` | TEXT | YES | - | Notas internas |
| `generado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Índices:** `idx_contratos_usuario`, `idx_contratos_estado`, `idx_contratos_fecha_fin`, `idx_contratos_tienda`, `idx_contratos_lote`

**RLS:** SELECT propio + gestión; ALL solo BACKOFFICE_RRHH, ADMIN

---

#### 13.8.1 Estados de Contrato (`estado`)

| Estado | Descripción |
|--------|-------------|
| `BORRADOR` | Generado, pendiente de envío |
| `ENVIADO` | Enviado al colaborador para firma |
| `FIRMADO` | Firmado electrónicamente |
| `VIGENTE` | Contrato activo en vigor |
| `VENCIDO` | Venció sin renovación |
| `CANCELADO` | Cancelado antes de firma |
| `NO_RENOVADO` | Decisión explícita de no renovar |

---

### 13.9 renovacion_lotes

Lotes mensuales de renovación con flujo de visado JV → KAM → RRHH.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `periodo` | VARCHAR(7) | NO | - | Período formato YYYY-MM (UNIQUE) |
| `fecha_generacion` | TIMESTAMPTZ | NO | NOW() | Cuándo se generó |
| `fecha_limite_visado` | DATE | YES | - | Fecha límite para visado |
| `estado` | VARCHAR(30) | NO | 'GENERADO' | Estado del lote (ver 13.9.1) |
| `total_colaboradores` | INTEGER | YES | 0 | Cantidad de colaboradores en el lote |
| `resumen` | JSONB | YES | - | Resumen agregado |
| `generado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** `periodo ~ '^\d{4}-\d{2}$'`

**Índice:** UNIQUE en `periodo`

---

#### 13.9.1 Estados del Lote (`estado`)

| Estado | Descripción | Siguiente |
|--------|-------------|-----------|
| `GENERADO` | AI generó resúmenes y lista | → EN_VISADO_JV |
| `EN_VISADO_JV` | JV revisando decisiones por zona | → EN_VISADO_KAM |
| `EN_VISADO_KAM` | KAM revisando todas las zonas | → LISTO_PARA_RRHH |
| `LISTO_PARA_RRHH` | Aprobado, RRHH puede ejecutar | → EJECUTADO |
| `EJECUTADO` | Contratos generados/no-renovados | — (terminal) |
| `CANCELADO` | Lote cancelado | — (terminal) |

---

### 13.10 renovacion_decisiones

Decisiones de renovación por colaborador con trazabilidad completa JV/KAM/RRHH.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `lote_id` | UUID | NO | - | FK → renovacion_lotes.id (CASCADE) |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `contrato_actual_id` | UUID | YES | - | FK → contratos.id |
| `ai_resumen` | TEXT | YES | - | Resumen ejecutivo generado por AI |
| `ai_recomendacion` | VARCHAR(20) | YES | - | RENOVAR, NO_RENOVAR, EVALUAR |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `indicadores_snapshot` | JSONB | YES | - | Indicadores congelados al generar |
| `decision_jv` | VARCHAR(20) | YES | - | RENOVAR, NO_RENOVAR, PENDIENTE_EVALUAR |
| `decision_jv_motivo` | TEXT | YES | - | Motivo (obligatorio si NO_RENOVAR) |
| `decision_jv_id` | UUID | YES | - | FK → usuarios.id (qué JV decidió) |
| `decision_jv_fecha` | TIMESTAMPTZ | YES | - | Cuándo decidió el JV |
| `decision_kam` | VARCHAR(20) | YES | - | CONFIRMAR, REVERTIR |
| `decision_kam_motivo` | TEXT | YES | - | Motivo (obligatorio si REVERTIR) |
| `decision_kam_id` | UUID | YES | - | FK → usuarios.id (qué KAM decidió) |
| `decision_kam_fecha` | TIMESTAMPTZ | YES | - | Cuándo decidió el KAM |
| `decision_final` | VARCHAR(20) | YES | - | RENOVAR, NO_RENOVAR |
| `ejecutado_por` | UUID | YES | - | FK → usuarios.id |
| `ejecutado_fecha` | TIMESTAMPTZ | YES | - | Cuándo se ejecutó |
| `contrato_nuevo_id` | UUID | YES | - | FK → contratos.id (contrato generado) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** UNIQUE (`lote_id`, `usuario_id`)

**Estructura `indicadores_snapshot` (JSONB):**
```json
{
  "ventas_mes": 35,
  "comision_mes": 1850.00,
  "cuota_cumplimiento": 87.5,
  "tardanzas_mes": 1,
  "faltas_mes": 0,
  "incidencias_activas": 0,
  "antiguedad_meses": 6,
  "ranking_tienda": 2,
  "total_hc_tienda": 3
}
```

**Índices:** `idx_decisiones_lote`, `idx_decisiones_usuario`, `idx_decisiones_final`

**RLS:** SELECT para JV+; UPDATE_JV para JEFE_VENTAS; ALL para BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL

---

### 13.11 asistencia

Marcaciones de entrada/salida con selfie georeferenciada y sistema anti-fraude de 4 capas.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `tipo` | VARCHAR(10) | NO | - | ENTRADA, SALIDA |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha de la marcación |
| `hora_servidor` | TIMESTAMPTZ | NO | NOW() | Timestamp del servidor |
| `hora_dispositivo` | TIMESTAMPTZ | YES | - | Timestamp del dispositivo |
| `foto_url` | TEXT | YES | - | URL de selfie en Storage |
| `gps_lat` | DECIMAL(10,7) | YES | - | Latitud GPS capturada |
| `gps_lng` | DECIMAL(10,7) | YES | - | Longitud GPS capturada |
| `gps_accuracy` | DECIMAL(8,2) | YES | - | Precisión GPS en metros |
| `dentro_radio` | BOOLEAN | YES | - | ¿Dentro del radio de la tienda? |
| `distancia_tienda_metros` | DECIMAL(8,2) | YES | - | Distancia a la tienda en metros |
| `mock_location_detectado` | BOOLEAN | YES | false | ¿GPS falso detectado? |
| `estado` | VARCHAR(20) | NO | 'VALIDO' | VALIDO, OBSERVADO, JUSTIFICADO, RECHAZADO, EDITADO |
| `es_tardanza` | BOOLEAN | YES | false | ¿Llegó tarde? |
| `minutos_tardanza` | INTEGER | YES | 0 | Minutos de tardanza |
| `observaciones` | TEXT | YES | - | Observaciones |
| `editado_por` | UUID | YES | - | FK → usuarios.id |
| `editado_motivo` | TEXT | YES | - | Motivo de edición |
| `editado_at` | TIMESTAMPTZ | YES | - | Timestamp de edición |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraint:** UNIQUE (`usuario_id`, `tienda_id`, `fecha`, `tipo`)

**Índices:** `idx_asistencia_usuario_fecha`, `idx_asistencia_tienda_fecha`, `idx_asistencia_fecha`, `idx_asistencia_estado`

**RLS:** SELECT propio + supervisión+; INSERT propio o RRHH; UPDATE solo SUPERVISOR, BACKOFFICE_RRHH, ADMIN

---

### 13.12 apertura_cierre_tienda

Registro diario de apertura y cierre de tienda con foto y headcount.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `tipo` | VARCHAR(10) | NO | - | APERTURA, CIERRE |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha |
| `hora` | TIMESTAMPTZ | NO | NOW() | Hora del registro |
| `foto_url` | TEXT | YES | - | URL de foto evidencia |
| `gps_lat` | DECIMAL(10,7) | YES | - | Latitud GPS |
| `gps_lng` | DECIMAL(10,7) | YES | - | Longitud GPS |
| `cantidad_hc` | INTEGER | NO | 0 | Cantidad de HC presentes |
| `usuarios_presentes` | UUID[] | YES | - | Array de IDs de usuarios presentes |
| `novedades` | TEXT | YES | - | Novedades del día |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraint:** UNIQUE (`tienda_id`, `fecha`, `tipo`)

**Índice:** `idx_apertura_cierre_tienda_fecha`

---

### 13.13 horarios_tienda

Horarios base de operación por tienda y día de semana.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `dia_semana` | INTEGER | NO | - | 0=Lunes, 6=Domingo |
| `hora_apertura` | TIME | NO | '09:00' | Hora apertura |
| `hora_cierre` | TIME | NO | '21:00' | Hora cierre |
| `activo` | BOOLEAN | NO | true | Si opera ese día |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraints:** `dia_semana BETWEEN 0 AND 6`, UNIQUE (`tienda_id`, `dia_semana`)

**RLS:** SELECT público; ALL solo BACKOFFICE_RRHH, ADMIN

---

### 13.14 turnos

Catálogo de tipos de turno con horarios y tolerancia de tardanza.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `codigo` | VARCHAR(20) | NO | - | Código único (APERTURA, CIERRE, COMPLETO) |
| `nombre` | VARCHAR(50) | NO | - | Nombre descriptivo |
| `hora_inicio` | TIME | YES | - | Hora inicio del turno |
| `hora_fin` | TIME | YES | - | Hora fin del turno |
| `es_partido` | BOOLEAN | YES | false | Si es turno partido (con corte) |
| `hora_corte_inicio` | TIME | YES | - | Hora inicio del corte (si partido) |
| `hora_corte_fin` | TIME | YES | - | Hora fin del corte (si partido) |
| `tolerancia_tardanza_minutos` | INTEGER | YES | 5 | Minutos de tolerancia |
| `activo` | BOOLEAN | NO | true | Estado activo |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Seed inicial:** APERTURA (09:00-15:00), CIERRE (15:00-21:00), COMPLETO (09:00-21:00)

**RLS:** SELECT público; ALL solo BACKOFFICE_RRHH, ADMIN

---

### 13.15 asignacion_turnos

Programación de turnos por colaborador, día y tienda.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tienda_id` | UUID | NO | - | FK → tiendas.id |
| `turno_id` | UUID | NO | - | FK → turnos.id |
| `fecha` | DATE | NO | - | Fecha del turno |
| `es_dia_descanso` | BOOLEAN | NO | false | Si es día de descanso |
| `es_feriado` | BOOLEAN | YES | false | Si es feriado |
| `notas` | TEXT | YES | - | Notas |
| `asignado_por` | UUID | YES | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** UNIQUE (`usuario_id`, `fecha`)

**Índices:** `idx_asignacion_usuario_fecha`, `idx_asignacion_tienda_fecha`

**RLS:** SELECT propio + supervisión+; ALL para COORDINADOR, SUPERVISOR, JEFE_VENTAS, BACKOFFICE_RRHH, ADMIN

---

### 13.16 incidencias_laborales

Registro disciplinario con flujo de notificación, descargo y resolución.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo` | VARCHAR(30) | NO | - | Tipo de incidencia (ver 13.16.1) |
| `fecha` | DATE | NO | CURRENT_DATE | Fecha del evento |
| `descripcion` | TEXT | YES | - | Descripción del evento |
| `asistencia_id` | UUID | YES | - | FK → asistencia.id (si aplica) |
| `estado` | VARCHAR(20) | NO | 'REGISTRADA' | Estado del flujo (ver 13.16.2) |
| `descargo_colaborador` | TEXT | YES | - | Descargo del colaborador |
| `descargo_fecha` | TIMESTAMPTZ | YES | - | Cuándo se presentó descargo |
| `resolucion` | TEXT | YES | - | Resolución final |
| `resolucion_por` | UUID | YES | - | FK → usuarios.id |
| `resolucion_fecha` | TIMESTAMPTZ | YES | - | Fecha resolución |
| `documento_url` | TEXT | YES | - | URL del documento (acta, amonestación) |
| `generada_automaticamente` | BOOLEAN | YES | false | Si fue generada por el sistema |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Índices:** `idx_incidencias_usuario`, `idx_incidencias_tipo`, `idx_incidencias_fecha`, `idx_incidencias_estado`

**RLS:** SELECT propio + supervisión+; INSERT supervisión + RRHH; UPDATE propio (descargo) + RRHH

---

#### 13.16.1 Tipos de Incidencia (`tipo`)

| Tipo | Generación | Descripción |
|------|-----------|-------------|
| `TARDANZA` | Automática | Por marcación fuera de tolerancia |
| `FALTA_INJUSTIFICADA` | Automática | Sin marcación ni permiso aprobado |
| `FALTA_JUSTIFICADA` | Manual | Falta con justificación aceptada |
| `ABANDONO_PUESTO` | Manual | Abandonó el puesto sin autorización |
| `AMONESTACION_VERBAL` | Manual | Amonestación verbal registrada |
| `AMONESTACION_ESCRITA` | Manual | Amonestación con documento firmado |
| `SUSPENSION` | Manual | Suspensión temporal |
| `SALIDA_ANTICIPADA` | Manual/Auto | Salió antes de hora sin autorización |
| `OTRO` | Manual | Otro tipo de incidencia |

---

#### 13.16.2 Estados de Incidencia (`estado`)

| Estado | Descripción |
|--------|-------------|
| `REGISTRADA` | Incidencia creada |
| `NOTIFICADA` | Colaborador fue notificado |
| `EN_DESCARGO` | Esperando descargo del colaborador |
| `RESUELTA` | Resuelta con decisión final |
| `ESCALADA` | Escalada a nivel superior |
| `ANULADA` | Anulada (error o justificación posterior) |

---

### 13.17 solicitudes_permiso

Solicitudes de permisos, vacaciones y licencias con flujo de aprobación.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo` | VARCHAR(30) | NO | - | Tipo de permiso (ver 13.17.1) |
| `fecha_inicio` | DATE | NO | - | Fecha inicio del permiso |
| `fecha_fin` | DATE | NO | - | Fecha fin del permiso |
| `horas_solicitadas` | DECIMAL(4,1) | YES | - | Horas (para PERMISO_HORAS) |
| `motivo` | TEXT | NO | - | Motivo de la solicitud |
| `documento_adjunto_url` | TEXT | YES | - | URL documento justificatorio |
| `estado` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, APROBADO, RECHAZADO, CANCELADO |
| `aprobado_por` | UUID | YES | - | FK → usuarios.id |
| `aprobado_fecha` | TIMESTAMPTZ | YES | - | Fecha de aprobación/rechazo |
| `motivo_rechazo` | TEXT | YES | - | Motivo si fue rechazado |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Constraint:** `fecha_fin >= fecha_inicio`

**Índices:** `idx_permisos_usuario`, `idx_permisos_estado`, `idx_permisos_fechas`

**RLS:** SELECT propio + supervisión+; INSERT solo propio; UPDATE propio (cancelar si pendiente) + aprobadores

---

#### 13.17.1 Tipos de Permiso (`tipo`)

| Tipo | Descripción | Requiere documento |
|------|-------------|-------------------|
| `PERMISO_HORAS` | Permiso por horas dentro del día | No |
| `PERMISO_DIA` | Permiso por día completo | No |
| `VACACIONES` | Vacaciones (según ley peruana) | No |
| `LICENCIA_MEDICA` | Licencia médica | Sí |
| `LICENCIA_MATERNIDAD` | Licencia por maternidad (98 días) | Sí |
| `LICENCIA_PATERNIDAD` | Licencia por paternidad (10 días) | Sí |
| `LICENCIA_FALLECIMIENTO` | Licencia por fallecimiento familiar (5 días) | Sí |
| `OTRO` | Otro tipo de permiso | Depende |

---

### 13.18 movimientos_personal

Historial de todos los movimientos de personal con datos antes/después.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo_movimiento` | VARCHAR(30) | NO | - | Tipo de movimiento (ver 13.18.1) |
| `fecha_efectiva` | DATE | NO | - | Fecha efectiva del movimiento |
| `motivo` | TEXT | YES | - | Motivo |
| `datos_anteriores` | JSONB | YES | - | Snapshot de datos antes del cambio |
| `datos_nuevos` | JSONB | YES | - | Snapshot de datos después del cambio |
| `contrato_id` | UUID | YES | - | FK → contratos.id |
| `tienda_origen_id` | UUID | YES | - | FK → tiendas.id |
| `tienda_destino_id` | UUID | YES | - | FK → tiendas.id |
| `autorizado_por` | UUID | NO | - | FK → usuarios.id |
| `documento_url` | TEXT | YES | - | URL de documento soporte |
| `notas` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_movimientos_usuario`, `idx_movimientos_tipo`, `idx_movimientos_fecha`

**RLS:** SELECT propio + jefatura+; ALL solo BACKOFFICE_RRHH, ADMIN

---

#### 13.18.1 Tipos de Movimiento (`tipo_movimiento`)

| Tipo | Descripción |
|------|-------------|
| `INGRESO` | Alta de nuevo colaborador |
| `TRANSFERENCIA` | Cambio de tienda |
| `CAMBIO_ROL` | Cambio de rol (ej: ASESOR → COORDINADOR) |
| `CAMBIO_ZONA` | Cambio de zona geográfica |
| `PROMOCION` | Promoción (implica cambio de rol/remuneración) |
| `CAMBIO_REMUNERACION` | Solo cambio de remuneración |
| `CESE_VOLUNTARIO` | Renuncia voluntaria |
| `CESE_DESPIDO` | Despido |
| `CESE_NO_RENOVACION` | No renovación de contrato |
| `CESE_ABANDONO` | Abandono de trabajo |
| `CESE_PERIODO_PRUEBA` | No pasó período de prueba |
| `REINGRESO` | Reingreso de ex-colaborador |

---

### 13.19 offboarding_checklist

Checklist adaptativo de offboarding generado según tipo de salida. AI genera tareas según el contexto.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo_salida` | VARCHAR(30) | NO | - | RENUNCIA, NO_RENOVACION, DESPIDO, ABANDONO, PERIODO_PRUEBA, MUTUO_ACUERDO |
| `fecha_inicio` | DATE | NO | CURRENT_DATE | Fecha inicio del proceso |
| `fecha_cierre` | DATE | YES | - | Fecha cierre del proceso |
| `estado` | VARCHAR(20) | NO | 'EN_PROCESO' | EN_PROCESO, COMPLETADO, CANCELADO |
| `tareas` | JSONB | NO | '[]' | Array de tareas del checklist |
| `generado_por_ai` | BOOLEAN | YES | false | Si fue generado por AI |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `responsable_id` | UUID | NO | - | FK → usuarios.id |
| `notas` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización |

**Estructura `tareas` (JSONB):**
```json
[
  {"id": "t1", "titulo": "Carta de renuncia recibida", "completada": true, "completada_por": "uuid", "completada_fecha": "2026-02-13", "orden": 1},
  {"id": "t2", "titulo": "Liquidación calculada", "completada": false, "orden": 2}
]
```

**Índices:** `idx_offboarding_usuario`, `idx_offboarding_estado`

**RLS:** SELECT/ALL para jefatura + RRHH

---

### 13.20 documentos_colaborador

Repositorio digital de documentos por colaborador con soporte OCR/AI.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id |
| `tipo` | VARCHAR(30) | NO | - | Tipo de documento (ver 13.20.1) |
| `nombre_archivo` | VARCHAR(200) | NO | - | Nombre del archivo |
| `descripcion` | TEXT | YES | - | Descripción |
| `url` | TEXT | NO | - | URL en Supabase Storage |
| `mime_type` | VARCHAR(100) | YES | - | Tipo MIME |
| `tamano_bytes` | INTEGER | YES | - | Tamaño en bytes |
| `ai_texto_extraido` | TEXT | YES | - | Texto extraído por OCR |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `fecha_documento` | DATE | YES | - | Fecha del documento |
| `es_confidencial` | BOOLEAN | YES | false | Si es confidencial |
| `subido_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_docs_usuario`, `idx_docs_tipo`

**RLS:** SELECT propio (no confidencial) + gestión (todo); ALL solo BACKOFFICE_RRHH, ADMIN

---

#### 13.20.1 Tipos de Documento (`tipo`)

| Tipo | Descripción |
|------|-------------|
| `CV` | Currículum vitae |
| `FOTO` | Foto del colaborador |
| `DNI` | Copia de DNI |
| `CONTRATO` | Contrato firmado |
| `AMONESTACION` | Amonestación escrita |
| `CERTIFICADO` | Certificado de capacitación |
| `CARTA_NOTARIAL` | Carta notarial |
| `LIQUIDACION` | Liquidación de beneficios |
| `EVALUACION` | Evaluación de desempeño |
| `ENTREVISTA_GRABACION` | Grabación de entrevista |
| `ENTREVISTA_TRANSCRIPCION` | Transcripción de entrevista |
| `LICENCIA_MEDICA` | Certificado médico |
| `OTRO` | Otro documento |

---

### 13.21 alertas_rrhh

Alertas contextuales automáticas del módulo RRHH con priorización.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `tipo` | VARCHAR(40) | NO | - | Tipo de alerta (ver 13.21.1) |
| `titulo` | VARCHAR(200) | NO | - | Título de la alerta |
| `mensaje` | TEXT | NO | - | Mensaje descriptivo |
| `nivel` | VARCHAR(10) | NO | 'INFO' | INFO, WARNING, CRITICAL |
| `entidad_tipo` | VARCHAR(30) | YES | - | Tipo de entidad relacionada |
| `entidad_id` | UUID | YES | - | ID de la entidad |
| `modulo` | VARCHAR(30) | YES | - | Módulo que genera la alerta |
| `datos_contexto` | JSONB | YES | - | Datos de contexto para la alerta |
| `destinatario_id` | UUID | YES | - | FK → usuarios.id (destinatario específico) |
| `destinatario_rol` | VARCHAR(30) | YES | - | Rol destinatario (si es broadcast) |
| `estado` | VARCHAR(20) | NO | 'PENDIENTE' | PENDIENTE, LEIDA, ACCIONADA, DESCARTADA |
| `leida_at` | TIMESTAMPTZ | YES | - | Cuándo se leyó |
| `accion_tomada` | TEXT | YES | - | Qué acción se tomó |
| `accion_por` | UUID | YES | - | FK → usuarios.id |
| `accion_at` | TIMESTAMPTZ | YES | - | Cuándo se accionó |
| `generada_por` | VARCHAR(20) | NO | 'SISTEMA' | SISTEMA, AI, MANUAL |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `fecha_limite` | DATE | YES | - | Fecha límite para actuar; prioriza alertas por urgencia *(migr. 025)* |

**Índices:** `idx_alertas_destinatario`, `idx_alertas_tipo`, `idx_alertas_estado`, `idx_alertas_nivel`, `idx_alertas_created`, `idx_alertas_rrhh_fecha_limite` (parcial: `fecha_limite IS NOT NULL AND estado='PENDIENTE'`, migr. 025)

**RLS:** SELECT propia + gestión; UPDATE propia (marcar leída) + RRHH; INSERT solo BACKOFFICE_RRHH, ADMIN

---

#### 13.21.1 Tipos de Alerta (`tipo`)

| Tipo | Nivel típico | Descripción |
|------|-------------|-------------|
| `CONTRATO_POR_VENCER` | WARNING | Contrato vence en los próximos X días |
| `VISADO_PENDIENTE` | CRITICAL | Lote de renovación esperando visado |
| `PERIODO_PRUEBA_VENCER` | WARNING | Período de prueba por terminar |
| `CANDIDATO_ESTANCADO` | INFO | Candidato más de X días en una etapa |
| `AUSENCIA_SIN_JUSTIFICAR` | WARNING | Falta sin permiso aprobado |
| `ABANDONO_POTENCIAL` | CRITICAL | Patrón de ausencias consecutivas |
| `RIESGO_FUGA` | WARNING | AI detecta alto riesgo de rotación |
| `INCIDENCIA_REINCIDENTE` | WARNING | Más de N incidencias en período |
| `COBERTURA_BAJA` | CRITICAL | Tienda con HC menor al mínimo |
| `CUMPLEANOS` | INFO | Cumpleaños de colaborador |
| `TURNO_SIN_ASIGNAR` | WARNING | Día sin turno asignado |
| `PERMISO_PENDIENTE` | INFO | Solicitud de permiso sin resolver |
| `OFFBOARDING_PENDIENTE` | WARNING | Checklist de salida incompleto |
| `GENERAL` | INFO | Alerta general |

---

### 13.22 importaciones_rrhh *(migración 025)*

Historial y estado de cada proceso de importación inicial de colaboradores (wizard Excel + mapeo AI).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `archivo_nombre` | VARCHAR(255) | NO | - | Nombre del archivo subido |
| `archivo_url` | TEXT | NO | - | URL en storage (bucket de importación) |
| `archivo_tamano_bytes` | INTEGER | YES | - | Tamaño del archivo |
| `archivo_tipo` | VARCHAR(50) | YES | - | Tipo/MIME del archivo |
| `hoja_procesada` | VARCHAR(100) | YES | - | Hoja Excel procesada |
| `fila_encabezados` | INTEGER | YES | - | Fila donde están los encabezados |
| `total_filas_datos` | INTEGER | NO | - | Total de filas de datos detectadas |
| `mapeo_columnas` | JSONB | NO | `'{}'` | Mapeo columna Excel → campo destino |
| `mapeo_ai_task_id` | UUID | YES | - | FK → ai_tasks.id (tarea de mapeo AI) |
| `mapeo_confianza_promedio` | DECIMAL(5,2) | YES | - | Confianza promedio del mapeo AI |
| `estado` | VARCHAR(30) | NO | 'EN_PROCESO' | Estado del wizard (ver abajo) |
| `total_validos` | INTEGER | YES | 0 | Filas válidas |
| `total_warnings` | INTEGER | YES | 0 | Filas con advertencias |
| `total_errores` | INTEGER | YES | 0 | Filas con errores |
| `total_importados` | INTEGER | YES | 0 | Filas insertadas |
| `total_actualizados` | INTEGER | YES | 0 | Filas actualizadas |
| `total_saltados` | INTEGER | YES | 0 | Filas omitidas |
| `total_activos_importados` | INTEGER | YES | 0 | Colaboradores activos importados |
| `total_cesados_importados` | INTEGER | YES | 0 | Colaboradores cesados importados |
| `reporte_brechas` | JSONB | YES | - | Reporte de campos faltantes/brechas |
| `reporte_brechas_url` | TEXT | YES | - | URL del reporte de brechas |
| `completitud_promedio` | DECIMAL(5,2) | YES | - | % de completitud promedio |
| `total_alertas_generadas` | INTEGER | YES | 0 | Alertas generadas tras importar |
| `alerta_resumen_id` | UUID | YES | - | FK → alertas_rrhh.id (alerta resumen) |
| `detalle_filas` | JSONB | YES | - | Detalle por fila (validación/resultado) |
| `ejecutado_por` | UUID | YES | - | FK → usuarios.id |
| `fecha_ejecucion` | TIMESTAMPTZ | YES | - | Cuándo se ejecutó la inserción |
| `notas` | TEXT | YES | - | Notas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización (trigger) |

**Constraints/FK:** `mapeo_ai_task_id` → ai_tasks, `alerta_resumen_id` → alertas_rrhh, `ejecutado_por` → usuarios.

**Estados (`estado`):** `EN_PROCESO` → `ANALIZADO` → `MAPEADO` → `VALIDADO` → `IMPORTADO`; terminales alternos `ERROR`, `CANCELADO`.

**Índices:** `idx_importaciones_rrhh_estado` (estado), `idx_importaciones_rrhh_fecha` (created_at DESC).

**RLS:** SELECT BACKOFFICE_RRHH/ADMIN/GERENTE_GENERAL; ALL BACKOFFICE_RRHH/ADMIN. *(Ver nota global: en este entorno las tablas RRHH operan con RLS deshabilitado por usar auth propia, no Supabase Auth.)*

---

### 13.23 historial_bancario *(migración 026)*

Historial de cuentas bancarias del colaborador (un solo registro vigente por usuario).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (ON DELETE CASCADE) |
| `banco` | VARCHAR(100) | NO | - | Nombre del banco |
| `numero_cuenta` | VARCHAR(50) | NO | - | Número de cuenta |
| `cci` | VARCHAR(25) | YES | - | Código de Cuenta Interbancario |
| `fecha_desde` | DATE | NO | - | Inicio de vigencia |
| `fecha_hasta` | DATE | YES | - | Fin de vigencia (NULL = vigente) |
| `motivo_cambio` | TEXT | YES | - | Motivo del cambio |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_historial_bancario_usuario` (usuario_id), `idx_historial_bancario_vigente` (parcial `fecha_hasta IS NULL`), **`idx_historial_bancario_unico_vigente`** (UNIQUE parcial `fecha_hasta IS NULL` — un solo registro vigente por usuario).

---

### 13.24 historial_direcciones *(migración 026)*

Historial de domicilios del colaborador (un solo registro vigente por usuario).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (ON DELETE CASCADE) |
| `direccion_domiciliaria` | TEXT | NO | - | Dirección completa |
| `distrito_residencia` | VARCHAR(100) | YES | - | Distrito |
| `gps_domicilio_lat` | NUMERIC(10,7) | YES | - | Latitud GPS del domicilio |
| `gps_domicilio_lng` | NUMERIC(10,7) | YES | - | Longitud GPS del domicilio |
| `fecha_desde` | DATE | NO | - | Inicio de vigencia |
| `fecha_hasta` | DATE | YES | - | Fin de vigencia (NULL = vigente) |
| `motivo_cambio` | TEXT | YES | - | Motivo del cambio |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Índices:** `idx_historial_direcciones_usuario` (usuario_id), **`idx_historial_direcciones_unico_vigente`** (UNIQUE parcial `fecha_hasta IS NULL`).

---

### 13.25 historial_cambios_rrhh *(migración 026)*

Historial genérico de cambios sobre campos sensibles del colaborador (auditoría).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (ON DELETE CASCADE) |
| `campo` | VARCHAR(50) | NO | - | Campo modificado (ver constraint) |
| `valor_anterior` | TEXT | YES | - | Valor previo |
| `valor_nuevo` | TEXT | NO | - | Valor nuevo |
| `fecha_cambio` | DATE | NO | - | Fecha del cambio |
| `motivo` | TEXT | YES | - | Motivo |
| `registrado_por` | UUID | NO | - | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |

**Constraint:** `historial_cambios_campo_check` → `campo IN ('TELEFONO_PERSONAL', 'REMUNERACION', 'JEFE_DIRECTO', 'CARGO_FORMAL')`.

**Índices:** `idx_historial_cambios_usuario` (usuario_id), `idx_historial_cambios_campo` (usuario_id, campo), `idx_historial_cambios_fecha` (fecha_cambio DESC).

---

### 13.26 entrevistas_colaborador *(migración 026)*

Entrevistas del colaborador ya contratado (exit interviews, feedback, retención, amonestación verbal). Distinta de `candidatos_entrevistas` (que aplica al pipeline de reclutamiento).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `usuario_id` | UUID | NO | - | FK → usuarios.id (ON DELETE CASCADE) |
| `tipo` | VARCHAR(30) | NO | - | Tipo de entrevista (ver constraint) |
| `entrevistador_id` | UUID | NO | - | FK → usuarios.id |
| `fecha` | DATE | NO | - | Fecha de la entrevista |
| `motivo` | TEXT | YES | - | Motivo |
| `notas` | TEXT | YES | - | Notas |
| `datos_estructurados` | JSONB | YES | - | Respuestas estructuradas / scorecard |
| `resultado` | VARCHAR(20) | YES | - | Resultado (ver constraint) |
| `grabacion_url` | TEXT | YES | - | URL de grabación |
| `transcripcion_url` | TEXT | YES | - | URL de transcripción |
| `ai_task_id` | UUID | YES | - | FK → ai_tasks.id |
| `ai_resumen` | TEXT | YES | - | Resumen generado por AI |
| `movimiento_id` | UUID | YES | - | FK → movimientos_personal.id (ej. exit ligado a cese) |
| `es_confidencial` | BOOLEAN | NO | false | Si la entrevista es confidencial |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Fecha actualización (trigger) |

**Constraints:**
```sql
CONSTRAINT entrevistas_tipo_check CHECK (
  tipo IN ('EXIT_INTERVIEW', 'FEEDBACK_DESEMPENO', 'RETENCION', 'AMONESTACION_VERBAL'))
CONSTRAINT entrevistas_resultado_check CHECK (
  resultado IS NULL OR resultado IN ('SATISFACTORIA', 'CON_OBSERVACIONES', 'NO_REALIZADA'))
```

**Índices:** `idx_entrevistas_usuario` (usuario_id), `idx_entrevistas_tipo` (tipo), `idx_entrevistas_fecha` (fecha DESC), `idx_entrevistas_movimiento` (parcial `movimiento_id IS NOT NULL`).

**RLS:** SELECT propia no-confidencial + gestión (BACKOFFICE_RRHH/ADMIN/GERENTE_GENERAL); ALL BACKOFFICE_RRHH/ADMIN.

---

### 13.27 Diagrama de Relaciones — Módulo RRHH

```
                                    ┌──────────────┐
                                    │   usuarios   │ (existente)
                                    └──────┬───────┘
                         ┌─────────────────┼─────────────────────────────┐
                         │                 │                             │
                         ▼                 ▼                             ▼
               ┌─────────────────┐ ┌──────────────┐           ┌─────────────────┐
               │ usuarios_rrhh   │ │  candidatos  │           │    contratos    │
               │ (1:1 extensión) │ │  (pipeline)  │           │  (historial)   │
               └────────┬────────┘ └──────┬───────┘           └────────┬────────┘
                        │                 │                            │
          ┌─────────────┤           ┌─────┼─────────┐          ┌──────┴──────┐
          ▼             ▼           ▼     ▼         ▼          ▼             ▼
  ┌───────────┐ ┌────────────┐ ┌──────┐┌──────┐┌──────┐ ┌──────────┐ ┌──────────┐
  │status_log │ │asistencia  │ │etapas││entrev││ docs │ │renov_    │ │renov_    │
  └───────────┘ └────────────┘ └──────┘└──────┘└──────┘ │lotes    │ │decisiones│
                      │                                  └──────────┘ └──────────┘
                      ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │incidencias   │ │solicitudes   │ │movimientos   │ │offboarding   │
  │_laborales    │ │_permiso      │ │_personal     │ │_checklist    │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │documentos    │ │alertas_rrhh  │ │ai_tasks      │ │  tiendas     │
  │_colaborador  │ │              │ │(compartida)  │ │(+8 columnas) │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

  Tablas de soporte:
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
  │horarios      │ │turnos        │ │asignacion    │ │apertura_cierre   │
  │_tienda       │ │(catálogo)    │ │_turnos       │ │_tienda           │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘
```

---

## 14. HISTORIAL DE CAMBIOS

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
| 2026-06-24 | **3.1** | **Módulo Arribos / Vinculación Venta↔Arribo (migraciones 027–030):** 027 corrige `arribos_dni_cliente_format_check` (DNI/CE/OTRO). 028 agrega funciones de reporte de arribos (`get_arribos_matriz/metricas/resumen_red/detalle_tienda`) + 5 índices. 029 reemplaza `arribos.se_vendio` por `arribos.resultado VARCHAR(30)` (5 estados), expande `tipo_documento_cliente` a DNI/CE/RUC/PASAPORTE/PTP/OTRO, agrega `ventas.arribo_id` (FK NOT NULL, ON DELETE RESTRICT) + índice, y crea `recompute_arribo_resultado()` + trigger `ventas_recompute_arribo`. 030 reescribe las funciones 028 sobre `resultado`. Validado contra la BD real; documentados 2 bugs de runtime en funciones de reporte. **Además** se documentaron a nivel columna las 5 tablas RRHH de las migraciones 025/026 (`importaciones_rrhh`, `historial_bancario`, `historial_direcciones`, `historial_cambios_rrhh`, `entrevistas_colaborador`), la columna `alertas_rrhh.fecha_limite` (025) y se corrigieron los conteos de objetos contra la BD real (57 tablas / 10 vistas / 24 funciones RPC). Se documentaron las 15 columnas nuevas de `usuarios_rrhh` (migr. 026, §13.1) y la vista `asesor_score_mensual` (§4.3). |
| 2026-02-13 | **3.0** | **Módulo RRHH:** 21 tablas nuevas (usuarios_rrhh, usuarios_status_log, ai_tasks, candidatos, candidatos_etapas, candidatos_entrevistas, candidatos_documentos, contratos, renovacion_lotes, renovacion_decisiones, asistencia, apertura_cierre_tienda, horarios_tienda, turnos, asignacion_turnos, incidencias_laborales, solicitudes_permiso, movimientos_personal, offboarding_checklist, documentos_colaborador, alertas_rrhh). ALTER tiendas (+8 columnas GPS/zona/HC). 61 índices, 12 triggers, 61 RLS policies. |

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen o modifiquen tablas.
