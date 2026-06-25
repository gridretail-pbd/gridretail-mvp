# CHANGELOG - Simulador de Ingresos HC
## GridRetail

**Última actualización:** 2026-02-03

---

## [Pendiente]

### Validaciones
- [ ] _Agregar issues aquí cuando se detecten_

### UX/UI
- [ ] _Agregar issues aquí cuando se detecten_

### Lógica de Negocio
- [ ] _Agregar issues aquí cuando se detecten_

---

## [2026-02-03] SPEC v2.0 - Actualización para Comisiones v3.4

### Cambios Mayores
Esta versión actualiza completamente el Simulador para soportar la nueva arquitectura de comisiones v3.4.

### Motor de Cálculo Universal (6 Pasos)
- ✅ Paso 1: Medir logro por partida (soporta 5 measurement_types)
- ✅ Paso 2: Calcular contribución según contribution_type (4 tipos)
- ✅ Paso 3: Sumar ponderadas → variable base
- ✅ Paso 4: Evaluar multiplicadores (6 tipos, 6 criterios)
- ✅ Paso 5: Calcular sobrecumplimiento (3 modalidades)
- ✅ Paso 6: Calcular neto

### Sistema de Multiplicadores (Reemplaza Candados)
- ✅ Tipos: LOCK, ACCELERATOR, DECELERATOR, PROPORTIONAL, CROSS_PRODUCT, TIERED
- ✅ Criterios: MIN_QUANTITY, OWN_ATTAINMENT, OTHER_ATTAINMENT, GLOBAL_ATTAINMENT, ATTAINMENT_RANGE, OPERATOR_ORIGIN
- ✅ Evaluación en cascada con factor combinado
- ✅ Compatibilidad con `commission_item_locks` legacy

### Sobrecumplimiento (3 Modalidades)
- ✅ `none`: Comisión se detiene al 100%
- ✅ `proportional`: Continúa proporcional (con/sin tope)
- ✅ `pxq_bonus`: Monto por unidad extra sobre meta

### Tipos de Medición Complejos
- ✅ UNIT_COUNT (default)
- ✅ AVERAGE_VALUE (promedio de campo)
- ✅ TOTAL_VALUE (suma de campo)
- ✅ RATE (ratio condición/total)
- ✅ MANUAL (valor externo)

### Variable Source para Adicionales
- ✅ FROM_MIX: Variable calculado desde mix
- ✅ FIXED_EXTRA: Monto fijo independiente (no cuenta en Mix 100%)

### Nuevos Tipos TypeScript
```typescript
// Nuevas interfaces principales
- ContributionType
- RangeSource
- OvercomplianceMode
- MeasurementType
- FulfillmentMethod
- VariableSource
- MultiplierType
- ActivationCriteria
- ItemMultiplier
- MultiplierEvaluation
- OvercomplianceConfig
- OvercomplianceResult
- SchemeItemV2
- ItemDetailV2
- SimulationResultV2
```

### Cambios en Hooks
- ✅ `loadSchemeWithItems()`: Carga multipliers desde `commission_item_multipliers`
- ✅ `simulateLocal()`: Usa motor de cálculo v2.0
- ✅ Nueva función `calculateCommissionV2()`
- ✅ Nueva función `evaluateMultiplier()`
- ✅ Nueva función `calculateOvercompliance()`

### Cambios en Componentes
- ✅ `ResultBreakdown`: Muestra multiplicadores evaluados
- ✅ `ResultBreakdown`: Muestra bonos por sobrecumplimiento
- ✅ `SimulationResult`: Nuevo desglose con acceleratorAdjustment y overcomplianceBonus

### Compatibilidad
- ✅ Normaliza items legacy (sin campos v3.x) a SchemeItemV2
- ✅ Convierte `commission_item_locks` a multiplicadores

### Alcance TEX/PBD
Esta versión soporta esquemas con:
- `contribution_type`: PONDERADA (weighted sum)
- `range_source`: CUOTA_PROPIA (item own)

Esquemas Netcall (PXQ_ONLY) y TPF (GLOBAL_CONVERSION_TABLE) → v2.1

---

## [2026-01-27] SPEC v1.2

### Cambios en Especificación
- ✅ Integración con Módulo de Cuotas (hc_quotas)
- ✅ Soporte de prorrateo en metas
- ✅ Nuevo hook `useHCQuota()`
- ✅ Interface `HCEffectiveQuota`
- ✅ Diagrama de integración de módulos
- ✅ Sección de verificación de integración

### Flujo Actualizado
```
CUOTAS (hc_quotas)     →  Metas del HC
COMISIONES (schemes)   →  Fórmulas y variables
INAR/Ventas            →  Datos de venta
PENALIDADES            →  Predicción de descuentos
                       ↓
              SIMULADOR
                       ↓
              RESULTADO NETO
```

---

## [2026-01-25] SPEC v1.1

### Cambios en Especificación
- ✅ Mapeo flexible de partidas (v2.1 BD)
- ✅ Queries con `commission_item_ventas`
- ✅ Tipos con `TipoVentaMapping`
- ✅ Helpers para nombres efectivos

---

## [2026-01-25] SPEC v1.0 - Versión Inicial

### Diseño Completado
- ✅ Simulador Gerencia (analistas)
- ✅ Simulador HC Personal (asesores)
- ✅ Comparación de escenarios
- ✅ Proyección de costos SSNN
- ✅ Perfiles predefinidos (average, top20, new, quota100)

### Funciones Backend Requeridas
- `simulate_hc_commission()` ✅ (existe en BD)
- `compare_commission_scenarios()` ✅ (existe en BD)
- `get_sales_profile()` ✅ (existe en BD)
- `predict_hc_penalties()` ✅ (existe en BD)
- `get_hc_effective_quota()` ✅ (existe en BD)

---

## Frontend - Estado de Implementación

### SPEC Actual
- ✅ SIMULADOR_INGRESOS_SPEC_v2.0.md

### Componentes Implementados
- [x] SchemeSelector
- [x] ProfileSelector
- [x] SalesInputTable
- [x] SimulationResult
- [x] ResultBreakdown
- [x] ScenarioComparison
- [x] HCSelector (modal)
- [x] ProgressBar
- [x] QuotaProrationBadge (v1.2)
- [ ] EffectiveQuotaCard (v1.2)
- [ ] CostProjection
- [ ] WhatIfCalculator

### Pendiente Actualizar para v2.0
- [ ] ResultBreakdown - Multiplicadores
- [ ] ResultBreakdown - Sobrecumplimiento
- [ ] SimulationResult - Nuevo desglose
- [ ] SalesInputTable - measurement_type

### Hooks Implementados
- [x] useSimulation
- [x] useSchemeData
- [x] useScenarios
- [x] usePenaltyPrediction
- [x] useHCQuota (v1.2)
- [x] useHCSalesData (v1.2)

### Pendiente Actualizar para v2.0
- [ ] useSchemeData - Cargar multipliers
- [ ] useSimulation - Motor cálculo v2.0

### Páginas
- [x] `/comisiones/simulador` - Simulador Gerencia
- [ ] `/mi-comision` - Simulador HC Personal

---

## Integraciones

| Módulo | Dato | Función | Estado |
|--------|------|---------|--------|
| Cuotas | Metas del HC | `get_hc_effective_quota()` | ✅ |
| Comisiones v3.4 | Esquema y fórmulas | `simulate_hc_commission()` | 🔄 Actualizar |
| Comisiones v3.4 | Multiplicadores | Query directa | ⏳ Nuevo |
| INAR | Ventas confirmadas | Query directo | ✅ |
| Ventas | Ventas BU (fallback) | Query directo | ✅ |
| Penalidades | Predicción | `predict_hc_penalties()` | ✅ |

---

## Archivos del Módulo

### Página
| Archivo | Descripción | Actualizar v2.0 |
|---------|-------------|-----------------|
| `app/(dashboard)/comisiones/simulador/page.tsx` | Página principal | No |

### Componentes (`components/simulador/`)
| Archivo | Descripción | Actualizar v2.0 |
|---------|-------------|-----------------|
| `SalesInputTable.tsx` | Tabla para ingresar ventas | 🟡 Opcional |
| `SimulationResult.tsx` | Resultado de la simulación | ✅ Sí |
| `ResultBreakdown.tsx` | Desglose detallado | ✅ Sí |
| `ProfileSelector.tsx` | Selector de perfiles | No |
| `SchemeSelector.tsx` | Selector de esquema | No |
| `ScenarioComparison.tsx` | Comparación de escenarios | No |
| `WhatIfCalculator.tsx` | Calculadora "¿Qué pasaría si?" | No |
| `HCProgressBar.tsx` | Barra de progreso del HC | No |
| `CostProjection.tsx` | Proyección de costos | No |
| `QuotaProrationBadge.tsx` | Badge de prorrateo | No |
| `EffectiveQuotaCard.tsx` | Card de cuota efectiva | No |
| `HCSelector.tsx` | Selector de HC | No |

### Lógica (`lib/simulador/`)
| Archivo | Descripción | Actualizar v2.0 |
|---------|-------------|-----------------|
| `types.ts` | Tipos TypeScript | ✅ Sí (extenso) |
| `hooks.ts` | Custom hooks | ✅ Sí |
| `profiles.ts` | Perfiles de venta | No |
| `formatters.ts` | Funciones de formateo | 🟡 Opcional |

### Nuevos Archivos v2.0
| Archivo | Descripción |
|---------|-------------|
| `calculation-engine.ts` | Motor de cálculo v2.0 |
| `multiplier-evaluator.ts` | Evaluación de multiplicadores |
| `overcompliance.ts` | Lógica de sobrecumplimiento |
| `normalizers.ts` | Compatibilidad legacy |

---

## Convenciones de este archivo

### Estados de items pendientes
- `[ ]` Pendiente
- `[~]` En progreso
- `[x]` Completado

### Prioridades (usar en descripción)
- 🔴 Alta - Bloquea uso normal
- 🟡 Media - Afecta experiencia pero hay workaround
- 🟢 Baja - Mejora nice-to-have

### Símbolos de estado
- ✅ Completado/Disponible
- 🔄 Requiere actualización
- ⏳ Nuevo (pendiente)
- ❌ No aplica
