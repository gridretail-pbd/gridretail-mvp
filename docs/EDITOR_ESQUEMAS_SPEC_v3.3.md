# Editor de Esquemas de Comisiones - Especificación v3.3
## GridRetail - Arquitectura Multi-Esquema

**Versión:** 3.3  
**Fecha:** 2026-02-02  
**Para:** Claude Code - Desarrollo Frontend + Backend  
**Prerequisito:** Leer EDITOR_ESQUEMAS_SPEC v3.0 primero (bugs y lógica base de partidas)

---

### Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| **v3.3** | **2026-02-02** | **Tipos de medición y base de aceleradores**: Nuevo campo `accelerator_base` en esquemas (VARIABLE_TEORICO/VARIABLE_CALCULADO). Nuevos campos en partidas: `measurement_type` (UNIT_COUNT, AVERAGE_VALUE, TOTAL_VALUE, RATE, MANUAL), `fulfillment_method` (RATIO, ABSOLUTE_RANGES), `measurement_config` (JSONB). Nuevos campos en multiplicadores: `measurement_type`, `measurement_config` (soporta Tasa de Uso de Descuento como multiplicador específico). Motor de cálculo actualizado para KPIs complejos. |
| v3.2 | 2026-02-02 | **Arquitectura multi-esquema**: Nuevos atributos de esquema (tabla de conversión, método de rango global). Nuevos atributos de partida (tipo de contribución, fuente de rango, rangos de acelerador). Sección unificada "Candados y Multiplicadores" con taxonomía de 6 tipos. Motor de cálculo universal para soportar TEX/PBD, Netcall y TPF. Sección AI Readiness. |
| v3.0.1 | 2026-02-01 | Addendum: Sobrecumplimiento (3 modalidades: sin tope, proporcional, bono PxQ) |
| v3.0 | 2026-02-01 | Bugs (404 editar, 1 partida visible, cálculo erróneo). Cambios: eliminar draft, sueldo fijo desde BD, Meta↔Peso vinculados, Factor Mix como %, Variable S/. calculado |
| v2.1 | 2026-01-26 | UI simplificada modal partidas, orden de categorías |
| v2.0 | 2026-01-25 | Sistema de presets, mapeo flexible tipos venta |
| v1.0 | 2026-01-25 | Versión inicial |

**Este documento NO reemplaza v3.0** (bugs y lógica base). Es una extensión que agrega los conceptos nuevos. Para implementar, leer primero v3.0, luego v3.0.1, luego este documento.

---

## PARTE 1: VISIÓN ARQUITECTÓNICA

### 1.1 El Problema

GridRetail fue diseñado originalmente para el esquema de comisiones TEX/PBD. Al analizar esquemas de otros modelos de negocio (call centers, tiendas propias franquiciadas), se identifican patrones que el modelo actual no soporta:

| Esquema | Patrón faltante |
|---------|-----------------|
| **Netcall (Call Center)** | PxQ puro donde el rango depende del volumen global de ventas (no de % de cuota) |
| **TPF (Tiendas Propias)** | Tabla de conversión no-lineal que castiga fuerte el bajo rendimiento. Partidas "aceleradoras" que suman/restan % al total. Multiplicador cruzado (Seguros afecta comisión de Equipos) |

### 1.2 La Solución: Modelo de 3 Niveles

```
NIVEL 1: ESQUEMA (arquitectura del plan)
  → conversion_table, global_range_method
  
NIVEL 2: PARTIDA (cómo contribuye cada pieza al total)
  → contribution_type, range_source, accelerator_ranges
  
NIVEL 3: MULTIPLICADORES (factores que modifican el resultado)
  → candados, aceleradores, cruzados, escalonados
```

**Principio de diseño:** La diferencia entre TEX, Netcall y TPF NO está en código separado, sino en **configuración diferente** de las mismas estructuras.

### 1.3 Mapeo de los 3 Esquemas al Modelo Unificado

#### TEX/PBD (Modelo actual)
```
Esquema: conversion_table=NULL, global_range_method=NULL
Partidas:
  OSS ─── PONDERADA, 27%, CUOTA_PROPIA, porcentaje
  VR  ─── PONDERADA, 17%, CUOTA_PROPIA, porcentaje
  OPP ─── PONDERADA, 8%, CUOTA_PROPIA, porcentaje
  RENO ── PONDERADA (adicional), CUOTA_PROPIA
  PxQ ─── PXQ_INDEPENDIENTE, CUOTA_GLOBAL_SS, pxq
  NPS ─── BONO, binario
Multiplicadores:
  Candado MEP en PACK (LOCK, ×0 si <2 seguros)
  Cumplimiento mínimo 50% (LOCK por partida)
```

#### Netcall (Call Center)
```
Esquema: conversion_table=NULL, global_range_method='VOLUMEN_TOTAL'
Partidas: (TODAS PXQ_INDEPENDIENTE con VOLUMEN_GLOBAL)
  Porta ─── PXQ_INDEPENDIENTE, VOLUMEN_GLOBAL, escala propia
  LLAA ──── PXQ_INDEPENDIENTE, VOLUMEN_GLOBAL, escala propia
  ...6 productos, cada uno con precio/unidad por rango de volumen
Multiplicadores:
  Candado antigüedad (LOCK, rango 0 solo si <3 meses)
```

#### TPF (Tiendas Propias Franquiciadas)
```
Esquema: conversion_table=[tabla con saltos no-lineales], global_range_method=NULL
Partidas:
  Porta OSS ── PONDERADA, 30%, CUOTA_PROPIA, usa_conversion_table=true
  VR+OPP ───── PONDERADA, 25%, CUOTA_PROPIA, usa_conversion_table=true
  Equipos ──── PONDERADA, 25%, CUOTA_PROPIA, usa_conversion_table=true
  LLAA ──────── ACELERADOR, ±5% del variable total
  CFG ────────── ACELERADOR, ±5% del variable total
  Accesorios ── ACELERADOR, ±5% del variable total
  Mis In ────── ACELERADOR, ±5% del variable total
  Prepago ──── PXQ_INDEPENDIENTE, S/3+S/5
Multiplicadores:
  Cruzado: Seguros → Equipos (TIERED, 70%-110%)
```

---

## PARTE 2: CAMBIOS EN NIVEL 1 — ESQUEMA

### 2.1 Nuevos Atributos en `commission_schemes`

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `conversion_table` | JSONB | NULL | Tabla de conversión no-lineal (mapea % cumplimiento real → % efectivo) |
| `global_range_method` | VARCHAR(30) | NULL | Método de rango global: `NULL` (cada partida usa su cuota), `'VOLUMEN_TOTAL'` (suma absoluta de ventas) |
| `accelerator_base` | VARCHAR(25) | `'VARIABLE_TEORICO'` | Base sobre la cual los aceleradores aplican su ±% |

### 2.1.1 Base de Aceleradores (`accelerator_base`)

Define **sobre qué monto** se aplica el ±% de las partidas ACELERADOR.

| Valor | Descripción | Cálculo | Uso |
|-------|-------------|---------|-----|
| `'VARIABLE_TEORICO'` | El variable target fijo del esquema | ±% × `variable_salary` (siempre predecible) | TPF |
| `'VARIABLE_CALCULADO'` | El variable ya calculado de partidas PONDERADAS | ±% × Σ(resultados ponderados) | Futuro |

**Ejemplo TPF con VARIABLE_TEORICO:**
```
Variable target = S/. 1,200
LLAA: HC logra 85% → rango → pct_effect = -5%
Efecto = -5% × S/. 1,200 = -S/. 60 (SIEMPRE -60, independiente de cuánto ganó en ponderadas)
```

**Ejemplo hipotético con VARIABLE_CALCULADO:**
```
HC ganó S/. 900 de ponderadas (de S/. 1,200 posibles)
LLAA: pct_effect = -5%
Efecto = -5% × S/. 900 = -S/. 45 (depende del rendimiento en ponderadas)
```

**Por qué importa:** La primera opción es más simple, predecible y transparente. Es lo que usa TPF actualmente. La segunda introduce dependencia circular parcial (los aceleradores dependen del resultado de las ponderadas). Default = VARIABLE_TEORICO.

### 2.2 Tabla de Conversión No-Lineal (`conversion_table`)

**¿Qué resuelve?** El Paso 2 del esquema TPF, donde el % de cumplimiento crudo se transforma a un % efectivo antes de calcular la comisión.

**Estructura JSONB:**
```json
{
  "description": "Tabla multiplicadora TPF",
  "ranges": [
    { "min": 0,      "max": 69.99,  "effective": 0,     "label": "No comisiona" },
    { "min": 70,     "max": 74.99,  "effective": 50,    "label": "Mínimo" },
    { "min": 75,     "max": 79.99,  "effective": 60,    "label": "Castigo" },
    { "min": 80,     "max": 84.99,  "effective": 80,    "label": "Bajo" },
    { "min": 85,     "max": 89.99,  "effective": 85,    "label": "Regular" },
    { "min": 90,     "max": 94.99,  "effective": 90,    "label": "Regular" },
    { "min": 95,     "max": 99.99,  "effective": 95,    "label": "Cercano" },
    { "min": 100,    "max": 100,    "effective": 100,   "label": "Meta" },
    { "min": 100.01, "max": 105,    "effective": 105,   "label": "Bien" },
    { "min": 105.01, "max": 110,    "effective": 110,   "label": "Acelerado" },
    { "min": 110.01, "max": 115,    "effective": 115,   "label": "Acelerado" },
    { "min": 115.01, "max": 999999, "effective": "+10",  "label": "Sin tope (+10 sobre real)" }
  ]
}
```

**Regla del último rango:** Si `effective` es un string como `"+10"`, significa: `effective = real + 10`. Esto permite topes sin límite superior.

**Ejemplo de uso:**
```
HC logra 78% de cuota real
→ conversion_table busca rango [75, 79.99]
→ effective = 60%
→ Comisión se calcula con 60%, NO con 78%
→ CASTIGO: pierde 18 puntos porcentuales
```

**Cuándo se usa:** Solo cuando la partida tiene `uses_conversion_table = true`. Si el esquema no tiene `conversion_table` (NULL), este campo se ignora.

### 2.3 Método de Rango Global (`global_range_method`)

**¿Qué resuelve?** El esquema Netcall, donde el rango PxQ NO depende del % de cuota de cada partida, sino del volumen total de ventas.

| Valor | Descripción | Uso |
|-------|-------------|-----|
| `NULL` | Cada partida evalúa su propia cuota (Real/Meta) | TEX, TPF |
| `'VOLUMEN_TOTAL'` | El rango se determina por el total absoluto de ventas | Netcall |

**Ejemplo Netcall:** HC vendió 45 unidades totales (10 Porta + 15 LLAA + 8 OPre + 12 Multi). El rango se busca en la escala global (45 → rango 4: 40-49). Todas las partidas PxQ usan ese rango para determinar su precio unitario.

### 2.4 UI: Configuración a Nivel de Esquema

**En la página "Nuevo Esquema" / "Editar Esquema", agregar después de los campos actuales:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ... campos actuales (nombre, período, sueldo fijo, variable) ...  │
│                                                                     │
│  ─── Configuración Avanzada (colapsable) ──────────────────────   │
│                                                                     │
│  Método de rango global                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │ (●) Cuota individual por partida (default)       │              │
│  │ ( ) Volumen total de ventas                      │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                     │
│  Tabla de conversión no-lineal                                     │
│  ┌──────────────────────────────────────────────────┐              │
│  │ ☐ Usar tabla de conversión                       │              │
│  │   (convierte % real → % efectivo antes de pagar) │              │
│  └──────────────────────────────────────────────────┘              │
│  [Si activado: editor de tabla con rangos]                         │
│                                                                     │
│  ⓘ Estos son ajustes avanzados. La mayoría de esquemas TEX       │
│     no los necesitan. Úsalos para modelar esquemas como            │
│     call centers (rango por volumen) o esquemas con                │
│     tablas de conversión (TPF).                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.5 UI: Editor de Tabla de Conversión

Cuando se activa "Usar tabla de conversión", se muestra un editor:

```
┌──────────────────────────────────────────────────────────────┐
│  Tabla de Conversión                              [+ Rango]  │
│                                                              │
│  Desde (%)  │  Hasta (%)  │  % Efectivo  │  Etiqueta  │ 🗑  │
│  ──────────┼────────────┼─────────────┼───────────┼────│
│  0          │  69.99      │  0           │  No paga   │ 🗑  │
│  70         │  74.99      │  50          │  Mínimo    │ 🗑  │
│  75         │  79.99      │  60          │  Castigo   │ 🗑  │
│  80         │  84.99      │  80          │  Bajo      │ 🗑  │
│  85         │  89.99      │  85          │  Regular   │ 🗑  │
│  90         │  94.99      │  90          │            │ 🗑  │
│  95         │  99.99      │  95          │            │ 🗑  │
│  100        │  100        │  100         │  Meta      │ 🗑  │
│  100.01     │  105        │  105         │            │ 🗑  │
│  105.01     │  110        │  110         │  Acelerado │ 🗑  │
│  110.01     │  115        │  115         │            │ 🗑  │
│  115.01     │  ∞          │  Real + 10   │  Sin tope  │ 🗑  │
│                                                              │
│  ⚠️ Nota: Los rangos deben ser contiguos sin huecos.         │
│  El último rango puede ser "sin tope" (∞).                   │
└──────────────────────────────────────────────────────────────┘
```

**Validaciones:**
- Rangos contiguos sin huecos (max del rango N = min del rango N+1 - 0.01)
- Al menos un rango con effective = 100 (debe existir la "meta")
- El primer rango debe empezar en 0
- El último rango puede tener max = ∞

---

## PARTE 3: CAMBIOS EN NIVEL 2 — PARTIDA

### 3.1 Nuevos Atributos en `commission_scheme_items`

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `contribution_type` | VARCHAR(25) | `'PONDERADA'` | Cómo contribuye al ingreso total |
| `range_source` | VARCHAR(25) | `'CUOTA_PROPIA'` | De dónde se obtiene el input para evaluar |
| `uses_conversion_table` | BOOLEAN | false | Si usa la tabla de conversión del esquema |
| `accelerator_ranges` | JSONB | NULL | Rangos ±% para partidas ACELERADOR |
| `measurement_type` | VARCHAR(20) | `'UNIT_COUNT'` | Cómo se mide el logro de esta partida (v3.3) |
| `fulfillment_method` | VARCHAR(20) | `'RATIO'` | Cómo se convierte el logro a % de cumplimiento (v3.3) |
| `measurement_config` | JSONB | NULL | Configuración específica del tipo de medición (v3.3) |

### 3.1.1 Tipo de Medición (`measurement_type`) — v3.3

Define **cómo se obtiene el valor de logro** de la partida. No todas las partidas se miden contando ventas.

| Valor | Logro | Ejemplo | measurement_config |
|-------|-------|---------|-------------------|
| `'UNIT_COUNT'` | Contar ventas que coincidan con los tipos_venta de la partida | 50 OSS vendidas | No requerido |
| `'AVERAGE_VALUE'` | Promedio de un campo numérico de las ventas | Cargo Fijo Promedio = S/52 | `{ "value_field": "plan_tarifario_monto" }` |
| `'TOTAL_VALUE'` | Suma de un campo numérico de las ventas | Ingresos totales = S/15,000 | `{ "value_field": "monto_liquidado" }` |
| `'RATE'` | Ratio entre ventas que cumplen condición / total ventas del scope | 45% ventas con descuento | `{ "condition_field": "tiene_descuento", "condition_value": true }` |
| `'MANUAL'` | Valor ingresado manualmente (fuente externa) | NPS = 78 puntos | No requerido (input directo) |

**Cuándo se usa cada tipo:**

- `UNIT_COUNT` — La gran mayoría de partidas: OSS, VR, OPP, RENO, PACK, Prepago. Cuenta unidades vendidas.
- `AVERAGE_VALUE` — KPIs de valor: Cargo Fijo Promedio (TPF). El logro es el promedio del campo configurado.
- `TOTAL_VALUE` — KPIs de monto: Ingresos brutos, recaudación. El logro es la suma del campo.
- `RATE` — KPIs de tasa: Tasa de uso de descuento. Ratio entre ventas que cumplen condición vs total.
- `MANUAL` — KPIs externos: NPS, satisfacción de Entel. No se puede calcular del sistema.

### 3.1.2 Método de Cumplimiento (`fulfillment_method`) — v3.3

Define **cómo se convierte el logro a un porcentaje o valor** para evaluar contra rangos.

| Valor | Cálculo | Ejemplo | Uso |
|-------|---------|---------|-----|
| `'RATIO'` | `logro / meta × 100` | 50 ventas / 70 meta = 71.4% | TEX, Netcall, TPF (mayoría) |
| `'ABSOLUTE_RANGES'` | El valor cae directamente en un rango absoluto | CFP S/52 → rango "S/50-54.99" | TPF Cargo Fijo Promedio |

**RATIO (default):** La partida tiene una meta numérica. Se divide logro / meta para obtener %. Luego ese % se busca en escalas de cumplimiento, tabla de conversión, etc.

**ABSOLUTE_RANGES:** No hay meta. El valor absoluto se busca directamente en los rangos de la partida (`accelerator_ranges` o `tiered_ranges` del multiplicador). Ejemplo: Cargo Fijo Promedio no tiene "meta de S/55"; el valor S/52 se busca directamente en rangos [S/50-54.99 → -2%, S/55+ → +5%].

### 3.1.3 Configuración de Medición (`measurement_config`) — v3.3

JSONB con parámetros específicos según `measurement_type`:

**Para AVERAGE_VALUE:**
```json
{
  "value_field": "plan_tarifario_monto",
  "description": "Cargo Fijo Promedio de planes vendidos"
}
```

**Para TOTAL_VALUE:**
```json
{
  "value_field": "monto_liquidado",
  "description": "Ingresos brutos del período"
}
```

**Para RATE:**
```json
{
  "condition_field": "tiene_descuento",
  "condition_value": true,
  "scope_tipos_venta": ["OSS_BASE", "OSS_CAPTURA"],
  "description": "% de OSS vendidas con descuento"
}
```

**Para UNIT_COUNT y MANUAL:** `measurement_config` es NULL (no se necesita configuración adicional).

### 3.2 Tipo de Contribución (`contribution_type`)

Define **cómo la partida aporta al ingreso total** del HC.

| Valor | Descripción | Cálculo | Ejemplo |
|-------|-------------|---------|---------|
| `'PONDERADA'` | Peso % del sueldo variable. Suman al target. | `resultado × peso × variable_target` | TEX OSS 27%, TPF Porta OSS 30% |
| `'ACELERADOR'` | Suma o resta un % al total del variable. NO tiene peso. | `±% del variable_target` | TPF LLAA ±5%, CFG ±5% |
| `'PXQ_INDEPENDIENTE'` | Monto aparte. Precio × Cantidad. No afecta %. | `Σ(precio × cantidad)` | TEX PxQ Portabilidad, TPF Prepago |
| `'BONO'` | Todo o nada. Monto separado. | `monto_fijo si condición` | TEX NPS Venta S/75 |

**Regla de suma:**
```
Ingreso Total = sueldo_fijo
              + (Σ partidas PONDERADAS) × variable_target
              + (Σ partidas ACELERADOR) × variable_target
              + Σ partidas PXQ_INDEPENDIENTE
              + Σ partidas BONO
              - penalidades
```

**Nota:** Las partidas PONDERADAS principales deben sumar peso = 100%. Las PONDERADAS adicionales (RENO, PREPAGO) suman un % extra al variable. Los ACELERADORES pueden sumar (+) o restar (−).

### 3.3 Fuente de Rango (`range_source`)

Define **de dónde se obtiene el input** para evaluar el cumplimiento/rango de la partida.

| Valor | Input | Cómo se calcula | Uso |
|-------|-------|-----------------|-----|
| `'CUOTA_PROPIA'` | Real / Meta de esta partida | `ventas_partida / meta_partida` | TEX (cada partida vs su meta), TPF |
| `'VOLUMEN_GLOBAL'` | Total absoluto de ventas | `Σ ventas_todas_partidas` (número entero) | Netcall (buscar en escala global) |
| `'CUOTA_GLOBAL_SS'` | % cumplimiento cuota SS total | `total_ventas_SS / cuota_SS_total` | TEX PxQ (rango por % cuota SS global) |

### 3.4 Rangos de Acelerador (`accelerator_ranges`)

Solo aplica cuando `contribution_type = 'ACELERADOR'`. Define rangos de cumplimiento y su efecto (± %) sobre el variable total.

**Estructura JSONB:**
```json
{
  "source_item_name": "LLAA",
  "ranges": [
    { "min": 0,   "max": 89.99,  "pct_effect": -5,  "label": "Castigo" },
    { "min": 90,  "max": 94.99,  "pct_effect": -2,  "label": "Bajo" },
    { "min": 95,  "max": 97.99,  "pct_effect": -0.5, "label": "Casi" },
    { "min": 98,  "max": 100,    "pct_effect": 0,    "label": "Meta" },
    { "min": 100.01, "max": 110, "pct_effect": 5,    "label": "Acelerado" }
  ]
}
```

**Ejemplo TPF — LLAA como acelerador:**
```
HC logra 85% en LLAA
→ Rango [0, 89.99] → pct_effect = -5
→ Efecto sobre variable total: -5% × S/. 1,200 = -S/. 60
```

**Rango total de aceleradores TPF:** Con 4 aceleradores de ±5% cada uno:
- Mejor caso: +20% → +S/. 240
- Peor caso: -20% → -S/. 240

### 3.5 UI: Selector de Tipo de Contribución en Modal de Partida

**Agregar al inicio del modal, antes de "Configuración de Meta":**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tipo de Contribución                                               │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌───────────┐  │
│  │  Ponderada  │ │  Acelerador │ │ PxQ Indep.   │ │   Bono    │  │
│  │  ────────── │ │  ────────── │ │ ────────────  │ │ ────────  │  │
│  │  Peso % del │ │  Suma/resta │ │ Monto aparte │ │ Todo o    │  │
│  │  variable   │ │  % al total │ │ precio × qty │ │ nada      │  │
│  └─────────────┘ └─────────────┘ └──────────────┘ └───────────┘  │
│     (default)                                                       │
│                                                                     │
│  Fuente de rango                                                    │
│  ┌──────────────────────────────────────────────────┐              │
│  │ (●) Cuota propia (Real/Meta de esta partida)     │              │
│  │ ( ) Volumen global (total absoluto de ventas)    │              │
│  │ ( ) % Cuota SS total                             │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                     │
│  ☐ Usa tabla de conversión del esquema                             │
│    (solo si el esquema tiene tabla configurada)                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Campos visibles según `contribution_type`:**

| Campo | PONDERADA | ACELERADOR | PXQ_INDEPENDIENTE | BONO |
|-------|-----------|------------|-------------------|------|
| Tipo de venta | ✅ | ✅ | ✅ | ✅ |
| Meta (unidades) | ✅ | ✅ | ❌ | ❌ |
| Peso (%) | ✅ | ❌ | ❌ | ❌ |
| Factor Mix (%) | ✅ | ❌ | ❌ | ❌ |
| Variable S/. | ✅ (calc) | ❌ | ❌ | ❌ |
| Cumpl. mínimo | ✅ | ❌ | ❌ | ❌ |
| Sobrecumplimiento | ✅ | ❌ | ❌ | ❌ |
| Rangos acelerador | ❌ | ✅ | ❌ | ❌ |
| Escala PxQ | ❌ | ❌ | ✅ | ❌ |
| Monto bono | ❌ | ❌ | ❌ | ✅ |
| Condición bono | ❌ | ❌ | ❌ | ✅ |
| Usa conv. table | ✅ | ❌ | ❌ | ❌ |
| Multiplicadores | ✅ | ❌ | ✅ | ❌ |

### 3.6 UI: Editor de Rangos de Acelerador

Cuando `contribution_type = 'ACELERADOR'`, en vez de Meta/Peso/Mix mostrar:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Rangos de Efecto                                       [+ Rango]  │
│                                                                     │
│  Desde (%)  │  Hasta (%)  │  Efecto  │  Etiqueta                  │
│  ──────────┼────────────┼─────────┼───────────                   │
│  0          │  89.99      │  -5.0%   │  Castigo                    │
│  90         │  94.99      │  -2.0%   │  Bajo                       │
│  95         │  97.99      │  -0.5%   │  Casi                       │
│  98         │  100        │   0.0%   │  Meta                       │
│  100.01     │  110        │  +5.0%   │  Acelerado                  │
│                                                                     │
│  ⓘ Efecto negativo = descuento sobre variable total.               │
│     Efecto positivo = bonificación sobre variable total.            │
│     Máximo efecto: ±[_5_]% (protección)                            │
│                                                                     │
│  💰 Variable total del esquema: S/. 1,200                          │
│     Rango de efecto: -S/. 60 a +S/. 60                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PARTE 4: SOBRECUMPLIMIENTO (de v3.0.1 — integrado)

> **Nota:** Esta sección integra completamente la especificación v3.0.1 del addendum de sobrecumplimiento. No es necesario leer v3.0.1 por separado si se lee esta sección.

### 4.1 Concepto

Reemplaza la sección "Tiene tope máximo" del modal de partida. Responde a:

> **¿Qué sucede si el HC vende más que la meta de esta partida?**

### 4.2 Tres Modalidades

| Modalidad | `overcompliance_mode` | Descripción | Ejemplo (Meta=35, Variable=S/.480) |
|-----------|----------------------|-------------|-------------------------------------|
| Sin sobrecumplimiento | `'none'` | Tope al 100%. No gana más. | Vende 40 → S/. 480 |
| Proporcional | `'proportional'` | Sigue ganando al mismo rate | Vende 40 (114.3%) → S/. 548.57 |
| Bono por unidad | `'pxq_bonus'` | Monto fijo por unidad extra | Vende 40 → S/. 480 + 5×S/.20 = S/. 580 |

En modalidades 2 y 3, opcionalmente se puede establecer un **tope** para limitar la ganancia máxima.

### 4.3 Campos de BD

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `overcompliance_mode` | VARCHAR(20) | `'none'` | `'none'`, `'proportional'`, `'pxq_bonus'` |
| `has_cap` | BOOLEAN | false | Si tiene tope (aplica a ambos modos) |
| `cap_percentage` | DECIMAL(8,4) | NULL | Tope en % (solo proporcional). Ej: 1.20 para 120% |
| `cap_units` | DECIMAL(10,2) | NULL | Tope en unidades totales |
| `cap_amount` | DECIMAL(12,2) | NULL | Tope en soles |
| `pxq_bonus_amount` | DECIMAL(10,2) | NULL | Monto por unidad adicional (solo pxq_bonus) |
| `overcap_max_units` | DECIMAL(10,2) | NULL | Máx unidades adicionales (solo pxq_bonus con tope) |
| `overcap_max_amount` | DECIMAL(12,2) | NULL | Máx monto adicional (solo pxq_bonus con tope) |

### 4.4 UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sobrecumplimiento                                                  │
│  ¿Qué sucede si el HC supera la meta?                              │
│                                                                     │
│  (●) Sin sobrecumplimiento                                          │
│      Se paga máximo el Variable S/. al alcanzar 100%.               │
│                                                                     │
│  ( ) Proporcional                                                   │
│      Cada unidad adicional se paga al mismo valor unitario.         │
│                                                                     │
│  ( ) Bono por unidad adicional                                      │
│      Monto fijo por cada unidad vendida sobre la meta.              │
│                                                                     │
│  [Proyección dinámica según modalidad seleccionada]                │
└─────────────────────────────────────────────────────────────────────┘
```

**Para detalles completos de UI, proyecciones y validaciones**, referir al addendum v3.0.1 existente. La lógica de vinculación de campos (meta ↔ cap_units ↔ cap_amount ↔ cap_percentage) está completamente documentada allí.

**Solo aplica a:** `contribution_type = 'PONDERADA'`

---

## PARTE 5: CANDADOS Y MULTIPLICADORES (Unificados)

### 5.1 Concepto Unificado

Un **Multiplicador** es un factor numérico que modifica el resultado de una partida:

| Factor | Efecto |
|--------|--------|
| > 1.0 | Incrementa la comisión (acelerador, premio) |
| = 1.0 | Sin efecto (neutro) |
| 0 < f < 1.0 | Reduce la comisión (desacelerador) |
| = 0 | Anula completamente (candado no cumplido) |

Un **candado** es un multiplicador binario: cumple (×1.0) o no cumple (×0.0).

### 5.2 Taxonomía de Multiplicadores

| Tipo | Código | Factor típico | Criterio de activación |
|------|--------|---------------|------------------------|
| **Candado** | `LOCK` | 0 / 1 | Binario: cumple o no cumple |
| **Acelerador** | `ACCELERATOR` | >1.0 | % cumplimiento supera umbral |
| **Desacelerador** | `DECELERATOR` | <1.0 | % cumplimiento bajo umbral |
| **Proporcional** | `PROPORTIONAL` | 0.0 – 2.0+ | Igual al % de cumplimiento |
| **Cruzado** | `CROSS_PRODUCT` | Variable | Cumplimiento de OTRO producto |
| **Escalonado** | `TIERED` | Variable por rango | Rangos con factores diferentes |

### 5.3 Criterios de Activación

| Criterio | Código | Descripción | Ejemplo |
|----------|--------|-------------|---------|
| Cantidad mínima | `MIN_QUANTITY` | Vender ≥N unidades de un producto | ≥2 MEP para desbloquear PACK |
| % Cumplimiento propio | `OWN_ATTAINMENT` | % logrado de la cuota propia | ≥50% para comisionar |
| % Cumplimiento otro | `OTHER_ATTAINMENT` | % logrado de otra partida | 100% RENO → +10% en VR |
| % Cumplimiento global | `GLOBAL_ATTAINMENT` | % cuota SS total | ≥100% SS → 1.2x en PxQ |
| Rango de cumplimiento | `ATTAINMENT_RANGE` | Factor por rango | 50-70%→0.8, 70-100%→1.0, 100%+→1.3 |
| % Origen operador | `OPERATOR_ORIGIN` | % de portas de operador X | ≥40% Claro → 1.1x |

### 5.4 Combinación de Multiplicadores

Cuando una partida tiene múltiples multiplicadores, se combinan multiplicativamente:

```
Comisión final = Variable × % cumplimiento × Mult_1 × Mult_2 × ... × Mult_N
```

**Ejemplo:**
```
Partida: OSS (Variable S/. 324)
HC logra: 90% de cuota OSS

Multiplicadores activos:
  1. Candado MEP (MIN_QUANTITY ≥2 seguros): factor = 1.0 ✓
  2. Acelerador cruzado (cumplió RENO): factor = 1.10
  
Cálculo: S/. 324 × 0.90 × 1.0 × 1.10 = S/. 320.76

Si candado NO se cumple:
  S/. 324 × 0.90 × 0.0 × 1.10 = S/. 0.00
```

### 5.5 Migración desde Sistema Actual

| Sistema Actual | Nuevo Modelo |
|---------------|--------------|
| `commission_item_locks` | Multiplicador tipo `LOCK`, criterio `MIN_QUANTITY` |
| Cumplimiento mínimo 50%/70% | Multiplicador tipo `LOCK`, criterio `OWN_ATTAINMENT` |
| Cálculo `percentage` | Multiplicador tipo `PROPORTIONAL`, criterio `OWN_ATTAINMENT` |
| Tope Sí/No | Se mantiene en partida (no es multiplicador) |
| Restricciones de mix | Se mantienen separadas (afectan unidades, no factor) |

### 5.6 Nueva Tabla: `commission_item_multipliers`

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | gen_random_uuid() | PK |
| `item_id` | UUID | - | FK → commission_scheme_items(id) ON DELETE CASCADE |
| `multiplier_type` | VARCHAR(20) | - | `LOCK`, `ACCELERATOR`, `DECELERATOR`, `PROPORTIONAL`, `CROSS_PRODUCT`, `TIERED` |
| `activation_criteria` | VARCHAR(25) | - | `MIN_QUANTITY`, `OWN_ATTAINMENT`, `OTHER_ATTAINMENT`, `GLOBAL_ATTAINMENT`, `ATTAINMENT_RANGE`, `OPERATOR_ORIGIN` |
| `source_description` | VARCHAR(200) | - | Descripción legible del origen (ej: "Cumplimiento de RENO") |
| `source_item_id` | UUID | NULL | FK → commission_scheme_items(id). Para CROSS_PRODUCT y OTHER_ATTAINMENT |
| `threshold_value` | DECIMAL(10,2) | NULL | Umbral de activación. Para MIN_QUANTITY: cantidad. Para ATTAINMENT: %. |
| `factor_if_met` | DECIMAL(6,4) | 1.0 | Factor si se cumple la condición |
| `factor_if_not_met` | DECIMAL(6,4) | 0.0 | Factor si NO se cumple (para LOCK = 0) |
| `tiered_ranges` | JSONB | NULL | Para TIERED: array de {min, max, factor} |
| `operator_cedente` | VARCHAR(30) | NULL | Para OPERATOR_ORIGIN: operador específico |
| `measurement_type` | VARCHAR(20) | `'UNIT_COUNT'` | Cómo se mide el KPI del multiplicador: UNIT_COUNT, RATE, AVERAGE_VALUE, MANUAL (v3.3) |
| `measurement_config` | JSONB | NULL | Config del KPI cuando measurement_type ≠ UNIT_COUNT (v3.3) |
| `is_active` | BOOLEAN | true | Si está activo |
| `display_order` | INTEGER | 0 | Orden de visualización |
| `notes` | TEXT | NULL | Notas |
| `created_at` | TIMESTAMPTZ | NOW() | |
| `updated_at` | TIMESTAMPTZ | NOW() | |

**Constraint:**
```sql
CHECK (multiplier_type IN ('LOCK', 'ACCELERATOR', 'DECELERATOR', 'PROPORTIONAL', 'CROSS_PRODUCT', 'TIERED'))
CHECK (activation_criteria IN ('MIN_QUANTITY', 'OWN_ATTAINMENT', 'OTHER_ATTAINMENT', 'GLOBAL_ATTAINMENT', 'ATTAINMENT_RANGE', 'OPERATOR_ORIGIN'))
CHECK (measurement_type IN ('UNIT_COUNT', 'RATE', 'AVERAGE_VALUE', 'MANUAL'))
```

**Estructura JSONB para `tiered_ranges`:**
```json
[
  { "min": 70, "max": 79.99, "factor": 0.70 },
  { "min": 80, "max": 94.99, "factor": 0.80 },
  { "min": 95, "max": 100,   "factor": 1.00 },
  { "min": 100.01, "max": 999999, "factor": 1.10 }
]
```

### 5.6.1 Multiplicadores con Medición Compleja (v3.3)

La mayoría de multiplicadores evalúan conteo de unidades (`measurement_type = 'UNIT_COUNT'`). Sin embargo, algunos KPIs requieren mediciones más sofisticadas.

**Ejemplo: Tasa de Uso de Descuento sobre partida OSS**

Un multiplicador TIERED sobre la partida OSS que evalúa qué porcentaje de las ventas OSS se hicieron con descuento:

```json
{
  "multiplier_type": "TIERED",
  "activation_criteria": "OWN_ATTAINMENT",
  "measurement_type": "RATE",
  "measurement_config": {
    "condition_field": "tiene_descuento",
    "condition_value": true,
    "description": "% de ventas OSS con descuento aplicado"
  },
  "tiered_ranges": [
    { "min": 0,     "max": 39.99,  "factor": 1.05, "label": "Bajo uso → premio" },
    { "min": 40,    "max": 60,     "factor": 1.00, "label": "Uso normal" },
    { "min": 60.01, "max": 100,    "factor": 0.85, "label": "Uso excesivo → castigo" }
  ],
  "source_description": "Tasa de uso de descuento en OSS"
}
```

**Lógica:** El motor calcula la tasa = (OSS con descuento / OSS totales × 100), busca en `tiered_ranges`, y aplica el factor resultante sobre la comisión de OSS.

**Cuándo usar `measurement_type` en multiplicadores:**

| measurement_type | Caso de uso | Evaluación |
|-----------------|-------------|------------|
| `UNIT_COUNT` | Candado MEP (≥2 seguros), cumplimiento de otra partida | Contar ventas/unidades |
| `RATE` | Tasa de descuento, % de ventas con seguro | (condición / total) × 100 |
| `AVERAGE_VALUE` | Ticket promedio como condición | Promedio del campo configurado |
| `MANUAL` | Resultado de auditoría, score externo | Valor ingresado manualmente |

### 5.7 UI: Sección en Modal de Partida

```
┌─────────────────────────────────────────────────────────────────────┐
│  ─── Candados y Multiplicadores ───                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ 🔒 Candado: MEP                              [✓]   │           │
│  │ Condición: Vender ≥2 seguros MEP                    │           │
│  │ Si NO cumple: comisión = 0                          │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ 📈 Acelerador: Sobrecumplimiento              [✓]  │           │
│  │ Condición: >100% de cuota OSS                       │           │
│  │ Factor: ×1.2 (+20%)                                 │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ 🔗 Cruzado: Cumplir RENO                      [✓]  │           │
│  │ Condición: ≥100% cuota RENO                         │           │
│  │ Factor: ×1.1 (+10%)                                 │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
│  [+ Agregar multiplicador]                                         │
│                                                                     │
│  Factor combinado: ×1.32 (si todo se cumple)                       │
│  Factor mínimo: ×0 (si candado no se cumple)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.8 UI: Modal "Agregar Multiplicador"

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agregar Multiplicador                                         [X] │
│                                                                     │
│  Tipo                                                               │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐           │
│  │ 🔒       │ │ 📈        │ │ 🔗       │ │ 📊        │           │
│  │ Candado  │ │ Acelerador│ │ Cruzado  │ │ Escalonado│           │
│  └──────────┘ └───────────┘ └──────────┘ └───────────┘           │
│                                                                     │
│  [Campos dinámicos según tipo seleccionado]                        │
│                                                                     │
│  ── Candado ──────────────────────────────                         │
│  Criterio: [ Cantidad mínima de producto ▼ ]                       │
│  Producto: [ Seguros MEP ▼ ]                                       │
│  Cantidad mínima: [ 2 ]                                            │
│  Si no cumple: comisión = 0                                        │
│                                                                     │
│  ── Acelerador ───────────────────────────                         │
│  Criterio: [ % cumplimiento propio ▼ ]                             │
│  Umbral: [ 100 ] %                                                 │
│  Factor si cumple: [ 1.20 ] (×1.2 = +20%)                         │
│                                                                     │
│  ── Cruzado ──────────────────────────────                         │
│  Partida origen: [ RENO ▼ ] (otra partida del esquema)             │
│  Umbral: [ 100 ] %                                                 │
│  Factor si cumple: [ 1.10 ] (×1.1 = +10%)                         │
│  Factor si no cumple: [ 1.00 ] (sin efecto)                       │
│                                                                     │
│  ── Escalonado ───────────────────────────                         │
│  [Editor de rangos similar a tabla de conversión]                  │
│  Desde %  │  Hasta %  │  Factor                                   │
│  70       │  79.99    │  0.70                                      │
│  80       │  94.99    │  0.80                                      │
│  95       │  100      │  1.00                                      │
│  100.01   │  ∞        │  1.10                                      │
│                                                                     │
│                                        [Cancelar]  [Agregar]       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.9 Alcance v3.2 vs Futuro

| Concepto | v3.2 | Futuro |
|----------|------|--------|
| Candados (LOCK) | ✅ | |
| Aceleradores (ACCELERATOR) | ✅ | |
| Cruzados (CROSS_PRODUCT) | ✅ | |
| Escalonados (TIERED) | ✅ | |
| Desaceleradores (DECELERATOR) | ✅ (tabla existe, UI simplificada) | |
| Proporcional (PROPORTIONAL) | ✅ (implícito en cálculo percentage) | |
| SPIFFs | ❌ | Módulo separado de campañas |
| Team-based | ❌ | Requiere agrupación |
| Matrix commissions | ❌ | Demasiado complejo para MVP |

---

## PARTE 6: MOTOR DE CÁLCULO UNIVERSAL

### 6.1 Flujo de Cálculo

```
POR CADA PARTIDA del esquema:

  1. OBTENER INPUT (depende de measurement_type Y range_source)
     
     1a. MEDIR LOGRO (measurement_type):
         ├─ UNIT_COUNT → contar ventas del scope de la partida
         ├─ AVERAGE_VALUE → promedio del campo configurado
         ├─ TOTAL_VALUE → suma del campo configurado
         ├─ RATE → (ventas con condición / ventas totales del scope) × 100
         └─ MANUAL → valor ingresado por usuario
     
     1b. CALCULAR CUMPLIMIENTO (fulfillment_method):
         ├─ RATIO → logro / meta × 100 (ej: 50/70 = 71.4%)
         └─ ABSOLUTE_RANGES → valor cae directamente en rango (sin dividir por meta)
     
     1c. DETERMINAR RANGO (range_source):
         ├─ CUOTA_PROPIA → usar el cumplimiento de esta partida
         ├─ VOLUMEN_GLOBAL → Σ ventas_todas = buscar en escala global
         └─ CUOTA_GLOBAL_SS → total_ventas_SS / cuota_SS = % global

  2. CALCULAR RESULTADO CRUDO
     ├─ PONDERADA: resultado = % cumplimiento (decimal, ej: 0.85)
     ├─ ACELERADOR: resultado = buscar rango en accelerator_ranges → ±%
     ├─ PXQ_INDEPENDIENTE: resultado = buscar precio en escala × cantidad
     └─ BONO: resultado = 1 si condición cumplida, 0 si no

  3. CONVERSIÓN (opcional)
     Si esquema tiene conversion_table Y partida tiene uses_conversion_table:
     → resultado crudo se transforma: 78% real → 60% efectivo

  4. APLICAR MULTIPLICADORES
     resultado × Mult_1 × Mult_2 × ... × Mult_N
     (cada multiplicador evalúa su propio measurement_type si ≠ UNIT_COUNT)

  5. APLICAR SOBRECUMPLIMIENTO (solo PONDERADA)
     Si resultado > 1.0:
     ├─ mode='none': resultado = min(resultado, 1.0)
     ├─ mode='proportional': resultado (sin tope o con cap)
     └─ mode='pxq_bonus': base=1.0 + bonus por unidades extra

  6. CALCULAR MONTO según contribution_type:
     ├─ PONDERADA: monto = resultado × peso × variable_target
     ├─ ACELERADOR: monto = pct_effect × accelerator_base_amount (puede ser negativo)
     ├─ PXQ_INDEPENDIENTE: monto = precio × cantidad (directo)
     └─ BONO: monto = monto_fijo × resultado (1 o 0)

TOTAL = sueldo_fijo
      + Σ montos PONDERADAS
      + Σ montos ACELERADORES (pueden ser negativos)
      + Σ montos PXQ_INDEPENDIENTE
      + Σ montos BONO
      - penalidades

Nota: accelerator_base_amount depende de scheme.accelerator_base:
  - VARIABLE_TEORICO → scheme.variable_salary (fijo, predecible)
  - VARIABLE_CALCULADO → Σ montos PONDERADAS (depende del rendimiento)
```

### 6.2 Pseudocódigo del Motor

```typescript
function calculateCommission(
  scheme: CommissionScheme,
  items: CommissionSchemeItem[],
  sales: SalesData,          // datos de venta con campos adicionales
  multipliers: CommissionItemMultiplier[]
): CommissionResult {
  
  let totalPonderadas = 0;
  let totalAceleradores = 0;
  let totalPxQ = 0;
  let totalBonos = 0;
  
  for (const item of items) {
    if (!item.is_active) continue;
    
    // 1a. Medir logro según measurement_type
    let rawValue = measureAchievement(item, sales);
    
    // 1b. Calcular cumplimiento según fulfillment_method
    let input: number;
    if (item.fulfillment_method === 'ABSOLUTE_RANGES') {
      // Valor absoluto → se busca directamente en rangos
      input = rawValue;
    } else {
      // RATIO → dividir por meta
      input = item.quota ? rawValue / item.quota : 0;
    }
    
    // 1c. Ajustar por range_source si aplica
    switch (item.range_source) {
      case 'CUOTA_PROPIA':
        break; // ya calculado arriba
      case 'VOLUMEN_GLOBAL':
        input = Object.values(sales.unitCounts).reduce((a, b) => a + b, 0);
        break;
      case 'CUOTA_GLOBAL_SS':
        const totalSS = sumSSUnits(sales);
        input = totalSS / scheme.total_ss_quota;
        break;
    }
    
    // 3. Conversión no-lineal (si aplica)
    if (item.uses_conversion_table && scheme.conversion_table) {
      const pct = item.fulfillment_method === 'RATIO' ? input * 100 : input;
      input = applyConversionTable(pct, scheme.conversion_table) / 100;
    }
    
    // 4. Aplicar multiplicadores (cada uno evalúa su propio measurement_type)
    const itemMultipliers = multipliers.filter(m => m.item_id === item.id && m.is_active);
    let combinedFactor = 1.0;
    for (const mult of itemMultipliers) {
      combinedFactor *= evaluateMultiplier(mult, sales, items);
    }
    
    // 2, 5, 6. Calcular monto según tipo
    switch (item.contribution_type) {
      case 'PONDERADA':
        let resultado = input * combinedFactor;
        resultado = applyOvercompliance(resultado, item);
        totalPonderadas += resultado * item.weight * scheme.variable_salary;
        break;
        
      case 'ACELERADOR':
        const pctForRange = item.fulfillment_method === 'RATIO' ? input * 100 : input;
        const range = findAcceleratorRange(pctForRange, item.accelerator_ranges);
        const accelBase = scheme.accelerator_base === 'VARIABLE_CALCULADO'
          ? totalPonderadas  // depende de lo ya calculado
          : scheme.variable_salary;  // fijo (default)
        totalAceleradores += (range.pct_effect / 100) * accelBase;
        break;
        
      case 'PXQ_INDEPENDIENTE':
        const price = findPxQPrice(input, item.pxq_scales);
        totalPxQ += price * (sales.unitCounts[item.name] || 0);
        break;
        
      case 'BONO':
        if (input >= (item.min_fulfillment || 0) / 100) {
          totalBonos += item.variable_amount * combinedFactor;
        }
        break;
    }
  }
  
  return {
    fixed_salary: scheme.fixed_salary,
    variable_ponderadas: totalPonderadas,
    variable_aceleradores: totalAceleradores,
    variable_pxq: totalPxQ,
    variable_bonos: totalBonos,
    total_bruto: scheme.fixed_salary + totalPonderadas + totalAceleradores + totalPxQ + totalBonos,
    // penalidades se restan después
  };
}

// ── Helper: Medir logro según measurement_type ──

function measureAchievement(
  item: CommissionSchemeItem,
  sales: SalesData
): number {
  switch (item.measurement_type) {
    case 'UNIT_COUNT':
      return sales.unitCounts[item.name] || 0;
      
    case 'AVERAGE_VALUE':
      const field = item.measurement_config?.value_field;
      const values = sales.getFieldValues(item.name, field);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      
    case 'TOTAL_VALUE':
      const sumField = item.measurement_config?.value_field;
      return sales.getFieldSum(item.name, sumField);
      
    case 'RATE':
      const condField = item.measurement_config?.condition_field;
      const condValue = item.measurement_config?.condition_value;
      const total = sales.unitCounts[item.name] || 0;
      const matching = sales.countMatching(item.name, condField, condValue);
      return total > 0 ? (matching / total) * 100 : 0;
      
    case 'MANUAL':
      return sales.manualValues?.[item.name] || 0;
  }
}
```

### 6.3 Función de Evaluación de Multiplicador

```typescript
function evaluateMultiplier(
  mult: CommissionItemMultiplier,
  sales: SalesData,
  items: CommissionSchemeItem[]
): number {
  
  // v3.3: Primero, obtener el valor a evaluar según measurement_type del multiplicador
  let evaluationValue: number;
  
  switch (mult.measurement_type || 'UNIT_COUNT') {
    case 'UNIT_COUNT':
      evaluationValue = getUnitCountForMultiplier(mult, sales, items);
      break;
    case 'RATE':
      evaluationValue = getRateForMultiplier(mult, sales, items);
      break;
    case 'AVERAGE_VALUE':
      evaluationValue = getAverageForMultiplier(mult, sales, items);
      break;
    case 'MANUAL':
      evaluationValue = sales.manualValues?.[mult.source_description] || 0;
      break;
  }
  
  // Luego, evaluar según activation_criteria usando el valor obtenido
  switch (mult.activation_criteria) {
    case 'MIN_QUANTITY':
      return evaluationValue >= mult.threshold_value ? mult.factor_if_met : mult.factor_if_not_met;
      
    case 'OWN_ATTAINMENT':
      return evaluationValue >= mult.threshold_value ? mult.factor_if_met : mult.factor_if_not_met;
      
    case 'OTHER_ATTAINMENT':
      const sourceItem = items.find(i => i.id === mult.source_item_id);
      if (!sourceItem) return 1.0;
      const otherPct = (sales.unitCounts[sourceItem.name] || 0) / sourceItem.quota * 100;
      return otherPct >= mult.threshold_value ? mult.factor_if_met : mult.factor_if_not_met;
      
    case 'GLOBAL_ATTAINMENT':
      return evaluationValue >= mult.threshold_value ? mult.factor_if_met : mult.factor_if_not_met;
      
    case 'ATTAINMENT_RANGE':
      if (!mult.tiered_ranges) return 1.0;
      for (const range of mult.tiered_ranges) {
        if (evaluationValue >= range.min && evaluationValue <= range.max) return range.factor;
      }
      return 1.0;
      
    case 'OPERATOR_ORIGIN':
      // Requiere datos de operador cedente — future implementation
      return 1.0;
  }
}

// ── Helpers para measurement_type de multiplicadores ──

function getUnitCountForMultiplier(
  mult: CommissionItemMultiplier, sales: SalesData, items: CommissionSchemeItem[]
): number {
  if (mult.source_item_id) {
    const src = items.find(i => i.id === mult.source_item_id);
    return src ? (sales.unitCounts[src.name] || 0) : 0;
  }
  return sales.unitCounts[mult.source_description] || 0;
}

function getRateForMultiplier(
  mult: CommissionItemMultiplier, sales: SalesData, items: CommissionSchemeItem[]
): number {
  // Obtener el scope (la partida padre del multiplicador)
  const parentItem = items.find(i => i.id === mult.item_id);
  if (!parentItem) return 0;
  
  const config = mult.measurement_config;
  const total = sales.unitCounts[parentItem.name] || 0;
  const matching = sales.countMatching(
    parentItem.name,
    config?.condition_field,
    config?.condition_value
  );
  return total > 0 ? (matching / total) * 100 : 0;
}

function getAverageForMultiplier(
  mult: CommissionItemMultiplier, sales: SalesData, items: CommissionSchemeItem[]
): number {
  const parentItem = items.find(i => i.id === mult.item_id);
  if (!parentItem) return 0;
  
  const config = mult.measurement_config;
  const values = sales.getFieldValues(parentItem.name, config?.value_field);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
```

---

## PARTE 7: ESQUEMAS DE REFERENCIA

### 7.1 TEX/PBD — Esquema Asesor Enero 2026

**Configuración de esquema:**
```json
{
  "name": "TEX Asesor Enero 2026",
  "scheme_type": "asesor",
  "fixed_salary": 1050,
  "variable_salary": 1200,
  "total_ss_quota": 69,
  "min_fulfillment_pct": 50,
  "conversion_table": null,
  "global_range_method": null
}
```

**Partidas:**

| Nombre | contribution_type | range_source | Meta | Peso | Mix | Variable S/. |
|--------|-------------------|-------------|------|------|-----|-------------|
| OSS Total | PONDERADA | CUOTA_PROPIA | 18.6 | 27% | 27% | 324 |
| VR BASE/LLAA | PONDERADA | CUOTA_PROPIA | 27.6 | 40% | 40% | 480 |
| OPP Total | PONDERADA | CUOTA_PROPIA | 5.5 | 8% | 8% | 96 |
| VR CAPTURA | PONDERADA | CUOTA_PROPIA | 11.9 | 17% | 17% | 204 |
| RENO | PONDERADA | CUOTA_PROPIA | 20 | (extra) | 5.5% | 66 |
| PREPAGO | PONDERADA | CUOTA_PROPIA | 40 | (extra) | - | - |
| PACK SS | PONDERADA | CUOTA_PROPIA | 10 | (extra) | - | - |
| PxQ Portabilidad | PXQ_INDEPENDIENTE | CUOTA_GLOBAL_SS | - | - | - | Escala |
| NPS Venta | BONO | - | - | - | - | 75 |
| NPS Post Venta | BONO | - | - | - | - | 75 |

**Multiplicadores activos:**
- LOCK en PACK SS: MIN_QUANTITY ≥2 MEP → ×1.0/×0.0
- LOCK en VR CAPTURA: OWN_ATTAINMENT ≥70% → ×1.0/×0.0

### 7.2 Netcall — Esquema Gestor

**Configuración de esquema:**
```json
{
  "name": "Netcall Gestor",
  "scheme_type": "asesor",
  "fixed_salary": 1130,
  "variable_salary": 0,
  "total_ss_quota": null,
  "min_fulfillment_pct": null,
  "conversion_table": null,
  "global_range_method": "VOLUMEN_TOTAL"
}
```

**Partidas (todas PXQ_INDEPENDIENTE):**

| Nombre | contribution_type | range_source | Escala por rango global |
|--------|-------------------|-------------|------------------------|
| Porta | PXQ_INDEPENDIENTE | VOLUMEN_GLOBAL | 0→3.00, 1→5.50, ..., 7→28.50 |
| LLAA | PXQ_INDEPENDIENTE | VOLUMEN_GLOBAL | 0→3.00, 1→5.50, ..., 7→28.50 |
| Porta O.Pre | PXQ_INDEPENDIENTE | VOLUMEN_GLOBAL | 0→2.00, ..., 7→15.00 |
| Multi | PXQ_INDEPENDIENTE | VOLUMEN_GLOBAL | 0→2.00, ..., 6→22.00 |
| Pack Mono | PXQ_INDEPENDIENTE | VOLUMEN_GLOBAL | 0→3.00, ..., 7→8.00 |
| Pack Multi | PXQ_INDEPENDIENTE | VOLUMEN_GLOBAL | 0→5.00, ..., 7→8.00 |

**Multiplicadores:**
- LOCK en rango 0: "Solo gestores con <3 meses de antigüedad"

### 7.3 TPF — Esquema Asesor

**Configuración de esquema:**
```json
{
  "name": "TPF Asesor",
  "scheme_type": "asesor",
  "fixed_salary": 1130,
  "variable_salary": 1500,
  "total_ss_quota": 80,
  "min_fulfillment_pct": 70,
  "conversion_table": {
    "ranges": [
      { "min": 0, "max": 69.99, "effective": 0 },
      { "min": 70, "max": 74.99, "effective": 50 },
      { "min": 75, "max": 79.99, "effective": 60 },
      { "min": 80, "max": 84.99, "effective": 80 },
      { "min": 85, "max": 89.99, "effective": 85 },
      { "min": 90, "max": 94.99, "effective": 90 },
      { "min": 95, "max": 99.99, "effective": 95 },
      { "min": 100, "max": 100, "effective": 100 },
      { "min": 100.01, "max": 105, "effective": 105 },
      { "min": 105.01, "max": 110, "effective": 110 },
      { "min": 110.01, "max": 115, "effective": 115 },
      { "min": 115.01, "max": 999999, "effective": "+10" }
    ]
  },
  "global_range_method": null
}
```

**Partidas:**

| Nombre | contribution_type | range_source | usa_conv | Peso | Meta |
|--------|-------------------|-------------|---------|------|------|
| Porta SS OSS | PONDERADA | CUOTA_PROPIA | ✅ | 30% | 24 |
| VR SS + Porta SS OPP | PONDERADA | CUOTA_PROPIA | ✅ | 25% | 20 |
| Equipos Total | PONDERADA | CUOTA_PROPIA | ✅ | 25% | 20 |
| LLAA | ACELERADOR | CUOTA_PROPIA | ❌ | ±5% | 15 |
| CFG | ACELERADOR | CUOTA_PROPIA | ❌ | ±5% | 10 |
| Accesorios | ACELERADOR | CUOTA_PROPIA | ❌ | ±5% | 5 |
| Mis In | ACELERADOR | CUOTA_PROPIA | ❌ | ±5% | 8 |
| Prepago | PXQ_INDEPENDIENTE | CUOTA_PROPIA | ❌ | - | - |

**Multiplicadores:**
- TIERED cruzado en Equipos: Cumplimiento de Seguros → factor 70%-110%
  ```json
  { "min": 0, "max": 69.99, "factor": 0.70 },
  { "min": 70, "max": 79.99, "factor": 0.80 },
  { "min": 80, "max": 94.99, "factor": 0.90 },
  { "min": 95, "max": 100, "factor": 1.00 },
  { "min": 100.01, "max": 999999, "factor": 1.10 }
  ```

---

## PARTE 8: MIGRACIÓN SQL CONSOLIDADA

```sql
-- ============================================================================
-- MIGRACIÓN: Arquitectura Multi-Esquema v3.2
-- Módulo: Comisiones
-- Fecha: 2026-02-02
-- Prerequisitos: Migraciones 001-004 de comisiones ya ejecutadas
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE A: Nuevos campos en commission_schemes (Nivel 1)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE commission_schemes
  ADD COLUMN IF NOT EXISTS conversion_table JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS global_range_method VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accelerator_base VARCHAR(25) DEFAULT 'VARIABLE_TEORICO';

ALTER TABLE commission_schemes
  ADD CONSTRAINT commission_schemes_global_range_method_check
  CHECK (global_range_method IS NULL OR global_range_method IN ('VOLUMEN_TOTAL'));

ALTER TABLE commission_schemes
  ADD CONSTRAINT commission_schemes_accelerator_base_check
  CHECK (accelerator_base IN ('VARIABLE_TEORICO', 'VARIABLE_CALCULADO'));

COMMENT ON COLUMN commission_schemes.conversion_table IS 
  'Tabla de conversión no-lineal: mapea % cumplimiento real → % efectivo. Estructura: {ranges: [{min, max, effective, label}]}';
COMMENT ON COLUMN commission_schemes.global_range_method IS 
  'Método de rango global: NULL (cuota individual por partida), VOLUMEN_TOTAL (suma absoluta de ventas)';
COMMENT ON COLUMN commission_schemes.accelerator_base IS 
  'Base para aceleradores: VARIABLE_TEORICO (% del variable fijo), VARIABLE_CALCULADO (% del variable ya calculado)';

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE B: Nuevos campos en commission_scheme_items (Nivel 2)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(25) DEFAULT 'PONDERADA',
  ADD COLUMN IF NOT EXISTS range_source VARCHAR(25) DEFAULT 'CUOTA_PROPIA',
  ADD COLUMN IF NOT EXISTS uses_conversion_table BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS accelerator_ranges JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS measurement_type VARCHAR(20) DEFAULT 'UNIT_COUNT',
  ADD COLUMN IF NOT EXISTS fulfillment_method VARCHAR(20) DEFAULT 'RATIO',
  ADD COLUMN IF NOT EXISTS measurement_config JSONB DEFAULT NULL;

ALTER TABLE commission_scheme_items
  ADD CONSTRAINT commission_scheme_items_contribution_type_check
  CHECK (contribution_type IN ('PONDERADA', 'ACELERADOR', 'PXQ_INDEPENDIENTE', 'BONO'));

ALTER TABLE commission_scheme_items
  ADD CONSTRAINT commission_scheme_items_range_source_check
  CHECK (range_source IN ('CUOTA_PROPIA', 'VOLUMEN_GLOBAL', 'CUOTA_GLOBAL_SS'));

ALTER TABLE commission_scheme_items
  ADD CONSTRAINT commission_scheme_items_measurement_type_check
  CHECK (measurement_type IN ('UNIT_COUNT', 'AVERAGE_VALUE', 'TOTAL_VALUE', 'RATE', 'MANUAL'));

ALTER TABLE commission_scheme_items
  ADD CONSTRAINT commission_scheme_items_fulfillment_method_check
  CHECK (fulfillment_method IN ('RATIO', 'ABSOLUTE_RANGES'));

COMMENT ON COLUMN commission_scheme_items.contribution_type IS 
  'Cómo aporta al total: PONDERADA (peso% del variable), ACELERADOR (±% del variable), PXQ_INDEPENDIENTE (monto aparte), BONO (todo o nada)';
COMMENT ON COLUMN commission_scheme_items.range_source IS 
  'Fuente de input: CUOTA_PROPIA (Real/Meta propia), VOLUMEN_GLOBAL (total absoluto), CUOTA_GLOBAL_SS (% cuota SS total)';
COMMENT ON COLUMN commission_scheme_items.accelerator_ranges IS 
  'Rangos ±% para tipo ACELERADOR. Estructura: {source_item_name, ranges: [{min, max, pct_effect, label}]}';
COMMENT ON COLUMN commission_scheme_items.measurement_type IS 
  'Cómo se mide el logro: UNIT_COUNT (conteo ventas), AVERAGE_VALUE (promedio campo), TOTAL_VALUE (suma campo), RATE (ratio condición/total), MANUAL (input externo)';
COMMENT ON COLUMN commission_scheme_items.fulfillment_method IS 
  'Cómo se convierte logro a cumplimiento: RATIO (logro/meta), ABSOLUTE_RANGES (valor directo en rango)';
COMMENT ON COLUMN commission_scheme_items.measurement_config IS 
  'Config JSON según measurement_type. AVERAGE/TOTAL: {value_field}. RATE: {condition_field, condition_value, scope_tipos_venta}';

-- PARTE B.2: Campos de sobrecumplimiento (v3.0.1)

ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS overcompliance_mode VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cap_units DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS pxq_bonus_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS overcap_max_units DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS overcap_max_amount DECIMAL(12,2);

ALTER TABLE commission_scheme_items
  ADD CONSTRAINT commission_scheme_items_overcompliance_mode_check
  CHECK (overcompliance_mode IN ('none', 'proportional', 'pxq_bonus'));

-- Migrar datos existentes: si has_cap=true → proporcional con tope
UPDATE commission_scheme_items
SET overcompliance_mode = 'proportional'
WHERE has_cap = true AND (cap_percentage IS NOT NULL OR cap_amount IS NOT NULL);

COMMENT ON COLUMN commission_scheme_items.overcompliance_mode IS 
  'Modo de sobrecumplimiento: none (tope 100%), proportional, pxq_bonus';

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE C: Nueva tabla commission_item_multipliers (Nivel 3)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_item_multipliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES commission_scheme_items(id) ON DELETE CASCADE,
    
    -- Clasificación
    multiplier_type VARCHAR(20) NOT NULL,
    activation_criteria VARCHAR(25) NOT NULL,
    
    -- Descripción y origen
    source_description VARCHAR(200) NOT NULL,
    source_item_id UUID REFERENCES commission_scheme_items(id) ON DELETE SET NULL,
    
    -- Umbrales y factores
    threshold_value DECIMAL(10,2),
    factor_if_met DECIMAL(6,4) DEFAULT 1.0,
    factor_if_not_met DECIMAL(6,4) DEFAULT 0.0,
    
    -- Para tipo TIERED
    tiered_ranges JSONB,
    
    -- Para OPERATOR_ORIGIN
    operator_cedente VARCHAR(30),
    
    -- Medición compleja (v3.3)
    measurement_type VARCHAR(20) DEFAULT 'UNIT_COUNT',
    measurement_config JSONB,
    
    -- Control
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT multiplier_type_check CHECK (multiplier_type IN (
      'LOCK', 'ACCELERATOR', 'DECELERATOR', 'PROPORTIONAL', 'CROSS_PRODUCT', 'TIERED'
    )),
    CONSTRAINT activation_criteria_check CHECK (activation_criteria IN (
      'MIN_QUANTITY', 'OWN_ATTAINMENT', 'OTHER_ATTAINMENT', 
      'GLOBAL_ATTAINMENT', 'ATTAINMENT_RANGE', 'OPERATOR_ORIGIN'
    )),
    CONSTRAINT multiplier_measurement_type_check CHECK (measurement_type IN (
      'UNIT_COUNT', 'RATE', 'AVERAGE_VALUE', 'MANUAL'
    ))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_multipliers_item ON commission_item_multipliers(item_id);
CREATE INDEX IF NOT EXISTS idx_multipliers_source ON commission_item_multipliers(source_item_id);
CREATE INDEX IF NOT EXISTS idx_multipliers_type ON commission_item_multipliers(multiplier_type);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at ON commission_item_multipliers;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON commission_item_multipliers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- RLS
ALTER TABLE commission_item_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "multipliers_select_all" ON commission_item_multipliers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid())
    );

CREATE POLICY "multipliers_manage" ON commission_item_multipliers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL')
        )
    );

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE D: Migrar candados existentes a multiplicadores (retrocompatibilidad)
-- ────────────────────────────────────────────────────────────────────────────

-- Migrar commission_item_locks → commission_item_multipliers
INSERT INTO commission_item_multipliers (
    item_id, multiplier_type, activation_criteria,
    source_description, threshold_value,
    factor_if_met, factor_if_not_met, is_active
)
SELECT 
    il.item_id,
    'LOCK',
    'MIN_QUANTITY',
    'Migrado de candado: ' || COALESCE(il.lock_description, 'Sin descripción'),
    il.required_quantity,
    1.0,
    0.0,
    il.is_active
FROM commission_item_locks il
WHERE NOT EXISTS (
    SELECT 1 FROM commission_item_multipliers m 
    WHERE m.item_id = il.item_id 
    AND m.multiplier_type = 'LOCK'
    AND m.notes = 'migrated_from_locks'
);

-- Nota: NO eliminar commission_item_locks todavía. 
-- Mantener ambas tablas durante período de transición.
-- Eliminar commission_item_locks en versión futura después de verificar migración.

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE E: Configuraciones default en system_config
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO system_config (key, value, description, is_secret, category)
VALUES 
  ('DEFAULT_FIXED_SALARY', '1130', 'Sueldo fijo default para nuevos esquemas (Entel)', false, 'comisiones'),
  ('DEFAULT_VARIABLE_SALARY', '1200', 'Sueldo variable default para nuevos esquemas (Entel)', false, 'comisiones'),
  ('DEFAULT_MIN_FULFILLMENT', '50', 'Cumplimiento mínimo global default (%)', false, 'comisiones')
ON CONFLICT (key) DO NOTHING;
```

---

## PARTE 9: TIPOS TYPESCRIPT

```typescript
// ═══════════════════════════════════════════════════
// types/commissions.ts — v3.2
// ═══════════════════════════════════════════════════

// ── Nivel 1: Esquema ──────────────────────────────

type GlobalRangeMethod = 'VOLUMEN_TOTAL' | null;
type AcceleratorBase = 'VARIABLE_TEORICO' | 'VARIABLE_CALCULADO';

interface ConversionTableRange {
  min: number;
  max: number;
  effective: number | string; // number o "+10" para sin tope
  label?: string;
}

interface ConversionTable {
  description?: string;
  ranges: ConversionTableRange[];
}

interface CommissionScheme {
  id: string;
  name: string;
  code: string;
  scheme_type: 'asesor' | 'supervisor';
  year: number;
  month: number;
  status: 'oficial' | 'draft' | 'aprobado' | 'archivado';
  fixed_salary: number;
  variable_salary: number;
  total_ss_quota: number | null;
  min_fulfillment_pct: number | null;
  
  // v3.2 nuevos
  conversion_table: ConversionTable | null;
  global_range_method: GlobalRangeMethod;
  
  // v3.3 nuevo
  accelerator_base: AcceleratorBase;
  
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Nivel 2: Partida ──────────────────────────────

type ContributionType = 'PONDERADA' | 'ACELERADOR' | 'PXQ_INDEPENDIENTE' | 'BONO';
type RangeSource = 'CUOTA_PROPIA' | 'VOLUMEN_GLOBAL' | 'CUOTA_GLOBAL_SS';
type OvercomplianceMode = 'none' | 'proportional' | 'pxq_bonus';
type MeasurementType = 'UNIT_COUNT' | 'AVERAGE_VALUE' | 'TOTAL_VALUE' | 'RATE' | 'MANUAL';
type FulfillmentMethod = 'RATIO' | 'ABSOLUTE_RANGES';

interface MeasurementConfig {
  // Para AVERAGE_VALUE y TOTAL_VALUE
  value_field?: string;
  // Para RATE
  condition_field?: string;
  condition_value?: boolean | string | number;
  scope_tipos_venta?: string[];
  // Descripción general
  description?: string;
}

interface AcceleratorRange {
  min: number;
  max: number;
  pct_effect: number; // positivo = bonificación, negativo = descuento
  label?: string;
}

interface AcceleratorRanges {
  source_item_name?: string;
  ranges: AcceleratorRange[];
}

interface CommissionSchemeItem {
  id: string;
  scheme_id: string;
  name: string;
  category: 'principal' | 'adicional' | 'pxq' | 'bono';
  
  // Configuración base
  quota: number | null;
  weight: number | null;       // decimal (0.27 = 27%)
  mix_factor: number | null;   // decimal (0.27 = 27%)
  variable_amount: number | null;
  min_fulfillment: number | null;
  calculation_type: 'percentage' | 'pxq' | 'binary';
  
  // v3.2 nuevos
  contribution_type: ContributionType;
  range_source: RangeSource;
  uses_conversion_table: boolean;
  accelerator_ranges: AcceleratorRanges | null;
  
  // v3.3 nuevos
  measurement_type: MeasurementType;
  fulfillment_method: FulfillmentMethod;
  measurement_config: MeasurementConfig | null;
  
  // Sobrecumplimiento (v3.0.1)
  overcompliance_mode: OvercomplianceMode;
  has_cap: boolean;
  cap_percentage: number | null;
  cap_units: number | null;
  cap_amount: number | null;
  pxq_bonus_amount: number | null;
  overcap_max_units: number | null;
  overcap_max_amount: number | null;
  
  // Control
  is_active: boolean;
  display_order: number;
  notes: string | null;
}

// ── Nivel 3: Multiplicador ────────────────────────

type MultiplierType = 'LOCK' | 'ACCELERATOR' | 'DECELERATOR' | 'PROPORTIONAL' | 'CROSS_PRODUCT' | 'TIERED';
type ActivationCriteria = 'MIN_QUANTITY' | 'OWN_ATTAINMENT' | 'OTHER_ATTAINMENT' | 'GLOBAL_ATTAINMENT' | 'ATTAINMENT_RANGE' | 'OPERATOR_ORIGIN';
type MultiplierMeasurementType = 'UNIT_COUNT' | 'RATE' | 'AVERAGE_VALUE' | 'MANUAL';  // Subconjunto de MeasurementType

interface TieredRange {
  min: number;
  max: number;
  factor: number;
  label?: string;  // v3.3: label opcional para UI
}

interface CommissionItemMultiplier {
  id: string;
  item_id: string;
  multiplier_type: MultiplierType;
  activation_criteria: ActivationCriteria;
  source_description: string;
  source_item_id: string | null;
  threshold_value: number | null;
  factor_if_met: number;
  factor_if_not_met: number;
  tiered_ranges: TieredRange[] | null;
  operator_cedente: string | null;
  
  // v3.3 nuevos
  measurement_type: MultiplierMeasurementType;
  measurement_config: MeasurementConfig | null;
  
  is_active: boolean;
  display_order: number;
  notes: string | null;
}

// ── Datos de Venta para Motor de Cálculo (v3.3) ──

interface SalesData {
  unitCounts: Record<string, number>;                              // {partida_name: cantidad}
  manualValues?: Record<string, number>;                           // {kpi_name: valor}
  getFieldValues(itemName: string, field: string): number[];       // Valores de campo para AVERAGE
  getFieldSum(itemName: string, field: string): number;            // Suma de campo para TOTAL
  countMatching(itemName: string, field: string, value: any): number; // Conteo condicional para RATE
}

// ── Resultado del Motor de Cálculo ────────────────

interface CommissionResult {
  fixed_salary: number;
  variable_ponderadas: number;
  variable_aceleradores: number;
  variable_pxq: number;
  variable_bonos: number;
  total_bruto: number;
  penalidades: number;
  total_neto: number;
  
  // Desglose por partida
  items: ItemResult[];
}

interface ItemResult {
  item_id: string;
  item_name: string;
  contribution_type: ContributionType;
  input_value: number;            // % cumplimiento o volumen
  converted_value: number | null; // después de tabla conversión
  multiplier_factor: number;      // factor combinado
  overcompliance_extra: number;   // monto extra por sobrecumplimiento
  monto_calculado: number;        // monto final de esta partida
  
  // Detalle de multiplicadores
  multipliers_applied: {
    name: string;
    type: MultiplierType;
    factor: number;
  }[];
}
```

---

## PARTE 10: AI READINESS

### 10.1 Visión

GridRetail evoluciona de herramienta de registro a **plataforma de inteligencia comercial** con 3 capacidades AI futuras:

| Capacidad | Input | Output |
|-----------|-------|--------|
| **AI Diseñador** | Foco del mes + presupuesto + restricciones | Esquema draft con partidas y multiplicadores + proyección de costo |
| **AI Analista** | Foto/Excel de esquema externo | Clasificación de estructura, detección de incentivos, comparación |
| **AI Optimizador** | Esquema draft + presupuesto + # asesores | Escenarios de costo, distribución probable, ajustes |

### 10.2 ¿Cómo la Arquitectura v3.2 Habilita Esto?

**Para diseñar esquemas**, AI necesita un vocabulario de piezas combinables:
- `contribution_type`: 4 tipos de pieza (PONDERADA, ACELERADOR, PXQ, BONO)
- `range_source`: 3 fuentes de input
- `conversion_table`: Personalización de curva de pago
- `multiplier_type`: 6 tipos de modificador
- `activation_criteria`: 6 criterios de activación

AI combina estas piezas según objetivo estratégico → esquema draft listo para revisión.

**Para analizar esquemas externos**, AI mapea cualquier documento a la estructura interna:
- Esquema TPF → "3 PONDERADAS con conversion_table, 4 ACELERADORES ±5%, 1 TIERED cruzado"
- Esquema Netcall → "6 PXQ_INDEPENDIENTE con VOLUMEN_GLOBAL"
- La traducción es determinista, no requiere lógica especial

**Para optimizar**, AI usa `simulate_hc_commission()` programáticamente:
- Datos históricos de ventas por asesor
- Varía parámetros (pesos, metas, multiplicadores)
- Calcula costo total para N asesores en M escenarios
- Encuentra configuración que maximiza incentivo dentro de presupuesto

### 10.3 Qué NO Construir Ahora

| Concepto | Por qué no ahora |
|----------|-------------------|
| Layer AI (Claude API) | La base de datos y el motor de cálculo deben estar sólidos primero |
| Prompt engineering | Depende de las tablas finales — construir después de validar en producción |
| OCR de esquemas | Requiere fine-tuning — construir como feature separada |
| Optimización automática | Requiere datos históricos — primero acumular 3+ meses de operación |

### 10.4 Qué SÍ Asegurar Ahora

| Aspecto | Acción | Estado |
|---------|--------|--------|
| Vocabulario rico de piezas | contribution_type, range_source, multiplier_type | ✅ v3.2 |
| Tablas expresivas | conversion_table, accelerator_ranges, tiered_ranges (JSONB) | ✅ v3.2 |
| Motor de cálculo programático | simulate_hc_commission() con nuevos parámetros | 🔄 Actualizar |
| Esquemas de referencia documentados | TEX, Netcall, TPF como configuraciones JSON | ✅ v3.2 (Parte 7) |
| Datos históricos acumulándose | Ventas, cuotas, penalidades en producción | 🔄 En deployment |

---

## PARTE 11: CHECKLIST DE IMPLEMENTACIÓN

### Fase 1 — Base de Datos (prerequisito para todo lo demás)

- [ ] Ejecutar migración SQL consolidada (Parte 8)
- [ ] Verificar que constraint CASCADE existe en commission_scheme_items → commission_schemes
- [ ] Verificar migración de candados existentes a commission_item_multipliers
- [ ] Insertar configs default en system_config

### Fase 2 — Backend (funciones de cálculo)

- [ ] Actualizar `simulate_hc_commission()` para soportar contribution_type
- [ ] Agregar función `apply_conversion_table(pct, table)` 
- [ ] Agregar función `evaluate_multipliers(item_id, sales)`
- [ ] Agregar función `calculate_accelerator_effect(ranges, pct)`
- [ ] Actualizar `compare_commission_scenarios()` para nuevos tipos

### Fase 3 — Frontend Editor de Esquemas

- [ ] Agregar sección "Configuración Avanzada" (conversion_table, global_range_method)
- [ ] Agregar editor visual de tabla de conversión
- [ ] Agregar selector de contribution_type en modal de partida
- [ ] Agregar selector de range_source en modal de partida
- [ ] Campos condicionales según contribution_type (ver tabla 3.5)
- [ ] Editor de rangos de acelerador para tipo ACELERADOR
- [ ] Sección unificada "Candados y Multiplicadores" en modal de partida
- [ ] Modal "Agregar Multiplicador" con 4 tipos
- [ ] Factor combinado calculado en tiempo real

### Fase 4 — Frontend Sobrecumplimiento (de v3.0.1)

- [ ] Reemplazar "Tiene tope máximo" por sección Sobrecumplimiento
- [ ] 3 modalidades con radio buttons
- [ ] Proyección dinámica
- [ ] Vinculación de campos (cap_percentage ↔ cap_units ↔ cap_amount)

### Fase 5 — Simulador (actualización)

- [ ] Simulador soporta partidas ACELERADOR (muestra como +/- separado)
- [ ] Simulador muestra efecto de tabla de conversión
- [ ] Simulador muestra multiplicadores aplicados por partida
- [ ] Comparación de escenarios incluye nuevos tipos

### Fase 6 — Validación

- [ ] Configurar esquema TEX completo con nuevos atributos (debe calcular igual que antes)
- [ ] Configurar esquema Netcall de prueba (PxQ puro con volumen global)
- [ ] Configurar esquema TPF de prueba (tabla conversión + aceleradores)
- [ ] Verificar que motor de cálculo produce resultados correctos en 3 esquemas

---

## PARTE 12: RESUMEN DE OBJETOS DE BD NUEVOS/MODIFICADOS

### Tablas Modificadas

| Tabla | Columnas agregadas | Constraints nuevos |
|-------|--------------------|--------------------|
| `commission_schemes` | `conversion_table`, `global_range_method`, `accelerator_base` (v3.3) | CHECK global_range_method, CHECK accelerator_base |
| `commission_scheme_items` | `contribution_type`, `range_source`, `uses_conversion_table`, `accelerator_ranges`, `overcompliance_mode`, `cap_units`, `pxq_bonus_amount`, `overcap_max_units`, `overcap_max_amount`, `measurement_type` (v3.3), `fulfillment_method` (v3.3), `measurement_config` (v3.3) | CHECK contribution_type, range_source, overcompliance_mode, measurement_type, fulfillment_method |

### Tablas Nuevas

| Tabla | Descripción | Columnas |
|-------|-------------|----------|
| `commission_item_multipliers` | Multiplicadores unificados (reemplaza gradualmente commission_item_locks) | 17 columnas (15 base + 2 v3.3: measurement_type, measurement_config) |

### Conteo de Campos Nuevos por Versión

| Versión | Tabla | Campos | Detalle |
|---------|-------|--------|---------|
| v3.2 | commission_schemes | 2 | conversion_table, global_range_method |
| v3.2 | commission_scheme_items | 4 | contribution_type, range_source, uses_conversion_table, accelerator_ranges |
| v3.0.1 | commission_scheme_items | 5 | overcompliance_mode, cap_units, pxq_bonus_amount, overcap_max_units, overcap_max_amount |
| v3.2 | commission_item_multipliers | 15 | Nueva tabla completa |
| **v3.3** | **commission_schemes** | **1** | **accelerator_base** |
| **v3.3** | **commission_scheme_items** | **3** | **measurement_type, fulfillment_method, measurement_config** |
| **v3.3** | **commission_item_multipliers** | **2** | **measurement_type, measurement_config** |

### Conteo Actualizado de Objetos

| Módulo | Antes | Después v3.3 | Cambio |
|--------|-------|-------------|--------|
| Comisiones - Tablas | 7 | 8 (+1) | +commission_item_multipliers |
| Comisiones - Funciones | 5 | 5 (actualizar) | Modificar existentes |
| **Total BD** | **30 tablas** | **31 tablas** | +1 tabla, +6 campos nuevos en v3.3 |

---

**Este documento es la FUENTE DE VERDAD para la arquitectura multi-esquema de GridRetail.** Debe leerse junto con v3.0 (bugs y lógica base) y actualizarse cuando se implementen cambios.

---

**Documentos relacionados:**
- `EDITOR_ESQUEMAS_SPEC_v3.0.md` — Bugs y lógica base de partidas
- `EDITOR_ESQUEMAS_SPEC_v3.0.1_sobrecumplimiento.md` — Detalle completo UI sobrecumplimiento
- `ANALISIS_MULTIPLICADORES_CANDADOS.md` — Investigación de industria
- `DATA_DICTIONARY.md` — Diccionario de datos (actualizar tras migración)
- `CHANGELOG_COMISIONES.md` — Historial de cambios del módulo

**Nota v3.3:** Los 6 campos nuevos (accelerator_base, measurement_type ×2, fulfillment_method, measurement_config ×2) son extensiones backward-compatible. Todos tienen defaults que preservan el comportamiento existente (VARIABLE_TEORICO, UNIT_COUNT, RATIO, NULL). No requieren cambios en esquemas ya creados.
