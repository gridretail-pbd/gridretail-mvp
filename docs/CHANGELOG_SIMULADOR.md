# CHANGELOG - Simulador de Ingresos HC
## GridRetail

**Última actualización:** 2026-01-27

---

## [Pendiente]

### Validaciones
- [ ] _Agregar issues aquí cuando se detecten_

### UX/UI
- [ ] _Agregar issues aquí cuando se detecten_

### Lógica de Negocio
- [ ] _Agregar issues aquí cuando se detecten_

---

## [2026-01-XX] v1.1 (Próxima versión)

_Cambios pendientes de implementar_

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

## Frontend (Pendiente de Implementar)

### SPEC Actual
- ✅ SIMULADOR_INGRESOS_SPEC_v1.2.md

### Componentes Diseñados
- [ ] SchemeSelector
- [ ] ProfileSelector
- [ ] SalesInputTable
- [ ] SimulationResult
- [ ] ResultBreakdown
- [ ] ScenarioComparison
- [ ] HCSelector (modal)
- [ ] ProgressBar
- [ ] CostProjection
- [ ] WhatIfCalculator
- [ ] QuotaProrationBadge (v1.2)
- [ ] EffectiveQuotaCard (v1.2)

### Hooks Diseñados
- [ ] useSimulation
- [ ] useHCQuota (v1.2)

### Páginas
- [ ] `/comisiones/simulador` - Simulador Gerencia
- [ ] `/mi-comision` - Simulador HC Personal

---

## Integraciones

| Módulo | Dato | Función |
|--------|------|---------|
| Cuotas | Metas del HC | `get_hc_effective_quota()` |
| Comisiones | Esquema y fórmulas | `simulate_hc_commission()` |
| INAR | Ventas confirmadas | Query directo |
| Ventas | Ventas BU (fallback) | Query directo |
| Penalidades | Predicción | `predict_hc_penalties()` |

---

## Convenciones de este archivo

### Estados de items pendientes
- `[ ]` Pendiente
- `[~]` En progreso
- `[x]` Completado (mover a sección de versión)

### Prioridades (usar en descripción)
- 🔴 Alta - Bloquea uso normal
- 🟡 Media - Afecta experiencia pero hay workaround
- 🟢 Baja - Mejora nice-to-have
