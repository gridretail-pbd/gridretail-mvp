# CHANGELOG - Módulo de Comisiones
## GridRetail

**Última actualización:** 2026-02-03

---

## [Pendiente]

### Base de Datos
- [ ] Ejecutar migración SQL consolidada v3.3 (nuevos campos en 3 tablas + tabla multipliers)
- [ ] Ejecutar migración 010_variable_source.sql (campo variable_source)
- [ ] Validar constraints y defaults en Supabase

### Frontend
- [ ] Implementar Editor de Esquemas (EDITOR_ESQUEMAS_SPEC_v3.3.md)
- [ ] Implementar Simulador de Ingresos (SIMULADOR_INGRESOS_SPEC_v1.2.md)
- [ ] Implementar Importador AI de Excel con Claude API

### Lógica de Negocio
- [ ] Motor de cálculo universal (6 pasos) en funciones SQL/TypeScript
- [ ] Soporte measurement_type en evaluación de partidas y multiplicadores

---

## [2026-02-03] v3.4 - Fuente de Variable para Partidas Adicionales

### Problema Resuelto
Las partidas "Adicional" tienen dos casos de uso distintos:
1. **Contribuyen al Mix**: El Variable S/. es parte del variable teórico (suma con las demás al 100%)
2. **Monto Extra**: El Variable S/. es un pago adicional al variable teórico

### Nuevo Campo BD
**`commission_scheme_items`:**
- ✅ `variable_source` (VARCHAR(20), DEFAULT 'FROM_MIX')
  - `FROM_MIX`: Variable calculado desde mix_factor × variable_salary
  - `FIXED_EXTRA`: Variable es monto fijo independiente, no cuenta en Mix

### Nueva Migración
- ✅ `supabase/migrations/010_variable_source.sql`

### Backward Compatibility
- Default `FROM_MIX` preserva comportamiento existente
- Esquemas/partidas existentes no requieren cambios

---

## [2026-02-02] SPEC v3.3 - Tipos de Medición Complejos

### Nuevos Campos (6 campos en 3 tablas)

**`commission_schemes`:**
- ✅ `accelerator_base` (VARCHAR(25)) — VARIABLE_TEORICO o VARIABLE_CALCULADO

**`commission_scheme_items`:**
- ✅ `measurement_type` (VARCHAR(20)) — UNIT_COUNT, AVERAGE_VALUE, TOTAL_VALUE, RATE, MANUAL
- ✅ `fulfillment_method` (VARCHAR(20)) — RATIO o ABSOLUTE_RANGES
- ✅ `measurement_config` (JSONB) — Configuración específica por tipo

**`commission_item_multipliers`:**
- ✅ `measurement_type` (VARCHAR(20)) — UNIT_COUNT, RATE, AVERAGE_VALUE, MANUAL
- ✅ `measurement_config` (JSONB) — Configuración para evaluación compleja

### Capacidades Nuevas
- ✅ Partidas con KPIs no basados en conteo (promedio, suma, ratio, manual)
- ✅ Método de cumplimiento por valor absoluto en rangos (sin meta numérica)
- ✅ Multiplicadores que evalúan condiciones complejas (ej: Tasa de Uso de Descuento)
- ✅ Base de aceleradores configurable por esquema (teórico vs calculado)

### Motor de Cálculo Refactorizado
- ✅ Función `measureAchievement()` con 5 ramas por measurement_type
- ✅ Función `evaluateMultiplier()` con 3 helpers (getUnitCount, getRate, getAverage)
- ✅ Paso 1 del motor dividido en 1a (medir logro), 1b (calcular cumplimiento), 1c (aplicar cumplimiento mínimo)

### Backward Compatibility
- Defaults preservan comportamiento actual: UNIT_COUNT + RATIO + VARIABLE_TEORICO
- Esquemas existentes no requieren cambios

---

## [2026-02-02] SPEC v3.2 - Arquitectura Multi-Esquema

### Investigación Previa
- ✅ Búsqueda web de 20+ fuentes sobre estructuras de comisiones en telecom
- ✅ Análisis profundo de 3 esquemas reales: TEX/PBD, Netcall Call Center, TPF Tiendas Propias
- ✅ Documento ANALISIS_MULTIPLICADORES_CANDADOS.md con taxonomía unificada

### Arquitectura de 3 Niveles
```
NIVEL 1: ESQUEMA
├── conversion_table (JSONB) — Tabla de conversión global (estilo TPF)
├── global_range_method — Método de rango global
└── accelerator_ranges (JSONB) — Aceleradores globales

NIVEL 2: PARTIDA
├── contribution_type — WEIGHTED_SUM, PXQ_ONLY, DIRECT_VALUE
├── range_source — ITEM_OWN, GLOBAL_CONVERSION_TABLE, ITEM_PXQ_TABLE
├── uses_conversion_table — Si usa la tabla del esquema
├── accelerator_ranges (JSONB) — Rangos propios de acelerador
└── sobrecumplimiento — SIN, PROPORCIONAL, PXQ_BONUS

NIVEL 3: MULTIPLICADORES
└── commission_item_multipliers (nueva tabla, 17 columnas)
    ├── 6 multiplier_types: BINARY, TIERED, SCALE, FLAT, CONDITIONAL, PENALTY
    └── 6 activation_criteria: GLOBAL_ATTAINMENT, OWN_ATTAINMENT, etc.
```

### Esquemas Soportados
| Esquema | contribution_type | range_source | Multiplicadores |
|---------|-------------------|--------------|-----------------|
| TEX/PBD | WEIGHTED_SUM | ITEM_OWN | Candados MEP, restricciones plan |
| Netcall | PXQ_ONLY | ITEM_PXQ_TABLE | Aceleradores globales |
| TPF | WEIGHTED_SUM | GLOBAL_CONVERSION_TABLE | Aceleradores por producto |

### Nuevos Atributos BD (Esquema)
- ✅ `conversion_table` (JSONB) — Tabla no-lineal estilo TPF
- ✅ `global_range_method` (VARCHAR) — CUMPLIMIENTO_DIRECTO o TABLA_CONVERSION
- ✅ `accelerator_config` (JSONB) — Config de aceleradores globales

### Nuevos Atributos BD (Partida)
- ✅ `contribution_type` (VARCHAR) — WEIGHTED_SUM, PXQ_ONLY, DIRECT_VALUE
- ✅ `range_source` (VARCHAR) — ITEM_OWN, GLOBAL_CONVERSION_TABLE, ITEM_PXQ_TABLE
- ✅ `uses_conversion_table` (BOOLEAN)
- ✅ `accelerator_ranges` (JSONB) — Rangos individuales de acelerador
- ✅ `sobrecumplimiento` (VARCHAR) — SIN, PROPORCIONAL, PXQ_BONUS

### Nueva Tabla: `commission_item_multipliers`
- ✅ 17 columnas con 6 tipos de multiplicador y 6 criterios de activación
- ✅ Reemplaza conceptualmente a `commission_item_locks` y `commission_item_restrictions`
- ✅ Soporta multiplicadores positivos (aceleradores, bonos) y negativos (penalizadores)

### Motor de Cálculo Universal (6 pasos)
```
1. Medir logro por partida
2. Calcular contribución según contribution_type
3. Sumar ponderadas → variable base
4. Evaluar multiplicadores (candados, aceleradores, restricciones)
5. Aplicar aceleradores globales (si aplica)
6. Calcular neto (fijo + variable + PxQ + bonos - penalidades)
```

### AI Readiness
- ✅ 3 capacidades futuras documentadas: Importador AI, Analizador, Sugeridor
- ✅ Estructura de BD preparada para análisis comparativo entre esquemas

---

## [2026-02-02] SPEC v3.0.1 - Sobrecumplimiento

### Rediseño de Sección
- ✅ 3 modalidades: Sin sobrecumplimiento, Proporcional (sin tope), PxQ Bonus
- ✅ Vinculación bidireccional de campos tope
- ✅ Proyecciones en tiempo real en simulador
- ✅ Migración SQL para campo `sobrecumplimiento` en `commission_scheme_items`
- ✅ Tipos TypeScript y validaciones Zod

---

## [2026-02-02] SPEC v3.0 - Correcciones y Mejoras de Partidas

### Bugs Corregidos
- ✅ **BUG-01**: Botón Eliminar esquema draft ahora disponible (antes solo se podía archivar)
- ✅ **BUG-02**: Permitir editar tipo de cálculo de partida existente
- ✅ **BUG-03**: Factor Mix como porcentaje (display 27% → almacena 0.27)

### Mejoras Funcionales
- ✅ Vinculación bidireccional Meta ↔ Peso (cambiar uno recalcula el otro)
- ✅ Variable S/. calculado automáticamente: `variable_salary × peso / 100`
- ✅ Validación cruzada: suma de pesos = 100% para partidas principales
- ✅ Columna "Variable S/." como campo calculado no editable
- ✅ Validación de metas > 0 al guardar
- ✅ Aviso al usuario si pesos no suman 100% (warning, no bloqueo)

---

## [2026-01-26] v2.1 - Sistema de Partidas Flexible (BD)

### Tablas Creadas
- ✅ `partition_presets` — 25 presets predefinidos (9 agrupaciones + 16 individuales)
- ✅ `partition_preset_ventas` — Mapeo N:N preset → tipo_venta
- ✅ `commission_item_ventas` — Mapeo N:N partida → tipo_venta

### Vistas y Funciones
- ✅ `vw_partition_presets_detail` — Presets con tipos de venta
- ✅ `vw_commission_items_ventas` — Partidas con tipos mapeados
- ✅ `apply_preset_to_item()` — Aplicar preset a partida
- ✅ `get_item_effective_ventas()` — Tipos efectivos de una partida

### Cambio Arquitectónico
- `item_type_id` en `commission_scheme_items` ahora nullable
- Partidas pueden definir tipos de venta custom sin depender de `commission_item_types`
- Modal de configuración con selector inteligente (preset + individual)

---

## [2026-01-25] v1.0 - Versión Inicial (BD)

### Tablas Creadas
- ✅ `commission_item_types` — Catálogo de tipos de partida
- ✅ `commission_schemes` — Esquemas de comisiones
- ✅ `commission_scheme_items` — Partidas individuales
- ✅ `commission_pxq_scales` — Escalas PxQ
- ✅ `commission_item_locks` — Candados
- ✅ `commission_item_restrictions` — Restricciones de mix
- ✅ `commission_hc_assignments` — Asignación de esquemas a HC

### Funciones Creadas
- ✅ `simulate_hc_commission()` — Calcular comisión completa
- ✅ `compare_commission_scenarios()` — Comparar dos esquemas
- ✅ `get_sales_profile()` — Generar perfil de ventas predefinido
- ✅ `predict_hc_penalties()` — Predecir penalidades (en módulo Penalidades)

### Estados de Esquema
```
oficial    → Importado de Entel (solo lectura)
draft      → En edición (pueden existir múltiples)
aprobado   → Vigente para el período (solo uno)
archivado  → Histórico
```

### Tipos de Cálculo Soportados
- **percentage**: Comisión por % de cumplimiento
- **pxq**: Precio por cantidad con escalas
- **binary**: Todo o nada (bonos)

### Dependencias
- Tabla `usuarios` (created_by, approved_by)
- Tabla `tipos_venta` (mapeo de partidas)

---

## Frontend (Pendiente de Implementar)

### SPECs Generados
- ✅ EDITOR_ESQUEMAS_SPEC_v3.3.md (1,759 líneas)
- ✅ SIMULADOR_INGRESOS_SPEC_v1.2.md
- ✅ ANALISIS_MULTIPLICADORES_CANDADOS.md

### Pantallas Diseñadas
- [ ] Lista de esquemas (con estados y acciones por rol)
- [ ] Editor de esquema (header + partidas + config global)
- [ ] Modal de partida (7 secciones: básico, cálculo, sobrecumplimiento, presets, restricciones, multiplicadores, preview)
- [ ] Modal de multiplicador (tipo, criterio, rangos, medición)
- [ ] Importador AI de Excel Entel
- [ ] Simulador Gerencia (comparar esquemas, proyectar costos)
- [ ] Simulador HC Personal (mi comisión estimada)

### Migraciones Pendientes de Ejecutar
```
v1.0  → 001-004 (tablas base, comisiones, penalidades, funciones) ✅ Ejecutadas
v2.1  → 005 (partidas flexibles, presets) ✅ Ejecutada
v3.2  → Pendiente (multi-esquema, multipliers)
v3.3  → Pendiente (measurement types, fulfillment methods)
v3.4  → Pendiente (010_variable_source.sql)
```

---

## Evolución del SPEC del Editor

| Versión | Fecha | Cambios Principales |
|---------|-------|---------------------|
| v1.0 | 2026-01-25 | Diseño inicial: 8 pantallas, flujos por rol |
| v2.1 | 2026-01-26 | Mapeo flexible N:N, presets, modal partidas |
| v3.0 | 2026-02-02 | 3 bugs corregidos, Meta↔Peso bidireccional, Variable calculado |
| v3.0.1 | 2026-02-02 | Rediseño sobrecumplimiento (3 modalidades) |
| v3.2 | 2026-02-02 | Arquitectura multi-esquema 3 niveles, multiplicadores, motor universal |
| v3.3 | 2026-02-02 | 6 campos medición compleja, fulfillment methods, accelerator base |
| v3.4 | 2026-02-03 | Campo variable_source para Adicionales (FROM_MIX vs FIXED_EXTRA) |

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
