# Editor de Esquemas de Comisiones - Especificación Frontend
## GridRetail - Modelador de Comisiones HC

**Versión:** 3.0
**Fecha:** 2026-02-01
**Para:** Claude Code - Desarrollo Frontend

### Changelog
- **v3.0 (2026-02-01)**: Cambios significativos en lógica de partidas, corrección de bugs, nuevas funcionalidades
- **v2.1 (2026-01-26)**: UI simplificada del modal de partidas, orden de categorías de tipos de venta
- **v2.0 (2026-01-25)**: Sistema de presets para partidas, mapeo flexible de tipos de venta
- **v1.0 (2026-01-25)**: Versión inicial

---

## RESUMEN DE CAMBIOS v3.0

### 🔴 Bugs a Corregir

| ID | Pantalla | Descripción | Impacto |
|----|----------|-------------|---------|
| BUG-01 | Lista Esquemas | "Editar" en dropdown lleva a error 404 | Bloquea edición de datos generales |
| BUG-02 | Detalle Esquema | Solo muestra 1 partida de las N registradas | Información incompleta |
| BUG-03 | Detalle Esquema | Cálculo de % PRINCIPALES hecho sobre 1 partida | Dato erróneo |

### 🟡 Cambios Funcionales

| ID | Pantalla | Descripción |
|----|----------|-------------|
| CHG-01 | Lista Esquemas | Agregar acción "Eliminar" (solo esquemas Borrador) |
| CHG-02 | Nuevo Esquema | Sueldo Fijo default debe venir de BD (S/. 1,130) |
| CHG-03 | Agregar Partida | Meta ↔ Peso vinculados bidireccionalmente vía Cuota SS |
| CHG-04 | Agregar Partida | Factor Mix ahora es porcentaje (no decimal) |
| CHG-05 | Agregar Partida | Variable S/. es calculado (Factor Mix × Variable Total) |
| CHG-06 | Agregar Partida | Renombrar "Variable Máximo" → "Variable S/." |
| CHG-07 | Agregar Partida | Validaciones cruzadas en sumas de Meta, Peso y Mix |

---

## 1. PÁGINA INICIAL - Lista de Esquemas

### 1.1 BUG-01: Acción "Editar" → Error 404

**Comportamiento actual:** Al hacer click en "Editar" del dropdown de acciones, navega a una ruta que no existe (404).

**Comportamiento esperado:** "Editar" debe navegar a `/comisiones/esquemas/[id]/editar` y cargar el formulario de datos generales (misma estructura que "Nuevo Esquema") pre-poblado con los datos existentes del esquema.

**Implementación:**
```typescript
// En el dropdown de acciones
{
  label: 'Editar',
  icon: Pencil,
  // Navegar a la ruta de edición (reutiliza SchemeForm)
  onClick: () => router.push(`/comisiones/esquemas/${scheme.id}/editar`),
  // Solo visible si el esquema es draft
  visible: scheme.status === 'draft',
}
```

**Verificar que exista:** `app/(dashboard)/comisiones/esquemas/[id]/editar/page.tsx`

Este formulario debe:
- Cargar los datos del esquema por ID
- Usar el mismo componente `SchemeForm` que "Nuevo Esquema"
- Pre-rellenar todos los campos con los valores actuales
- Al guardar, hacer UPDATE en lugar de INSERT
- Redirigir al detalle del esquema tras guardar

---

### 1.2 CHG-01: Acción "Eliminar" para Borradores

**Nuevo requisito:** Agregar opción "Eliminar" en el dropdown de acciones.

**Reglas:**
- Solo visible cuando `status === 'draft'`
- Requiere confirmación con dialog
- Elimina el esquema Y todas sus partidas, candados y restricciones (CASCADE)
- Después de eliminar, refresca la lista

**Permisos para eliminar:** Solo `ADMIN` y `GERENTE_COMERCIAL`

**UI del dropdown de acciones actualizado:**

| Acción | Condición de visibilidad | Icono |
|--------|--------------------------|-------|
| Ver Detalle | Siempre | Eye |
| Editar | `status === 'draft'` | Pencil |
| Clonar | Siempre | Copy |
| Aprobar | `status === 'draft'` | Check |
| **Eliminar** | **`status === 'draft'`** | **Trash2 (rojo)** |

**Dialog de confirmación:**
```
┌──────────────────────────────────────────────┐
│  ¿Eliminar esquema?                          │
│                                              │
│  Se eliminará permanentemente el esquema     │
│  "{nombre}" y todas sus partidas,            │
│  candados y restricciones asociadas.         │
│                                              │
│  Esta acción no se puede deshacer.           │
│                                              │
│              [Cancelar]  [Eliminar]          │
│                           (rojo)             │
└──────────────────────────────────────────────┘
```

**Implementación backend:**
```typescript
// DELETE con cascade (las FK ya tienen ON DELETE CASCADE)
const { error } = await supabase
  .from('commission_schemes')
  .delete()
  .eq('id', schemeId)
  .eq('status', 'draft'); // Doble validación en backend

if (error) throw error;
toast.success('Esquema eliminado');
router.refresh();
```

---

## 2. NUEVO ESQUEMA / EDITAR ESQUEMA

### 2.1 CHG-02: Sueldo Fijo por defecto desde BD

**Comportamiento actual:** El Sueldo Fijo aparece con un valor por defecto (posiblemente hardcodeado o vacío).

**Comportamiento esperado:** El valor por defecto del Sueldo Fijo debe leerse de la base de datos para ser configurable sin tocar código.

**Opción A — Usar `system_config` (recomendada):**

Insertar en BD:
```sql
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES (
  'DEFAULT_FIXED_SALARY', 
  '1130', 
  'Sueldo fijo por defecto para nuevos esquemas de comisiones (en soles)',
  false, 
  'comisiones'
);
```

Leer en frontend al crear nuevo esquema:
```typescript
// Al cargar el formulario de nuevo esquema
const { data: config } = await supabase
  .from('system_config')
  .select('value')
  .eq('key', 'DEFAULT_FIXED_SALARY')
  .single();

const defaultFixedSalary = config ? parseFloat(config.value) : 1130;

// Usar como valor inicial del formulario
const form = useForm({
  defaultValues: {
    fixed_salary: defaultFixedSalary,  // S/. 1,130
    // ...otros campos
  }
});
```

**Nota:** Este valor es el que Entel define como sueldo fijo obligatorio (S/. 1,130). PBD puede ajustarlo (ej: S/. 1,050) en el esquema, pero el default debe ser el de Entel.

**Opción B alternativa — Agregar columna default en BD:**

Si se quiere más flexibilidad por tipo de esquema (asesor vs supervisor), se podría crear una tabla `commission_defaults` pero para MVP es suficiente con `system_config`.

**Configuraciones sugeridas adicionales para `system_config`:**

| Key | Value | Descripción |
|-----|-------|-------------|
| `DEFAULT_FIXED_SALARY` | `1130` | Sueldo fijo default (Entel) |
| `DEFAULT_VARIABLE_SALARY` | `1200` | Sueldo variable default (Entel) |
| `DEFAULT_MIN_FULFILLMENT` | `50` | Cumplimiento mínimo global default (%) |

---

## 3. DETALLE DE ESQUEMA

### 3.1 BUG-02 y BUG-03: Solo muestra 1 partida / Cálculo erróneo

**Pantalla:** `/comisiones/esquemas/[id]` (Vista Detalle / Resumen)

**Comportamiento actual:**
- La sección "Resumen de Partidas" muestra solo 1 partida
- El porcentaje junto a "PRINCIPALES" se calcula con solo esa partida

**Datos reales del esquema (visible en la pantalla de Partidas):**

| Tipo | Categoría | Meta | Peso | Variable |
|------|-----------|------|------|----------|
| OSS Total | Principal | 35 | 40% | S/ 480.00 |
| VR BASE / LLAA | Principal | 25 | 35% | S/ 420.00 |
| OPP | Principal | 4 | 5% | S/ 60.00 |
| VR CAPTURA | Principal | 14 | 20% | S/ 240.00 |

**Comportamiento esperado:**
- Mostrar TODAS las partidas del esquema
- El % de PRINCIPALES debe ser la suma real de los pesos: 40% + 35% + 5% + 20% = 100%

**Causa probable:** La query del componente `SchemeSummary` está haciendo `.single()` o `.limit(1)` en lugar de traer todas las partidas.

**Query correcta:**
```typescript
// Obtener TODAS las partidas del esquema
const { data: items } = await supabase
  .from('commission_scheme_items')
  .select(`
    *,
    commission_item_ventas (
      tipo_venta_id,
      cuenta_linea,
      cuenta_equipo,
      tipos_venta:tipo_venta_id (codigo, nombre, categoria)
    )
  `)
  .eq('scheme_id', schemeId)
  .order('display_order');

// Agrupar por categoría
const principales = items.filter(i => i.category === 'principal');
const adicionales = items.filter(i => i.category === 'adicional');
const pxq = items.filter(i => i.category === 'pxq');
const bonos = items.filter(i => i.category === 'bono');

// Calcular suma de pesos de principales
const sumaPesos = principales.reduce((sum, p) => sum + (p.weight || 0), 0);
// sumaPesos debería ser 1.0 (100%)
```

---

## 4. AGREGAR/EDITAR PARTIDA - Cambios de Lógica

### 4.1 Conceptos Clave (Nuevo Modelo v3.0)

El esquema tiene tres totales globales que se distribuyen entre las partidas:

| Concepto Global | Campo en Esquema | Se distribuye vía | Validación |
|----------------|------------------|-------------------|------------|
| **Cuota SS Total** | `total_ss_quota` (ej: 69 líneas) | **Meta** de cada partida | Σ Metas ≤ Cuota SS Total |
| **100% del peso** | Implícito | **Peso %** de cada partida | Σ Pesos ≤ 100% |
| **Variable Total S/.** | `variable_salary` (ej: S/. 1,200) | **Factor Mix %** de cada partida | Σ Factor Mix ≤ 100% |

**Relaciones bidireccionales:**

```
Meta ←→ Peso     (vinculados vía Cuota SS Total)
Factor Mix → Variable S/.  (calculado vía Variable Total S/.)
```

---

### 4.2 CHG-03: Meta ↔ Peso Vinculados Bidireccionalmente

**Fórmulas:**
```
Si el usuario ingresa Meta:
  Peso (%) = (Meta / Cuota SS Total) × 100

Si el usuario ingresa Peso:
  Meta = (Peso / 100) × Cuota SS Total
```

**Ejemplo con Cuota SS Total = 69 líneas:**

| Acción del usuario | Meta | Peso |
|-------------------|------|------|
| Ingresa Meta = 35 | 35 | **50.72%** (35/69×100) |
| Ingresa Peso = 40% | **27.6** (40%×69) | 40% |
| Ingresa Meta = 14 | 14 | **20.29%** (14/69×100) |

**Implementación:**
```typescript
const totalSSQuota = scheme.total_ss_quota; // ej: 69

// Cuando cambia Meta
const handleMetaChange = (newMeta: number) => {
  const calculatedWeight = (newMeta / totalSSQuota) * 100;
  form.setValue('quota', newMeta);
  form.setValue('weight', Math.round(calculatedWeight * 100) / 100); // 2 decimales
};

// Cuando cambia Peso
const handleWeightChange = (newWeight: number) => {
  const calculatedMeta = (newWeight / 100) * totalSSQuota;
  form.setValue('weight', newWeight);
  form.setValue('quota', Math.round(calculatedMeta * 100) / 100); // 2 decimales
};
```

**Control de edición:** Usar un flag `lastEditedField` para saber cuál campo actualizó al otro y evitar loops infinitos:
```typescript
const [lastEdited, setLastEdited] = useState<'meta' | 'peso' | null>(null);

// En el onChange de Meta
onChange={(value) => {
  setLastEdited('meta');
  handleMetaChange(value);
}}

// En el onChange de Peso  
onChange={(value) => {
  setLastEdited('peso');
  handleWeightChange(value);
}}
```

---

### 4.3 CHG-07: Validaciones Cruzadas (Meta y Peso)

Al ingresar o modificar una partida, validar en tiempo real:

**Validación 1: Suma de Metas ≤ Cuota SS Total**
```typescript
const metaActualPartidas = existingItems
  .filter(i => i.id !== currentItemId) // Excluir la partida que se está editando
  .reduce((sum, i) => sum + (i.quota || 0), 0);

const metaDisponible = totalSSQuota - metaActualPartidas;

if (newMeta > metaDisponible) {
  setError('quota', { 
    message: `Meta máxima disponible: ${metaDisponible} unidades (${totalSSQuota} total - ${metaActualPartidas} asignadas)` 
  });
}
```

**Validación 2: Suma de Pesos ≤ 100%**
```typescript
const pesoActualPartidas = existingItems
  .filter(i => i.id !== currentItemId)
  .reduce((sum, i) => sum + (i.weight || 0), 0);

const pesoDisponible = 100 - (pesoActualPartidas * 100); // Convertir de decimal a %

if (newWeight > pesoDisponible) {
  setError('weight', { 
    message: `Peso máximo disponible: ${pesoDisponible.toFixed(2)}% (100% - ${(pesoActualPartidas * 100).toFixed(2)}% asignado)` 
  });
}
```

**UI — Indicadores de disponibilidad en el modal:**
```
┌──────────────────────────────────────────────────┐
│  Configuración de Meta                           │
│                                                  │
│  Meta (unidades):        [___35___]              │
│  Disponible: 30 de 69                            │
│                                                  │
│  Peso (% de cuota SS):   [___50.72___]           │
│  Disponible: 43.48% de 100%                      │
│                                                  │
│  ⚠️ Nota: Meta y Peso están vinculados.          │
│  Al modificar uno, el otro se recalcula.         │
└──────────────────────────────────────────────────┘
```

---

### 4.4 CHG-04: Factor Mix como Porcentaje

**Antes (v2.1):** Factor Mix era un decimal (ej: 0.27)
**Ahora (v3.0):** Factor Mix es un porcentaje (ej: 27%)

**En la UI:** Mostrar campo con sufijo "%"
**En la BD:** Almacenar como decimal (0.27) — la conversión se hace en frontend

```typescript
// Al mostrar en el formulario
const displayMix = (item.mix_factor || 0) * 100; // 0.27 → 27

// Al guardar en BD
const dbMix = formValues.mix_factor / 100; // 27 → 0.27
```

**Validación: Suma de Factor Mix ≤ 100%**
```typescript
const mixActualPartidas = existingItems
  .filter(i => i.id !== currentItemId)
  .reduce((sum, i) => sum + (i.mix_factor || 0), 0);

const mixDisponible = (1 - mixActualPartidas) * 100; // En %

if (newMixPercent > mixDisponible) {
  setError('mix_factor', { 
    message: `Factor Mix máximo disponible: ${mixDisponible.toFixed(2)}%` 
  });
}
```

---

### 4.5 CHG-05 y CHG-06: Variable S/. Calculado

**Antes (v2.1):** "Variable Máximo" era un campo de entrada manual
**Ahora (v3.0):** "Variable S/." es un campo **calculado y de solo lectura**

**Fórmula:**
```
Variable S/. = (Factor Mix % / 100) × Variable Total S/.
```

**Ejemplo con Variable Total = S/. 1,200:**

| Factor Mix | Variable S/. |
|-----------|-------------|
| 40% | S/. 480.00 |
| 35% | S/. 420.00 |
| 5% | S/. 60.00 |
| 20% | S/. 240.00 |
| **Total: 100%** | **S/. 1,200.00** |

**Implementación:**
```typescript
const variableTotal = scheme.variable_salary; // ej: 1200

// Cuando cambia Factor Mix
const handleMixChange = (newMixPercent: number) => {
  const calculatedVariable = (newMixPercent / 100) * variableTotal;
  form.setValue('mix_factor', newMixPercent);
  form.setValue('variable_amount', Math.round(calculatedVariable * 100) / 100);
};
```

**UI del campo Variable S/.:**
```
┌──────────────────────────────────────────────────┐
│  Factor Mix (%):         [___40___]              │
│  Disponible: 25% de 100%                        │
│                                                  │
│  Variable S/.            S/ 480.00   (calculado) │
│  = 40% × S/ 1,200.00                            │
└──────────────────────────────────────────────────┘
```

El campo "Variable S/." debe:
- Ser **readonly** (no editable directamente)
- Mostrar el cálculo debajo como referencia
- Actualizarse automáticamente cuando cambia Factor Mix
- Tener un estilo visual diferente (ej: fondo gris) para indicar que es calculado

---

### 4.6 Resumen del Modal de Partida v3.0

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agregar Partida                                                       [X] │
│  Selecciona un preset o configura una partida personalizada               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Tipo de Partida                                                           │
│  ┌───────────────────┬───────────────────┬───────────────────┐            │
│  │   Agrupaciones    │    Individuales   │   Personalizado   │            │
│  └───────────────────┴───────────────────┴───────────────────┘            │
│                                                                            │
│  [Grid de presets - sin cambios vs v2.1]                                  │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  Nombre de la partida                                                      │
│  [______OSS Total______________________________]                           │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  Tipos de Venta que Aplican                                                │
│  [Sin cambios vs v2.1 - grid de chips seleccionables por categoría]       │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  Configuración de Meta                            ← CAMBIOS AQUÍ         │
│                                                                            │
│  Meta (unidades)         Peso (% de cuota SS)                              │
│  [___35___]              [___50.72___] %                                   │
│  Disponible: 30 de 69   Disponible: 43.48% de 100%                       │
│                                                                            │
│  ⓘ Meta y Peso están vinculados. Al modificar uno, el otro se recalcula. │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  Comisión                                         ← CAMBIOS AQUÍ         │
│                                                                            │
│  Factor Mix (%)          Variable S/.                                      │
│  [___40___] %            S/ 480.00  (calculado)                           │
│  Disponible: 25% de 100%  = 40% × S/ 1,200.00                            │
│                                                                            │
│  Σ Factor Mix: 75% de 100%                                                │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  Cumplimiento mínimo (%): [___50___] (vacío = usar global)                │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  ☐ Tiene tope máximo                                                       │
│     Porcentaje tope (%): [____]    Monto tope (S/.): [________]           │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  Notas (opcional): [_______________________________________________]      │
│                                                                            │
│  ☑ Partida activa                                                          │
│                                                                            │
│                                             [Cancelar]  [Agregar Partida] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.7 Tabla de Partidas - Columnas Actualizadas

La tabla en la pantalla de partidas (`/comisiones/esquemas/[id]/partidas`) debe reflejar los cambios:

| Columna | Antes (v2.1) | Ahora (v3.0) | Nota |
|---------|-------------|-------------|------|
| Tipo | ✓ | ✓ | Sin cambios |
| Categoría | ✓ | ✓ | Sin cambios |
| Meta | ✓ | ✓ | Sin cambios |
| Peso | ✓ | ✓ | Sin cambios |
| **Mix** | ✓ (decimal) | **Mostrar como %** | Ej: "27%" en vez de "0.27" |
| **Variable** | "Variable" | **"Variable S/."** | Renombrado |
| Cumpl. Mín | ✓ | ✓ | Sin cambios |
| Tope | ✓ | ✓ | Sin cambios |
| Candados | ✓ | ✓ | Sin cambios |
| Acciones | ✓ | ✓ | Sin cambios |

**Nuevo: Fila de totales al pie de la tabla:**
```
┌──────────┬──────┬───────┬───────┬────────────┐
│ ...      │ Meta │ Peso  │ Mix   │ Variable   │
├──────────┼──────┼───────┼───────┼────────────┤
│ OSS      │ 35   │ 40%   │ 40%   │ S/ 480.00  │
│ VR BASE  │ 25   │ 35%   │ 35%   │ S/ 420.00  │
│ OPP      │ 4    │ 5%    │ 5%    │ S/ 60.00   │
│ VR CAPT  │ 14   │ 20%   │ 20%   │ S/ 240.00  │
├──────────┼──────┼───────┼───────┼────────────┤
│ TOTAL    │ 78/69│ 100%  │ 100%  │ S/1,200.00 │
│          │ ⚠️   │ ✓     │ ✓     │ ✓          │
└──────────┴──────┴───────┴───────┴────────────┘
```

**Nota:** La suma de Metas puede exceder la Cuota SS Total si se incluyen partidas adicionales (RENO, PREPAGO, etc.) que no son parte de la cuota principal. La validación de ≤ 100% aplica solo a partidas principales.

---

## 5. VALIDACIONES ZOD ACTUALIZADAS (v3.0)

```typescript
// validations.ts v3.0
import { z } from 'zod';

export const schemeFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(150),
  code: z.string()
    .min(1, 'Código requerido')
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'Solo mayúsculas, números y guión bajo'),
  scheme_type: z.enum(['asesor', 'supervisor']),
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
  fixed_salary: z.number().min(0),
  variable_salary: z.number().min(0),
  total_ss_quota: z.number().min(1, 'Cuota debe ser mayor a 0'),
  default_min_fulfillment: z.number().min(0.01).max(1),
  description: z.string().optional(),
});

// v3.0: Schema actualizado para partidas
export const schemeItemFormSchema = z.object({
  // Selección de tipo (sin cambios)
  item_type_id: z.string().uuid().optional().nullable(),
  preset_id: z.string().uuid().optional().nullable(),
  custom_name: z.string().max(100).optional().nullable(),
  custom_description: z.string().max(500).optional().nullable(),
  tipos_venta_ids: z.array(z.object({
    tipo_venta_id: z.string().uuid(),
    cuenta_linea: z.boolean(),
    cuenta_equipo: z.boolean(),
  })).optional().nullable(),
  
  // v3.0: Meta y Peso vinculados
  quota: z.number().min(0).optional().nullable(),
  weight: z.number().min(0).max(100).optional().nullable(), // Ahora en % (0-100)
  
  // v3.0: Factor Mix como porcentaje
  mix_factor: z.number().min(0).max(100).optional().nullable(), // En % (0-100)
  
  // v3.0: Variable S/. calculado (readonly en UI pero se guarda)
  variable_amount: z.number().min(0),
  
  // Sin cambios
  min_fulfillment: z.number().min(0).max(100).optional().nullable(), // En %
  has_cap: z.boolean(),
  cap_percentage: z.number().min(0).max(200).optional().nullable(), // En %
  cap_amount: z.number().min(0).optional().nullable(),
  is_active: z.boolean(),
  display_order: z.number().min(0),
  notes: z.string().max(500).optional().nullable(),
});
```

**IMPORTANTE — Conversión Frontend ↔ BD:**

La BD almacena weight y mix_factor como decimales (0.40), pero el frontend v3.0 trabaja en porcentajes (40%). La conversión debe hacerse al leer y al escribir:

```typescript
// Al LEER de BD para mostrar en UI
const displayWeight = (dbWeight || 0) * 100;     // 0.40 → 40
const displayMix = (dbMixFactor || 0) * 100;     // 0.27 → 27

// Al ESCRIBIR a BD desde UI
const dbWeight = formWeight / 100;               // 40 → 0.40
const dbMixFactor = formMix / 100;               // 27 → 0.27
```

---

## 6. FUNCIONES AUXILIARES v3.0

```typescript
// calculations.ts v3.0

/**
 * Calcula el Peso a partir de Meta y Cuota SS Total
 */
export function calculateWeight(meta: number, totalSSQuota: number): number {
  if (totalSSQuota === 0) return 0;
  return Math.round((meta / totalSSQuota) * 10000) / 100; // 2 decimales en %
}

/**
 * Calcula la Meta a partir de Peso y Cuota SS Total
 */
export function calculateMeta(weightPercent: number, totalSSQuota: number): number {
  return Math.round((weightPercent / 100) * totalSSQuota * 100) / 100; // 2 decimales
}

/**
 * Calcula Variable S/. a partir de Factor Mix y Variable Total
 */
export function calculateVariable(mixPercent: number, variableTotal: number): number {
  return Math.round((mixPercent / 100) * variableTotal * 100) / 100; // 2 decimales
}

/**
 * Calcula disponibilidad para nueva partida
 */
export function getAvailability(
  existingItems: CommissionSchemeItem[],
  currentItemId: string | null,
  scheme: CommissionScheme
) {
  const otherItems = existingItems.filter(i => i.id !== currentItemId);
  
  const usedMeta = otherItems.reduce((sum, i) => sum + (i.quota || 0), 0);
  const usedWeight = otherItems.reduce((sum, i) => sum + (i.weight || 0), 0); // decimal
  const usedMix = otherItems.reduce((sum, i) => sum + (i.mix_factor || 0), 0); // decimal
  
  return {
    metaAvailable: scheme.total_ss_quota - usedMeta,
    metaTotal: scheme.total_ss_quota,
    weightAvailable: (1 - usedWeight) * 100, // en %
    weightUsed: usedWeight * 100, // en %
    mixAvailable: (1 - usedMix) * 100, // en %
    mixUsed: usedMix * 100, // en %
    variableAvailable: scheme.variable_salary * (1 - usedMix),
    variableTotal: scheme.variable_salary,
  };
}
```

---

## 7. RESUMEN DE CAMBIOS EN BD

### Cambios requeridos en BD (mínimos)

**1. Nuevo registro en `system_config`:**
```sql
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES 
  ('DEFAULT_FIXED_SALARY', '1130', 'Sueldo fijo default para nuevos esquemas (Entel)', false, 'comisiones'),
  ('DEFAULT_VARIABLE_SALARY', '1200', 'Sueldo variable default para nuevos esquemas (Entel)', false, 'comisiones'),
  ('DEFAULT_MIN_FULFILLMENT', '50', 'Cumplimiento mínimo global default (%)', false, 'comisiones');
```

**2. Verificar CASCADE en FK de `commission_scheme_items`:**
```sql
-- Verificar que la FK tenga ON DELETE CASCADE
-- Si no la tiene, agregar:
ALTER TABLE commission_scheme_items 
  DROP CONSTRAINT commission_scheme_items_scheme_id_fkey,
  ADD CONSTRAINT commission_scheme_items_scheme_id_fkey 
    FOREIGN KEY (scheme_id) REFERENCES commission_schemes(id) ON DELETE CASCADE;
```

**3. No se requieren cambios en columnas de BD.** Los campos `weight` y `mix_factor` siguen almacenándose como decimales. La conversión a/desde porcentaje es responsabilidad del frontend.

---

## 8. CHECKLIST DE IMPLEMENTACIÓN PARA CLAUDE CODE

### Prioridad 1 — Bugs bloqueantes
- [ ] BUG-01: Fix ruta "Editar" → crear/verificar `/comisiones/esquemas/[id]/editar/page.tsx`
- [ ] BUG-02: Fix query en vista detalle — traer TODAS las partidas del esquema
- [ ] BUG-03: Fix cálculo de % PRINCIPALES — sumar pesos de todas las partidas

### Prioridad 2 — Nuevas funcionalidades
- [ ] CHG-01: Agregar "Eliminar" en dropdown (solo draft, con confirmación)
- [ ] CHG-02: Leer `DEFAULT_FIXED_SALARY` de `system_config` (requiere INSERT en BD)

### Prioridad 3 — Cambios de lógica en partidas
- [ ] CHG-03: Vincular Meta ↔ Peso bidireccionalmente
- [ ] CHG-04: Factor Mix como porcentaje en UI
- [ ] CHG-05: Variable S/. calculado automáticamente (readonly)
- [ ] CHG-06: Renombrar "Variable Máximo" → "Variable S/."
- [ ] CHG-07: Validaciones cruzadas (sumas de Meta, Peso, Mix)
- [ ] Agregar indicadores de disponibilidad en modal
- [ ] Agregar fila de totales en tabla de partidas
- [ ] Conversión frontend ↔ BD (% ↔ decimal)

### SQL a ejecutar
- [ ] INSERT configs en `system_config`
- [ ] Verificar CASCADE en FK de `commission_scheme_items`

---

## 9. ELEMENTOS SIN CAMBIOS (referencia a v2.1)

Los siguientes elementos NO cambian en v3.0:
- Sistema de presets (Agrupaciones / Individuales / Personalizado)
- Tipos de venta y su mapeo
- Modal de candados
- Configurador de restricciones
- Flujo de aprobación
- Flujo de clonación
- Permisos por rol (excepto eliminar: solo ADMIN y GERENTE_COMERCIAL)
- Estructura de archivos
- Navegación y breadcrumbs

---

## PENDIENTE v3.1 (próxima iteración)

El usuario indicó que enviará cambios adicionales para:
- Modificaciones al sistema de candados
- Introducción del concepto de "multiplicador"

Estos cambios se documentarán en una versión v3.1 del SPEC.

---

**Este documento reemplaza las secciones modificadas de EDITOR_ESQUEMAS_SPEC v2.1. Para secciones no mencionadas aquí, referirse a v2.1.**
