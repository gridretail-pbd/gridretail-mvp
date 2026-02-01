# Especificaciones: Registro de Arribos (Tráfico de Clientes)
## GridRetail - Módulo de Arribos

**Versión:** 1.1  
**Actualización:** 2026-01-27  
**Estado:** ✅ Validado contra BD de producción

---

## Resumen

El módulo de **Registro de Arribos** permite capturar el tráfico de clientes que llegan a las tiendas. Este registro es fundamental para calcular la **tasa de conversión** (ventas/arribos) y analizar el desempeño comercial de cada punto de venta.

**Ruta:** `/dashboard/arribos/nuevo`  
**Archivo principal:** `app/(dashboard)/dashboard/arribos/nuevo/page.tsx`

---

## Roles con Acceso

| Rol | Puede Registrar | Ve todas las tiendas |
|-----|-----------------|----------------------|
| ASESOR | Sí | Solo asignadas |
| ASESOR_REFERENTE | Sí | Solo asignadas |
| COORDINADOR | Sí | Solo asignadas |
| SUPERVISOR | Sí | Solo asignadas |
| JEFE_VENTAS | Sí | Solo asignadas |
| GERENTE_COMERCIAL | Sí | Solo asignadas |
| GERENTE_GENERAL | Sí | Solo asignadas |
| BACKOFFICE_OPERACIONES | Sí | Solo asignadas |
| VALIDADOR_ARRIBOS | Sí | Solo asignadas |
| ADMIN | Sí | Todas |

**Nota:** Los roles ven solo las tiendas asignadas en `usuarios_tiendas`, excepto ADMIN que ve todas.

**Roles sin acceso:** BACKOFFICE_RRHH, BACKOFFICE_AUDITORIA (no registran arribos).

---

## Estructura del Formulario

### Campos del Formulario

| Campo | Tipo | Requerido | Valores | Descripción |
|-------|------|-----------|---------|-------------|
| `tienda_id` | Select | Sí | UUID de tienda | Tienda donde ocurre el arribo |
| `dni_cliente` | Input | No | 8 dígitos | DNI del cliente (opcional) |
| `es_cliente_entel` | Select | Sí | SI, NO, NO_SABE | Si ya es cliente Entel |
| `tipo_visita` | Select | Sí | VENTA, POSVENTA | Propósito de la visita |
| `concreto_operacion` | Select | Sí | SI, NO | Si completó alguna operación |
| `se_vendio` | Select | Condicional* | SI, NO | Si se realizó venta |
| `motivo_no_venta` | Select | Condicional** | Ver catálogo | Razón de no venta |

*Solo visible cuando `tipo_visita = 'VENTA'`  
**Solo visible cuando `tipo_visita = 'VENTA'` Y `se_vendio = 'NO'`

---

## Catálogo: Motivos de No Venta

| Código | Descripción | Validado en BD |
|--------|-------------|----------------|
| `SIN_STOCK` | Sin stock | ✅ |
| `PRECIO_ALTO` | Precio muy alto | ✅ |
| `NO_CALIFICA` | No califica crédito | ✅ |
| `SOLO_CONSULTA` | Solo consulta | ✅ |
| `DOCS_INCOMPLETOS` | Documentos incompletos | ✅ |
| `PROBLEMA_SISTEMA` | Problema sistema | ✅ |
| `OTRO` | Otro | ✅ |

**Constraint en BD:** `arribos_motivo_no_venta_check`

---

## Flujo de Registro

```
[Cliente llega a tienda]
         │
         ▼
┌─────────────────────┐
│ Seleccionar Tienda  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ DNI Cliente (opc.)  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ ¿Es cliente Entel?  │
│  SI / NO / NO_SABE  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   Tipo de Visita    │
│   VENTA / POSVENTA  │
└─────────────────────┘
         │
    ┌────┴────┐
    │         │
  VENTA    POSVENTA
    │         │
    ▼         │
┌─────────┐   │
│¿Se vendió?│  │
│ SI / NO │   │
└─────────┘   │
    │         │
   NO         │
    │         │
    ▼         │
┌───────────┐ │
│Motivo no  │ │
│venta      │ │
└───────────┘ │
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────────┐
│¿Concretó operación? │
│      SI / NO        │
└─────────────────────┘
         │
         ▼
    [REGISTRAR]
```

---

## Conversión de Valores (Frontend → BD)

| Campo | Valor Frontend | Valor BD |
|-------|----------------|----------|
| `es_cliente_entel` | "SI" | `true` |
| `es_cliente_entel` | "NO" | `false` |
| `es_cliente_entel` | "NO_SABE" | `null` |
| `concreto_operacion` | "SI" | `true` |
| `concreto_operacion` | "NO" | `false` |
| `se_vendio` | "SI" | `true` |
| `se_vendio` | "NO" | `false` |
| `se_vendio` | (POSVENTA) | `null` |

---

## Datos Enviados al Backend

```typescript
{
  // Automáticos (generados por el frontend)
  fecha: string,           // YYYY-MM-DD (fecha actual)
  hora: string,            // HH:mm:ss (hora actual)
  usuario_id: string,      // UUID del usuario logueado
  registrado_por: string,  // ID del usuario que registra (VARCHAR)

  // Del formulario
  tienda_id: string,                    // UUID
  dni_cliente: string | null,           // 8 dígitos o null
  es_cliente_entel: boolean | null,     // true/false/null
  tipo_visita: 'VENTA' | 'POSVENTA',
  concreto_operacion: boolean,
  se_vendio: boolean | null,            // null si POSVENTA
  motivo_no_venta: string | null,       // null si se_vendio=true o POSVENTA
}
```

---

## Tipo de Datos: Arribo

```typescript
interface Arribo {
  id: string
  fecha: string
  hora: string
  tienda_id: string
  usuario_id: string
  registrado_por?: string

  dni_cliente?: string
  es_cliente_entel?: boolean | null
  tipo_visita: 'VENTA' | 'POSVENTA'
  concreto_operacion: boolean
  se_vendio?: boolean | null
  motivo_no_venta?: string | null

  created_at: string
  updated_at: string
}
```

---

## API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/arribos` | POST | Registra nuevo arribo |

### POST `/api/arribos`

**Request Body:**
```json
{
  "fecha": "2026-01-27",
  "hora": "14:30:00",
  "tienda_id": "uuid-tienda",
  "usuario_id": "uuid-usuario",
  "registrado_por": "uuid-usuario",
  "dni_cliente": "12345678",
  "es_cliente_entel": false,
  "tipo_visita": "VENTA",
  "concreto_operacion": false,
  "se_vendio": false,
  "motivo_no_venta": "NO_CALIFICA"
}
```

**Response (éxito):**
```json
{
  "success": true,
  "arribo": { /* objeto arribo creado */ }
}
```

**Response (error):**
```json
{
  "error": "mensaje de error"
}
```

---

## Carga de Tiendas

El sistema carga las tiendas según el rol del usuario:

```typescript
// Si es ADMIN → todas las tiendas activas
if (user.rol === 'ADMIN') {
  query = supabase.from('tiendas').select('*').eq('activa', true)
}

// Si no es ADMIN → solo tiendas asignadas
else {
  // 1. Obtener IDs de tiendas asignadas
  const tiendaIds = await supabase
    .from('usuarios_tiendas')
    .select('tienda_id')
    .eq('usuario_id', user.id)

  // 2. Filtrar tiendas por esos IDs
  query = query.in('id', tiendaIds)
}
```

---

## Validaciones

| Campo | Validación | Constraint BD |
|-------|------------|---------------|
| Tienda | Obligatoria, tienda activa asignada | FK a tiendas |
| DNI Cliente | Opcional, máximo 8 caracteres | - |
| Es Cliente Entel | Obligatorio en UI, default "NO_SABE" | - |
| Tipo Visita | Obligatorio | ✅ CHECK constraint |
| Concretó Operación | Obligatorio, default "NO" | - |
| Se Vendió | Obligatorio solo si VENTA | - |
| Motivo No Venta | Obligatorio solo si se_vendio=NO | ✅ CHECK constraint |

---

## Métricas de Conversión

Los arribos se utilizan para calcular:

| Métrica | Fórmula |
|---------|---------|
| **Tasa de Conversión** | `(Total Ventas / Total Arribos) × 100` |
| **Arribos por Hora** | `Total Arribos / Horas Operativas` |
| **Efectividad de Tienda** | Comparación de conversión entre tiendas |

---

## Características Especiales

### Registro Rápido
- El formulario está optimizado para registro rápido en el punto de venta
- Fecha y hora se capturan automáticamente
- Valores por defecto reducen clics necesarios

### Contexto de Usuario
- El sistema filtra automáticamente las tiendas disponibles según el rol
- El registro incluye quién lo creó (`registrado_por`)

### Historial
- Cada arribo tiene timestamps de creación y actualización
- Los datos son auditables por tienda y fecha

---

## Archivos Relacionados

```
app/(dashboard)/dashboard/arribos/nuevo/page.tsx  # Página de registro
app/api/arribos/route.ts                          # API POST
types/database.ts                                  # Interface Arribo
```

---

## Diferencias con Registro de Ventas

| Aspecto | Arribos | Ventas |
|---------|---------|--------|
| **Propósito** | Registrar tráfico | Registrar transacciones |
| **Complejidad** | Simple (14 campos) | Complejo (40+ campos) |
| **Validación externa** | No | INAR |
| **Verificación orden** | No | Sí |
| **Equipos/IMEI** | No | Sí |
| **Documentos cliente** | Solo DNI opcional | Múltiples tipos |
| **Constraints BD** | 2 CHECK | 6 CHECK |

---

## Inconsistencias Conocidas

| Campo | Problema | Estado |
|-------|----------|--------|
| `registrado_por` | VARCHAR en lugar de UUID (no tiene FK) | ⚠️ Pendiente evaluar migración |

---

## Notas de Implementación

1. **Zod Schema:** Validación del formulario
2. **React Hook Form:** Gestión de estado
3. **UI Components:** shadcn/ui (Card, Form, Select, Input, Button)
4. **date-fns:** Formateo de fechas
5. **Supabase Client:** Carga de tiendas y guardado

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-01-27 | Documentación inicial |
| 1.1 | 2026-01-27 | Validación contra BD: agregado CHECK constraint para motivo_no_venta, documentada semántica de es_cliente_entel (boolean con null=NO_SABE), agregada tabla de conversión de valores, identificada inconsistencia de registrado_por. |
