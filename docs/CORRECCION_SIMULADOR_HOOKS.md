# Corrección Crítica - Simulador de Ingresos
## Discrepancia entre Documentación y BD Real

**Fecha:** 2026-02-03  
**Prioridad:** 🔴 CRÍTICA - El simulador no funciona  
**Módulo:** `lib/simulador/hooks.ts`

---

## 1. PROBLEMA

El simulador no calcula comisiones porque el código hace SELECT de columnas que **no existen** en la BD.

### Columnas Incorrectas

| Código usa | BD tiene | Solución |
|------------|----------|----------|
| `weight_percent` | `weight` | Renombrar en código |
| `calculation_type` | ❌ No existe | Obtener de `preset.default_calculation_type` |
| `category` | ❌ No existe | Obtener de `preset.default_category` |

### Estructura Real de `commission_scheme_items`

```sql
-- Columnas que SÍ existen:
id, scheme_id, item_type_id, preset_id
custom_name, custom_description, original_label
quota, quota_amount
weight,              -- ⚠️ NO es "weight_percent"
mix_factor
variable_amount
min_fulfillment
has_cap, cap_percentage, cap_amount
is_active, display_order, notes
-- Campos v3.x (todos existen):
contribution_type, range_source, uses_conversion_table
accelerator_ranges, measurement_type, fulfillment_method
measurement_config, overcompliance_mode
cap_units, pxq_bonus_amount, overcap_max_units, overcap_max_amount
variable_source

-- Columnas que NO existen (vienen de JOINs):
-- category → viene de preset.default_category o item_type.category
-- calculation_type → viene de preset.default_calculation_type o item_type.calculation_type
```

---

## 2. CORRECCIÓN EN hooks.ts

### 2.1 Función `loadSchemeWithItems()`

**ANTES (incorrecto):**
```typescript
const { data: itemsData, error: itemsError } = await supabase
  .from('commission_scheme_items')
  .select(`
    *,
    item_type:commission_item_types(code, name, category, calculation_type),
    preset:partition_presets(code, name, short_name, default_category, default_calculation_type),
    pxq_scales:commission_pxq_scales(*)
  `)
```

El `*` incluye columnas que no existen y causa error silencioso.

**DESPUÉS (correcto):**
```typescript
const { data: itemsData, error: itemsError } = await supabase
  .from('commission_scheme_items')
  .select(`
    id,
    scheme_id,
    item_type_id,
    preset_id,
    custom_name,
    custom_description,
    original_label,
    quota,
    quota_amount,
    weight,
    mix_factor,
    variable_amount,
    min_fulfillment,
    has_cap,
    cap_percentage,
    cap_amount,
    is_active,
    display_order,
    notes,
    contribution_type,
    range_source,
    uses_conversion_table,
    accelerator_ranges,
    measurement_type,
    fulfillment_method,
    measurement_config,
    overcompliance_mode,
    cap_units,
    pxq_bonus_amount,
    overcap_max_units,
    overcap_max_amount,
    variable_source,
    item_type:commission_item_types(
      id,
      code, 
      name, 
      category, 
      calculation_type
    ),
    preset:partition_presets(
      id,
      code, 
      name, 
      short_name, 
      default_category, 
      default_calculation_type
    ),
    pxq_scales:commission_pxq_scales(*)
  `)
  .eq('scheme_id', schemeId)
  .eq('is_active', true)
  .order('display_order')
```

### 2.2 Mapeo de Items

Después del SELECT, mapear los campos correctamente:

```typescript
// Mapear partidas con campos derivados
const itemsWithMapping: SchemeItemWithMapping[] = (itemsData || []).map(item => {
  // Obtener category y calculation_type de preset o item_type
  const category = item.preset?.default_category 
    || item.item_type?.category 
    || 'adicional'
  
  const calculationType = item.preset?.default_calculation_type 
    || item.item_type?.calculation_type 
    || 'percentage'
  
  return {
    ...item,
    // Mapear weight a weight_percent para compatibilidad con tipos existentes
    weight_percent: item.weight,
    // Campos derivados de joins
    category,
    calculation_type: calculationType,
    // Mapeos de tipos de venta
    mapped_tipos_venta: ventasMappings[item.id] || [],
    // Multiplicadores
    multipliers: multipliersMap[item.id] || []
  }
})
```

---

## 3. CORRECCIÓN EN types.ts

### 3.1 Interface `SchemeItemWithMapping`

Asegurar que los tipos reflejen la realidad:

```typescript
export interface SchemeItemWithMapping {
  id: string
  scheme_id: string
  item_type_id: string | null
  preset_id: string | null
  custom_name: string | null
  custom_description: string | null
  original_label: string | null
  quota: number | null
  quota_amount: number | null
  weight: number | null              // ⚠️ Campo real de la BD
  weight_percent?: number | null     // Campo mapeado para compatibilidad
  mix_factor: number | null
  variable_amount: number
  min_fulfillment: number | null
  has_cap: boolean
  cap_percentage: number | null
  cap_amount: number | null
  is_active: boolean
  display_order: number
  notes: string | null
  
  // Campos v3.x
  contribution_type: ContributionType
  range_source: RangeSource
  uses_conversion_table: boolean
  accelerator_ranges: TieredRanges | null
  measurement_type: MeasurementType
  fulfillment_method: FulfillmentMethod
  measurement_config: MeasurementConfig | null
  overcompliance_mode: OvercomplianceMode
  cap_units: number | null
  pxq_bonus_amount: number | null
  overcap_max_units: number | null
  overcap_max_amount: number | null
  variable_source: VariableSource
  
  // Campos derivados (de joins, no de la tabla)
  category?: ItemCategory            // Viene de preset.default_category
  calculation_type?: CalculationType // Viene de preset.default_calculation_type
  
  // Joins
  item_type?: {
    id: string
    code: string
    name: string
    category: ItemCategory
    calculation_type: CalculationType
  } | null
  preset?: {
    id: string
    code: string
    name: string
    short_name: string | null
    default_category: ItemCategory
    default_calculation_type: CalculationType
  } | null
  mapped_tipos_venta: TipoVentaMapping[]
  multipliers: ItemMultiplier[]
  pxq_scales?: PxQScale[]
}
```

---

## 4. CORRECCIÓN EN calculation-engine.ts

### 4.1 Funciones Helper

Actualizar para usar los campos correctos:

```typescript
/**
 * Obtiene la categoría efectiva de un item
 */
export function getEffectiveCategory(item: SchemeItemWithMapping): ItemCategory {
  // Prioridad: preset > item_type > default
  return item.preset?.default_category 
    || item.item_type?.category 
    || 'adicional'
}

/**
 * Obtiene el tipo de cálculo efectivo de un item
 */
export function getEffectiveCalculationType(item: SchemeItemWithMapping): CalculationType {
  return item.preset?.default_calculation_type 
    || item.item_type?.calculation_type 
    || 'percentage'
}

/**
 * Obtiene el peso del item (usa 'weight' de la BD)
 */
export function getItemWeight(item: SchemeItemWithMapping): number | null {
  return item.weight ?? item.weight_percent ?? null
}
```

### 4.2 En `calculateCommissionV2()`

Usar las funciones helper:

```typescript
// ANTES (incorrecto)
const category = item.category
const calcType = item.calculation_type
const weight = item.weight_percent

// DESPUÉS (correcto)
const category = getEffectiveCategory(item)
const calcType = getEffectiveCalculationType(item)
const weight = getItemWeight(item)
```

---

## 5. VERIFICACIÓN

Después de aplicar las correcciones, el simulador debería:

1. ✅ Cargar las partidas sin error
2. ✅ Mostrar el desglose en la tab "Detalle"
3. ✅ Calcular comisiones correctamente

### Test Esperado (Perfil 75%)

Con el esquema "Esquema Asesor Feb v2":
- Sueldo Fijo: S/. 1,130.00
- Variable (75% cumpl.): ~S/. 341.25 (suma de variable_amount × 0.75)
- **Total esperado: ~S/. 1,471.25**

---

## 6. ACTUALIZACIÓN DE DATA_DICTIONARY.md

También hay que corregir la documentación para que refleje la BD real:

```markdown
### 5.3 commission_scheme_items

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `weight` | DECIMAL | YES | - | Peso (0.45 = 45%) |
| ~~`weight_percent`~~ | ~~DECIMAL~~ | - | - | ❌ NO EXISTE |
| ~~`category`~~ | ~~VARCHAR~~ | - | - | ❌ Viene de preset.default_category |
| ~~`calculation_type`~~ | ~~VARCHAR~~ | - | - | ❌ Viene de preset.default_calculation_type |
```

---

## 7. RESUMEN DE ARCHIVOS A MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `lib/simulador/hooks.ts` | SELECT explícito, mapeo de campos |
| `lib/simulador/types.ts` | Ajustar interface SchemeItemWithMapping |
| `lib/simulador/calculation-engine.ts` | Usar funciones helper |
| `lib/simulador/profiles.ts` | Verificar uso de weight vs weight_percent |

---

**Prioridad de implementación:**
1. 🔴 hooks.ts - Sin esto nada funciona
2. 🟡 types.ts - Para consistencia
3. 🟢 calculation-engine.ts - Ya debería funcionar con el fix de hooks
