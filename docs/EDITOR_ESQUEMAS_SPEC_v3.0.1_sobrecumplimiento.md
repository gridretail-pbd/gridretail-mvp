# Editor de Esquemas - Addendum v3.0.1
## Rediseño: Sección Sobrecumplimiento en Modal de Partida

**Fecha:** 2026-02-01
**Reemplaza:** Sección "Tiene tope máximo" del modal de Agregar/Editar Partida

---

## 1. CONCEPTO

La sección actual "Tiene tope máximo" con dos campos (Porcentaje tope y Monto tope) es limitada. Se reemplaza por una sección completa de **Sobrecumplimiento** que responde a la pregunta:

> **¿Qué sucede si el HC vende más que la meta de esta partida?**

### Tres modalidades:

| Modalidad | Descripción | Ejemplo (Meta=35, Variable=S/.480) |
|-----------|-------------|-------------------------------------|
| **Sin sobrecumplimiento** | Tope al 100%. No gana más aunque venda más | Vende 40 → gana S/. 480 |
| **Proporcional** | Sigue ganando al mismo rate por unidad extra | Vende 40 (114.3%) → gana S/. 548.57 |
| **Bono por unidad adicional** | Monto fijo por cada unidad encima de la meta | Vende 40 → gana S/. 480 + 5×S/.20 = S/. 580 |

En las modalidades 2 y 3, opcionalmente se puede establecer un **tope** para limitar la ganancia máxima.

---

## 2. DISEÑO UI

### 2.1 Estado inicial (colapsado)

Cuando el usuario aún no ha configurado sobrecumplimiento:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sobrecumplimiento                                                  │
│  ¿Qué sucede si el HC supera la meta?                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  (●) Sin sobrecumplimiento                                  │   │
│  │      Se paga máximo el Variable S/. al alcanzar 100%.       │   │
│  │                                                             │   │
│  │  ( ) Proporcional                                           │   │
│  │      Cada unidad adicional se paga al mismo valor unitario. │   │
│  │                                                             │   │
│  │  ( ) Bono por unidad adicional                              │   │
│  │      Monto fijo por cada unidad vendida sobre la meta.      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────┐                        │
│  │ 📊 Proyección                          │                        │
│  │ Al 100% (35 uds):  S/. 480.00         │                        │
│  │ Máximo posible:     S/. 480.00         │                        │
│  └────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Opción: Proporcional (sin tope)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sobrecumplimiento                                                  │
│  ¿Qué sucede si el HC supera la meta?                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ( ) Sin sobrecumplimiento                                  │   │
│  │  (●) Proporcional                                           │   │
│  │  ( ) Bono por unidad adicional                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Cada unidad adicional se paga al mismo valor proporcional.        │
│  Valor por unidad: S/. 13.71  (S/. 480 ÷ 35 uds)    ← calculado  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☐ Establecer tope                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────┐                        │
│  │ 📊 Proyección                          │                        │
│  │ Al 100% (35 uds):  S/. 480.00         │                        │
│  │ Máximo posible:     Sin límite         │                        │
│  └────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Opción: Proporcional CON tope

Cuando el usuario marca "Establecer tope", aparecen tres campos vinculados.
El usuario puede ingresar cualquiera de los tres y los otros dos se calculan.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sobrecumplimiento                                                  │
│  ¿Qué sucede si el HC supera la meta?                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ( ) Sin sobrecumplimiento                                  │   │
│  │  (●) Proporcional                                           │   │
│  │  ( ) Bono por unidad adicional                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Valor por unidad: S/. 13.71  (S/. 480 ÷ 35 uds)                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☑ Establecer tope                                           │   │
│  │                                                             │   │
│  │ Ingresa uno, los demás se calculan automáticamente.         │   │
│  │                                                             │   │
│  │   Tope %         Tope unidades      Tope S/.               │   │
│  │   [___120___]    [___42___]          [___576.00___]         │   │
│  │                                                             │   │
│  │   ℹ️ 120% de 35 = 42 uds → S/. 480 × 1.20 = S/. 576.00   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────┐                        │
│  │ 📊 Proyección                          │                        │
│  │ Al 100% (35 uds):    S/. 480.00       │                        │
│  │ Al tope (42 uds):    S/. 576.00       │                        │
│  │ Adicional:           +S/.  96.00       │                        │
│  └────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Opción: Bono por unidad adicional (sin tope)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sobrecumplimiento                                                  │
│  ¿Qué sucede si el HC supera la meta?                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ( ) Sin sobrecumplimiento                                  │   │
│  │  ( ) Proporcional                                           │   │
│  │  (●) Bono por unidad adicional                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Monto por cada unidad adicional:                                  │
│  S/. [___20.00___]                                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☐ Establecer tope                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────┐                        │
│  │ 📊 Proyección                          │                        │
│  │ Al 100% (35 uds):  S/. 480.00         │                        │
│  │ Máximo posible:     Sin límite         │                        │
│  │                                        │                        │
│  │ Ejemplo: si vende 40 uds (+5):         │                        │
│  │ S/. 480 + 5 × S/.20 = S/. 580.00      │                        │
│  └────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.5 Opción: Bono por unidad adicional CON tope

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sobrecumplimiento                                                  │
│  ¿Qué sucede si el HC supera la meta?                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ( ) Sin sobrecumplimiento                                  │   │
│  │  ( ) Proporcional                                           │   │
│  │  (●) Bono por unidad adicional                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Monto por cada unidad adicional:                                  │
│  S/. [___20.00___]                                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☑ Establecer tope                                           │   │
│  │                                                             │   │
│  │ Ingresa uno, el otro se calcula automáticamente.            │   │
│  │                                                             │   │
│  │   Máx. unidades adicionales     Máx. bono adicional        │   │
│  │   [___10___]                    S/. [___200.00___]          │   │
│  │                                                             │   │
│  │   ℹ️ 10 uds × S/.20 = S/. 200.00 adicionales              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 📊 Proyección                          │                        │
│  │ Al 100% (35 uds):    S/. 480.00       │                        │
│  │ Al tope (45 uds):    S/. 680.00       │                        │
│  │ Adicional:           +S/. 200.00       │                        │
│  └────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. LÓGICA DE VINCULACIÓN DE CAMPOS

### 3.1 Proporcional con tope

Los tres campos están vinculados. El usuario edita uno y los otros se recalculan.

**Variables disponibles:**
- `meta` = Meta de la partida (ej: 35)
- `variable` = Variable S/. de la partida (ej: 480)
- `valorUnitario` = variable / meta (ej: 13.71)

**Fórmulas:**

| Usuario ingresa | Se calcula |
|-----------------|------------|
| **Tope %** (ej: 120) | Tope uds = meta × (tope% / 100) = 35 × 1.20 = 42 |
| | Tope S/. = variable × (tope% / 100) = 480 × 1.20 = 576 |
| **Tope unidades** (ej: 42) | Tope % = (topeUds / meta) × 100 = (42/35) × 100 = 120% |
| | Tope S/. = topeUds × valorUnitario = 42 × 13.71 = 576 |
| **Tope S/.** (ej: 576) | Tope % = (topeS / variable) × 100 = (576/480) × 100 = 120% |
| | Tope uds = topeS / valorUnitario = 576 / 13.71 = 42 |

```typescript
// Proporcional - vinculación de topes
const valorUnitario = variable / meta; // S/. por unidad

const handleCapPercentChange = (pct: number) => {
  form.setValue('cap_percentage', pct);
  form.setValue('cap_units', Math.round(meta * (pct / 100) * 100) / 100);
  form.setValue('cap_amount', Math.round(variable * (pct / 100) * 100) / 100);
};

const handleCapUnitsChange = (units: number) => {
  form.setValue('cap_units', units);
  form.setValue('cap_percentage', Math.round((units / meta) * 10000) / 100);
  form.setValue('cap_amount', Math.round(units * valorUnitario * 100) / 100);
};

const handleCapAmountChange = (amount: number) => {
  form.setValue('cap_amount', amount);
  form.setValue('cap_percentage', Math.round((amount / variable) * 10000) / 100);
  form.setValue('cap_units', Math.round((amount / valorUnitario) * 100) / 100);
};
```

### 3.2 Bono por unidad adicional con tope

Solo dos campos vinculados (unidades ↔ monto).

**Variables:**
- `pxqAmount` = Monto PxQ por unidad (ej: 20)

**Fórmulas:**

| Usuario ingresa | Se calcula |
|-----------------|------------|
| **Máx. unidades** (ej: 10) | Máx. bono = maxUds × pxqAmount = 10 × 20 = S/. 200 |
| **Máx. bono S/.** (ej: 200) | Máx. unidades = maxBono / pxqAmount = 200 / 20 = 10 |

```typescript
// PxQ - vinculación de topes
const handleMaxUnitsChange = (units: number) => {
  form.setValue('overcap_max_units', units);
  form.setValue('overcap_max_amount', Math.round(units * pxqAmount * 100) / 100);
};

const handleMaxAmountChange = (amount: number) => {
  form.setValue('overcap_max_amount', amount);
  form.setValue('overcap_max_units', Math.round((amount / pxqAmount) * 100) / 100);
};
```

---

## 4. PROYECCIÓN (Card informativa)

La card de Proyección se actualiza en tiempo real según la configuración:

```typescript
interface Projection {
  baseAmount: number;      // Variable S/. (al 100%)
  baseUnits: number;       // Meta
  maxAmount: number | null; // null = sin límite
  maxUnits: number | null;
  additionalAmount: number | null; // maxAmount - baseAmount
  method: string;          // Descripción del método
}

function calculateProjection(
  meta: number,
  variable: number,
  overcompliance: OvercomplianceConfig
): Projection {
  const base = { baseAmount: variable, baseUnits: meta };

  switch (overcompliance.mode) {
    case 'none':
      return { ...base, maxAmount: variable, maxUnits: meta, 
               additionalAmount: 0, method: 'Tope al 100%' };
    
    case 'proportional':
      if (!overcompliance.hasCap) {
        return { ...base, maxAmount: null, maxUnits: null,
                 additionalAmount: null, method: 'Proporcional sin límite' };
      }
      const propMax = variable * (overcompliance.capPercentage / 100);
      return { ...base, maxAmount: propMax, 
               maxUnits: meta * (overcompliance.capPercentage / 100),
               additionalAmount: propMax - variable,
               method: `Proporcional hasta ${overcompliance.capPercentage}%` };
    
    case 'pxq_bonus':
      if (!overcompliance.hasCap) {
        return { ...base, maxAmount: null, maxUnits: null,
                 additionalAmount: null, 
                 method: `S/.${overcompliance.pxqAmount} por unidad extra, sin límite` };
      }
      const bonus = overcompliance.maxUnits * overcompliance.pxqAmount;
      return { ...base, 
               maxAmount: variable + bonus,
               maxUnits: meta + overcompliance.maxUnits,
               additionalAmount: bonus,
               method: `S/.${overcompliance.pxqAmount} por unidad extra, máx ${overcompliance.maxUnits} uds` };
  }
}
```

**Componente UI de Proyección:**

```typescript
// ProjectionCard.tsx
<Card className="bg-muted/50">
  <CardContent className="pt-4 pb-3 space-y-1">
    <p className="text-sm font-medium">📊 Proyección</p>
    
    <div className="flex justify-between text-sm">
      <span>Al 100% ({projection.baseUnits} uds):</span>
      <span className="font-semibold">S/. {projection.baseAmount.toFixed(2)}</span>
    </div>
    
    {projection.maxAmount !== null ? (
      <>
        <div className="flex justify-between text-sm">
          <span>Al tope ({projection.maxUnits} uds):</span>
          <span className="font-semibold">S/. {projection.maxAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-green-600">
          <span>Adicional:</span>
          <span>+S/. {projection.additionalAmount.toFixed(2)}</span>
        </div>
      </>
    ) : (
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Máximo posible:</span>
        <span>Sin límite</span>
      </div>
    )}
  </CardContent>
</Card>
```

---

## 5. MODELO DE DATOS

### 5.1 Campos en `commission_scheme_items`

**Campos actuales (v2.1):**
- `has_cap` BOOLEAN
- `cap_percentage` DECIMAL
- `cap_amount` DECIMAL

**Campos propuestos (v3.0.1) — requiere migración:**

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `overcompliance_mode` | VARCHAR(20) | `'none'` | `'none'`, `'proportional'`, `'pxq_bonus'` |
| `has_cap` | BOOLEAN | false | Si tiene tope (aplica a proporcional y pxq) |
| `cap_percentage` | DECIMAL(8,4) | NULL | Tope en % (solo proporcional). Ej: 1.20 para 120% |
| `cap_units` | DECIMAL(10,2) | NULL | Tope en unidades totales (calculado o ingresado) |
| `cap_amount` | DECIMAL(12,2) | NULL | Tope en soles (calculado o ingresado) |
| `pxq_bonus_amount` | DECIMAL(10,2) | NULL | Monto PxQ por unidad adicional (solo pxq_bonus) |
| `overcap_max_units` | DECIMAL(10,2) | NULL | Máx unidades adicionales (solo pxq_bonus con tope) |
| `overcap_max_amount` | DECIMAL(12,2) | NULL | Máx monto adicional (solo pxq_bonus con tope) |

### 5.2 SQL de Migración

```sql
-- ============================================================================
-- MIGRACIÓN: Sobrecumplimiento en partidas de comisión
-- Módulo: Comisiones
-- Fecha: 2026-02-01
-- ============================================================================

-- 1. Agregar nuevos campos
ALTER TABLE commission_scheme_items
  ADD COLUMN IF NOT EXISTS overcompliance_mode VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cap_units DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS pxq_bonus_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS overcap_max_units DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS overcap_max_amount DECIMAL(12,2);

-- 2. Constraint para overcompliance_mode
ALTER TABLE commission_scheme_items
  ADD CONSTRAINT commission_scheme_items_overcompliance_mode_check
  CHECK (overcompliance_mode IN ('none', 'proportional', 'pxq_bonus'));

-- 3. Migrar datos existentes: si has_cap=true y cap_percentage>0 → proporcional con tope
UPDATE commission_scheme_items
SET overcompliance_mode = 'proportional'
WHERE has_cap = true AND (cap_percentage IS NOT NULL OR cap_amount IS NOT NULL);

-- 4. Para items sin tope previo, dejar como 'none'
-- (ya es el default, no necesita UPDATE)

-- 5. Comentarios
COMMENT ON COLUMN commission_scheme_items.overcompliance_mode IS 
  'Modo de sobrecumplimiento: none (tope 100%), proportional, pxq_bonus';
COMMENT ON COLUMN commission_scheme_items.cap_units IS 
  'Tope en unidades totales (vinculado con cap_percentage y cap_amount)';
COMMENT ON COLUMN commission_scheme_items.pxq_bonus_amount IS 
  'Monto fijo por cada unidad vendida por encima de la meta';
COMMENT ON COLUMN commission_scheme_items.overcap_max_units IS 
  'Máximo de unidades adicionales permitidas (solo para pxq_bonus con tope)';
COMMENT ON COLUMN commission_scheme_items.overcap_max_amount IS 
  'Máximo monto adicional permitido (solo para pxq_bonus con tope)';
```

---

## 6. TIPOS TYPESCRIPT

```typescript
// types.ts - Overcompliance
type OvercomplianceMode = 'none' | 'proportional' | 'pxq_bonus';

interface OvercomplianceConfig {
  mode: OvercomplianceMode;
  
  // Para 'proportional' con tope
  hasCap: boolean;
  capPercentage?: number;  // ej: 120 (en UI), 1.20 (en BD)
  capUnits?: number;       // ej: 42
  capAmount?: number;      // ej: 576
  
  // Para 'pxq_bonus'
  pxqBonusAmount?: number;     // ej: 20 (S/. por unidad extra)
  overcapMaxUnits?: number;    // ej: 10 (máx uds adicionales)
  overcapMaxAmount?: number;   // ej: 200 (máx bono adicional)
}

// Función para extraer config de los campos del form
function getOvercomplianceFromItem(item: CommissionSchemeItem): OvercomplianceConfig {
  return {
    mode: item.overcompliance_mode || 'none',
    hasCap: item.has_cap || false,
    capPercentage: item.cap_percentage ? item.cap_percentage * 100 : undefined,
    capUnits: item.cap_units || undefined,
    capAmount: item.cap_amount || undefined,
    pxqBonusAmount: item.pxq_bonus_amount || undefined,
    overcapMaxUnits: item.overcap_max_units || undefined,
    overcapMaxAmount: item.overcap_max_amount || undefined,
  };
}
```

---

## 7. VALIDACIONES ZOD

```typescript
// Validación del bloque de sobrecumplimiento
const overcomplianceSchema = z.discriminatedUnion('overcompliance_mode', [
  // Sin sobrecumplimiento
  z.object({
    overcompliance_mode: z.literal('none'),
  }),
  
  // Proporcional
  z.object({
    overcompliance_mode: z.literal('proportional'),
    has_cap: z.boolean(),
    cap_percentage: z.number().min(100.01).max(500).optional().nullable(),
    cap_units: z.number().min(0).optional().nullable(),
    cap_amount: z.number().min(0).optional().nullable(),
  }).refine(
    (data) => !data.has_cap || (data.cap_percentage && data.cap_percentage > 100),
    { message: 'Si hay tope, debe ser mayor a 100%' }
  ),
  
  // PxQ Bonus
  z.object({
    overcompliance_mode: z.literal('pxq_bonus'),
    pxq_bonus_amount: z.number().min(0.01, 'Monto por unidad requerido'),
    has_cap: z.boolean(),
    overcap_max_units: z.number().min(1).optional().nullable(),
    overcap_max_amount: z.number().min(0).optional().nullable(),
  }),
]);
```

---

## 8. IMPACTO EN SIMULADOR

El simulador de comisiones debe usar `overcompliance_mode` para calcular:

```typescript
function calculateItemCommission(
  item: CommissionSchemeItem,
  salesCount: number,  // unidades vendidas
): number {
  const meta = item.quota;
  const variable = item.variable_amount;
  const fulfillment = salesCount / meta;  // ej: 1.143 para 40/35
  
  // Base: comisión al 100% o proporcional hasta 100%
  const baseFulfillment = Math.min(fulfillment, 1.0);
  let commission = variable * baseFulfillment;
  
  // Si no alcanza cumplimiento mínimo → 0
  const minFulfillment = item.min_fulfillment || scheme.default_min_fulfillment;
  if (fulfillment < minFulfillment) return 0;
  
  // Sobrecumplimiento
  if (fulfillment > 1.0) {
    switch (item.overcompliance_mode) {
      case 'none':
        // No pagar nada extra
        break;
        
      case 'proportional':
        commission = variable * fulfillment;
        if (item.has_cap && item.cap_percentage) {
          const maxFulfillment = item.cap_percentage; // decimal, ej: 1.20
          commission = variable * Math.min(fulfillment, maxFulfillment);
        }
        break;
        
      case 'pxq_bonus':
        const extraUnits = salesCount - meta;
        let bonus = extraUnits * item.pxq_bonus_amount;
        if (item.has_cap && item.overcap_max_units) {
          bonus = Math.min(extraUnits, item.overcap_max_units) * item.pxq_bonus_amount;
        }
        commission = variable + bonus;  // base 100% + bonus
        break;
    }
  }
  
  return Math.round(commission * 100) / 100;
}
```

---

## 9. RESUMEN DE IMPLEMENTACIÓN

### BD (SQL)
- [ ] Agregar 5 columnas a `commission_scheme_items`
- [ ] Agregar CHECK constraint para `overcompliance_mode`
- [ ] Migrar datos existentes (has_cap=true → proportional)

### Frontend
- [ ] Crear componente `OvercomplianceSection` (radio group + campos condicionales)
- [ ] Crear componente `ProjectionCard` (card informativa con cálculos en tiempo real)
- [ ] Integrar en `SchemeItemModal` reemplazando la sección "Tiene tope máximo"
- [ ] Vinculación bidireccional de campos de tope (3 campos para proporcional, 2 para PxQ)
- [ ] Actualizar tabla de partidas para mostrar el modo de sobrecumplimiento

### Simulador (futuro)
- [ ] Actualizar `simulate_hc_commission()` para usar los nuevos campos
- [ ] Actualizar función SQL o crear nueva que soporte los 3 modos

---

## 10. VISUALIZACIÓN EN TABLA DE PARTIDAS

En la tabla de partidas, la columna "Tope" actual se reemplaza por "Sobrecumplimiento":

| Tipo | Meta | Peso | Mix | Variable S/. | Cumpl. | **Sobrecumpl.** |
|------|------|------|-----|-------------|--------|-----------------|
| OSS | 35 | 40% | 40% | S/ 480 | 50% | Proporcional ≤120% |
| VR BASE | 25 | 35% | 35% | S/ 420 | 50% | S/.20/ud extra ≤10 uds |
| OPP | 4 | 5% | 5% | S/ 60 | 50% | Sin sobrecumpl. |
| VR CAPT | 14 | 20% | 20% | S/ 240 | 70% | Proporcional (sin tope) |

**Formato de texto en celda:**

| Modo | Texto en celda |
|------|---------------|
| `none` | Sin sobrecumpl. |
| `proportional` sin tope | Proporcional ∞ |
| `proportional` con tope | Proporcional ≤{capPct}% |
| `pxq_bonus` sin tope | S/.{monto}/ud extra ∞ |
| `pxq_bonus` con tope | S/.{monto}/ud extra ≤{maxUds} uds |
