# GridRetail — Módulo de Importación Inicial de Colaboradores
## Especificación Técnica y Funcional Consolidada

**Versión:** 2.0  
**Fecha:** 2026-02-17  
**Módulo padre:** RRHH  
**Prioridad:** 🔴 Alta (prerrequisito para operación del módulo RRHH)  
**Dependencias:** Tablas `usuarios`, `usuarios_rrhh`, `usuarios_tiendas`, `contratos`, `tiendas`, `movimientos_personal`, `usuarios_status_log`, `alertas_rrhh`, `ai_tasks`, `system_config`  
**Prerrequisito de implementación:** Adjuntar este archivo + `RRHH_DESARROLLO_PROGRESO.md` + `SPEC_MODULO_RRHH.md`  
**Documentos que reemplaza:** SPEC_IMPORTACION_INICIAL_RRHH v1.2, MIGRACION_026_AMPLIACION_USUARIOS v1.0, SPEC_VERIFICACION_RENIEC_IMPORTADOR v1.0

---

## ÍNDICE

1. Visión y Contexto
2. Flujo General del Wizard (6 pasos)
3. Campos Mapeables (54 campos)
4. Template de Importación (47 columnas)
5. AI Mapping Engine
6. Resolución de Referencias (FKs)
7. Validación RENIEC / Migraciones
8. Duplicados y Cesados
9. Análisis de Brechas (9 categorías)
10. Sistema de Alertas — 3 Capas
11. Migraciones SQL (025 + 026)
12. Types, Interfaces, Schemas (TypeScript)
13. Estructura de Archivos
14. Permisos
15. Multi-Tenant
16. Edge Cases
17. Relación con Fase 6
18. Métricas, Dependencias, Verificaciones

---

## 1. VISIÓN Y CONTEXTO

### 1.1 Problema que Resuelve

Cuando un nuevo tenant (SSNN) adopta GridRetail, ya cuenta con colaboradores activos y cesados con datos en hojas de cálculo heterogéneas. PBD tiene ~100 colaboradores en 21 tiendas TEX. Cada SSNN nuevo enfrentará la misma situación.

### 1.2 Objetivos

1. **Importar data existente** de colaboradores (activos y cesados) desde cualquier Excel
2. **Mapeo inteligente de columnas** usando AI para interpretar cualquier estructura
3. **Validación exhaustiva** contra modelo de datos + verificación de identidad RENIEC
4. **Análisis de brechas** por 9 categorías de datos
5. **Revisión asistida** con confirmación humana antes de insertar
6. **Template descargable** dinámico por tenant (47 columnas)
7. **Alertas en 3 capas:** reporte estático + alertas operativas + alerta resumen
8. **Repetibilidad** para futuras importaciones incrementales

### 1.3 Filosofía AI First

| Nivel | Aplicación |
|-------|-----------|
| **Motor invisible** | Mapeo automático columnas → campos, normalización de datos, detección duplicados |
| **Asistente activo** | Sugerencias de mapeo, alertas sobre inconsistencias, reporte de brechas |
| **Agente autónomo** | No aplica (importación siempre requiere confirmación humana) |

---

## 2. FLUJO GENERAL DEL WIZARD

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────────┐   ┌──────────┐   ┌──────────┐
│ 1.SUBIDA │──▶│2.ANÁLISIS│──▶│ 3.MAPEO  │──▶│    4.VALIDACIÓN      │──▶│5.REVISIÓN│──▶│6.INSERCIÓN│
│          │   │          │   │          │   │ 4a Local             │   │          │   │ +ALERTAS │
└──────────┘   └──────────┘   └──────────┘   │ 4b RENIEC/Migraciones│   └──────────┘   └──────────┘
                                             │ 4c Brechas           │
                                             └──────────────────────┘
```

### 2.1 Paso 1 — Subida del Archivo

- Dropzone para .xlsx, .xls, .csv (≤10MB)
- Link "📥 Descargar template de ejemplo" (siempre visible)
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
```

### 2.3 Paso 3 — Mapeo Inteligente de Columnas

AI mapea columnas del Excel a los 54 campos destino (sección 3). Niveles de confianza:
- 🟢 Alta (≥90%): automático, usuario confirma
- 🟡 Media (60-89%): sugerencia, usuario debe confirmar
- 🔴 Baja (<60%): sin sugerencia, usuario elige

### 2.4 Paso 4 — Validación (3 sub-pasos)

**4a. Validaciones locales** — formato, enums, FKs, duplicados (detalle en sección 2.7)

**4b. Verificación RENIEC/Migraciones** — validación de identidad batch obligatoria (detalle en sección 7)

**4c. Análisis de brechas** — completitud por 9 categorías (detalle en sección 9)

### 2.5 Paso 5 — Revisión y Confirmación

**Vista A — Resumen:** totales activos/cesados, distribución por completitud, brechas, verificación RENIEC, preview de alertas.

**Vista B — Tabla:** interactiva con filtros (estado, status, completitud, tienda, rol, verificación identidad). Edición inline. Checkbox incluir/excluir.

**Vista C — Detalle:** modal con Excel vs BD lado a lado, resultado RENIEC, alertas en contexto.

### 2.6 Paso 6 — Inserción + Alertas

Transacción por batch de 50: `usuarios` → `usuarios_rrhh` → `usuarios_tiendas` → `contratos` → `movimientos_personal` → `usuarios_status_log` → `historial_bancario` → `historial_direcciones`.

Para cesados: `activo=false`, `status='CESADO'`, movimiento con tipo de cese, NO contrato, NO tienda.

Post-inserción: generar alertas 3 capas (sección 10).

### 2.7 Validaciones locales (sub-paso 4a)

| Validación | Acción si falla |
|------------|-----------------|
| DNI/CE: formato correcto (8/9 dígitos) | ❌ Error |
| DNI: no duplicado en archivo | ❌ Error |
| DNI: no existe en `usuarios` | ⚠️ ¿Actualizar o saltar? |
| nombre_completo: no vacío | ❌ Error |
| rol: valor válido (12 roles) | ⚠️ Normalización |
| tienda: existe en `tiendas` | ⚠️ Match fuzzy |
| fecha_ingreso: válida | ⚠️ Corrección |
| Enums (tipo_contrato, area, genero, sistema_pensionario, nivel_educativo, etc.) | ⚠️ Normalización |
| email: formato válido | ⚠️ Corrección |
| CCI: 20 dígitos | ⚠️ Verificar |
| CUSPP: formato XXX-XXXXXXXX-X | ⚠️ Verificar |
| RUC: 11 dígitos, inicia con 10 o 20 | ⚠️ Verificar |
| grupo_sanguineo: valor válido | ⚠️ Normalización |
| status=CESADO sin fecha_cese | ⚠️ Recomendado |
| status=ACTIVO con fecha_cese | ⚠️ Contradicción |
| AFP seleccionada pero sistema_pensionario≠AFP | ⚠️ Contradicción |

---

## 3. CAMPOS MAPEABLES (54 total)

### 3.1 Tabla `usuarios` (7 campos)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `codigo_asesor` | VARCHAR | ✅ | Código único. Si vacío se autogenera con prefijo del tenant |
| `dni` | VARCHAR(8) | ✅ | DNI 8 dígitos |
| `nombre_completo` | VARCHAR | ✅ | Nombre completo |
| `email` | VARCHAR | ❌ | Email |
| `rol` | ENUM(12) | ✅ | Normalizado desde texto libre |
| `zona` | VARCHAR | ❌ | NORTE, SUR, ESTE, CENTRO |
| `activo` | BOOLEAN | ✅ | Default: true. false si cesado |

### 3.2 Tabla `usuarios_rrhh` — Campos existentes (24)

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
| `fecha_ingreso` | DATE | ✅ | Fecha de ingreso |
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

### 3.3 Tabla `usuarios_rrhh` — Campos NUEVOS (15) 🆕

#### Seguridad Social y Tributario (8)

| Campo | Tipo | Req | CHECK | Descripción |
|-------|------|-----|-------|-------------|
| `sistema_pensionario` | VARCHAR(10) | ❌ | AFP, ONP | Sistema de pensiones |
| `afp_nombre` | VARCHAR(50) | ❌ | — | Integra, Prima, Habitat, Profuturo |
| `cuspp` | VARCHAR(20) | ❌ | — | Código Único SPP |
| `eps_nombre` | VARCHAR(50) | ❌ | — | Rímac, Pacífico, Mapfre, Sanitas, etc. |
| `tiene_sctr` | BOOLEAN | ❌ | — | Seguro Complementario de Trabajo de Riesgo |
| `asignacion_familiar` | BOOLEAN | ❌ | — | Percibe asignación (10% RMV) |
| `numero_dependientes` | INTEGER | ❌ | ≥ 0 | Dependientes declarados |
| `numero_hijos` | INTEGER | ❌ | ≥ 0 | Hijos |

#### Identificación Adicional (4)

| Campo | Tipo | Req | CHECK | Descripción |
|-------|------|-----|-------|-------------|
| `tipo_documento` | VARCHAR(15) | ❌ | DNI, CE, PASAPORTE, PTP | Tipo de documento identidad |
| `lugar_nacimiento` | VARCHAR(100) | ❌ | — | Ciudad/departamento |
| `nacionalidad` | VARCHAR(50) | ❌ | — | Default: PERUANA |
| `ruc` | VARCHAR(11) | ❌ | — | RUC personal (relevante para RxH) |

#### Educación (2)

| Campo | Tipo | Req | CHECK | Descripción |
|-------|------|-----|-------|-------------|
| `nivel_educativo` | VARCHAR(30) | ❌ | 7 valores | Nivel máximo alcanzado |
| `profesion_carrera` | VARCHAR(100) | ❌ | — | Carrera o profesión |

#### Salud (1)

| Campo | Tipo | Req | CHECK | Descripción |
|-------|------|-----|-------|-------------|
| `grupo_sanguineo` | VARCHAR(5) | ❌ | 8 valores | A+, A-, B+, B-, AB+, AB-, O+, O- |

### 3.4 Tabla `usuarios_tiendas` (1 referencia)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `tienda` | REF | ❌ | Nombre o código → resuelve a UUID |

### 3.5 Tabla `contratos` (5 campos)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `tipo_contrato` | ENUM | ❌ | |
| `fecha_inicio_contrato` | DATE | ❌ | |
| `fecha_fin_contrato` | DATE | ❌ | |
| `cargo_contrato` | VARCHAR | ❌ | |
| `remuneracion_contrato` | DECIMAL | ❌ | |

### 3.6 Campos para cesados (2)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `fecha_cese` | DATE | Cond. | Obligatorio si status = CESADO |
| `motivo_cese` | ENUM | Cond. | 5 valores (ver tipos de movimiento) |

**Campos NO mapeables desde Excel:** foto_url, gps_domicilio, notas, documentos.

---

## 4. TEMPLATE DE IMPORTACIÓN

### 4.1 Estructura (47 columnas A-AU)

**Hoja 1: "Colaboradores"**

| Col | Campo | Ejemplo |
|-----|-------|---------|
| A | Código Asesor | PBD_JPEREZ |
| B | DNI | 72845612 |
| C | Nombre Completo | Juan Pérez García |
| D | Email | jperez@pbd.pe |
| E | Rol | Asesor |
| F | Zona | NORTE |
| G | Status | Activo |
| H | Tienda | Higuereta |
| I | Fecha Nacimiento | 15/03/1995 |
| J | Género | Masculino |
| K | Estado Civil | Soltero |
| L | Teléfono Personal | 987654321 |
| M | Dirección | Av. Javier Prado 1234 |
| N | Distrito | San Isidro |
| O | Contacto Emergencia Nombre | María García |
| P | Contacto Emergencia Teléfono | 912345678 |
| Q | Contacto Emergencia Parentesco | Madre |
| R | Banco | BCP |
| S | Número de Cuenta | 12345678901234 |
| T | CCI | 00212345678901234567 |
| U | Fecha Ingreso | 01/06/2024 |
| V | Fecha Fin Contrato | 31/05/2025 |
| W | Tipo Contrato | Plazo Fijo |
| X | Régimen Laboral | General |
| Y | Cargo Formal | Asesor de Ventas |
| Z | Área Funcional | Comercial |
| AA | Jefe Directo (DNI o nombre) | 45678912 |
| AB | Remuneración | 1500.00 |
| AC | Talla Uniforme | M |
| AD | Equipo Corporativo | Sí |
| AE | Fecha de Cese | 15/12/2025 |
| AF | Motivo de Cese | Voluntario |
| AG | Tipo de Documento | DNI |
| AH | Lugar de Nacimiento | Lima |
| AI | Nacionalidad | Peruana |
| AJ | RUC | 10728456123 |
| AK | Sistema Pensionario | AFP |
| AL | AFP | Integra |
| AM | CUSPP | 123-12345678-1 |
| AN | EPS | Rímac |
| AO | Tiene SCTR | Sí |
| AP | Asignación Familiar | Sí |
| AQ | Número de Dependientes | 2 |
| AR | Número de Hijos | 1 |
| AS | Nivel Educativo | Técnico |
| AT | Profesión/Carrera | Administración |
| AU | Grupo Sanguíneo | O+ |

**Hoja 2: "Valores Válidos"** — Dropdowns dinámicos por tenant: roles (12), tiendas, zonas, tipos contrato (4), áreas (5), géneros (4), estados civiles (5), estados colaborador (9), motivos cese (5), sistema pensionario (2), tipo documento (4), nivel educativo (7), grupo sanguíneo (8).

**Hoja 3: "Instrucciones"** — Formato fechas, manejo cesados, código asesor, campos de seguridad social.

### 4.2 Prefijo Código Asesor — Configurable por Tenant

Autogeneración: `{PREFIX}_{Inicial}{APELLIDO}` + sufijo numérico si duplicado.

**Endpoint:** `GET /api/rrhh/importacion/template`

---

## 5. AI MAPPING ENGINE

### 5.1 Prompt

Envía columnas detectadas con muestras. Pide mapeo a 54 campos destino con confianza (0-100). Contexto peruano (DNI=8, CE=9, CCI=20, CUSPP=formato específico, Distrito=subdivisión Lima). Detecta columnas de cesados y seguridad social.

### 5.2 Registro en `ai_tasks`

Tipo: `MAPEO_COLUMNAS_IMPORT`. Metadata: importacion_id, columnas mapeadas, confianza promedio.

### 5.3 Normalización batch de enums

```typescript
// Campos originales
'vendedor'/'vendedora' → 'ASESOR'
'encargado de tienda' → 'ASESOR_REFERENTE'
'plazo fijo'/'mensual' → 'PLAZO_FIJO'
'renuncia'/'voluntario' → 'CESE_VOLUNTARIO'

// Campos nuevos
'afp'/'privado' → 'AFP'
'onp'/'público'/'nacional' → 'ONP'
'secundaria'/'sec. completa' → 'SECUNDARIA'
'técnico'/'instituto' → 'TECNICO'
'universitario'/'bachiller' → 'UNIVERSITARIO'
'maestría'/'doctorado' → 'POSTGRADO'
'dni'/'documento nacional' → 'DNI'
'carnet de extranjería'/'ce' → 'CE'
```

---

## 6. RESOLUCIÓN DE REFERENCIAS (FKs)

**Tiendas:** exacto por nombre → código → contenido parcial → fuzzy (>0.6)

**Jefe directo:** DNI (buscar datos + BD) → nombre (fuzzy). Orden de inserción si está en el mismo batch.

**Código asesor:** autogenerar si vacío, con prefijo configurable del tenant.

---

## 7. VERIFICACIÓN RENIEC / MIGRACIONES

### 7.1 Resumen

Validación **obligatoria** de identidad en sub-paso 4b. Para cada colaborador se verifica que DNI/CE exista en RENIEC/Migraciones y que el nombre coincida. Usa el endpoint existente `/api/consulta-documento` y `system_config.JSON_PE_TOKEN`.

**No se autocompleta ni extrae data adicional.** Solo validación de existencia + coincidencia de nombre.

### 7.2 Procesamiento Batch

```typescript
const RENIEC_CONFIG = {
  BATCH_SIZE: 5,                    // Consultas simultáneas por lote
  DELAY_BETWEEN_BATCHES_MS: 1000,   // Pausa entre lotes
  TIMEOUT_PER_REQUEST_MS: 8000,     // Timeout individual
  MAX_RETRIES: 2,                   // Reintentos por fallo
  RETRY_DELAY_MS: 2000,             // Pausa antes de reintentar
};
// ~100 DNIs → 20 lotes × 1s pausa → ~30-40 segundos total
```

**Flujo:** filtrar filas válidas (formato ok en paso 4a) → deduplicar documentos → armar lotes de 5 → ejecutar con progress bar → comparar nombres → asignar resultado.

**Deduplicación:** Si 100 filas tienen 95 DNIs únicos, se hacen 95 consultas.

### 7.3 Comparación de Nombres

Algoritmo tokenizado: normalizar (mayúsculas, sin tildes, trim) → tokenizar por palabras (ignorar iniciales sueltas) → contar coincidencias (exactas + parciales) → calcular confianza.

| Confianza | Estado | Significado |
|-----------|--------|-------------|
| ≥ 0.75 | `VERIFICADO` ✅ | Nombre coincide (mín. 2 palabras) |
| 0.50 — 0.74 | `NOMBRE_REVISAR` 🟡 | Coincidencia parcial, revisar |
| < 0.50 | `NOMBRE_NO_COINCIDE` ⚠️ | No coincide, requiere acción |

```typescript
function compararNombres(nombreExcel: string, nombreReniec: string): {
  coincide: boolean;
  confianza: number;
  detalle: string;
}
```

**Armado de nombre oficial desde json.pe:**
- DNI (RENIEC): `${apellidoPaterno} ${apellidoMaterno} ${nombres}`
- CE (Migraciones): `${apellidos} ${nombres}`

### 7.4 Estados de Verificación

| Estado | Icono | Bloquea | Acción usuario |
|--------|-------|---------|---------------|
| `VERIFICADO` | ✅ | No | — |
| `NOMBRE_REVISAR` | 🟡 | No (warning) | Revisar visualmente |
| `NOMBRE_NO_COINCIDE` | ⚠️ | **Sí** | Corregir nombre / Usar nombre RENIEC / Confirmar manualmente |
| `NO_ENCONTRADO` | ❌ | **Sí** | Corregir DNI / Confirmar manualmente / Excluir fila |
| `ERROR_API` | 🔄 | No | Reintentar |
| `SIN_DOCUMENTO` | ⬜ | Error previo (4a) | — |

**Confirmación manual:** requiere checkbox "He verificado" + justificación obligatoria.

### 7.5 Resolución de conflictos (UX)

**`NOMBRE_NO_COINCIDE` — Modal:**
- Opción 1: Corregir nombre en Excel (edición inline) → re-comparar
- Opción 2: Usar nombre de RENIEC → reemplaza el nombre del Excel
- Opción 3: Confirmar de todas formas → checkbox + justificación

**`NO_ENCONTRADO` — Modal:**
- Opción 1: Corregir DNI (edición inline) → re-consultar
- Opción 2: Confirmar manualmente → checkbox + justificación
- Opción 3: Excluir fila de la importación

### 7.6 Resumen visual en wizard

```
┌─────────────────────────────────────────────┐
│  Verificación de Identidad — Resultados     │
│                                             │
│  ✅ 89 Verificados                          │
│  🟡  4 Coincidencia parcial (revisar)       │
│  ⚠️  3 Nombre no coincide (acción req.)    │
│  ❌  2 No encontrado (acción requerida)     │
│  🔄  2 Error de API (se permite continuar)  │
│                                             │
│  [↻ Reintentar errores API]                 │
└─────────────────────────────────────────────┘
```

Integración en tabla del Paso 4/5 como columna "Identidad" con icono + confianza.

### 7.7 API caída

Si todas las consultas fallan: se permite continuar con warning global. Se genera alerta `VERIFICACION_IDENTIDAD_PENDIENTE` en `alertas_rrhh`. Después de 2 reintentos fallidos parciales, se marca como `ERROR_API` y se permite continuar.

### 7.8 Control de costos

Preview antes de ejecutar: *"Se verificarán 98 documentos (95 DNI, 3 CE). Costo estimado: S/ 3.60"*

Registro en `ai_tasks`: tipo `VERIFICACION_IDENTIDAD`, tokens_input = cantidad consultas.

### 7.9 Endpoint

```
POST /api/rrhh/importacion/verificar-identidad
```

Acepta lista de documentos, retorna resultados via Server-Sent Events para progress en tiempo real.

```typescript
// Request
interface VerificarIdentidadRequest {
  importacion_id: string;
  documentos: {
    fila_excel: number;
    tipo_documento: 'DNI' | 'CE';
    numero_documento: string;
    nombre_excel: string;
  }[];
}

// Response (SSE stream)
interface VerificarIdentidadResultado {
  fila_excel: number;
  tipo_documento: 'DNI' | 'CE';
  numero_documento: string;
  estado: EstadoVerificacionIdentidad;
  nombre_excel: string;
  nombre_oficial: string | null;
  confianza_nombre: number | null;
  detalle: string;
}
```

---

## 8. DUPLICADOS Y CESADOS

**Duplicados:** activo existente → actualizar campos vacíos. Cesado existente → preguntar (¿reingreso?). En candidatos → preguntar.

**Cesados:** `activo=false`, `status='CESADO'`, movimiento registrado, sin contrato vigente, sin tienda, brechas con criterio reducido.

---

## 9. ANÁLISIS DE BRECHAS (9 categorías)

### 9.1 Categorías de completitud

| # | Categoría | Campos | Activos | Cesados |
|---|-----------|--------|---------|---------|
| 1 | **Core** | dni, nombre, rol, fecha_ingreso | ✅ Req | ✅ Req |
| 2 | **Personal** | nacimiento, teléfono, dirección, distrito, emergencia | ✅ Eval | ✅ Eval |
| 3 | **Bancario** | banco, cuenta, CCI | ✅ Eval | ⬜ Omitir |
| 4 | **Contractual** | tipo_contrato, fechas, cargo, remuneración | ✅ Eval | ⬜ Omitir |
| 5 | **Operativo** | tienda, zona, código_asesor | ✅ Eval | ⬜ Omitir |
| 6 | **Seguridad Social** 🆕 | sistema_pensionario, afp, cuspp, eps, sctr, asignación, dependientes, hijos | ✅ Eval | ⬜ Omitir |
| 7 | **Identificación** 🆕 | tipo_documento, lugar_nacimiento, nacionalidad, ruc | ✅ Eval | ✅ Eval |
| 8 | **Educación** 🆕 | nivel_educativo, profesion_carrera | ✅ Eval | ⬜ Omitir |
| 9 | **Salud** 🆕 | grupo_sanguineo | ✅ Eval | ⬜ Omitir |

### 9.2 Niveles de completitud

| Nivel | Criterio | Color |
|-------|----------|-------|
| `COMPLETO` | ≥90% campos + bancarios + contrato + seg.social | 🟢 |
| `PARCIAL` | ≥70% o faltan bancarios/contrato/seg.social | 🟡 |
| `MINIMO` | Solo datos core | 🟠 |
| `INSUFICIENTE` | Falta dato core obligatorio | 🔴 |

**Cesados:** criterio reducido (solo Core + Personal + Identificación).

---

## 10. SISTEMA DE ALERTAS — 3 CAPAS

### 10.1 Capa 1: Reporte Estático (Excel descargable)

4 hojas: Resumen | Detalle por Colaborador (incluye verificación RENIEC) | Documentos Pendientes (solo activos) | Errores y Warnings.

Almacenado en `importaciones_rrhh.reporte_brechas_url`.

**Columnas de verificación RENIEC en hoja "Detalle":**

| Columna | Contenido |
|---------|-----------|
| Verificación RENIEC | VERIFICADO / NOMBRE_NO_COINCIDE / NO_ENCONTRADO / ERROR_API |
| Nombre Oficial | Nombre según RENIEC/Migraciones |
| Confianza Nombre | Porcentaje de coincidencia |
| Resolución Manual | Justificación si fue confirmado manualmente |

### 10.2 Capa 2: Alertas Operativas (selectivas en `alertas_rrhh`)

Solo para **activos** con situaciones **accionables con urgencia**.

| Condición | `tipo` | `nivel` | `fecha_limite` |
|-----------|--------|---------|----------------|
| Contrato vence ≤30 días sin datos contractuales | `CONTRATO_POR_VENCER` ♻️ | CRITICAL | fecha_fin_contrato |
| Activo sin datos bancarios | `DATOS_INCOMPLETOS` 🆕 | WARNING | — |
| Activo sin contacto emergencia | `DATOS_INCOMPLETOS` 🆕 | INFO | — |
| Activo sin tienda | `ASIGNACION_PENDIENTE` 🆕 | WARNING | — |
| DNI duplicado | `DUPLICADO_DETECTADO` 🆕 | WARNING | — |
| Jefe directo no encontrado | `REFERENCIA_PENDIENTE` 🆕 | INFO | — |
| API caída, identidades sin verificar | `VERIFICACION_IDENTIDAD_PENDIENTE` 🆕 | WARNING | — |

**Mapeo a campos `alertas_rrhh`:** `entidad_tipo`='USUARIO'/'IMPORTACION', `modulo`='IMPORTACION', `destinatario_rol`='BACKOFFICE_RRHH', `generada_por`='SISTEMA'.

**NO generan alerta:** falta CV, foto, fecha nacimiento, talla, brechas de cesados → solo en reporte.

### 10.3 Capa 3: Alerta Resumen (una única)

```typescript
{
  tipo: 'IMPORTACION_COMPLETADA',
  titulo: 'Importación inicial completada',
  mensaje: `${total} colaboradores (${activos} activos, ${cesados} cesados). 
            Completitud: ${prom}%. ${urgentes} contratos urgentes.`,
  nivel: urgentes > 0 ? 'CRITICAL' : 'WARNING',
  entidad_tipo: 'IMPORTACION',
  entidad_id: importacionId,
  modulo: 'IMPORTACION',
  datos_contexto: { 
    importacion_id, totales, brechas_resumen, reporte_url,
    verificacion_identidad: {
      total_verificados, total_parcial, total_no_coincide_resueltos,
      total_no_encontrado_resueltos, total_errores_api, total_sin_verificar,
    }
  },
  destinatario_rol: 'BACKOFFICE_RRHH',
}
```

### 10.4 Ciclo de vida

`PENDIENTE → LEIDA → ACCIONADA / DESCARTADA`. Alertas con `fecha_limite` se priorizan en dashboard.

---

## 11. MIGRACIONES SQL

### 11.1 Migración `025_rrhh_importacion.sql`

**Crea:** tabla `importaciones_rrhh` + trigger, índices, RLS.  
**Altera:** `alertas_rrhh` + columna `fecha_limite`.  
**Inserta:** `system_config` (prefijo código asesor + costo consulta json.pe).

```sql
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
-- 2. ALTER: alertas_rrhh + fecha_limite
-- ===========================================

ALTER TABLE alertas_rrhh ADD COLUMN IF NOT EXISTS fecha_limite DATE;

CREATE INDEX IF NOT EXISTS idx_alertas_rrhh_fecha_limite 
  ON alertas_rrhh(fecha_limite) 
  WHERE fecha_limite IS NOT NULL AND estado = 'PENDIENTE';

-- ===========================================
-- 3. CONFIG
-- ===========================================

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES 
  ('TENANT_CODIGO_ASESOR_PREFIX', 'PBD', 
   'Prefijo para códigos de asesor autogenerados', false, 'tenant'),
  ('JSON_PE_COSTO_POR_CONSULTA', '0.01', 
   'Costo por consulta a json.pe en USD', false, 'api')
ON CONFLICT (key) DO NOTHING;
```

### 11.2 Migración `026_rrhh_ampliacion_usuarios.sql`

**Altera:** `usuarios_rrhh` +15 columnas con CHECK constraints e índices.  
**Crea:** `historial_bancario`, `historial_direcciones`, `historial_cambios_rrhh`, `entrevistas_colaborador`.

```sql
-- ===========================================
-- 1. ALTER TABLE usuarios_rrhh (+15 columnas)
-- ===========================================

-- Seguridad Social y Tributario
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS sistema_pensionario VARCHAR(10);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS afp_nombre VARCHAR(50);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS cuspp VARCHAR(20);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS eps_nombre VARCHAR(50);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS tiene_sctr BOOLEAN DEFAULT false;
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS asignacion_familiar BOOLEAN DEFAULT false;
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS numero_dependientes INTEGER;
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS numero_hijos INTEGER;

-- Identificación Adicional
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(15) DEFAULT 'DNI';
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS lugar_nacimiento VARCHAR(100);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(50) DEFAULT 'PERUANA';
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS ruc VARCHAR(11);

-- Educación
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(30);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS profesion_carrera VARCHAR(100);

-- Salud
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS grupo_sanguineo VARCHAR(5);

-- CHECK constraints
ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_sistema_pensionario_check 
  CHECK (sistema_pensionario IS NULL OR sistema_pensionario IN ('AFP', 'ONP'));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_tipo_documento_check 
  CHECK (tipo_documento IS NULL OR tipo_documento IN ('DNI', 'CE', 'PASAPORTE', 'PTP'));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_nivel_educativo_check 
  CHECK (nivel_educativo IS NULL OR nivel_educativo IN (
    'SECUNDARIA_INCOMPLETA', 'SECUNDARIA', 'TECNICO_INCOMPLETO', 'TECNICO', 
    'UNIVERSITARIO_INCOMPLETO', 'UNIVERSITARIO', 'POSTGRADO'
  ));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_grupo_sanguineo_check 
  CHECK (grupo_sanguineo IS NULL OR grupo_sanguineo IN (
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  ));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_numero_dependientes_check 
  CHECK (numero_dependientes IS NULL OR numero_dependientes >= 0);

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_numero_hijos_check 
  CHECK (numero_hijos IS NULL OR numero_hijos >= 0);

CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_sistema_pensionario 
  ON usuarios_rrhh(sistema_pensionario) WHERE sistema_pensionario IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_tipo_documento 
  ON usuarios_rrhh(tipo_documento);

-- ===========================================
-- 2. HISTORIAL BANCARIO
-- ===========================================

CREATE TABLE historial_bancario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  banco VARCHAR(100) NOT NULL,
  numero_cuenta VARCHAR(50) NOT NULL,
  cci VARCHAR(25),
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE,
  motivo_cambio TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_bancario_usuario ON historial_bancario(usuario_id);
CREATE UNIQUE INDEX idx_historial_bancario_unico_vigente 
  ON historial_bancario(usuario_id) WHERE fecha_hasta IS NULL;

ALTER TABLE historial_bancario ENABLE ROW LEVEL SECURITY;

CREATE POLICY historial_bancario_select ON historial_bancario
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY historial_bancario_all ON historial_bancario
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 3. HISTORIAL DIRECCIONES
-- ===========================================

CREATE TABLE historial_direcciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  direccion_domiciliaria TEXT NOT NULL,
  distrito_residencia VARCHAR(100),
  gps_domicilio_lat NUMERIC(10,7),
  gps_domicilio_lng NUMERIC(10,7),
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE,
  motivo_cambio TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_direcciones_usuario ON historial_direcciones(usuario_id);
CREATE UNIQUE INDEX idx_historial_direcciones_unico_vigente 
  ON historial_direcciones(usuario_id) WHERE fecha_hasta IS NULL;

ALTER TABLE historial_direcciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY historial_direcciones_select ON historial_direcciones
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY historial_direcciones_all ON historial_direcciones
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 4. HISTORIAL CAMBIOS RRHH (genérico)
-- ===========================================

CREATE TABLE historial_cambios_rrhh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  campo VARCHAR(50) NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT NOT NULL,
  fecha_cambio DATE NOT NULL,
  motivo TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT historial_cambios_campo_check CHECK (
    campo IN ('TELEFONO_PERSONAL', 'REMUNERACION', 'JEFE_DIRECTO', 'CARGO_FORMAL')
  )
);

CREATE INDEX idx_historial_cambios_usuario ON historial_cambios_rrhh(usuario_id);
CREATE INDEX idx_historial_cambios_campo ON historial_cambios_rrhh(usuario_id, campo);
CREATE INDEX idx_historial_cambios_fecha ON historial_cambios_rrhh(fecha_cambio DESC);

ALTER TABLE historial_cambios_rrhh ENABLE ROW LEVEL SECURITY;

CREATE POLICY historial_cambios_select ON historial_cambios_rrhh
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL', 'JEFE_VENTAS', 'SUPERVISOR')
  );

CREATE POLICY historial_cambios_all ON historial_cambios_rrhh
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 5. ENTREVISTAS COLABORADOR
-- ===========================================

CREATE TABLE entrevistas_colaborador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL,
  entrevistador_id UUID NOT NULL REFERENCES usuarios(id),
  fecha DATE NOT NULL,
  motivo TEXT,
  notas TEXT,
  datos_estructurados JSONB,
  resultado VARCHAR(20),
  grabacion_url TEXT,
  transcripcion_url TEXT,
  ai_task_id UUID REFERENCES ai_tasks(id),
  ai_resumen TEXT,
  movimiento_id UUID REFERENCES movimientos_personal(id),
  es_confidencial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entrevistas_tipo_check CHECK (
    tipo IN ('EXIT_INTERVIEW', 'FEEDBACK_DESEMPENO', 'RETENCION', 'AMONESTACION_VERBAL')
  ),
  CONSTRAINT entrevistas_resultado_check CHECK (
    resultado IS NULL OR resultado IN ('SATISFACTORIA', 'CON_OBSERVACIONES', 'NO_REALIZADA')
  )
);

CREATE TRIGGER set_entrevistas_colaborador_updated_at
  BEFORE UPDATE ON entrevistas_colaborador
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_entrevistas_usuario ON entrevistas_colaborador(usuario_id);
CREATE INDEX idx_entrevistas_tipo ON entrevistas_colaborador(tipo);
CREATE INDEX idx_entrevistas_fecha ON entrevistas_colaborador(fecha DESC);
CREATE INDEX idx_entrevistas_movimiento ON entrevistas_colaborador(movimiento_id) 
  WHERE movimiento_id IS NOT NULL;

ALTER TABLE entrevistas_colaborador ENABLE ROW LEVEL SECURITY;

CREATE POLICY entrevistas_select ON entrevistas_colaborador
  FOR SELECT USING (
    (es_confidencial = false AND usuario_id = auth.uid())
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY entrevistas_all ON entrevistas_colaborador
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );
```

### 11.3 Resumen de migraciones

| Migración | Tablas creadas | Tablas alteradas |
|-----------|---------------|-----------------|
| `025_rrhh_importacion.sql` | `importaciones_rrhh` (1) | `alertas_rrhh` (+fecha_limite), `system_config` (+2 rows) |
| `026_rrhh_ampliacion_usuarios.sql` | `historial_bancario`, `historial_direcciones`, `historial_cambios_rrhh`, `entrevistas_colaborador` (4) | `usuarios_rrhh` (+15 cols, +6 checks, +2 idx) |

**Post-migración:** `usuarios_rrhh` pasa de 31 a **46 columnas**. Total tablas RRHH: de 21 a **26**. Total campos mapeables importador: **54**.

---

## 12. TYPES, INTERFACES, SCHEMAS

### 12.1 Agregar a `lib/rrhh/types.ts`

```typescript
// === IMPORTACIÓN ===

export const ESTADO_IMPORTACION = {
  EN_PROCESO: 'EN_PROCESO', ANALIZADO: 'ANALIZADO', MAPEADO: 'MAPEADO',
  VALIDADO: 'VALIDADO', IMPORTADO: 'IMPORTADO', ERROR: 'ERROR', CANCELADO: 'CANCELADO',
} as const;
export type EstadoImportacion = typeof ESTADO_IMPORTACION[keyof typeof ESTADO_IMPORTACION];

export const ESTADO_IMPORTACION_LABELS: Record<EstadoImportacion, string> = {
  EN_PROCESO: 'En Proceso', ANALIZADO: 'Analizado', MAPEADO: 'Mapeado',
  VALIDADO: 'Validado', IMPORTADO: 'Importado', ERROR: 'Error', CANCELADO: 'Cancelado',
};

export const ESTADO_IMPORTACION_COLORS: Record<EstadoImportacion, string> = {
  EN_PROCESO: 'bg-blue-100 text-blue-800', ANALIZADO: 'bg-cyan-100 text-cyan-800',
  MAPEADO: 'bg-indigo-100 text-indigo-800', VALIDADO: 'bg-purple-100 text-purple-800',
  IMPORTADO: 'bg-green-100 text-green-800', ERROR: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-800',
};

export const NIVEL_COMPLETITUD = {
  COMPLETO: 'COMPLETO', PARCIAL: 'PARCIAL', MINIMO: 'MINIMO', INSUFICIENTE: 'INSUFICIENTE',
} as const;
export type NivelCompletitud = typeof NIVEL_COMPLETITUD[keyof typeof NIVEL_COMPLETITUD];
export const NIVEL_COMPLETITUD_LABELS: Record<NivelCompletitud, string> = {
  COMPLETO: 'Completo', PARCIAL: 'Parcial', MINIMO: 'Mínimo', INSUFICIENTE: 'Insuficiente',
};
export const NIVEL_COMPLETITUD_COLORS: Record<NivelCompletitud, string> = {
  COMPLETO: 'bg-green-100 text-green-800', PARCIAL: 'bg-yellow-100 text-yellow-800',
  MINIMO: 'bg-orange-100 text-orange-800', INSUFICIENTE: 'bg-red-100 text-red-800',
};

// MOTIVO_CESE — VERIFICAR: si TipoSalida ya contiene estos valores, reusar
export const MOTIVO_CESE = {
  CESE_VOLUNTARIO: 'CESE_VOLUNTARIO', CESE_DESPIDO: 'CESE_DESPIDO',
  CESE_NO_RENOVACION: 'CESE_NO_RENOVACION', CESE_ABANDONO: 'CESE_ABANDONO',
  CESE_PERIODO_PRUEBA: 'CESE_PERIODO_PRUEBA',
} as const;
export type MotivoCese = typeof MOTIVO_CESE[keyof typeof MOTIVO_CESE];
export const MOTIVO_CESE_LABELS: Record<MotivoCese, string> = {
  CESE_VOLUNTARIO: 'Renuncia voluntaria', CESE_DESPIDO: 'Despido',
  CESE_NO_RENOVACION: 'No renovación', CESE_ABANDONO: 'Abandono de puesto',
  CESE_PERIODO_PRUEBA: 'No superó periodo de prueba',
};

// === VERIFICACIÓN IDENTIDAD ===

export const ESTADO_VERIFICACION_IDENTIDAD = {
  VERIFICADO: 'VERIFICADO', NOMBRE_NO_COINCIDE: 'NOMBRE_NO_COINCIDE',
  NOMBRE_REVISAR: 'NOMBRE_REVISAR', NO_ENCONTRADO: 'NO_ENCONTRADO',
  ERROR_API: 'ERROR_API', SIN_DOCUMENTO: 'SIN_DOCUMENTO',
} as const;
export type EstadoVerificacionIdentidad = typeof ESTADO_VERIFICACION_IDENTIDAD[keyof typeof ESTADO_VERIFICACION_IDENTIDAD];
export const ESTADO_VERIFICACION_IDENTIDAD_LABELS: Record<EstadoVerificacionIdentidad, string> = {
  VERIFICADO: 'Verificado', NOMBRE_NO_COINCIDE: 'Nombre no coincide',
  NOMBRE_REVISAR: 'Revisar coincidencia', NO_ENCONTRADO: 'No encontrado',
  ERROR_API: 'Error de verificación', SIN_DOCUMENTO: 'Sin documento',
};
export const ESTADO_VERIFICACION_IDENTIDAD_COLORS: Record<EstadoVerificacionIdentidad, string> = {
  VERIFICADO: 'bg-green-100 text-green-800', NOMBRE_NO_COINCIDE: 'bg-red-100 text-red-800',
  NOMBRE_REVISAR: 'bg-yellow-100 text-yellow-800', NO_ENCONTRADO: 'bg-red-100 text-red-800',
  ERROR_API: 'bg-gray-100 text-gray-800', SIN_DOCUMENTO: 'bg-gray-50 text-gray-400',
};

// === SEGURIDAD SOCIAL ===

export const SISTEMA_PENSIONARIO = { AFP: 'AFP', ONP: 'ONP' } as const;
export type SistemaPensionario = typeof SISTEMA_PENSIONARIO[keyof typeof SISTEMA_PENSIONARIO];
export const SISTEMA_PENSIONARIO_LABELS: Record<SistemaPensionario, string> = {
  AFP: 'AFP (Privado)', ONP: 'ONP (Público)',
};

// === IDENTIFICACIÓN ===

export const TIPO_DOCUMENTO_IDENTIDAD = {
  DNI: 'DNI', CE: 'CE', PASAPORTE: 'PASAPORTE', PTP: 'PTP',
} as const;
export type TipoDocumentoIdentidad = typeof TIPO_DOCUMENTO_IDENTIDAD[keyof typeof TIPO_DOCUMENTO_IDENTIDAD];
export const TIPO_DOCUMENTO_IDENTIDAD_LABELS: Record<TipoDocumentoIdentidad, string> = {
  DNI: 'DNI', CE: 'Carnet de Extranjería', PASAPORTE: 'Pasaporte', PTP: 'PTP',
};

// === EDUCACIÓN ===

export const NIVEL_EDUCATIVO = {
  SECUNDARIA_INCOMPLETA: 'SECUNDARIA_INCOMPLETA', SECUNDARIA: 'SECUNDARIA',
  TECNICO_INCOMPLETO: 'TECNICO_INCOMPLETO', TECNICO: 'TECNICO',
  UNIVERSITARIO_INCOMPLETO: 'UNIVERSITARIO_INCOMPLETO', UNIVERSITARIO: 'UNIVERSITARIO',
  POSTGRADO: 'POSTGRADO',
} as const;
export type NivelEducativo = typeof NIVEL_EDUCATIVO[keyof typeof NIVEL_EDUCATIVO];
export const NIVEL_EDUCATIVO_LABELS: Record<NivelEducativo, string> = {
  SECUNDARIA_INCOMPLETA: 'Secundaria Incompleta', SECUNDARIA: 'Secundaria Completa',
  TECNICO_INCOMPLETO: 'Técnico Incompleto', TECNICO: 'Técnico Completo',
  UNIVERSITARIO_INCOMPLETO: 'Universitario Incompleto', UNIVERSITARIO: 'Universitario Completo',
  POSTGRADO: 'Postgrado',
};

// === SALUD ===

export const GRUPO_SANGUINEO = {
  'A+': 'A+', 'A-': 'A-', 'B+': 'B+', 'B-': 'B-',
  'AB+': 'AB+', 'AB-': 'AB-', 'O+': 'O+', 'O-': 'O-',
} as const;
export type GrupoSanguineo = typeof GRUPO_SANGUINEO[keyof typeof GRUPO_SANGUINEO];

// === HISTORIAL ===

export const CAMPO_HISTORIAL = {
  TELEFONO_PERSONAL: 'TELEFONO_PERSONAL', REMUNERACION: 'REMUNERACION',
  JEFE_DIRECTO: 'JEFE_DIRECTO', CARGO_FORMAL: 'CARGO_FORMAL',
} as const;
export type CampoHistorial = typeof CAMPO_HISTORIAL[keyof typeof CAMPO_HISTORIAL];
export const CAMPO_HISTORIAL_LABELS: Record<CampoHistorial, string> = {
  TELEFONO_PERSONAL: 'Teléfono personal', REMUNERACION: 'Remuneración',
  JEFE_DIRECTO: 'Jefe directo', CARGO_FORMAL: 'Cargo formal',
};

// === ENTREVISTAS COLABORADOR ===

export const TIPO_ENTREVISTA_COLABORADOR = {
  EXIT_INTERVIEW: 'EXIT_INTERVIEW', FEEDBACK_DESEMPENO: 'FEEDBACK_DESEMPENO',
  RETENCION: 'RETENCION', AMONESTACION_VERBAL: 'AMONESTACION_VERBAL',
} as const;
export type TipoEntrevistaColaborador = typeof TIPO_ENTREVISTA_COLABORADOR[keyof typeof TIPO_ENTREVISTA_COLABORADOR];
export const TIPO_ENTREVISTA_COLABORADOR_LABELS: Record<TipoEntrevistaColaborador, string> = {
  EXIT_INTERVIEW: 'Entrevista de salida', FEEDBACK_DESEMPENO: 'Feedback de desempeño',
  RETENCION: 'Entrevista de retención', AMONESTACION_VERBAL: 'Amonestación verbal',
};

export const RESULTADO_ENTREVISTA = {
  SATISFACTORIA: 'SATISFACTORIA', CON_OBSERVACIONES: 'CON_OBSERVACIONES', NO_REALIZADA: 'NO_REALIZADA',
} as const;
export type ResultadoEntrevista = typeof RESULTADO_ENTREVISTA[keyof typeof RESULTADO_ENTREVISTA];

// Agregar a TipoAlerta (si existe como enum):
// IMPORTACION_COMPLETADA, DATOS_INCOMPLETOS, ASIGNACION_PENDIENTE,
// DUPLICADO_DETECTADO, REFERENCIA_PENDIENTE, VERIFICACION_IDENTIDAD_PENDIENTE
```

### 12.2 Agregar a `lib/rrhh/interfaces.ts`

```typescript
// === IMPORTACIÓN ===

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
  campo_destino: string;
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

export interface ReporteBrechas {
  total_colaboradores: number;
  total_activos: number;
  total_cesados: number;
  completitud_promedio: number;
  distribucion_completitud: Record<NivelCompletitud, number>;
  top_campos_faltantes: { campo: string; cantidad: number }[];
  brechas_por_colaborador: AnalisisBrechas[];
}

export interface AnalisisBrechas {
  colaborador_dni: string;
  colaborador_nombre: string;
  es_cesado: boolean;
  datos_core: CategoriaCompletitud;
  datos_personales: CategoriaCompletitud;
  datos_bancarios: CategoriaCompletitud;
  datos_contractuales: CategoriaCompletitud;
  datos_operativo: CategoriaCompletitud;
  datos_seguridad_social: CategoriaCompletitud;
  datos_identificacion: CategoriaCompletitud;
  datos_educacion: CategoriaCompletitud;
  datos_salud: CategoriaCompletitud;
  documentos_pendientes: string[];
  nivel_completitud: NivelCompletitud;
}

export interface CategoriaCompletitud {
  presentes: string[];
  faltantes: string[];
  porcentaje: number;
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
  verificacion_identidad: {
    estado: EstadoVerificacionIdentidad;
    nombre_oficial: string | null;
    confianza_nombre: number | null;
    confirmado_manualmente: boolean;
    justificacion_manual: string | null;
  } | null;
}

// === HISTORIAL ===

export interface HistorialBancario {
  id: string;
  usuario_id: string;
  banco: string;
  numero_cuenta: string;
  cci: string | null;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo_cambio: string | null;
  registrado_por: string;
  created_at: string;
  registrado_por_usuario?: { nombre_completo: string };
}

export interface HistorialDireccion {
  id: string;
  usuario_id: string;
  direccion_domiciliaria: string;
  distrito_residencia: string | null;
  gps_domicilio_lat: number | null;
  gps_domicilio_lng: number | null;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo_cambio: string | null;
  registrado_por: string;
  created_at: string;
}

export interface HistorialCambioRRHH {
  id: string;
  usuario_id: string;
  campo: CampoHistorial;
  valor_anterior: string | null;
  valor_nuevo: string;
  fecha_cambio: string;
  motivo: string | null;
  registrado_por: string;
  created_at: string;
}

// === ENTREVISTAS ===

export interface EntrevistaColaborador {
  id: string;
  usuario_id: string;
  tipo: TipoEntrevistaColaborador;
  entrevistador_id: string;
  fecha: string;
  motivo: string | null;
  notas: string | null;
  datos_estructurados: Record<string, any> | null;
  resultado: ResultadoEntrevista | null;
  grabacion_url: string | null;
  transcripcion_url: string | null;
  ai_task_id: string | null;
  ai_resumen: string | null;
  movimiento_id: string | null;
  es_confidencial: boolean;
  created_at: string;
  updated_at: string;
  entrevistador?: { nombre_completo: string };
  usuario?: { nombre_completo: string; dni: string };
  movimiento?: { tipo_movimiento: string; fecha_efectiva: string };
}
```

### 12.3 Agregar a `lib/rrhh/schemas.ts`

```typescript
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

---

## 13. ESTRUCTURA DE ARCHIVOS

### 13.1 Archivos a MODIFICAR (existentes de Fases 1-5)

| Archivo | Cambios |
|---------|---------|
| `lib/rrhh/types.ts` | + todos los enums de sección 12.1 |
| `lib/rrhh/interfaces.ts` | + todas las interfaces de sección 12.2 |
| `lib/rrhh/schemas.ts` | + schemas de sección 12.3 |
| `app/(dashboard)/rrhh/layout.tsx` | + item "Importación" al final con `requiereGestion: true` |

### 13.2 Archivos NUEVOS — Capa de datos

```
lib/rrhh/
├── queries/
│   └── importacion.ts           ← NUEVO (CRUD importaciones_rrhh)
├── hooks/
│   └── useImportacion.ts        ← NUEVO (lista + detalle)
└── utils/
    └── comparar-nombres.ts      ← NUEVO (algoritmo comparación RENIEC)
```

### 13.3 Archivos NUEVOS — UI

```
app/(dashboard)/rrhh/
└── importacion/
    ├── page.tsx                              # Wizard principal (6 pasos)
    ├── components/
    │   ├── StepSubida.tsx                    # Paso 1
    │   ├── StepAnalisis.tsx                  # Paso 2
    │   ├── StepMapeo.tsx                     # Paso 3
    │   ├── StepValidacion.tsx                # Paso 4 (orquesta 4a+4b+4c)
    │   ├── StepRevision.tsx                  # Paso 5
    │   ├── StepResultado.tsx                 # Paso 6
    │   ├── ColumnaMapper.tsx                 # Mapeo individual
    │   ├── TablaPreview.tsx                  # Preview datos
    │   ├── ResumenBrechas.tsx                # Dashboard brechas
    │   ├── DetalleColaborador.tsx            # Modal detalle
    │   ├── AlertasPreview.tsx                # Preview alertas
    │   ├── ProgressWizard.tsx                # Barra progreso
    │   ├── VerificacionIdentidad.tsx         # Progress + resumen RENIEC
    │   └── ModalResolucionIdentidad.tsx      # Modal corrección RENIEC
    └── hooks/
        ├── useWizardImportacion.ts           # Estado local wizard
        ├── useMapeoAI.ts                     # AI mapping
        ├── useValidacion.ts                  # Validación + brechas
        └── useVerificacionIdentidad.ts       # SSE + estado RENIEC
```

### 13.4 Archivos NUEVOS — API Routes

```
app/api/rrhh/importacion/
├── analizar/route.ts                 # POST: Analizar Excel
├── mapear/route.ts                   # POST: Mapeo AI
├── validar/route.ts                  # POST: Validar datos
├── verificar-identidad/route.ts      # POST: Batch RENIEC/Migraciones (SSE)
├── ejecutar/route.ts                 # POST: Ejecutar importación
├── template/route.ts                 # GET: Template dinámico
└── reporte/route.ts                  # GET: Reporte brechas
```

### 13.5 Sub-navegación final

```
Dashboard | Colaboradores | Reclutamiento | Contratos | Asistencia | 
Horarios | Incidencias | Permisos | Movimientos | Offboarding | Alertas | Importación
```

---

## 14. PERMISOS

| Acción | Roles |
|--------|-------|
| Ejecutar importación | BACKOFFICE_RRHH, ADMIN |
| Ver historial importaciones | BACKOFFICE_RRHH, ADMIN, GERENTE_GENERAL |
| Descargar template | BACKOFFICE_RRHH, ADMIN |
| Descargar reporte brechas | BACKOFFICE_RRHH, ADMIN, JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL |

**Función existente:** `puedeGestionarRRHH()` de `lib/rrhh/utils/permisos-rrhh.ts`

---

## 15. MULTI-TENANT

| Aspecto | Implementación |
|---------|---------------|
| Template | Dinámico con tiendas/zonas/prefijo del tenant |
| Prefijo código | `system_config.TENANT_CODIGO_ASESOR_PREFIX` |
| Storage | `imports/rrhh/{tenant_id}/...` |
| Enums | Roles globales; tiendas/zonas por tenant |
| AI prompts | Contexto tenant incluido |
| RENIEC | Token compartido en `system_config.JSON_PE_TOKEN` |

---

## 16. EDGE CASES

| Caso | Manejo |
|------|--------|
| DNI con ceros a la izquierda | Texto, siempre 8 chars |
| Fechas anglosajón (MM/DD) | Heurística: día > 12 = DD/MM |
| Serial Excel como fecha | Conversión automática |
| Celdas fusionadas | Expandir valor |
| Filas vacías/subtotales | Detectar y excluir |
| Cesado sin fecha cese | Warning, importar con brecha |
| Cesado con tienda | Ignorar tienda |
| CE en lugar de DNI | Detectar por largo (9 dígitos) + tipo_documento |
| RENIEC nombre con caracteres especiales | Normalizar antes de comparar |
| Colaborador extranjero sin DNI | Usar CE como identificador |
| Datos bancarios importados | Además de usuarios_rrhh, crear registro en historial_bancario |
| Dirección importada | Además de usuarios_rrhh, crear registro en historial_direcciones |

---

## 17. RELACIÓN CON FASE 6 Y SECUENCIACIÓN

| Tabla | Importador escribe | Fase 6 consume |
|-------|-------------------|----------------|
| `alertas_rrhh` | ✅ INSERTs (Capas 2 y 3) | ✅ Lista/gestiona |
| `movimientos_personal` | ✅ INSERTs (INGRESO/CESE) | ✅ Lista historial |
| `usuarios_status_log` | ✅ INSERTs | Consumido internamente |
| `historial_bancario` | ✅ INSERT inicial | Visible en ficha colaborador |
| `historial_direcciones` | ✅ INSERT inicial | Visible en ficha colaborador |
| `entrevistas_colaborador` | ❌ No escribe | ✅ Exit interviews en offboarding |

**Secuenciación recomendada:**
```
Fase 6:  Movimientos + Offboarding (incluye exit interviews) + Alertas UI + Dashboard
Fase 7:  Importación Inicial (este módulo)
```

**Módulo futuro documentado:** Capacitación y Evaluaciones (banco de preguntas, quiz móvil, scoring, certificaciones internas, gamificación). Extiende `entrevistas_colaborador` con tipos FEEDBACK_DESEMPENO, RETENCION, AMONESTACION_VERBAL.

---

## 18. MÉTRICAS, DEPENDENCIAS, VERIFICACIONES

### 18.1 Métricas objetivo

| Métrica | Objetivo |
|---------|----------|
| Tiempo (100 colaboradores) | < 5 min (incluye RENIEC ~40s) |
| Precisión mapeo AI | > 85% |
| Tasa sin errores | > 80% |
| Verificación RENIEC | > 95% éxito |
| Reporte generado | 100% |

### 18.2 Dependencias

| Librería | Uso | Estado |
|----------|-----|--------|
| `xlsx` / `sheetjs` | Lectura de Excel | Instalar |
| `exceljs` | Generación template con validaciones | Instalar |
| `string-similarity` | Match fuzzy tiendas/nombres | Instalar |
| `zod` | Validación schemas | ✅ Ya instalado |
| `@anthropic-ai/sdk` | Claude API mapeo | ✅ Ya instalado |
| `date-fns` | Parsing/formateo fechas | ✅ Ya instalado |

### 18.3 Verificaciones para Claude Code (pre-implementación)

1. **¿`TipoSalida` en types.ts ya contiene los motivos de cese?** → Si sí, reusar
2. **¿`TipoAlerta` en types.ts tiene los 14 tipos base?** → Saber cuáles agregar
3. **¿Cómo implementa layout.tsx la prop `requiereGestion`?** → Replicar patrón
4. **¿`system_config` tiene constraint UNIQUE en `key`?** → Para `ON CONFLICT`
5. **¿`trigger_set_updated_at` existe como función global?** → Usada en migraciones
6. **¿`/api/consulta-documento` acepta tipo CE?** → Verificar endpoint existente
7. **Patrones de referencia:** `rrhh/incidencias/page.tsx` y `rrhh/incidencias/nueva/page.tsx`

### 18.4 Imports para archivos nuevos

```typescript
// Supabase
import { createClient } from '@/lib/supabase/client'
import { createClient } from '@/lib/supabase/server'

// Auth
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'

// RRHH types
import { 
  ESTADO_IMPORTACION, ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS,
  NIVEL_COMPLETITUD, NIVEL_COMPLETITUD_LABELS, NIVEL_COMPLETITUD_COLORS,
  ESTADO_VERIFICACION_IDENTIDAD, ESTADO_VERIFICACION_IDENTIDAD_COLORS,
  SISTEMA_PENSIONARIO, TIPO_DOCUMENTO_IDENTIDAD, NIVEL_EDUCATIVO, GRUPO_SANGUINEO,
  MOTIVO_CESE, MOTIVO_CESE_LABELS, CAMPO_HISTORIAL,
} from '@/lib/rrhh/types'
import type { 
  ImportacionRRHH, MapeoColumnas, ColumnaDetectada, AnalisisBrechas,
  HistorialBancario, HistorialDireccion, HistorialCambioRRHH,
  EntrevistaColaborador, DetalleFilaImportacion,
} from '@/lib/rrhh/interfaces'
import { importacionUploadSchema, importacionMapeoConfirmSchema, importacionEjecutarSchema } from '@/lib/rrhh/schemas'

// RRHH utils
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { compararNombres } from '@/lib/rrhh/utils/comparar-nombres'

// UI (shadcn)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { cn } from '@/lib/utils'
```

---

## 19. CHANGELOG

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-16 | 1.0 | Spec inicial: wizard 6 pasos, AI mapping, template, reporte brechas |
| 2026-02-16 | 1.1 | Prefijo código configurable. Template con cesados. Alertas 3 capas. ALTER `fecha_limite`. 39 campos. Tabla `importaciones_rrhh`. |
| 2026-02-16 | 1.2 | Conciliación con avance real (Fases 1-5). Rutas UI corregidas. Migración `025`. Layout. Types/Interfaces/Schemas en archivos existentes. Relación Fase 6. |
| 2026-02-17 | **2.0** | **Spec consolidada.** Absorbe MIGRACION_026 y SPEC_VERIFICACION_RENIEC. Campos mapeables: 39→54 (+15: seguridad social, identificación, educación, salud). Template: 32→47 columnas. Migración 026: +15 cols usuarios_rrhh + 3 tablas historial (bancario, direcciones, genérico) + entrevistas_colaborador (exit interviews). Verificación RENIEC obligatoria en paso 4b: batch DNI+CE contra json.pe, comparación fuzzy nombres, 6 estados, resolución conflictos. Brechas: 5→9 categorías. Alertas: +1 tipo VERIFICACION_IDENTIDAD_PENDIENTE. Módulo futuro: Capacitación y Evaluaciones. |
