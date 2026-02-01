# Instrucciones para Claude Code - Actualización Módulo Cuotas
## Fecha: 2026-01-27

---

## CONTEXTO

Se ha ejecutado la migración `008_store_quota_entel_reference.sql` que agrega:
- Columna `ss_quota_entel` a `store_quotas` (cuota original de Entel, inmutable)
- La columna `ss_quota` ahora es la cuota operativa del SSNN (editable)
- Vistas actualizadas con nuevas columnas
- Función `update_store_quota_ssnn()` para actualizar cuota SSNN con validación
- Función `get_quota_period_summary()` para resumen del período

---

## CAMBIOS REQUERIDOS EN EL FRONTEND

### 1. Actualizar Tipos TypeScript

```typescript
// types/quota.ts

interface StoreQuota {
  id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  year: number;
  month: number;
  ss_quota_entel: number;      // NUEVO: Cuota original Entel
  ss_quota: number;            // Renombrar conceptualmente a "cuota SSNN"
  diferencia: number;          // NUEVO: ss_quota - ss_quota_entel
  quota_breakdown: object | null;
  status: 'draft' | 'approved';
  hc_count: number;
  ss_quota_distributed: number;
  ss_quota_pending: number;
}

interface QuotaPeriodSummary {
  total_stores: number;
  stores_with_quota: number;
  stores_distributed: number;
  total_ss_quota_entel: number;  // NUEVO
  total_ss_quota_ssnn: number;   // NUEVO (era total_ss_quota)
  total_diferencia: number;      // NUEVO
  total_hc_assigned: number;
  total_ss_distributed: number;
}
```

### 2. Actualizar Cards de Resumen

**Antes (1 card de cuota):**
```
┌─────────────┐
│ Cuota Total │
│  2,461 SS   │
└─────────────┘
```

**Después (3 cards):**
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐
│ Cuota SSNN      │  │ Cuota Entel     │  │ Diferencia  │
│    2,561 SS     │  │    2,461 SS     │  │   +100 ▲    │
│   (operativa)   │  │   (referencia)  │  │   (+4.1%)   │
└─────────────────┘  └─────────────────┘  └─────────────┘
```

**Componente sugerido:**
```tsx
// components/cuotas/QuotaSummaryCards.tsx

interface QuotaSummaryCardsProps {
  summary: QuotaPeriodSummary;
}

export function QuotaSummaryCards({ summary }: QuotaSummaryCardsProps) {
  const diferencia = summary.total_ss_quota_ssnn - summary.total_ss_quota_entel;
  const porcentaje = summary.total_ss_quota_entel > 0 
    ? ((diferencia / summary.total_ss_quota_entel) * 100).toFixed(1)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Cuota SSNN - Destacada */}
      <Card className="border-2 border-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cuota Total SSNN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {summary.total_ss_quota_ssnn.toLocaleString()} SS
          </div>
          <p className="text-xs text-muted-foreground">Cuota operativa</p>
        </CardContent>
      </Card>

      {/* Cuota Entel - Referencia */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cuota Total Entel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-muted-foreground">
            {summary.total_ss_quota_entel.toLocaleString()} SS
          </div>
          <p className="text-xs text-muted-foreground">Referencia oficial</p>
        </CardContent>
      </Card>

      {/* Diferencia */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Diferencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold flex items-center gap-1 ${
            diferencia > 0 ? 'text-green-600' : 
            diferencia < 0 ? 'text-orange-500' : 'text-gray-500'
          }`}>
            {diferencia > 0 ? '+' : ''}{diferencia}
            {diferencia !== 0 && (
              diferencia > 0 ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {diferencia !== 0 ? `(${diferencia > 0 ? '+' : ''}${porcentaje}%)` : 'Sin ajuste'}
          </p>
        </CardContent>
      </Card>

      {/* Tiendas (existente) */}
      <Card>
        {/* ... mantener igual ... */}
      </Card>
    </div>
  );
}
```

### 3. Actualizar Tabla de Tiendas

**Nuevas columnas:**
| Tienda | Entel | SSNN | Dif | HC | Distribuido | Estado | Acción |

**Componente de fila con input editable:**
```tsx
// components/cuotas/StoreQuotaRow.tsx

interface StoreQuotaRowProps {
  store: StoreQuota;
  onUpdateQuota: (id: string, newQuota: number) => Promise<void>;
  isUpdating: boolean;
}

export function StoreQuotaRow({ store, onUpdateQuota, isUpdating }: StoreQuotaRowProps) {
  const [localQuota, setLocalQuota] = useState(store.ss_quota);
  const [error, setError] = useState<string | null>(null);
  
  const diferencia = store.ss_quota - store.ss_quota_entel;
  const isModified = diferencia !== 0;
  
  const handleBlur = async () => {
    if (localQuota === store.ss_quota) return;
    
    // Validar que no sea menor que distribuido
    if (localQuota < store.ss_quota_distributed) {
      setError(`Mínimo: ${store.ss_quota_distributed} (ya distribuido)`);
      setLocalQuota(store.ss_quota);
      return;
    }
    
    setError(null);
    await onUpdateQuota(store.id, localQuota);
  };

  return (
    <TableRow>
      {/* Tienda */}
      <TableCell>
        <div>
          <p className="font-medium">{store.store_name}</p>
          <p className="text-xs text-muted-foreground">{store.store_code}</p>
        </div>
      </TableCell>
      
      {/* Cuota Entel (solo lectura) */}
      <TableCell className="text-center text-muted-foreground">
        {store.ss_quota_entel}
      </TableCell>
      
      {/* Cuota SSNN (editable) */}
      <TableCell>
        <div className="relative">
          <Input
            type="number"
            value={localQuota}
            onChange={(e) => setLocalQuota(parseInt(e.target.value) || 0)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            disabled={store.status === 'approved' || isUpdating}
            className={`w-20 text-center ${
              isModified ? 'border-blue-500 bg-blue-50' : ''
            } ${error ? 'border-red-500' : ''}`}
            min={0}
          />
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
      </TableCell>
      
      {/* Diferencia */}
      <TableCell className="text-center">
        <QuotaDifferenceIndicator diferencia={diferencia} />
      </TableCell>
      
      {/* HC Count */}
      <TableCell className="text-center">{store.hc_count}</TableCell>
      
      {/* Distribuido */}
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          {store.ss_quota_distributed}
          {store.ss_quota_pending === 0 ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <span className="text-xs px-1 py-0.5 bg-red-100 text-red-600 rounded">
              -{store.ss_quota_pending}
            </span>
          )}
        </div>
      </TableCell>
      
      {/* Estado */}
      <TableCell>
        <Badge variant={store.status === 'approved' ? 'default' : 'secondary'}>
          {store.status === 'approved' ? 'Aprobado' : 'Borrador'}
        </Badge>
      </TableCell>
      
      {/* Acción */}
      <TableCell>
        <Button variant="ghost" size="sm">
          Distribuir
        </Button>
      </TableCell>
    </TableRow>
  );
}
```

### 4. Indicador de Diferencia

```tsx
// components/cuotas/QuotaDifferenceIndicator.tsx

interface QuotaDifferenceIndicatorProps {
  diferencia: number;
  showPercentage?: boolean;
  baseValue?: number;
}

export function QuotaDifferenceIndicator({ 
  diferencia, 
  showPercentage = false,
  baseValue 
}: QuotaDifferenceIndicatorProps) {
  if (diferencia === 0) {
    return <span className="text-gray-400">-</span>;
  }
  
  const isPositive = diferencia > 0;
  const percentage = baseValue && baseValue > 0 
    ? ((diferencia / baseValue) * 100).toFixed(1) 
    : null;
  
  return (
    <span className={`flex items-center gap-0.5 font-medium ${
      isPositive ? 'text-green-600' : 'text-orange-500'
    }`}>
      {isPositive ? '+' : ''}{diferencia}
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {showPercentage && percentage && (
        <span className="text-xs ml-1">({isPositive ? '+' : ''}{percentage}%)</span>
      )}
    </span>
  );
}
```

### 5. Hook para Actualizar Cuota

```tsx
// hooks/useUpdateStoreQuota.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useUpdateStoreQuota() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ss_quota }: { id: string; ss_quota: number }) => {
      // Opción A: Usar la función SQL
      const { data, error } = await supabase.rpc('update_store_quota_ssnn', {
        p_store_quota_id: id,
        p_new_ss_quota: ss_quota,
        p_user_id: null // O el ID del usuario actual
      });
      
      // Opción B: Update directo (sin validación en BD)
      // const { data, error } = await supabase
      //   .from('store_quotas')
      //   .update({ ss_quota })
      //   .eq('id', id)
      //   .select()
      //   .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['store-quotas'] });
      queryClient.invalidateQueries({ queryKey: ['quota-summary'] });
    }
  });
}
```

### 6. Query de Supabase Actualizada

```typescript
// Para obtener datos de la vista actualizada
const { data: storeQuotas } = await supabase
  .from('vw_store_quotas_summary')
  .select('*')
  .eq('year', year)
  .eq('month', month)
  .order('store_code');

// Para obtener resumen del período
const { data: summary } = await supabase
  .rpc('get_quota_period_summary', { 
    p_year: year, 
    p_month: month 
  });
```

---

## ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. ✅ Ejecutar migración SQL (ya hecho)
2. Actualizar tipos TypeScript
3. Actualizar hook de datos para usar nuevas columnas
4. Crear componente `QuotaDifferenceIndicator`
5. Actualizar `QuotaSummaryCards` con 3 cards
6. Actualizar tabla de tiendas con nuevas columnas
7. Agregar input editable para cuota SSNN
8. Crear hook `useUpdateStoreQuota`
9. Probar flujo completo

---

## VALIDACIONES IMPORTANTES

1. **Cuota SSNN mínima:** No puede ser menor que `ss_quota_distributed`
2. **Cuota SSNN mínima:** No puede ser negativa
3. **Edición bloqueada:** Si `status === 'approved'`
4. **Visual feedback:** Input con borde azul si `ss_quota !== ss_quota_entel`

---

## ARCHIVOS A MODIFICAR

```
app/(dashboard)/cuotas/
├── page.tsx                         # Actualizar para usar nuevos datos
├── components/
│   ├── QuotaSummaryCards.tsx        # MODIFICAR: 3 cards
│   ├── StoreQuotaTable.tsx          # MODIFICAR: nuevas columnas
│   ├── StoreQuotaRow.tsx            # NUEVO o MODIFICAR: input editable
│   └── QuotaDifferenceIndicator.tsx # NUEVO
├── hooks/
│   ├── useQuotaPeriod.ts            # MODIFICAR: nuevos campos
│   └── useUpdateStoreQuota.ts       # NUEVO
└── types/
    └── quota.ts                     # MODIFICAR: nuevos tipos
```
