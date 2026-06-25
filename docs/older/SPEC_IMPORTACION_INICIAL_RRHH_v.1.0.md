# GridRetail — Módulo de Importación Inicial de Colaboradores
## Especificación Técnica y Funcional

**Versión:** 1.2  
**Fecha:** 2026-02-16  
**Módulo padre:** RRHH  
**Prioridad:** 🔴 Alta (prerrequisito para operación del módulo RRHH)  
**Dependencias:** Tablas `usuarios`, `usuarios_rrhh`, `usuarios_tiendas`, `contratos`, `tiendas`, `movimientos_personal`, `usuarios_status_log`, `alertas_rrhh`, `ai_tasks`  
**Prerrequisito de implementación:** Adjuntar este archivo + `RRHH_DESARROLLO_PROGRESO.md` + `SPEC_MODULO_RRHH.md`

---

## 1. VISIÓN Y CONTEXTO

### 1.1 Problema que Resuelve

Cuando un nuevo tenant (SSNN) adopta GridRetail, ya cuenta con una base de colaboradores activos y cesados con datos dispersos en hojas de cálculo, archivos y sistemas externos. El onboarding del tenant requiere migrar esta data existente al sistema de forma controlada, validada y completa.

Actualmente PBD tiene ~100 colaboradores distribuidos en 21 tiendas TEX. Cada SSNN nuevo enfrentará una situación similar: data en Excel con formatos heterogéneos, campos incompletos, y documentación pendiente.

### 1.2 Objetivos

1. **Importar data existente** de colaboradores (activos y cesados) desde cualquier Excel, sin restringir al usuario a un formato específico
2. **Mapeo inteligente de columnas** usando AI para interpretar cualquier estructura de Excel
3. **Validación exhaustiva** contra el modelo de datos de GridRetail (constraints, enums, FKs)
4. **Análisis de brechas** que identifique datos y documentos faltantes por cada colaborador
5. **Revisión asistida** donde el usuario confirme cada decisión antes de insertar datos
6. **Template descargable** como guía opcional, generado dinámicamente por tenant
7. **Alertas en 3 capas:** reporte estático + alertas operativas selectivas + alerta resumen
8. **Repetibilidad** para futuras importaciones incrementales (nuevos ingresos batch)

### 1.3 Filosofía AI First

| Nivel | Aplicación en este módulo |
|-------|--------------------------|
| **Motor invisible** | Mapeo automático de columnas Excel → campos BD, normalización de datos (formato DNI, nombres, fechas), detección de duplicados |
| **Asistente activo** | Sugerencias de mapeo cuando hay ambigüedad, alertas sobre datos inconsistentes, reporte de brechas con recomendaciones |
| **Agente autónomo** | No aplica en esta versión (la importación siempre requiere confirmación humana) |

---

## 2. FLUJO GENERAL

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│  1. SUBIDA   │ ──▶ │ 2. ANÁLISIS  │ ──▶ │  3. MAPEO DE  │ ──▶ │ 4. VALIDACIÓN│ ──▶ │ 5. REVISIÓN │
│  DEL ARCHIVO │     │  INTELIGENTE │     │   COLUMNAS    │     │  Y BRECHAS   │     │ Y CONFIRMA  │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘     └─────────────┘
                                                                                           │
                                                                                           ▼
                                                                                    ┌─────────────┐
                                                                                    │ 6. INSERCIÓN │
                                                                                    │  + ALERTAS   │
                                                                                    └─────────────┘
```

### 2.1 Paso 1 — Subida del Archivo

- Dropzone para arrastrar/soltar archivo Excel (.xlsx, .xls, .csv)
- Link "📥 Descargar template de ejemplo" (siempre visible)
- Texto: *"Puedes usar nuestro template o subir tu propio archivo. El sistema analizará las columnas automáticamente."*
- Validaciones: formato (.xlsx, .xls, .csv), tamaño (≤10MB), mínimo 1 fila de datos
- Storage: `imports/rrhh/{tenant_id}/{timestamp}_{filename}`

### 2.2 Paso 2 — Análisis Inteligente del Excel

Detección automática de: hoja activa, fila de encabezados, filas de datos vs vacías/totales, encoding, formato de fechas.

```typescript
interface AnalisisExcel {
  hojas: string[];
  hoja_seleccionada: string;
  fila_encabezados: number;
  total_filas_datos: number;
  columnas_detectadas: ColumnaDetectada[];
  preview_datos: Record<string, any>[];
}

interface ColumnaDetectada {
  indice: number;
  nombre_original: string;
  tipo_inferido: 'texto' | 'numero' | 'fecha' | 'booleano' | 'email' | 'telefono';
  valores_muestra: string[];
  porcentaje_lleno: number;
  valores_unicos: number;
}
```

### 2.3 Paso 3 — Mapeo Inteligente de Columnas

**Campos destino (39 campos mapeables):**

#### Tabla `usuarios` (7 campos)
| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `codigo_asesor` | VARCHAR | ✅ | Código único. Si vacío se autogenera con prefijo del tenant |
| `dni` | VARCHAR(8) | ✅ | DNI 8 dígitos |
| `nombre_completo` | VARCHAR | ✅ | Nombre completo |
| `email` | VARCHAR | ❌ | Email |
| `rol` | ENUM(12) | ✅ | Normalizado desde texto libre |
| `zona` | VARCHAR | ❌ | NORTE, SUR, ESTE, CENTRO |
| `activo` | BOOLEAN | ✅ | Default: true. false si cesado |

#### Tabla `usuarios_rrhh` (24 campos)
| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `fecha_nacimiento` | DATE | ❌ | |
| `genero` | ENUM | ❌ | MASCULINO, FEMENINO, OTRO, NO_ESPECIFICA |
| `estado_civil` | ENUM | ❌ | SOLTERO, CASADO, CONVIVIENTE, DIVORCIADO, VIUDO |
| `telefono_personal` | VARCHAR | ❌ | |
| `direccion_domiciliaria` | TEXT | ❌ | |
| `distrito_residencia` | VARCHAR | ❌ | |
| `contacto_emergencia_nombre` | VARCHAR | ❌ | |
| `contacto_emergencia_telefono` | VARCHAR | ❌ | |
| `contacto_emergencia_parentesco` | VARCHAR | ❌ | |
| `banco` | VARCHAR | ❌ | |
| `numero_cuenta` | VARCHAR | ❌ | |
| `cci` | VARCHAR(25) | ❌ | |
| `fecha_ingreso` | DATE | ✅ | Fecha de ingreso a la empresa |
| `fecha_fin_contrato` | DATE | ❌ | |
| `tipo_contrato_actual` | ENUM | ❌ | PLAZO_FIJO, INDETERMINADO, RXH, PERIODO_PRUEBA |
| `regimen_laboral` | VARCHAR | ❌ | |
| `cargo_formal` | VARCHAR | ❌ | |
| `area_funcional` | ENUM | ❌ | COMERCIAL, OPERACIONES, RRHH, MANTENIMIENTO, ADMINISTRACION |
| `jefe_directo_id` | REF | ❌ | DNI o nombre → resuelve a UUID |
| `remuneracion_actual` | DECIMAL | ❌ | |
| `talla_uniforme` | VARCHAR | ❌ | |
| `tiene_equipo_corporativo` | BOOLEAN | ❌ | |
| `equipo_corporativo_detalle` | TEXT | ❌ | |
| `status` | ENUM | ✅ | Default: ACTIVO |

#### Tabla `usuarios_tiendas` (1 referencia)
| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `tienda` | REF | ❌ | Nombre o código → resuelve a UUID |

#### Tabla `contratos` (5 campos)
| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `tipo_contrato` | ENUM | ❌ | |
| `fecha_inicio_contrato` | DATE | ❌ | |
| `fecha_fin_contrato` | DATE | ❌ | |
| `cargo_contrato` | VARCHAR | ❌ | |
| `remuneracion_contrato` | DECIMAL | ❌ | |

#### Campos para cesados (2 adicionales)
| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `fecha_cese` | DATE | Cond. | Obligatorio si status = CESADO |
| `motivo_cese` | ENUM | Cond. | CESE_VOLUNTARIO, CESE_DESPIDO, CESE_NO_RENOVACION, CESE_ABANDONO, CESE_PERIODO_PRUEBA |

**Campos NO mapeables desde Excel:** foto_url, gps_domicilio, notas, documentos (CV, contrato firmado, DNI escaneado).

**Niveles de confianza del mapeo AI:**
- 🟢 Alta (≥90%): Automático, usuario confirma
- 🟡 Media (60-89%): Sugerencia, usuario debe confirmar
- 🔴 Baja (<60%): Sin sugerencia, usuario elige

### 2.4 Paso 4 — Validación y Análisis de Brechas

#### Validaciones por fila

| Validación | Acción si falla |
|------------|-----------------|
| DNI: 8 dígitos numéricos | ❌ Error |
| DNI: no duplicado en archivo | ❌ Error |
| DNI: no existe en `usuarios` | ⚠️ ¿Actualizar o saltar? |
| nombre_completo: no vacío | ❌ Error |
| rol: valor válido (12 roles) | ⚠️ Sugerir normalización |
| tienda: existe en `tiendas` | ⚠️ Match fuzzy |
| fecha_ingreso: válida | ⚠️ Corrección |
| Enums (tipo_contrato, area, genero, etc.) | ⚠️ Normalización |
| email: formato válido | ⚠️ Corrección |
| CCI: 20 dígitos | ⚠️ Verificar |
| status=CESADO sin fecha_cese | ⚠️ Recomendado |
| status=ACTIVO con fecha_cese | ⚠️ Contradicción |

#### Normalización inteligente de enums

```typescript
// Ejemplos de normalización automática
'vendedor'/'vendedora' → 'ASESOR'
'encargado de tienda' → 'ASESOR_REFERENTE'
'plazo fijo'/'mensual' → 'PLAZO_FIJO'
'renuncia'/'voluntario' → 'CESE_VOLUNTARIO'
// Tiendas: generado dinámicamente desde BD del tenant
```

#### Niveles de completitud

| Nivel | Criterio | Color |
|-------|----------|-------|
| `COMPLETO` | ≥90% campos + bancarios + contrato | 🟢 |
| `PARCIAL` | ≥70% o faltan bancarios/contrato | 🟡 |
| `MINIMO` | Solo datos core | 🟠 |
| `INSUFICIENTE` | Falta dato core obligatorio | 🔴 |

**Cesados:** criterio reducido (solo Core + Personal).

### 2.5 Paso 5 — Revisión y Confirmación

**Vista A — Resumen:** totales activos/cesados, distribución por completitud, brechas principales, preview de alertas a generar.

**Vista B — Tabla:** interactiva con filtros (estado, status activo/cesado, completitud, tienda, rol). Edición inline. Checkbox incluir/excluir.

**Vista C — Detalle:** modal con Excel vs BD lado a lado, alertas en contexto, edición inline.

### 2.6 Paso 6 — Inserción + Alertas

Transacción por batch de 50: crear `usuarios` → `usuarios_rrhh` → `usuarios_tiendas` → `contratos` → `movimientos_personal` → `usuarios_status_log`.

Para cesados: `activo=false`, `status='CESADO'`, movimiento con tipo de cese, NO contrato, NO tienda.

Post-inserción: generar alertas 3 capas (sección 7).

---

## 3. TEMPLATE DE IMPORTACIÓN

### 3.1 Estructura (32 columnas, generado dinámicamente por tenant)

**Hoja 1: "Colaboradores"** — Columnas A-AF cubriendo los 39 campos mapeables.

**Hoja 2: "Valores Válidos"** — Dropdowns dinámicos: roles (12), tiendas (del tenant), zonas (del tenant), tipos contrato (4), áreas (5), géneros (4), estados civiles (5), estados colaborador (9), motivos cese (5).

**Hoja 3: "Instrucciones"** — Guía con formato de fechas, manejo de cesados, código asesor.

### 3.2 Prefijo Código Asesor — Configurable por Tenant

```sql
-- system_config
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES ('TENANT_CODIGO_ASESOR_PREFIX', 'PBD', 
        'Prefijo para códigos de asesor autogenerados', false, 'tenant');
```

Autogeneración: `{PREFIX}_{Inicial}{APELLIDO}` + sufijo numérico si duplicado.

**Endpoint:** `GET /api/rrhh/importacion/template`

---

## 4. AI MAPPING ENGINE

### 4.1 Prompt

Envía columnas detectadas con muestras. Pide mapeo a campos destino con confianza (0-100). Contexto peruano (DNI=8 dígitos, CCI=20 dígitos, Distrito=subdivisión Lima). Detecta columnas de cesados.

### 4.2 Registro en `ai_tasks`

Tipo: `MAPEO_COLUMNAS_IMPORT`. Metadata: importacion_id, columnas mapeadas, confianza promedio.

### 4.3 Normalización batch de valores

Para enums: enviar valores únicos, pedir normalización al enum más cercano.

---

## 5. RESOLUCIÓN DE REFERENCIAS (FKs)

**Tiendas:** exacto por nombre → código → contenido parcial → fuzzy (>0.6)

**Jefe directo:** DNI (buscar datos+BD) o nombre (fuzzy). Orden de inserción si está en el mismo batch.

**Código asesor:** autogenerar si vacío, con prefijo configurable del tenant.

---

## 6. DUPLICADOS Y CESADOS

**Duplicados:** activo → actualizar campos vacíos. Cesado → preguntar (¿reingreso?). En candidatos → preguntar.

**Cesados:** `activo=false`, `status='CESADO'`, movimiento registrado, sin contrato vigente, sin tienda, brechas con criterio reducido.

---

## 7. SISTEMA DE ALERTAS — 3 CAPAS

### 7.1 Capa 1: Reporte Estático (Excel descargable)

4 hojas: Resumen | Detalle por Colaborador | Documentos Pendientes (solo activos) | Errores y Warnings.

Almacenado en `importaciones_rrhh.reporte_brechas_url`.

### 7.2 Capa 2: Alertas Operativas (selectivas en `alertas_rrhh`)

Solo para **activos** con situaciones **accionables con urgencia**.

**Mapeo a campos existentes de `alertas_rrhh`:**

| Campo `alertas_rrhh` | Valor |
|----------------------|-------|
| `entidad_tipo` | 'USUARIO' |
| `entidad_id` | UUID del usuario |
| `modulo` | 'IMPORTACION' |
| `datos_contexto` | `{ importacion_id, campo_faltante, ... }` |
| `destinatario_rol` | 'BACKOFFICE_RRHH' |
| `generada_por` | 'SISTEMA' |
| `fecha_limite` | Deadline si aplica (campo nuevo) |

**Alertas individuales:**

| Condición | `tipo` | `nivel` | `fecha_limite` |
|-----------|--------|---------|----------------|
| Contrato vence ≤30 días sin datos contractuales | `CONTRATO_POR_VENCER` ♻️ | CRITICAL | fecha_fin_contrato |
| Activo sin datos bancarios | `DATOS_INCOMPLETOS` 🆕 | WARNING | — |
| Activo sin contacto emergencia | `DATOS_INCOMPLETOS` 🆕 | INFO | — |
| Activo sin tienda | `ASIGNACION_PENDIENTE` 🆕 | WARNING | — |
| DNI duplicado | `DUPLICADO_DETECTADO` 🆕 | WARNING | — |
| Jefe directo no encontrado | `REFERENCIA_PENDIENTE` 🆕 | INFO | — |

♻️ = tipo ya existente, se reutiliza. 🆕 = tipo nuevo.

**NO generan alerta:** falta CV, foto, fecha nacimiento, talla, brechas de cesados → solo en reporte.

### 7.3 Capa 3: Alerta Resumen (una única)

```typescript
{
  tipo: 'IMPORTACION_COMPLETADA',  // 🆕
  titulo: 'Importación inicial completada',
  mensaje: `${total} colaboradores (${activos} activos, ${cesados} cesados). 
            Completitud: ${prom}%. ${urgentes} contratos urgentes.`,
  nivel: urgentes > 0 ? 'CRITICAL' : 'WARNING',
  entidad_tipo: 'IMPORTACION',
  entidad_id: importacionId,
  modulo: 'IMPORTACION',
  datos_contexto: { importacion_id, totales, brechas_resumen, reporte_url },
  destinatario_rol: 'BACKOFFICE_RRHH',
}
```

### 7.4 Ciclo de vida

`PENDIENTE → LEIDA → ACCIONADA / DESCARTADA`

Alertas con `fecha_limite` se priorizan en dashboard. La alerta resumen se marca LEIDA al descargar reporte.

---

## 8. MIGRACIÓN SQL — `025_rrhh_importacion.sql`

**IMPORTANTE:** Las migraciones 020-024 ya están ejecutadas en producción. Esta migración es incremental.

### 8.1 Nueva tabla: `importaciones_rrhh`

```sql
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
  mapeo_columnas JSONB NOT NULL,
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
```

### 8.2 Nuevos tipos de alerta (sin migración — VARCHAR libre)

| tipo | Origen | Descripción |
|------|--------|-------------|
| `IMPORTACION_COMPLETADA` 🆕 | Importación | Resumen post-importación |
| `DATOS_INCOMPLETOS` 🆕 | Importación / Sistema | Datos críticos faltantes |
| `ASIGNACION_PENDIENTE` 🆕 | Importación | Sin tienda asignada |
| `DUPLICADO_DETECTADO` 🆕 | Importación | DNI ya existe |
| `REFERENCIA_PENDIENTE` 🆕 | Importación | FK no resuelta |
| `CONTRATO_POR_VENCER` ♻️ | Ya existe en spec RRHH | Se reutiliza |

---

## 9. ARCHIVOS A MODIFICAR (existentes de Fases 1-5)

### 9.1 `lib/rrhh/types.ts` — Agregar enums

```typescript
// === IMPORTACIÓN ===

export const ESTADO_IMPORTACION = {
  EN_PROCESO: 'EN_PROCESO',
  ANALIZADO: 'ANALIZADO',
  MAPEADO: 'MAPEADO',
  VALIDADO: 'VALIDADO',
  IMPORTADO: 'IMPORTADO',
  ERROR: 'ERROR',
  CANCELADO: 'CANCELADO',
} as const;
export type EstadoImportacion = typeof ESTADO_IMPORTACION[keyof typeof ESTADO_IMPORTACION];

export const ESTADO_IMPORTACION_LABELS: Record<EstadoImportacion, string> = {
  EN_PROCESO: 'En Proceso',
  ANALIZADO: 'Analizado',
  MAPEADO: 'Mapeado',
  VALIDADO: 'Validado',
  IMPORTADO: 'Importado',
  ERROR: 'Error',
  CANCELADO: 'Cancelado',
};

export const ESTADO_IMPORTACION_COLORS: Record<EstadoImportacion, string> = {
  EN_PROCESO: 'bg-blue-100 text-blue-800',
  ANALIZADO: 'bg-cyan-100 text-cyan-800',
  MAPEADO: 'bg-indigo-100 text-indigo-800',
  VALIDADO: 'bg-purple-100 text-purple-800',
  IMPORTADO: 'bg-green-100 text-green-800',
  ERROR: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-800',
};

export const NIVEL_COMPLETITUD = {
  COMPLETO: 'COMPLETO',
  PARCIAL: 'PARCIAL',
  MINIMO: 'MINIMO',
  INSUFICIENTE: 'INSUFICIENTE',
} as const;
export type NivelCompletitud = typeof NIVEL_COMPLETITUD[keyof typeof NIVEL_COMPLETITUD];

export const NIVEL_COMPLETITUD_LABELS: Record<NivelCompletitud, string> = {
  COMPLETO: 'Completo', PARCIAL: 'Parcial', MINIMO: 'Mínimo', INSUFICIENTE: 'Insuficiente',
};

export const NIVEL_COMPLETITUD_COLORS: Record<NivelCompletitud, string> = {
  COMPLETO: 'bg-green-100 text-green-800',
  PARCIAL: 'bg-yellow-100 text-yellow-800',
  MINIMO: 'bg-orange-100 text-orange-800',
  INSUFICIENTE: 'bg-red-100 text-red-800',
};

// MOTIVO_CESE — VERIFICAR: si TipoSalida ya contiene estos valores, reusar en lugar de crear
export const MOTIVO_CESE = {
  CESE_VOLUNTARIO: 'CESE_VOLUNTARIO',
  CESE_DESPIDO: 'CESE_DESPIDO',
  CESE_NO_RENOVACION: 'CESE_NO_RENOVACION',
  CESE_ABANDONO: 'CESE_ABANDONO',
  CESE_PERIODO_PRUEBA: 'CESE_PERIODO_PRUEBA',
} as const;
export type MotivoCese = typeof MOTIVO_CESE[keyof typeof MOTIVO_CESE];

export const MOTIVO_CESE_LABELS: Record<MotivoCese, string> = {
  CESE_VOLUNTARIO: 'Renuncia voluntaria',
  CESE_DESPIDO: 'Despido',
  CESE_NO_RENOVACION: 'No renovación',
  CESE_ABANDONO: 'Abandono de puesto',
  CESE_PERIODO_PRUEBA: 'No superó periodo de prueba',
};

// Agregar también a TipoAlerta (si existe como enum):
// IMPORTACION_COMPLETADA, DATOS_INCOMPLETOS, ASIGNACION_PENDIENTE,
// DUPLICADO_DETECTADO, REFERENCIA_PENDIENTE
```

### 9.2 `lib/rrhh/interfaces.ts` — Agregar interfaces

```typescript
import type { EstadoImportacion, NivelCompletitud } from './types'

export interface ImportacionRRHH {
  id: string;
  archivo_nombre: string;
  archivo_url: string;
  archivo_tamano_bytes: number | null;
  archivo_tipo: string | null;
  hoja_procesada: string | null;
  fila_encabezados: number | null;
  total_filas_datos: number;
  mapeo_columnas: MapeoColumnas;
  mapeo_ai_task_id: string | null;
  mapeo_confianza_promedio: number | null;
  estado: EstadoImportacion;
  total_validos: number;
  total_warnings: number;
  total_errores: number;
  total_importados: number;
  total_actualizados: number;
  total_saltados: number;
  total_activos_importados: number;
  total_cesados_importados: number;
  reporte_brechas: ReporteBrechas | null;
  reporte_brechas_url: string | null;
  completitud_promedio: number | null;
  total_alertas_generadas: number;
  alerta_resumen_id: string | null;
  detalle_filas: DetalleFilaImportacion[] | null;
  ejecutado_por: string | null;
  fecha_ejecucion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales (joins)
  ai_task?: AITask;
  ejecutado_por_usuario?: { nombre_completo: string };
}

export interface MapeoColumnas {
  mapeos: MapeoColumna[];
  columnas_sin_mapeo: string[];
  campos_sin_dato: string[];
}

export interface MapeoColumna {
  columna_origen: string;
  campo_destino: string;  // formato: "tabla.campo"
  confianza: number;
  transformacion: 'CONCATENAR' | 'NORMALIZAR_ENUM' | 'SPLIT' | 'FECHA' | null;
  notas: string | null;
}

export interface ColumnaDetectada {
  indice: number;
  nombre_original: string;
  tipo_inferido: 'texto' | 'numero' | 'fecha' | 'booleano' | 'email' | 'telefono';
  valores_muestra: string[];
  porcentaje_lleno: number;
  valores_unicos: number;
}

export interface AnalisisBrechas {
  colaborador_dni: string;
  colaborador_nombre: string;
  es_cesado: boolean;
  datos_core: CategoriaCompletitud;
  datos_personales: CategoriaCompletitud;
  datos_bancarios: CategoriaCompletitud;
  datos_contractuales: CategoriaCompletitud;
  documentos_pendientes: string[];
  nivel_completitud: NivelCompletitud;
}

export interface CategoriaCompletitud {
  presentes: string[];
  faltantes: string[];
  porcentaje: number;
}

export interface ReporteBrechas {
  total_colaboradores: number;
  total_activos: number;
  total_cesados: number;
  completitud_promedio: number;
  distribucion_completitud: Record<NivelCompletitud, number>;
  top_campos_faltantes: { campo: string; cantidad: number }[];
  brechas_por_colaborador: AnalisisBrechas[];
}

export interface DetalleFilaImportacion {
  fila_excel: number;
  dni: string;
  nombre: string;
  estado: 'VALIDO' | 'WARNING' | 'ERROR' | 'SALTADO';
  es_cesado: boolean;
  usuario_id_generado?: string;
  errores: { campo: string; mensaje: string; tipo: 'ERROR' | 'WARNING' | 'INFO' }[];
  nivel_completitud: NivelCompletitud;
}
```

### 9.3 `lib/rrhh/schemas.ts` — Agregar schemas Zod

```typescript
// === IMPORTACIÓN ===

export const importacionUploadSchema = z.object({
  archivo_nombre: z.string().min(1),
  archivo_url: z.string().url(),
  archivo_tipo: z.enum(['xlsx', 'xls', 'csv']),
  archivo_tamano_bytes: z.number().max(10 * 1024 * 1024),
});

export const importacionMapeoConfirmSchema = z.object({
  importacion_id: z.string().uuid(),
  mapeos_confirmados: z.array(z.object({
    columna_origen: z.string(),
    campo_destino: z.string(),
    confirmado: z.boolean(),
  })),
});

export const importacionEjecutarSchema = z.object({
  importacion_id: z.string().uuid(),
  filas_incluidas: z.array(z.number()).min(1),
  filas_excluidas: z.array(z.number()).optional(),
});

export type ImportacionUploadData = z.infer<typeof importacionUploadSchema>;
export type ImportacionMapeoConfirmData = z.infer<typeof importacionMapeoConfirmSchema>;
export type ImportacionEjecutarData = z.infer<typeof importacionEjecutarSchema>;
```

### 9.4 `app/(dashboard)/rrhh/layout.tsx` — Agregar sección

```typescript
// Agregar al final del array de items de navegación:
{
  label: 'Importación',
  href: '/rrhh/importacion',
  icon: Upload,  // import { Upload } from 'lucide-react'
  requiereGestion: true,  // Solo BACKOFFICE_RRHH, ADMIN
}
```

**Ubicación:** Al final de la barra, después de "Alertas". Es una operación administrativa poco frecuente.

Orden final de la sub-navegación:
```
Dashboard | Colaboradores | Reclutamiento | Contratos | Asistencia | 
Horarios | Incidencias | Permisos | Movimientos | Offboarding | Alertas | Importación
```

---

## 10. ARCHIVOS NUEVOS

### 10.1 Capa de datos (patrón estándar Fases 1-5)

```
lib/rrhh/
├── queries/
│   └── importacion.ts          ← NUEVO
└── hooks/
    └── useImportacion.ts       ← NUEVO
```

**`lib/rrhh/queries/importacion.ts`:**
```typescript
// Reciben SupabaseClient como primer parámetro (patrón establecido)
export async function fetchImportaciones(supabase: SupabaseClient, filtros?: {...})
export async function fetchImportacionById(supabase: SupabaseClient, id: string)
export async function insertImportacion(supabase: SupabaseClient, data: ImportacionUploadData)
export async function updateImportacion(supabase: SupabaseClient, id: string, data: Partial<ImportacionRRHH>)
```

**`lib/rrhh/hooks/useImportacion.ts`:**
```typescript
// Patrón: loading, error, data, refetch (igual que useContratos, useIncidencias, etc.)
export function useImportaciones(filtros?: {...})
export function useImportacion(id: string)
```

### 10.2 Páginas UI

```
app/(dashboard)/rrhh/
└── importacion/
    ├── page.tsx                    # Wizard principal (6 pasos)
    └── components/
        ├── StepSubida.tsx          # Paso 1: Upload + link template
        ├── StepAnalisis.tsx        # Paso 2: Preview del Excel
        ├── StepMapeo.tsx           # Paso 3: Mapeo de columnas
        ├── StepValidacion.tsx      # Paso 4: Validación y brechas
        ├── StepRevision.tsx        # Paso 5: Revisión y confirmación
        ├── StepResultado.tsx       # Paso 6: Resultado + alertas
        ├── ColumnaMapper.tsx       # Mapeo individual con dropdown
        ├── TablaPreview.tsx        # Preview de datos
        ├── ResumenBrechas.tsx      # Dashboard de brechas
        ├── DetalleColaborador.tsx  # Modal detalle
        ├── AlertasPreview.tsx      # Preview alertas a generar
        └── ProgressWizard.tsx      # Barra de progreso
```

**Hooks locales del wizard** (no reutilizables fuera del módulo):
```
app/(dashboard)/rrhh/importacion/
└── hooks/
    ├── useWizardImportacion.ts     # Estado local del wizard (pasos, data intermedia)
    ├── useMapeoAI.ts               # Llamada al AI mapping engine
    └── useValidacion.ts            # Lógica de validación y brechas
```

### 10.3 API Routes

```
app/api/rrhh/importacion/
├── analizar/route.ts       # POST: Analizar Excel subido
├── mapear/route.ts         # POST: Ejecutar mapeo AI
├── validar/route.ts        # POST: Validar datos mapeados
├── ejecutar/route.ts       # POST: Ejecutar importación + alertas
├── template/route.ts       # GET: Descargar template dinámico
└── reporte/route.ts        # GET: Descargar reporte de brechas
```

---

## 11. PERMISOS

| Acción | Roles |
|--------|-------|
| Ejecutar importación | BACKOFFICE_RRHH, ADMIN |
| Ver historial | BACKOFFICE_RRHH, ADMIN, GERENTE_GENERAL |
| Descargar template | BACKOFFICE_RRHH, ADMIN |
| Descargar reporte | BACKOFFICE_RRHH, ADMIN, JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL |

**Función de permisos existente a usar:** `puedeGestionarRRHH()` de `lib/rrhh/utils/permisos-rrhh.ts`

---

## 12. MULTI-TENANT

| Aspecto | Implementación |
|---------|---------------|
| Template | Dinámico con tiendas/zonas/prefijo del tenant |
| Prefijo código | `system_config.TENANT_CODIGO_ASESOR_PREFIX` |
| Storage | `imports/rrhh/{tenant_id}/...` |
| Enums | Roles globales; tiendas/zonas por tenant |
| AI prompts | Contexto tenant incluido |

---

## 13. EDGE CASES

| Caso | Manejo |
|------|--------|
| DNI con ceros a la izquierda | Texto, siempre 8 chars |
| Fechas anglosajón (MM/DD) | Heurística: día > 12 = DD/MM |
| Serial Excel como fecha | Conversión automática |
| Celdas fusionadas | Expandir valor |
| Filas vacías/subtotales | Detectar y excluir |
| Cesado sin fecha cese | Warning, importar con brecha |
| Cesado con tienda | Ignorar tienda |

---

## 14. RELACIÓN CON FASE 6 Y SECUENCIACIÓN

### Tablas compartidas

| Tabla | Importador escribe | Fase 6 consume |
|-------|-------------------|----------------|
| `alertas_rrhh` | ✅ INSERTs (Capas 2 y 3) | ✅ Lista/gestiona alertas |
| `movimientos_personal` | ✅ INSERTs (INGRESO/CESE) | ✅ Lista historial |
| `usuarios_status_log` | ✅ INSERTs | Consumido internamente |

### Sin conflicto

El importador solo hace INSERTs. Fase 6 hace SELECTs + gestión de estado. No hay dependencia bidireccional.

### Secuenciación recomendada

```
Fase 6:  Movimientos + Offboarding + Alertas UI + Dashboard métricas
Fase 7:  Importación Inicial (este módulo)
```

El importador puede desarrollarse independiente de Fase 6. Los registros que genera quedarán en BD y serán visibles cuando Fase 6 construya las pantallas de alertas y movimientos. Cuando Fase 6 implemente `rrhh/alertas/page.tsx`, debe filtrar `modulo = 'IMPORTACION'` para mostrar alertas del importador.

---

## 15. MÉTRICAS

| Métrica | Objetivo |
|---------|----------|
| Tiempo (100 colaboradores) | < 5 min |
| Precisión mapeo AI | > 85% |
| Tasa sin errores | > 80% |
| Reporte generado | 100% |
| Alertas accionables | 100% |

---

## 16. DEPENDENCIAS Y LIBRERÍAS

| Librería | Uso | Estado |
|----------|-----|--------|
| `xlsx` / `sheetjs` | Lectura de Excel | Instalar |
| `exceljs` | Generación template con validaciones | Instalar |
| `string-similarity` | Match fuzzy tiendas/nombres | Instalar |
| `zod` | Validación schemas | ✅ Ya instalado |
| `@anthropic-ai/sdk` | Claude API mapeo | ✅ Ya instalado |
| `date-fns` | Parsing/formateo fechas | ✅ Ya instalado |

---

## 17. VERIFICACIONES PARA CLAUDE CODE (pre-implementación)

Antes de empezar a codificar, verificar en el código existente:

1. **¿`TipoSalida` en types.ts ya contiene los motivos de cese?** → Si sí, reusar en lugar de crear `MOTIVO_CESE`
2. **¿`TipoAlerta` en types.ts tiene los 14 tipos base?** → Saber cuáles agregar
3. **¿Cómo implementa layout.tsx la prop `requiereGestion`?** → Replicar patrón para "Importación"
4. **¿`system_config` tiene constraint UNIQUE en `key`?** → Para el `ON CONFLICT` del INSERT
5. **¿`trigger_set_updated_at` existe como función global?** → Usada en la migración
6. **Patrones de referencia para componentes:** `rrhh/incidencias/page.tsx` y `rrhh/incidencias/nueva/page.tsx`

---

## 18. IMPORTS PARA ARCHIVOS NUEVOS

```typescript
// Supabase
import { createClient } from '@/lib/supabase/client'    // browser
import { createClient } from '@/lib/supabase/server'    // API routes

// Auth
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'

// RRHH types
import { 
  ESTADO_IMPORTACION, ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS,
  NIVEL_COMPLETITUD, NIVEL_COMPLETITUD_LABELS, NIVEL_COMPLETITUD_COLORS,
  MOTIVO_CESE, MOTIVO_CESE_LABELS,
} from '@/lib/rrhh/types'
import type { EstadoImportacion, NivelCompletitud, MotivoCese } from '@/lib/rrhh/types'
import type { 
  ImportacionRRHH, MapeoColumnas, ColumnaDetectada, AnalisisBrechas 
} from '@/lib/rrhh/interfaces'
import { 
  importacionUploadSchema, importacionMapeoConfirmSchema, importacionEjecutarSchema 
} from '@/lib/rrhh/schemas'

// RRHH utils
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'

// UI (shadcn)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Utility
import { cn } from '@/lib/utils'
```

---

## 19. CHANGELOG

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-16 | 1.0 | Spec inicial: wizard 6 pasos, AI mapping, template, reporte brechas |
| 2026-02-16 | 1.1 | Prefijo código configurable. Template con cesados. Alertas 3 capas. ALTER `fecha_limite`. 39 campos. Tabla `importaciones_rrhh`. |
| 2026-02-16 | 1.2 | **Conciliación con avance real (Fases 1-5).** Rutas UI corregidas a `app/(dashboard)/rrhh/`. Migración numerada como `025_rrhh_importacion.sql`. Layout: "Importación" al final de sub-nav con `requiereGestion: true`. Types/Interfaces/Schemas integrados en archivos existentes (`lib/rrhh/types.ts`, `interfaces.ts`, `schemas.ts`). Queries/Hooks siguen patrón estándar (`lib/rrhh/queries/importacion.ts`, `hooks/useImportacion.ts`). Hooks locales del wizard renombrados y separados. Tipos de alerta validados contra 14 existentes: `CONTRATO_POR_VENCER` reutilizado, 5 nuevos agregados. Relación con Fase 6 documentada (sin conflicto). Sección de verificaciones pre-implementación para Claude Code. Imports documentados. |
