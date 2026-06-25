# Análisis: Multiplicadores y Candados en Esquemas de Comisiones
## Investigación de Industria + Propuesta para GridRetail

**Fecha:** 2026-02-02  
**Contexto:** Investigación profunda de patrones de compensación variable en industria de telecomunicaciones y SaaS, aplicados al modelo TEX/PBD.

---

## 1. CONCEPTO UNIFICADO: MULTIPLICADORES

### 1.1 Definición Propuesta

Un **Multiplicador** es un factor numérico que modifica el resultado de una partida de comisión. Puede ser:
- **Positivo** (>1.0): Incrementa la comisión (acelerador, premio)
- **Neutro** (=1.0): Sin efecto
- **Reductor** (0 < factor < 1.0): Reduce la comisión (desacelerador, penalización)
- **Bloqueante** (=0): Anula la comisión completamente (candado no cumplido)

### 1.2 ¿Dónde Aplica?

| Tipo de Partida | El multiplicador afecta a... |
|-----------------|------------------------------|
| **Porcentaje de cumplimiento** | El **total calculado** de la partida (Variable × % logrado × **multiplicador**) |
| **PxQ** | El **P** (precio por unidad) → P × multiplicador × Q |
| **Bono binario** | El **monto del bono** (Bono × multiplicador) |

### 1.3 El Candado como Caso Especial

Bajo esta óptica unificada, un **candado** es simplemente un multiplicador con dos estados:
- Condición cumplida → multiplicador = **1.0** (comisión se paga normal)
- Condición NO cumplida → multiplicador = **0.0** (comisión se bloquea)

Esto simplifica el modelo: no necesitamos sistemas separados, solo un multiplicador con `factor_si_no_cumple = 0`.

---

## 2. PATRONES DE INDUSTRIA IDENTIFICADOS

### 2.1 Aceleradores (Accelerators)

**Qué son:** Tasas de comisión más altas que se activan al superar un umbral de cuota. Según Forrester, el 80% de planes de compensación los usan.

**Variantes encontradas:**

| Variante | Mecánica | Ejemplo |
|----------|----------|---------|
| **Tiered (Escalonado)** | Escalones discretos de tasa | 10% hasta cuota, 12% de 100-120%, 15% sobre 120% |
| **Progressive (Progresivo)** | Incremento continuo | +0.5% por cada $25K adicionales sobre cuota |
| **Multiplier (Factor)** | Multiplica toda la comisión | Al lograr 120% de cuota → toda la comisión ×1.5 |

**Aplicación del acelerador:**
- **Marginal**: Solo aplica al revenue/unidades por encima del umbral
- **Retroactivo**: Aplica a TODO el revenue/unidades del período (incluye lo anterior al umbral)

**Relevancia TEX:** ⭐⭐⭐ Alta. El esquema actual ya tiene un mecanismo similar en PxQ escalonado (más pago por unidad a mayor cumplimiento). Los aceleradores tipo "Multiplier" encajan perfecto con el concepto de Luis.

---

### 2.2 Desaceleradores (Decelerators)

**Qué son:** Tasas reducidas por debajo de un umbral mínimo de cuota.

**Mecánica:** Si el HC logra menos del umbral mínimo, la tasa de comisión es menor.

| Rango | Tasa Normal | Con Desacelerador |
|-------|-------------|-------------------|
| 0% - 49% | 0% | 0% |
| 50% - 69% | 10% | 6% (desacelerado) |
| 70% - 99% | 10% | 10% (normal) |
| 100%+ | 10% | 15% (acelerado) |

**Principio de industria:** Si hay desacelerador, DEBE haber acelerador. Los desaceleradores "pagan" los aceleradores más generosos. Un plan solo con desaceleradores se percibe como injusto.

**Relevancia TEX:** ⭐⭐ Media. El cumplimiento mínimo actual (50% o 70%) ya actúa como desacelerador binario (0% o 100%). Un desacelerador gradual sería más sofisticado pero quizás innecesario en esta etapa.

---

### 2.3 Multiplicadores por Cumplimiento de Cuota (Quota Attainment %)

**Qué es:** El variable de la partida se multiplica directamente por el % de cuota alcanzado.

**Mecánica:**
```
Variable de partida = S/. 324
HC alcanza 85% de cuota
Comisión = S/. 324 × 0.85 = S/. 275.40
```

**Relevancia TEX:** ⭐⭐⭐ Alta. Esto es exactamente el criterio #3 que Luis describió. Ya está parcialmente implementado en el cálculo "percentage" actual, pero formularlo como multiplicador permite combinarlo con otros factores.

---

### 2.4 Multiplicadores Cruzados (Cross-Product Multipliers)

**Qué son:** Factores que se activan basándose en el cumplimiento de OTRO producto diferente al de la partida.

**Mecánica:**
```
Partida: OSS (variable S/. 324)
Condición: Si cumple cuota de RENO → multiplicador 1.1
Resultado: S/. 324 × % cumplimiento OSS × 1.1 = S/. 356.40 (si 100%)
```

**Variantes de industria:**
- **Matrix Commissions**: Múltiples dimensiones simultáneas (Revenue × Margen, Revenue × Customer Count)
- **Performance Multipliers**: KPIs no-revenue que ajustan la comisión base

**Relevancia TEX:** ⭐⭐⭐ Alta. Esto es el criterio #2 de Luis. Permite incentivar venta cruzada: "si vendes suficientes seguros (MEP), tu comisión de PACK sube 10%".

---

### 2.5 Candados (Locks / Gates / Thresholds)

**Qué son:** Condiciones binarias que bloquean completamente una comisión si no se cumplen.

**Mecánica:** Multiplicador = 0 si no se cumple la condición.

**Tipos encontrados en industria:**
| Tipo | Ejemplo TEX |
|------|-------------|
| **Mínimo de producto** | Vender ≥2 seguros MEP para desbloquear PACK SS |
| **Mínimo de actividad** | ≥10 VEP CAPTURA para desbloquear bonos PxQ de VEP |
| **Cumplimiento mínimo global** | Alcanzar ≥50% de cuota SS total para comisionar |
| **Calidad mínima** | NPS ≥60% para acceder a bono |

**Relevancia TEX:** ⭐⭐⭐ Alta. Ya implementados en el sistema actual. Se unifican bajo el modelo de multiplicador.

---

### 2.6 SPIFFs (Sales Performance Incentive Funds)

**Qué son:** Incentivos de **corto plazo** separados del esquema permanente de comisiones. Temporales, con objetivo específico.

**Características clave:**
- Duración: 1-4 semanas típicamente
- Objetivo: Empujar producto específico, alcanzar meta de cierre de mes, lanzamiento
- Formato: Monto fijo por unidad, no porcentaje
- Son ADICIONALES a la comisión regular

**Tipos encontrados:**
| Tipo | Ejemplo |
|------|---------|
| **Lanzamiento** | S/. 20 por cada venta del Plan Nuevo durante semana de lanzamiento |
| **Cierre de mes** | S/. 50 extra por cada OSS en últimos 5 días del mes |
| **Cross-sell** | S/. 10 por cada seguro MEP vendido esta semana |
| **Protección de margen** | S/. 15 bonus si el descuento aplicado es ≤10% |

**Relevancia TEX:** ⭐⭐ Media-Alta. PBD podría usarlos para campañas cortas. No son parte del esquema mensual estándar pero el sistema debería poder soportarlos eventualmente. **No incluir en v3.1 del Editor, pero tener presente para diseño de BD.**

---

### 2.7 Kickers (Bonos por Logro Estratégico)

**Qué son:** Bonos adicionales por logros que van más allá de la cuota estándar.

**Ejemplos telecom:**
- +5% extra en comisión si ≥40% de portabilidades vienen de Claro
- Bono de S/. 100 si el HC logra ≥3 ventas multi-línea en el mes
- +10% si el HC mantiene 0 port-outs en el período

**Relevancia TEX:** ⭐⭐ Media. El esquema actual tiene algo similar con la condición "40% origen Claro". Se puede modelar como multiplicador condicionado.

---

### 2.8 Restricciones de Mix (ya en sistema actual)

**Qué son:** Límites que reducen las unidades que cuentan para comisión según tipo de plan.

**Ejemplos actuales TEX:**
- Máx 10% plan 39.9
- Máx 20 SS plan 34.90  
- Máx 30% plan 44.9/45.9

**Modelado como multiplicador:** NO aplica. Las restricciones de mix afectan las **unidades contables**, no el factor de pago. Se mantienen como sistema separado.

---

### 2.9 Sobrecumplimiento con Tope vs Sin Tope

**Variantes de industria para manejar >100% de cuota:**

| Estrategia | Mecánica | Ejemplo |
|-----------|----------|---------|
| **Tope (Cap)** | Máximo de pago fijo | Máx S/. 324, no importa si logra 150% |
| **Sin tope lineal** | Pago proporcional ilimitado | 150% cuota → 150% del variable = S/. 486 |
| **Acelerador sobre tope** | Tasa mayor después de 100% | 100-120% a tasa 1.0x, 120%+ a tasa 1.5x |
| **Tope con acelerador** | Tope más alto con tasa acelerada | Máx 150% del variable, pero de 100-150% paga a tasa 1.2x |

**Relevancia TEX:** ⭐⭐⭐ Alta. Ya se especificó en v3.0.1 del Editor. El multiplicador puede interactuar con el sobrecumplimiento.

---

## 3. TAXONOMÍA UNIFICADA PROPUESTA

Basado en la investigación, propongo esta clasificación para GridRetail:

### 3.1 Tipos de Multiplicador

| Tipo | Código | Factor típico | Criterio de activación |
|------|--------|---------------|------------------------|
| **Candado** | `LOCK` | 0.0 / 1.0 | Binario: cumple o no cumple condición |
| **Acelerador** | `ACCELERATOR` | >1.0 (ej: 1.2) | % cumplimiento supera umbral |
| **Desacelerador** | `DECELERATOR` | <1.0 (ej: 0.7) | % cumplimiento bajo umbral |
| **Proporcional** | `PROPORTIONAL` | 0.0 - 2.0+ | Igual al % de cumplimiento de cuota |
| **Cruzado** | `CROSS_PRODUCT` | Variable | Cumplimiento de OTRO producto |
| **Escalonado** | `TIERED` | Variable por rango | Rangos de cumplimiento con factores diferentes |

### 3.2 Criterios de Activación

| Criterio | Código | Descripción | Ejemplo |
|----------|--------|-------------|---------|
| **Cantidad mínima** | `MIN_QUANTITY` | Vender ≥N unidades de un producto | ≥2 MEP para desbloquear PACK |
| **% Cumplimiento propio** | `OWN_ATTAINMENT` | % logrado de la cuota de esta partida | 85% → factor 0.85 |
| **% Cumplimiento otro** | `OTHER_ATTAINMENT` | % logrado de cuota de otra partida | Cumplir RENO → +10% en VR |
| **% Cumplimiento global** | `GLOBAL_ATTAINMENT` | % logrado de cuota SS total | ≥100% SS total → 1.2x en PxQ |
| **Rango de cumplimiento** | `ATTAINMENT_RANGE` | Factor diferente por rango | 50-70%→0.8, 70-100%→1.0, 100%+→1.3 |
| **% Origen operador** | `OPERATOR_ORIGIN` | % de portabilidades de operador X | ≥40% de Claro → 1.1x |

### 3.3 Combinación de Multiplicadores

Cuando una partida tiene **múltiples multiplicadores**, se combinan multiplicativamente:

```
Comisión final = Variable × % cumplimiento × Mult_1 × Mult_2 × ... × Mult_N
```

**Ejemplo completo:**
```
Partida: OSS (Variable S/. 324)
HC logra: 90% de cuota OSS

Multiplicadores activos:
  1. Proporcional (OWN_ATTAINMENT): factor = 0.90
  2. Candado MEP (MIN_QUANTITY ≥2 seguros): factor = 1.0 (cumplido)
  3. Acelerador cruzado (cumplió RENO): factor = 1.10

Cálculo:
  S/. 324 × 0.90 × 1.0 × 1.10 = S/. 320.76
```

Si el candado MEP NO se cumple:
```
  S/. 324 × 0.90 × 0.0 × 1.10 = S/. 0.00
```

---

## 4. MAPEO CON SISTEMA ACTUAL GRIDRETAIL

### 4.1 Lo que ya existe y cómo migra

| Sistema Actual | Nuevo Modelo |
|---------------|--------------|
| `commission_item_locks` | Multiplicador tipo `LOCK` con criterio `MIN_QUANTITY` |
| Cumplimiento mínimo 50%/70% | Multiplicador tipo `LOCK` con criterio `OWN_ATTAINMENT` (umbral 50% o 70%) |
| Cálculo `percentage` (Variable × %) | Multiplicador tipo `PROPORTIONAL` con criterio `OWN_ATTAINMENT` |
| Tope Sí/No | Se mantiene como atributo de la partida (no es multiplicador) |
| Restricciones de mix | Se mantienen separadas (afectan unidades, no factor) |

### 4.2 Lo que se agrega

| Nuevo | Tipo | Uso esperado |
|-------|------|-------------|
| Aceleradores por sobrecumplimiento | `ACCELERATOR` / `TIERED` | +20% si supera 100% de cuota |
| Multiplicador cruzado | `CROSS_PRODUCT` | Vender RENO desbloquea +10% en VR |
| Desaceleradores opcionales | `DECELERATOR` | Reducir comisión si cumplimiento <70% |
| Rangos escalonados | `TIERED` | Factor diferente por rango de cumplimiento |

---

## 5. RECOMENDACIÓN: TÍTULO Y ESTRUCTURA EN EL EDITOR

### 5.1 Título: "Candados y Multiplicadores"

**Recomiendo mantenerlos UNIFICADOS** bajo el título **"Candados y Multiplicadores"** por estas razones:

1. **Conceptualmente son lo mismo**: Un candado ES un multiplicador (×0 o ×1)
2. **UI más simple**: Una sola sección para configurar todos los factores que afectan una partida
3. **Familiaridad**: Los usuarios de PBD ya conocen el término "candado" - no lo eliminamos, lo expandimos
4. **Menos confusión**: Tener "Candados" y "Multiplicadores" separados obliga al usuario a entender dónde poner cada regla

### 5.2 Estructura Propuesta en UI

```
┌─────────────────────────────────────────────────┐
│  PARTIDA: OSS (Variable S/. 324)                │
│                                                  │
│  [Sección existente: Meta, Peso, Mix, etc.]      │
│                                                  │
│  ─── Candados y Multiplicadores ───              │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ 🔒 Candado: MEP                    [✓]  │     │
│  │ Condición: Vender ≥2 seguros MEP         │     │
│  │ Si NO cumple: comisión = 0               │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ 📈 Acelerador: Sobrecumplimiento   [✓]  │     │
│  │ Condición: >100% de cuota OSS            │     │
│  │ Factor: ×1.2 (+20%)                      │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ 🔗 Cruzado: Cumplir RENO           [✓]  │     │
│  │ Condición: ≥100% cuota RENO              │     │
│  │ Factor: ×1.1 (+10%)                      │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  [+ Agregar multiplicador]                       │
│                                                  │
│  Factor combinado: ×1.32 (si todo se cumple)     │
│  Factor mínimo: ×0 (si candado no se cumple)     │
└─────────────────────────────────────────────────┘
```

### 5.3 Lo que NO recomiendo incluir en v3.1

| Concepto | Razón para excluir |
|----------|-------------------|
| **SPIFFs** | Son temporales, requieren módulo separado de campañas |
| **Team-based** | Requiere lógica de agrupación no implementada aún |
| **Matrix Commissions** | Demasiado complejo para la operación actual de TEX |
| **Desaceleradores** | Poco valor agregado vs complejidad. El cumplimiento mínimo ya cumple este rol |

---

## 6. RESUMEN EJECUTIVO

### Lo que investigamos
- Accelerators, decelerators, multipliers, SPIFFs, kickers, matrix commissions, contract multipliers, performance multipliers, team-based commissions, y quota attainment models.
- Fuentes: Forrester Research, QuotaPath, Level6, Bentega, Spiff, Performio, BlackHawk Network, entre otros.

### Lo que aplica a TEX/PBD
1. ✅ **Candados** (ya existen) → Se unifican como multiplicador ×0
2. ✅ **Multiplicador proporcional** (% de cumplimiento) → Ya existe implícitamente en cálculo "percentage"
3. ✅ **Aceleradores** → Nuevo: factor >1.0 al superar umbral
4. ✅ **Multiplicadores cruzados** → Nuevo: factor basado en otro producto
5. ✅ **Multiplicadores escalonados** → Nuevo: factores por rango de cumplimiento
6. ⏳ **SPIFFs** → Futuro: módulo separado de campañas temporales

### Decisión solicitada
- **Título sección**: "Candados y Multiplicadores" (unificado) ✅ Recomendado
- **Alcance v3.1**: Candados + Aceleradores + Cruzados + Escalonados
- **Siguiente paso**: Especificar la sección en el EDITOR_ESQUEMAS_SPEC v3.1
