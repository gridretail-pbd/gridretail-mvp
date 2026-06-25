# Simulador de Ingresos HC - Especificación Frontend
## GridRetail - Modelador de Comisiones HC

**Versión:** 2.0  
**Fecha:** 2026-02-03  
**Para:** Claude Code - Desarrollo Frontend  
**Alcance:** Esquemas TEX/PBD (WEIGHTED_SUM)

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| **2.0** | **2026-02-03** | **Actualización mayor para Comisiones v3.4**: Motor de cálculo universal 6 pasos, sistema de multiplicadores (reemplaza candados legacy), sobrecumplimiento (3 modalidades), tipos de medición complejos, variable_source para adicionales, nuevos tipos TypeScript |
| 1.2 | 2026-01-27 | Integración con Módulo de Cuotas v2.3 |
| 1.1 | 2026-01-25 | Mapeo flexible de partidas (v2.1 BD) |
| 1.0 | 2026-01-25 | Versión inicial |

---

## 1. RESUMEN EJECUTIVO

### 1.1 Propósito de v2.0

Esta versión actualiza el Simulador para soportar la **nueva arquitectura de comisiones v3.4**, que incluye:

| Característica | v1.2 (anterior) | v2.0 (nuevo) |
|----------------|-----------------|--------------|
| **Candados** | `commission_item_locks` (legacy) | `commission_item_multipliers` (6 tipos) |
| **Sobrecumplimiento** | `has_cap` + `cap_percentage` | `overcompliance_mode` (3 modalidades) |
| **Cálculo de contribución** | Solo `percentage` | `contribution_type` (4 tipos) |
| **Medición de logro** | Solo conteo unidades | `measurement_type` (5 tipos) |
| **Variable de partida** | Siempre desde Mix | `variable_source` (FROM_MIX / FIXED_EXTRA) |
| **Motor de cálculo** | Simplificado | Universal 6 pasos |

### 1.2 Esquemas Soportados

Esta versión está diseñada para **esquemas TEX/PBD** con:
- `contribution_type`: `PONDERADA` (weighted sum)
- `range_source`: `CUOTA_PROPIA` (item own)

Esquemas Netcall (PXQ_ONLY) y TPF (GLOBAL_CONVERSION_TABLE) se implementarán en v2.1.

### 1.3 Integración de Módulos (actualizado)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE DATOS → SIMULADOR v2.0                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   CUOTAS    │     │ COMISIONES  │     │    INAR     │                   │
│  │             │     │    v3.4     │     │             │                   │
│  │ • hc_quotas │     │ • schemes   │     │ lineas_inar │                   │
│  │ • ss_quota  │     │ • items     │     │ (ventas     │                   │
│  │ • breakdown │     │ • multi-    │     │  oficiales) │                   │
│  │ • prorrateo │     │   pliers    │     │             │                   │
│  └──────┬──────┘     │ • pxq_scales│     └──────┬──────┘                   │
│         │            └──────┬──────┘            │                          │
│         │                   │                   │                          │
│         │    get_hc_        │                   │                          │
│         │    effective_     │                   │                          │
│         │    quota()        │                   │                          │
│         │                   │                   │                          │
│         └───────────────────┼───────────────────┘                          │
│                             │                                              │
│                             ▼                                              │
│                   ┌─────────────────────┐                                  │
│                   │   SIMULADOR v2.0    │                                  │
│                   │                     │                                  │
│                   │ Motor 6 pasos:      │                                  │
│                   │ 1. Medir logro      │                                  │
│                   │ 2. Calcular contrib.│                                  │
│                   │ 3. Sumar ponderadas │                                  │
│                   │ 4. Evaluar multip.  │                                  │
│                   │ 5. Sobrecumplim.    │                                  │
│                   │ 6. Calcular neto    │                                  │
│                   └──────────┬──────────┘                                  │
│                              │                                             │
│         ┌────────────────────┼────────────────────┐                        │
│         │                    │                    │                        │
│         ▼                    ▼                    ▼                        │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │ PENALIDADES │     │  RESULTADO  │     │   PERFIL    │                   │
│  │             │     │             │     │             │                   │
│  │ predict_hc_ │     │ Fijo+Var+   │     │ average,    │                   │
│  │ penalties() │     │ PxQ+Bonos   │     │ top20, etc  │                   │
│  └─────────────┘     │ -Penalid.   │     └─────────────┘                   │
│                      │ +Sobrecump. │                                       │
│                      └─────────────┘                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ANÁLISIS DE GAP (v1.2 → v2.0)

### 2.1 Archivos a Modificar

| Archivo | Cambios Necesarios | Prioridad |
|---------|-------------------|-----------|
| `lib/simulador/types.ts` | Nuevas interfaces para multipliers, sobrecumplimiento, measurement | 🔴 Alta |
| `lib/simulador/hooks.ts` | Cargar multipliers, actualizar cálculo local | 🔴 Alta |
| `lib/comisiones/types.ts` | Nuevos tipos de BD (si no existen) | 🔴 Alta |
| `components/simulador/ResultBreakdown.tsx` | Mostrar multiplicadores, sobrecumplimiento | 🟡 Media |
| `components/simulador/SalesInputTable.tsx` | Soporte measurement_type RATE/AVERAGE | 🟡 Media |
| `components/simulador/SimulationResult.tsx` | Nuevo desglose con sobrecumplimiento | 🟡 Media |

### 2.2 Nuevos Campos BD a Consumir

#### En `commission_schemes`:
```typescript
accelerator_base: 'VARIABLE_TEORICO' | 'VARIABLE_CALCULADO'
conversion_table: JSONB | null
global_range_method: 'CUMPLIMIENTO_DIRECTO' | 'TABLA_CONVERSION'
```

#### En `commission_scheme_items`:
```typescript
// Contribución y rango
contribution_type: 'PONDERADA' | 'ACELERADOR' | 'PXQ_INDEPENDIENTE' | 'BONO'
range_source: 'CUOTA_PROPIA' | 'VOLUMEN_GLOBAL' | 'CUOTA_GLOBAL_SS'
uses_conversion_table: boolean
accelerator_ranges: JSONB | null

// Sobrecumplimiento (v3.0.1)
overcompliance_mode: 'none' | 'proportional' | 'pxq_bonus'
cap_units: number | null
pxq_bonus_amount: number | null
overcap_max_units: number | null
overcap_max_amount: number | null

// Medición compleja (v3.3)
measurement_type: 'UNIT_COUNT' | 'AVERAGE_VALUE' | 'TOTAL_VALUE' | 'RATE' | 'MANUAL'
fulfillment_method: 'RATIO' | 'ABSOLUTE_RANGES'
measurement_config: JSONB | null

// Fuente de variable (v3.4)
variable_source: 'FROM_MIX' | 'FIXED_EXTRA'
```

#### Nueva tabla `commission_item_multipliers`:
```typescript
interface CommissionItemMultiplier {
  id: string
  item_id: string
  multiplier_type: 'LOCK' | 'ACCELERATOR' | 'DECELERATOR' | 'PROPORTIONAL' | 'CROSS_PRODUCT' | 'TIERED'
  activation_criteria: 'MIN_QUANTITY' | 'OWN_ATTAINMENT' | 'OTHER_ATTAINMENT' | 'GLOBAL_ATTAINMENT' | 'ATTAINMENT_RANGE' | 'OPERATOR_ORIGIN'
  source_description: string
  source_item_id: string | null
  threshold_value: number | null
  factor_if_met: number
  factor_if_not_met: number
  tiered_ranges: TieredRanges | null
  operator_cedente: string | null
  measurement_type: 'UNIT_COUNT' | 'RATE' | 'AVERAGE_VALUE' | 'MANUAL'
  measurement_config: JSONB | null
  is_active: boolean
  display_order: number
}
```

---

## 3. NUEVOS TIPOS TYPESCRIPT

### 3.1 types.ts - Nuevas Interfaces

```typescript
// ============================================================================
// TIPOS DE COMISIONES v3.4 (NUEVO)
// ============================================================================

/**
 * Tipo de contribución de una partida al total
 */
export type ContributionType = 
  | 'PONDERADA'           // Contribuye con peso% al variable
  | 'ACELERADOR'          // Ajusta ±% del variable base
  | 'PXQ_INDEPENDIENTE'   // Monto independiente por unidad
  | 'BONO'                // Todo o nada si cumple condición

/**
 * Fuente del rango para calcular cumplimiento
 */
export type RangeSource = 
  | 'CUOTA_PROPIA'        // Cuota de la partida (TEX)
  | 'VOLUMEN_GLOBAL'      // Volumen total vendido
  | 'CUOTA_GLOBAL_SS'     // Cuota global SS del esquema

/**
 * Modo de sobrecumplimiento
 */
export type OvercomplianceMode = 
  | 'none'                // Comisión se detiene al 100%
  | 'proportional'        // Continúa proporcional (con o sin tope)
  | 'pxq_bonus'           // A partir del 100%, paga monto por unidad extra

/**
 * Tipo de medición del logro
 */
export type MeasurementType = 
  | 'UNIT_COUNT'          // Conteo de ventas (default)
  | 'AVERAGE_VALUE'       // Promedio de un campo (ej: cargo fijo)
  | 'TOTAL_VALUE'         // Suma de un campo (ej: ingresos)
  | 'RATE'                // Ratio condición/total × 100
  | 'MANUAL'              // Valor externo (ej: NPS)

/**
 * Método de cálculo del cumplimiento
 */
export type FulfillmentMethod = 
  | 'RATIO'               // (logro / meta) × 100
  | 'ABSOLUTE_RANGES'     // Valor directo busca en rangos

/**
 * Fuente del variable de la partida
 */
export type VariableSource = 
  | 'FROM_MIX'            // Variable = mix_factor × variable_salary
  | 'FIXED_EXTRA'         // Variable es monto fijo independiente

// ============================================================================
// TIPOS DE MULTIPLICADORES (v3.2)
// ============================================================================

/**
 * Tipos de multiplicador
 */
export type MultiplierType = 
  | 'LOCK'                // Candado binario (0 o 1)
  | 'ACCELERATOR'         // Bonus por buen desempeño (>1)
  | 'DECELERATOR'         // Penalización por bajo desempeño (<1)
  | 'PROPORTIONAL'        // Factor proporcional al cumplimiento
  | 'CROSS_PRODUCT'       // Factor depende de otra partida
  | 'TIERED'              // Factor según rangos escalonados

/**
 * Criterio de activación del multiplicador
 */
export type ActivationCriteria = 
  | 'MIN_QUANTITY'        // Cantidad mínima vendida
  | 'OWN_ATTAINMENT'      // % cumplimiento de esta partida
  | 'OTHER_ATTAINMENT'    // % cumplimiento de otra partida
  | 'GLOBAL_ATTAINMENT'   // % cumplimiento global SS
  | 'ATTAINMENT_RANGE'    // Rango de cumplimiento
  | 'OPERATOR_ORIGIN'     // % de ventas de un operador

/**
 * Rango para multiplicadores TIERED
 */
export interface TieredRange {
  min: number
  max: number | null      // null = sin límite
  factor: number
  label: string
}

/**
 * Configuración de rangos escalonados
 */
export interface TieredRanges {
  ranges: TieredRange[]
}

/**
 * Multiplicador de una partida
 */
export interface ItemMultiplier {
  id: string
  itemId: string
  multiplierType: MultiplierType
  activationCriteria: ActivationCriteria
  sourceDescription: string
  sourceItemId: string | null
  thresholdValue: number | null
  factorIfMet: number
  factorIfNotMet: number
  tieredRanges: TieredRanges | null
  operatorCedente: string | null
  measurementType: MeasurementType
  measurementConfig: MeasurementConfig | null
  isActive: boolean
  displayOrder: number
}

/**
 * Estado de evaluación de un multiplicador
 */
export interface MultiplierEvaluation {
  multiplier: ItemMultiplier
  conditionMet: boolean
  appliedFactor: number
  currentValue: number        // Valor actual del criterio evaluado
  requiredValue: number | null // Valor requerido (umbral)
  description: string         // Descripción para UI
}

// ============================================================================
// CONFIGURACIÓN DE MEDICIÓN (v3.3)
// ============================================================================

/**
 * Config para AVERAGE_VALUE / TOTAL_VALUE
 */
export interface MeasurementConfigValue {
  value_field: string         // Campo a agregar (ej: "cargo_fijo")
  description: string
}

/**
 * Config para RATE
 */
export interface MeasurementConfigRate {
  condition_field: string     // Campo a evaluar (ej: "tiene_descuento")
  condition_value: boolean | string | number
  scope_tipos_venta?: string[] // Tipos de venta a incluir
  description: string
}

/**
 * Configuración de medición (union type)
 */
export type MeasurementConfig = MeasurementConfigValue | MeasurementConfigRate

// ============================================================================
// CONFIGURACIÓN DE SOBRECUMPLIMIENTO (v3.0.1)
// ============================================================================

/**
 * Configuración de sobrecumplimiento de una partida
 */
export interface OvercomplianceConfig {
  mode: OvercomplianceMode
  capUnits: number | null           // Unidades máximas (proportional)
  pxqBonusAmount: number | null     // Monto por unidad extra (pxq_bonus)
  overcapMaxUnits: number | null    // Máximo unidades bonus
  overcapMaxAmount: number | null   // Máximo monto bonus
}

/**
 * Resultado de sobrecumplimiento
 */
export interface OvercomplianceResult {
  mode: OvercomplianceMode
  baseCommission: number            // Comisión hasta 100%
  bonusCommission: number           // Comisión adicional por sobrecumplimiento
  bonusUnits: number                // Unidades sobre la meta
  cappedUnits: number | null        // Unidades después de aplicar tope
  cappedAmount: number | null       // Monto después de aplicar tope
  totalCommission: number
}

// ============================================================================
// PARTIDA ACTUALIZADA (v2.0)
// ============================================================================

/**
 * Partida con todos los campos v3.4
 */
export interface SchemeItemV2 {
  id: string
  scheme_id: string
  item_type_id: string | null
  preset_id: string | null
  custom_name: string | null
  custom_description: string | null
  
  // Cuota y peso
  quota: number | null
  weight_percent: number | null
  variable_amount: number
  variable_source: VariableSource
  mix_factor: number | null
  
  // Contribución y rango
  contribution_type: ContributionType
  range_source: RangeSource
  uses_conversion_table: boolean
  
  // Cumplimiento
  min_fulfillment: number | null
  calculation_type: CalculationType
  
  // Sobrecumplimiento
  overcompliance_mode: OvercomplianceMode
  cap_units: number | null
  pxq_bonus_amount: number | null
  overcap_max_units: number | null
  overcap_max_amount: number | null
  
  // Medición
  measurement_type: MeasurementType
  fulfillment_method: FulfillmentMethod
  measurement_config: MeasurementConfig | null
  
  // Aceleradores individuales
  accelerator_ranges: TieredRanges | null
  
  // Metadatos
  display_order: number
  is_active: boolean
  notes: string | null
  
  // Joins
  item_type?: ItemTypeInfo | null
  preset?: PresetInfo | null
  mapped_tipos_venta: TipoVentaMapping[]
  multipliers: ItemMultiplier[]
  pxq_scales?: PxQScale[]
}

// ============================================================================
// RESULTADO DE SIMULACIÓN ACTUALIZADO (v2.0)
// ============================================================================

/**
 * Detalle de partida en resultado (v2.0)
 */
export interface ItemDetailV2 {
  // Identificación
  id: string
  name: string
  itemTypeCode: string | null
  presetCode: string | null
  customName: string | null
  category: ItemCategory
  
  // Tipo de cálculo
  calculationType: CalculationType
  contributionType: ContributionType
  measurementType: MeasurementType
  variableSource: VariableSource
  
  // Cuotas
  quota: number | null
  effectiveQuota: number | null       // Con prorrateo
  weight: number | null
  variableAmount: number
  
  // Ventas y cumplimiento
  sales: number                       // Valor medido (unidades, promedio, etc.)
  salesRaw: number                    // Unidades brutas siempre
  fulfillment: number                 // % cumplimiento
  effectiveFulfillment: number        // % después de topes
  meetsMinimum: boolean
  minFulfillment: number
  
  // Multiplicadores (v2.0 - reemplaza lockUnlocked/lockPending)
  multipliersEvaluated: MultiplierEvaluation[]
  combinedMultiplierFactor: number    // Producto de todos los factores
  hasBlockingMultiplier: boolean      // Si algún factor = 0
  
  // Sobrecumplimiento (v2.0)
  overcomplianceResult: OvercomplianceResult | null
  
  // Restricciones (legacy, migrar a multipliers)
  restrictionApplied: boolean
  restrictionDetail: string | null
  
  // Comisión
  baseCommission: number              // Antes de multiplicadores
  adjustedCommission: number          // Después de multiplicadores
  bonusFromOvercompliance: number     // Bono por sobrecumplimiento
  commission: number                  // Total final
  
  // Mapeo
  tiposVentaMapeados: TipoVentaMapping[]
}

/**
 * Resultado principal de simulación (v2.0)
 */
export interface SimulationResultV2 {
  // Componentes de ingreso
  fixedSalary: number
  variableCommission: number          // Partidas PONDERADA
  acceleratorAdjustment: number       // Partidas ACELERADOR (±%)
  pxqCommission: number               // Partidas PXQ_INDEPENDIENTE
  bonusCommission: number             // Partidas BONO
  additionalCommission: number        // Partidas con variable_source = FIXED_EXTRA
  overcomplianceBonus: number         // Total bonos por sobrecumplimiento
  
  // Totales
  totalGross: number
  predictedPenalties: number
  totalNet: number
  
  // Cumplimiento global
  globalFulfillment: number
  globalSSQuota: number
  globalSSSales: number
  
  // Detalles
  details: ItemDetailV2[]
  
  // Info de cuota (v1.2)
  quotaInfo?: QuotaInfo
  
  // Metadatos de cálculo (v2.0)
  calculationMetadata: {
    schemeType: 'asesor' | 'supervisor' | 'encargado'
    acceleratorBase: 'VARIABLE_TEORICO' | 'VARIABLE_CALCULADO'
    totalMultiplierFactors: number
    hasConversionTable: boolean
    calculationSteps: string[]        // Log de pasos para debugging
  }
}
```

---

## 4. MOTOR DE CÁLCULO UNIVERSAL (6 PASOS)

### 4.1 Algoritmo

```typescript
/**
 * Motor de cálculo de comisiones v2.0
 * Sigue el algoritmo universal de 6 pasos documentado en EDITOR_ESQUEMAS_SPEC_v3.3.md
 */
function calculateCommissionV2(
  scheme: SchemeForSimulationV2,
  salesData: SalesData,
  hcQuota?: HCEffectiveQuota
): SimulationResultV2 {
  const steps: string[] = []
  const details: ItemDetailV2[] = []
  
  // Factor de prorrateo
  const prorationFactor = hcQuota?.proration_factor ?? 1
  steps.push(`Prorrateo: ${(prorationFactor * 100).toFixed(1)}%`)
  
  // Acumuladores por tipo de contribución
  let variableCommission = 0      // PONDERADA
  let acceleratorAdjustment = 0   // ACELERADOR
  let pxqCommission = 0           // PXQ_INDEPENDIENTE
  let bonusCommission = 0         // BONO
  let additionalCommission = 0    // variable_source = FIXED_EXTRA
  let overcomplianceBonus = 0     // Sobrecumplimiento total
  
  // Totales para cumplimiento global
  let totalSSQuota = 0
  let totalSSSales = 0
  
  // =========================================================================
  // PASO 1: Medir logro por partida
  // =========================================================================
  steps.push('Paso 1: Medir logro por partida')
  
  const itemMeasurements: Map<string, {
    item: SchemeItemV2
    measuredValue: number
    rawUnits: number
    quota: number
    effectiveQuota: number
  }> = new Map()
  
  for (const item of scheme.items) {
    if (!item.is_active) continue
    
    const itemName = getEffectiveItemName(item)
    const rawUnits = salesData[itemName] || 0
    
    // Determinar cuota (de hc_quotas o del esquema)
    let quota = item.quota || 0
    if (hcQuota?.has_quota && hcQuota.quota_breakdown[itemName]) {
      quota = hcQuota.quota_breakdown[itemName]
    }
    const effectiveQuota = Math.round(quota * prorationFactor * 10) / 10
    
    // Medir según measurement_type
    let measuredValue = rawUnits // Default: UNIT_COUNT
    
    if (item.measurement_type === 'AVERAGE_VALUE' && item.measurement_config) {
      // TODO: Calcular promedio desde datos detallados
      measuredValue = rawUnits // Placeholder
    } else if (item.measurement_type === 'TOTAL_VALUE' && item.measurement_config) {
      // TODO: Calcular suma desde datos detallados
      measuredValue = rawUnits // Placeholder
    } else if (item.measurement_type === 'RATE' && item.measurement_config) {
      // TODO: Calcular ratio desde datos detallados
      measuredValue = rawUnits // Placeholder
    }
    
    itemMeasurements.set(item.id, {
      item,
      measuredValue,
      rawUnits,
      quota,
      effectiveQuota
    })
    
    // Acumular para cumplimiento global SS (solo partidas principales)
    if (getEffectiveCategory(item) === 'principal') {
      totalSSQuota += effectiveQuota
      totalSSSales += measuredValue
    }
  }
  
  // =========================================================================
  // PASO 2: Calcular contribución según contribution_type
  // =========================================================================
  steps.push('Paso 2: Calcular contribución por tipo')
  
  const itemContributions: Map<string, {
    fulfillment: number
    effectiveFulfillment: number
    meetsMinimum: boolean
    baseCommission: number
    contributionType: ContributionType
  }> = new Map()
  
  for (const [itemId, measurement] of itemMeasurements) {
    const { item, measuredValue, effectiveQuota } = measurement
    
    // Calcular cumplimiento según fulfillment_method
    let fulfillment = 0
    if (item.fulfillment_method === 'RATIO' && effectiveQuota > 0) {
      fulfillment = measuredValue / effectiveQuota
    } else if (item.fulfillment_method === 'ABSOLUTE_RANGES') {
      // Valor directo busca en rangos, no hay "cumplimiento" tradicional
      fulfillment = measuredValue / 100 // Normalizar para compatibilidad
    }
    
    // Verificar mínimo
    const minFulfillment = item.min_fulfillment || scheme.default_min_fulfillment || 0
    const meetsMinimum = fulfillment >= minFulfillment
    
    // Calcular comisión base según contribution_type
    let baseCommission = 0
    
    if (meetsMinimum) {
      switch (item.contribution_type) {
        case 'PONDERADA':
          // Comisión = variable_amount × cumplimiento efectivo
          let effectiveFulfillment = fulfillment
          // Aplicar tope legacy si existe y no hay overcompliance_mode
          if (item.overcompliance_mode === 'none' && fulfillment > 1) {
            effectiveFulfillment = 1
          }
          baseCommission = item.variable_amount * effectiveFulfillment
          break
          
        case 'PXQ_INDEPENDIENTE':
          // Buscar escala aplicable
          if (item.pxq_scales?.length) {
            const scale = findApplicablePxQScale(item.pxq_scales, fulfillment * 100)
            if (scale) {
              baseCommission = measurement.rawUnits * scale.amount_per_unit
            }
          }
          break
          
        case 'BONO':
          // Todo o nada
          baseCommission = fulfillment >= 1 ? item.variable_amount : 0
          break
          
        case 'ACELERADOR':
          // Se calcula después (en paso 4)
          baseCommission = 0
          break
      }
    }
    
    itemContributions.set(itemId, {
      fulfillment,
      effectiveFulfillment: fulfillment,
      meetsMinimum,
      baseCommission,
      contributionType: item.contribution_type
    })
  }
  
  // =========================================================================
  // PASO 3: Sumar ponderadas → variable base
  // =========================================================================
  steps.push('Paso 3: Sumar comisiones ponderadas')
  
  let variableBase = 0
  for (const [itemId, contribution] of itemContributions) {
    if (contribution.contributionType === 'PONDERADA') {
      variableBase += contribution.baseCommission
    }
  }
  
  // =========================================================================
  // PASO 4: Evaluar multiplicadores
  // =========================================================================
  steps.push('Paso 4: Evaluar multiplicadores')
  
  // Calcular cumplimiento global (necesario para GLOBAL_ATTAINMENT)
  const globalFulfillment = totalSSQuota > 0 ? totalSSSales / totalSSQuota : 0
  
  const itemMultiplierResults: Map<string, {
    evaluations: MultiplierEvaluation[]
    combinedFactor: number
    hasBlocking: boolean
    adjustedCommission: number
  }> = new Map()
  
  for (const [itemId, measurement] of itemMeasurements) {
    const { item } = measurement
    const contribution = itemContributions.get(itemId)!
    
    const evaluations: MultiplierEvaluation[] = []
    let combinedFactor = 1
    let hasBlocking = false
    
    for (const mult of item.multipliers) {
      if (!mult.isActive) continue
      
      const evaluation = evaluateMultiplier(
        mult,
        measurement,
        contribution,
        itemMeasurements,
        itemContributions,
        globalFulfillment
      )
      
      evaluations.push(evaluation)
      combinedFactor *= evaluation.appliedFactor
      
      if (evaluation.appliedFactor === 0) {
        hasBlocking = true
      }
    }
    
    // Aplicar factor combinado a la comisión base
    const adjustedCommission = contribution.baseCommission * combinedFactor
    
    itemMultiplierResults.set(itemId, {
      evaluations,
      combinedFactor,
      hasBlocking,
      adjustedCommission
    })
  }
  
  // =========================================================================
  // PASO 5: Calcular sobrecumplimiento
  // =========================================================================
  steps.push('Paso 5: Calcular sobrecumplimiento')
  
  const itemOvercompliance: Map<string, OvercomplianceResult | null> = new Map()
  
  for (const [itemId, measurement] of itemMeasurements) {
    const { item, measuredValue, effectiveQuota } = measurement
    const contribution = itemContributions.get(itemId)!
    const multiplierResult = itemMultiplierResults.get(itemId)!
    
    let overcompResult: OvercomplianceResult | null = null
    
    // Solo si cumple mínimo y no está bloqueado
    if (contribution.meetsMinimum && !multiplierResult.hasBlocking) {
      overcompResult = calculateOvercompliance(
        item,
        contribution.fulfillment,
        measuredValue,
        effectiveQuota,
        multiplierResult.adjustedCommission
      )
      
      if (overcompResult && overcompResult.bonusCommission > 0) {
        overcomplianceBonus += overcompResult.bonusCommission
      }
    }
    
    itemOvercompliance.set(itemId, overcompResult)
  }
  
  // =========================================================================
  // PASO 6: Calcular neto
  // =========================================================================
  steps.push('Paso 6: Calcular totales')
  
  // Construir detalles y acumular totales
  for (const [itemId, measurement] of itemMeasurements) {
    const { item, measuredValue, rawUnits, quota, effectiveQuota } = measurement
    const contribution = itemContributions.get(itemId)!
    const multiplierResult = itemMultiplierResults.get(itemId)!
    const overcompResult = itemOvercompliance.get(itemId)
    
    const category = getEffectiveCategory(item)
    const bonusFromOvercomp = overcompResult?.bonusCommission || 0
    const finalCommission = multiplierResult.adjustedCommission + bonusFromOvercomp
    
    // Acumular por tipo
    if (item.variable_source === 'FIXED_EXTRA') {
      additionalCommission += finalCommission
    } else {
      switch (item.contribution_type) {
        case 'PONDERADA':
          variableCommission += finalCommission
          break
        case 'ACELERADOR':
          // Los aceleradores ajustan el variable base
          acceleratorAdjustment += finalCommission
          break
        case 'PXQ_INDEPENDIENTE':
          pxqCommission += finalCommission
          break
        case 'BONO':
          bonusCommission += finalCommission
          break
      }
    }
    
    // Construir detalle
    details.push({
      id: itemId,
      name: getDisplayName(item),
      itemTypeCode: item.item_type?.code || null,
      presetCode: item.preset?.code || null,
      customName: item.custom_name,
      category: category as ItemCategory,
      calculationType: item.calculation_type,
      contributionType: item.contribution_type,
      measurementType: item.measurement_type,
      variableSource: item.variable_source,
      quota,
      effectiveQuota,
      weight: item.weight_percent,
      variableAmount: item.variable_amount,
      sales: measuredValue,
      salesRaw: rawUnits,
      fulfillment: contribution.fulfillment,
      effectiveFulfillment: contribution.effectiveFulfillment,
      meetsMinimum: contribution.meetsMinimum,
      minFulfillment: item.min_fulfillment || scheme.default_min_fulfillment || 0,
      multipliersEvaluated: multiplierResult.evaluations,
      combinedMultiplierFactor: multiplierResult.combinedFactor,
      hasBlockingMultiplier: multiplierResult.hasBlocking,
      overcomplianceResult: overcompResult,
      restrictionApplied: false,
      restrictionDetail: null,
      baseCommission: contribution.baseCommission,
      adjustedCommission: multiplierResult.adjustedCommission,
      bonusFromOvercompliance: bonusFromOvercomp,
      commission: finalCommission,
      tiposVentaMapeados: item.mapped_tipos_venta
    })
  }
  
  // Calcular totales
  const totalGross = scheme.fixed_salary + 
    variableCommission + 
    acceleratorAdjustment + 
    pxqCommission + 
    bonusCommission + 
    additionalCommission +
    overcomplianceBonus
  
  return {
    fixedSalary: scheme.fixed_salary,
    variableCommission,
    acceleratorAdjustment,
    pxqCommission,
    bonusCommission,
    additionalCommission,
    overcomplianceBonus,
    totalGross,
    predictedPenalties: 0, // Se calcula aparte
    totalNet: totalGross,
    globalFulfillment,
    globalSSQuota: totalSSQuota,
    globalSSSales: totalSSSales,
    details,
    calculationMetadata: {
      schemeType: scheme.scheme_type,
      acceleratorBase: scheme.accelerator_base || 'VARIABLE_TEORICO',
      totalMultiplierFactors: details.reduce((sum, d) => sum + d.combinedMultiplierFactor, 0) / details.length,
      hasConversionTable: scheme.conversion_table !== null,
      calculationSteps: steps
    }
  }
}
```

### 4.2 Función de Evaluación de Multiplicadores

```typescript
/**
 * Evalúa un multiplicador y retorna el factor a aplicar
 */
function evaluateMultiplier(
  mult: ItemMultiplier,
  measurement: { item: SchemeItemV2; measuredValue: number; rawUnits: number },
  contribution: { fulfillment: number; meetsMinimum: boolean },
  allMeasurements: Map<string, { measuredValue: number; item: SchemeItemV2 }>,
  allContributions: Map<string, { fulfillment: number }>,
  globalFulfillment: number
): MultiplierEvaluation {
  let conditionMet = false
  let appliedFactor = mult.factorIfNotMet
  let currentValue = 0
  let requiredValue = mult.thresholdValue
  let description = mult.sourceDescription
  
  switch (mult.activationCriteria) {
    case 'MIN_QUANTITY':
      // Cantidad mínima vendida
      currentValue = measurement.rawUnits
      conditionMet = currentValue >= (mult.thresholdValue || 0)
      description = `Mín ${mult.thresholdValue} unidades (actual: ${currentValue})`
      break
      
    case 'OWN_ATTAINMENT':
      // Cumplimiento de esta partida
      currentValue = contribution.fulfillment * 100
      conditionMet = currentValue >= (mult.thresholdValue || 0)
      description = `Cumpl. ≥${mult.thresholdValue}% (actual: ${currentValue.toFixed(1)}%)`
      break
      
    case 'OTHER_ATTAINMENT':
      // Cumplimiento de otra partida
      if (mult.sourceItemId) {
        const otherContrib = allContributions.get(mult.sourceItemId)
        if (otherContrib) {
          currentValue = otherContrib.fulfillment * 100
          conditionMet = currentValue >= (mult.thresholdValue || 0)
          const otherItem = allMeasurements.get(mult.sourceItemId)
          const otherName = otherItem ? getDisplayName(otherItem.item) : 'Otra partida'
          description = `${otherName} ≥${mult.thresholdValue}% (actual: ${currentValue.toFixed(1)}%)`
        }
      }
      break
      
    case 'GLOBAL_ATTAINMENT':
      // Cumplimiento global SS
      currentValue = globalFulfillment * 100
      conditionMet = currentValue >= (mult.thresholdValue || 0)
      description = `SS Global ≥${mult.thresholdValue}% (actual: ${currentValue.toFixed(1)}%)`
      break
      
    case 'ATTAINMENT_RANGE':
      // Buscar en rangos escalonados
      if (mult.tieredRanges?.ranges) {
        currentValue = contribution.fulfillment * 100
        const range = mult.tieredRanges.ranges.find(r => 
          currentValue >= r.min && (r.max === null || currentValue <= r.max)
        )
        if (range) {
          conditionMet = true
          appliedFactor = range.factor
          description = `${range.label} (${currentValue.toFixed(1)}%)`
        }
      }
      break
      
    case 'OPERATOR_ORIGIN':
      // % de ventas de un operador específico
      // TODO: Requiere datos detallados de operador por venta
      conditionMet = false
      description = `Origen ${mult.operatorCedente} (no implementado)`
      break
  }
  
  // Aplicar factor si cumple condición (excepto TIERED que ya lo asignó)
  if (mult.activationCriteria !== 'ATTAINMENT_RANGE') {
    appliedFactor = conditionMet ? mult.factorIfMet : mult.factorIfNotMet
  }
  
  return {
    multiplier: mult,
    conditionMet,
    appliedFactor,
    currentValue,
    requiredValue,
    description
  }
}
```

### 4.3 Función de Sobrecumplimiento

```typescript
/**
 * Calcula el bono por sobrecumplimiento
 */
function calculateOvercompliance(
  item: SchemeItemV2,
  fulfillment: number,
  sales: number,
  quota: number,
  baseCommission: number
): OvercomplianceResult | null {
  // Solo aplica si hay sobrecumplimiento
  if (fulfillment <= 1 || item.overcompliance_mode === 'none') {
    return null
  }
  
  const unitsOverQuota = sales - quota
  
  switch (item.overcompliance_mode) {
    case 'proportional': {
      // Comisión continúa proporcional
      let bonusUnits = unitsOverQuota
      let bonusCommission = 0
      
      // Aplicar tope de unidades si existe
      if (item.cap_units && bonusUnits > item.cap_units) {
        bonusUnits = item.cap_units
      }
      
      // Calcular comisión adicional proporcional
      // Proporción = (unitsOverQuota / quota) * variableAmount
      if (quota > 0) {
        bonusCommission = (bonusUnits / quota) * item.variable_amount
      }
      
      // Aplicar tope de monto si existe
      if (item.overcap_max_amount && bonusCommission > item.overcap_max_amount) {
        bonusCommission = item.overcap_max_amount
      }
      
      return {
        mode: 'proportional',
        baseCommission,
        bonusCommission,
        bonusUnits: unitsOverQuota,
        cappedUnits: bonusUnits,
        cappedAmount: bonusCommission,
        totalCommission: baseCommission + bonusCommission
      }
    }
    
    case 'pxq_bonus': {
      // Pago por unidad extra
      if (!item.pxq_bonus_amount) return null
      
      let bonusUnits = unitsOverQuota
      
      // Aplicar tope de unidades
      if (item.overcap_max_units && bonusUnits > item.overcap_max_units) {
        bonusUnits = item.overcap_max_units
      }
      
      let bonusCommission = bonusUnits * item.pxq_bonus_amount
      
      // Aplicar tope de monto
      if (item.overcap_max_amount && bonusCommission > item.overcap_max_amount) {
        bonusCommission = item.overcap_max_amount
      }
      
      return {
        mode: 'pxq_bonus',
        baseCommission,
        bonusCommission,
        bonusUnits: unitsOverQuota,
        cappedUnits: bonusUnits,
        cappedAmount: bonusCommission,
        totalCommission: baseCommission + bonusCommission
      }
    }
    
    default:
      return null
  }
}
```

---

## 5. CAMBIOS EN HOOKS

### 5.1 useSchemeData - Query Actualizada

```typescript
/**
 * Carga un esquema completo con partidas y multiplicadores (v2.0)
 */
const loadSchemeWithItems = useCallback(async (schemeId: string) => {
  setLoading(true)
  setError(null)

  try {
    // Cargar esquema con nuevos campos v3.4
    const { data: schemeData, error: schemeError } = await supabase
      .from('commission_schemes')
      .select(`
        *,
        accelerator_base,
        conversion_table,
        global_range_method,
        accelerator_config
      `)
      .eq('id', schemeId)
      .single()

    if (schemeError) throw schemeError

    // Cargar partidas con todos los campos v3.4
    const { data: itemsData, error: itemsError } = await supabase
      .from('commission_scheme_items')
      .select(`
        *,
        contribution_type,
        range_source,
        uses_conversion_table,
        accelerator_ranges,
        overcompliance_mode,
        cap_units,
        pxq_bonus_amount,
        overcap_max_units,
        overcap_max_amount,
        measurement_type,
        fulfillment_method,
        measurement_config,
        variable_source,
        item_type:commission_item_types(code, name, category, calculation_type),
        preset:partition_presets(code, name, short_name, default_category, default_calculation_type),
        pxq_scales:commission_pxq_scales(*)
      `)
      .eq('scheme_id', schemeId)
      .eq('is_active', true)
      .order('display_order')

    if (itemsError) throw itemsError

    // Cargar MULTIPLICADORES (v2.0 - reemplaza locks)
    const itemIds = itemsData?.map(i => i.id) || []
    let multipliersMap: Record<string, ItemMultiplier[]> = {}

    if (itemIds.length > 0) {
      const { data: multipliersData } = await supabase
        .from('commission_item_multipliers')
        .select('*')
        .in('item_id', itemIds)
        .eq('is_active', true)
        .order('display_order')

      // Agrupar por item_id y transformar
      multipliersMap = (multipliersData || []).reduce((acc, m) => {
        const itemId = m.item_id
        if (!acc[itemId]) acc[itemId] = []
        acc[itemId].push({
          id: m.id,
          itemId: m.item_id,
          multiplierType: m.multiplier_type,
          activationCriteria: m.activation_criteria,
          sourceDescription: m.source_description,
          sourceItemId: m.source_item_id,
          thresholdValue: m.threshold_value,
          factorIfMet: m.factor_if_met,
          factorIfNotMet: m.factor_if_not_met,
          tieredRanges: m.tiered_ranges,
          operatorCedente: m.operator_cedente,
          measurementType: m.measurement_type || 'UNIT_COUNT',
          measurementConfig: m.measurement_config,
          isActive: m.is_active,
          displayOrder: m.display_order
        })
        return acc
      }, {} as Record<string, ItemMultiplier[]>)
    }

    // Cargar mapeos de tipos de venta (igual que antes)
    let ventasMappings: Record<string, TipoVentaMapping[]> = {}
    // ... (código existente)

    // Mapear partidas con multiplicadores
    const itemsWithMapping: SchemeItemV2[] = (itemsData || []).map(item => ({
      ...item,
      mapped_tipos_venta: ventasMappings[item.id] || [],
      multipliers: multipliersMap[item.id] || []
    }))

    const scheme: SchemeForSimulationV2 = {
      ...schemeData,
      items: itemsWithMapping
    }

    setSelectedScheme(scheme)
    return scheme
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando esquema'
    setError(message)
    return null
  } finally {
    setLoading(false)
  }
}, [supabase])
```

### 5.2 useSimulation - Cálculo Local Actualizado

```typescript
/**
 * Simula usando cálculo local v2.0
 */
const simulateLocal = useCallback(async (
  scheme: SchemeForSimulationV2,
  salesData: SalesData,
  hcQuota?: HCEffectiveQuota
): Promise<SimulationResultV2> => {
  setLoading(true)
  setError(null)

  try {
    // Usar el nuevo motor de cálculo v2.0
    const result = calculateCommissionV2(scheme, salesData, hcQuota)
    setResult(result)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en cálculo local'
    setError(message)
    throw err
  } finally {
    setLoading(false)
  }
}, [])
```

---

## 6. CAMBIOS EN COMPONENTES UI

### 6.1 ResultBreakdown - Multiplicadores

```tsx
// Sección de multiplicadores (reemplaza candados)
{detail.multipliersEvaluated.length > 0 && (
  <div className="mt-2 space-y-1">
    <p className="text-xs font-medium text-muted-foreground">Multiplicadores:</p>
    {detail.multipliersEvaluated.map((eval, idx) => (
      <div key={idx} className="flex items-center gap-2 text-xs">
        {eval.conditionMet ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : (
          <XCircle className="h-3 w-3 text-red-500" />
        )}
        <span className={eval.conditionMet ? 'text-green-700' : 'text-red-700'}>
          {eval.description}
        </span>
        <Badge variant="outline" className="text-xs">
          ×{eval.appliedFactor.toFixed(2)}
        </Badge>
      </div>
    ))}
    {detail.combinedMultiplierFactor !== 1 && (
      <div className="flex items-center gap-2 text-xs font-medium mt-1 pt-1 border-t">
        <span>Factor combinado:</span>
        <Badge variant={detail.hasBlockingMultiplier ? 'destructive' : 'secondary'}>
          ×{detail.combinedMultiplierFactor.toFixed(2)}
        </Badge>
      </div>
    )}
  </div>
)}
```

### 6.2 ResultBreakdown - Sobrecumplimiento

```tsx
// Sección de sobrecumplimiento
{detail.overcomplianceResult && detail.overcomplianceResult.bonusCommission > 0 && (
  <div className="mt-2 p-2 bg-emerald-50 rounded-md">
    <div className="flex items-center gap-2 text-xs text-emerald-700">
      <TrendingUp className="h-3 w-3" />
      <span className="font-medium">Sobrecumplimiento</span>
      <Badge variant="outline" className="bg-emerald-100">
        {detail.overcomplianceResult.mode === 'proportional' ? 'Proporcional' : 'PxQ Bonus'}
      </Badge>
    </div>
    <div className="mt-1 text-xs text-emerald-600">
      <p>Unidades sobre meta: {detail.overcomplianceResult.bonusUnits.toFixed(0)}</p>
      {detail.overcomplianceResult.cappedUnits !== detail.overcomplianceResult.bonusUnits && (
        <p>Unidades con tope: {detail.overcomplianceResult.cappedUnits?.toFixed(0)}</p>
      )}
      <p className="font-medium">
        Bono: {formatCurrency(detail.overcomplianceResult.bonusCommission)}
      </p>
    </div>
  </div>
)}
```

### 6.3 SimulationResult - Nuevo Desglose

```tsx
// Desglose actualizado con nuevos conceptos
<div className="grid grid-cols-2 gap-4">
  <ResultRow label="Sueldo Fijo" value={result.fixedSalary} />
  <ResultRow label="Comisión Variable" value={result.variableCommission} />
  {result.acceleratorAdjustment !== 0 && (
    <ResultRow 
      label="Ajuste Aceleradores" 
      value={result.acceleratorAdjustment}
      highlight={result.acceleratorAdjustment > 0 ? 'positive' : 'negative'}
    />
  )}
  <ResultRow label="Comisión PxQ" value={result.pxqCommission} />
  <ResultRow label="Bonos" value={result.bonusCommission} />
  {result.additionalCommission > 0 && (
    <ResultRow label="Adicionales" value={result.additionalCommission} />
  )}
  {result.overcomplianceBonus > 0 && (
    <ResultRow 
      label="Bono Sobrecumplimiento" 
      value={result.overcomplianceBonus}
      highlight="positive"
      icon={<TrendingUp className="h-4 w-4" />}
    />
  )}
  <Separator className="col-span-2" />
  <ResultRow label="Total Bruto" value={result.totalGross} bold />
  {result.predictedPenalties > 0 && (
    <ResultRow 
      label="Penalidades (pred.)" 
      value={-result.predictedPenalties}
      highlight="negative"
    />
  )}
  <ResultRow label="Total Neto" value={result.totalNet} bold primary />
</div>
```

---

## 7. MIGRACIÓN Y COMPATIBILIDAD

### 7.1 Estrategia de Migración

1. **Fase 1:** Actualizar tipos TypeScript (`types.ts`)
2. **Fase 2:** Actualizar hooks para cargar nuevos campos
3. **Fase 3:** Implementar motor de cálculo v2.0
4. **Fase 4:** Actualizar componentes UI
5. **Fase 5:** Pruebas con datos reales

### 7.2 Compatibilidad con Datos Legacy

```typescript
/**
 * Normaliza un item legacy (sin campos v3.4) a SchemeItemV2
 */
function normalizeToV2(item: SchemeItemWithMapping): SchemeItemV2 {
  return {
    ...item,
    // Defaults para campos v3.x si no existen
    contribution_type: item.contribution_type || 'PONDERADA',
    range_source: item.range_source || 'CUOTA_PROPIA',
    uses_conversion_table: item.uses_conversion_table || false,
    accelerator_ranges: item.accelerator_ranges || null,
    overcompliance_mode: item.overcompliance_mode || (item.has_cap ? 'none' : 'proportional'),
    cap_units: item.cap_units || null,
    pxq_bonus_amount: item.pxq_bonus_amount || null,
    overcap_max_units: item.overcap_max_units || null,
    overcap_max_amount: item.overcap_max_amount || null,
    measurement_type: item.measurement_type || 'UNIT_COUNT',
    fulfillment_method: item.fulfillment_method || 'RATIO',
    measurement_config: item.measurement_config || null,
    variable_source: item.variable_source || 'FROM_MIX',
    // Convertir locks legacy a multipliers
    multipliers: convertLocksToMultipliers(item.locks || [])
  }
}

/**
 * Convierte candados legacy a multiplicadores
 */
function convertLocksToMultipliers(locks: LegacyLock[]): ItemMultiplier[] {
  return locks.filter(l => l.is_active).map(lock => ({
    id: lock.id,
    itemId: lock.item_id,
    multiplierType: 'LOCK' as MultiplierType,
    activationCriteria: lock.lock_type === 'MIN_QUANTITY' 
      ? 'MIN_QUANTITY' as ActivationCriteria
      : 'OTHER_ATTAINMENT' as ActivationCriteria,
    sourceDescription: lock.description || `Candado: ${lock.lock_type}`,
    sourceItemId: lock.required_item_type_id,
    thresholdValue: lock.required_value,
    factorIfMet: 1,
    factorIfNotMet: 0,
    tieredRanges: null,
    operatorCedente: null,
    measurementType: 'UNIT_COUNT' as MeasurementType,
    measurementConfig: null,
    isActive: true,
    displayOrder: 0
  }))
}
```

---

## 8. ORDEN DE IMPLEMENTACIÓN

### 8.1 Para Claude Code

```
1. TIPOS (Prioridad Alta)
   └─ Actualizar lib/simulador/types.ts con interfaces v2.0
   └─ Actualizar lib/comisiones/types.ts si es necesario

2. HOOKS (Prioridad Alta)
   └─ Actualizar loadSchemeWithItems() para cargar multipliers
   └─ Crear calculateCommissionV2() en hooks.ts
   └─ Actualizar simulateLocal() para usar nuevo motor

3. HELPERS (Prioridad Media)
   └─ Crear evaluateMultiplier()
   └─ Crear calculateOvercompliance()
   └─ Crear normalizeToV2() para compatibilidad

4. COMPONENTES (Prioridad Media)
   └─ Actualizar ResultBreakdown.tsx
   └─ Actualizar SimulationResult.tsx
   └─ Actualizar SalesInputTable.tsx (soporte measurement_type)

5. PRUEBAS (Prioridad Alta)
   └─ Verificar con esquema TEX real
   └─ Validar cálculos contra Excel de referencia
```

### 8.2 Archivos Nuevos a Crear

```
lib/simulador/
├── calculation-engine.ts    # Motor de cálculo v2.0
├── multiplier-evaluator.ts  # Evaluación de multiplicadores
├── overcompliance.ts        # Lógica de sobrecumplimiento
└── normalizers.ts           # Compatibilidad legacy
```

---

## 9. VERIFICACIÓN

### 9.1 Checklist de Implementación

- [ ] Tipos TypeScript actualizados
- [ ] Hook loadSchemeWithItems carga multipliers
- [ ] Motor de cálculo 6 pasos implementado
- [ ] Evaluación de multiplicadores funciona
- [ ] Sobrecumplimiento (3 modalidades) funciona
- [ ] variable_source diferencia FROM_MIX vs FIXED_EXTRA
- [ ] Componentes UI muestran multiplicadores
- [ ] Componentes UI muestran sobrecumplimiento
- [ ] Compatible con esquemas legacy (sin campos v3.x)
- [ ] Pruebas con esquema TEX real

### 9.2 Casos de Prueba

| Caso | Entrada | Resultado Esperado |
|------|---------|-------------------|
| Multiplicador LOCK | MEP=0, OSS=10 | RENO comisión=0 (bloqueado) |
| Multiplicador LOCK | MEP=2, OSS=10 | RENO comisión calculada |
| Sobrecumplimiento none | 120% cumpl. | Comisión = variable_amount |
| Sobrecumplimiento proportional | 120% cumpl. | Comisión = variable_amount × 1.2 |
| Sobrecumplimiento pxq_bonus | 120% cumpl. | Comisión base + (unidades_extra × pxq_bonus_amount) |
| variable_source FIXED_EXTRA | Partida adicional | No cuenta en validación Mix 100% |

---

**Este documento es la guía completa para actualizar el Simulador de Ingresos a v2.0. Adjuntar a Claude Code junto con DATA_DICTIONARY.md y CHANGELOG_COMISIONES.md**
