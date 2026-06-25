# Especificaciones: Registro de Venta Diaria (Boca de Urna)
## GridRetail - Módulo de Ventas

**Versión:** 2.1  
**Actualización:** 2026-01-27  
**Estado:** ✅ Validado contra BD de producción

---

## Resumen

El módulo de **Registro de Venta Diaria** permite a los asesores comerciales declarar sus ventas en tiempo real desde el punto de venta. Este registro "de boca de urna" se cruza posteriormente con el sistema INAR para validación y liquidación de comisiones.

**Ruta:** `/dashboard/ventas/nuevo`  
**Archivo principal:** `app/(dashboard)/dashboard/ventas/nuevo/page.tsx`

---

## Roles con Acceso

| Rol | Puede Registrar | Fecha Libre | Requiere Tienda |
|-----|-----------------|-------------|-----------------|
| ASESOR | Sí | No | Sí |
| ASESOR_REFERENTE | Sí | No | Sí |
| COORDINADOR | Sí | No | Sí |
| SUPERVISOR | Sí | No | Sí |
| JEFE_VENTAS | Sí | Sí | No |
| GERENTE_COMERCIAL | Sí | Sí | No |
| GERENTE_GENERAL | Sí | Sí | No |
| ADMIN | Sí | Sí | No |
| BACKOFFICE_OPERACIONES | Sí | Sí | No |

**Fecha Libre:** Puede registrar ventas de cualquier fecha pasada sin restricción.

---

## Estructura del Formulario

### 1. Fecha y Hora de la Venta

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `opcion_fecha` | Radio | Sí | HOY, AYER, OTRA (solo roles con permiso) |
| `fecha` | Date | Sí | Fecha de la venta (YYYY-MM-DD) |
| `rango_horario` | Select | Sí* | Hora aproximada (solo si no es HOY) |
| `motivo_rezago` | Textarea | Sí* | Explicación del registro tardío |

**Rangos Horarios Disponibles:**
```
08:00-08:59, 09:00-09:59, 10:00-10:59, 11:00-11:59,
12:00-12:59, 13:00-13:59, 14:00-14:59, 15:00-15:59,
16:00-16:59, 17:00-17:59, 18:00-18:59, 19:00-19:59,
20:00-20:59, 21:00-21:59
```

**Lógica de Venta Rezagada:**
- Si `opcion_fecha !== 'HOY'` → Requiere `motivo_rezago`
- Si el rol NO tiene permiso de fecha libre → Estado = `pendiente_aprobacion`
- Si el rol tiene permiso de fecha libre → Estado = `registrada`

---

### 2. Orden de Venta

| Campo | Tipo | Validación | Descripción |
|-------|------|------------|-------------|
| `orden_venta` | Input | `/^[78]\d{8}$/` | Número de contrato Entel |

**Formato:** 9 dígitos, debe empezar con 7 u 8

**Verificación de Orden (API):**

Al presionar "Verificar", el sistema consulta:

1. **¿Existe en INAR?**
   - Si existe → Alerta amarilla + checkbox de confirmación obligatorio
   - Muestra: teléfono, fecha, plan, vendedor

2. **¿Tiene líneas registradas hoy?**
   - Si existe → Alerta azul informativa
   - Permite "Agregar otra línea" (autocompleta datos del cliente)

3. **¿Es orden nueva?**
   - Si no existe en ningún lado → Alerta verde "Orden disponible"

---

### 3. Datos de Identificación

| Campo | Tipo | Validación | Descripción |
|-------|------|------------|-------------|
| `telefono_linea` | Input | `/^9\d{8}$/` | Número de línea vendida |
| `tipo_documento` | Select | Enum | DNI, CE, RUC, PASAPORTE, PTP |
| `numero_documento` | Input | Por tipo | Documento del cliente |
| `nombre_cliente` | Input | 3-100 chars | Nombre completo |

**Validación de Documentos:**

| Tipo | Patrón | Longitud | Ejemplo |
|------|--------|----------|---------|
| DNI | `^\d{8}$` | 8 | 12345678 |
| CE | `^\d{9}$` | 9 | 123456789 |
| RUC | `^(10\|20)\d{9}$` | 11 | 10123456789 |
| PASAPORTE | `^[A-Z0-9]{6,12}$` | 6-12 | AB123456 |
| PTP | `^[A-Z0-9]{6,15}$` | 6-15 | PTP123456 |

---

### 4. Clasificación de la Venta

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `tipo_venta` | Select | Sí | Código del tipo de venta |
| `operador_cedente` | Select | Condicional | Solo para portabilidades |

**16 Tipos de Venta (desde BD):**

| Categoría | Tipos |
|-----------|-------|
| POSTPAGO (8) | OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN |
| PACK (2) | PACK_VR, PACK_OPEN |
| PACK_SS (2) | PACK_OSS, PACK_VR_BASE |
| RENO (1) | RENO |
| PREPAGO (2) | PREPAGO, PORTA_PP |
| OTROS (1) | ACCESORIOS |

**Configuración por Tipo de Venta (desde BD):**

| Código | Req. Cedente | Req. IMEI | Permite Seguro |
|--------|--------------|-----------|----------------|
| OSS_BASE | ✅ | ❌ | ❌ |
| OSS_CAPTURA | ✅ | ❌ | ❌ |
| OPP_CAPTURA | ✅ | ❌ | ❌ |
| OPP_BASE | ✅ | ❌ | ❌ |
| VR_MONO | ❌ | ❌ | ❌ |
| VR_CAPTURA | ❌ | ❌ | ❌ |
| VR_BASE | ❌ | ❌ | ❌ |
| MISS_IN | ❌ | ❌ | ❌ |
| PACK_VR | ❌ | ✅ | ✅ |
| PACK_OPEN | ❌ | ✅ | ✅ |
| PACK_OSS | ✅ | ✅ | ✅ |
| PACK_VR_BASE | ❌ | ✅ | ✅ |
| RENO | ❌ | ✅ | ✅ |
| PREPAGO | ❌ | ❌ | ❌ |
| PORTA_PP | ✅ | ❌ | ❌ |
| ACCESORIOS | ❌ | ❌ | ❌ |

**Operadores Cedentes:**
- MOVISTAR
- CLARO
- BITEL

---

### 5. Equipo y Seguro

| Campo | Tipo | Validación | Condicional |
|-------|------|------------|-------------|
| `imei_equipo` | Input | `/^\d{15}$/` | Si `requiere_imei` |
| `modelo_equipo` | Input | Texto libre | Opcional |
| `iccid_chip` | Input | `/^\d{19,20}$/` | No en RENO ni ACCESORIOS |
| `incluye_seguro` | Checkbox | Boolean | Si `permite_seguro` |
| `incluye_accesorios` | Checkbox | Boolean | Siempre visible |
| `descripcion_accesorios` | Input | Texto | Si `incluye_accesorios` |

---

### 6. Observaciones

| Campo | Tipo | Validación | Descripción |
|-------|------|------------|-------------|
| `notas` | Textarea | Max 500 chars | Comentarios adicionales |

---

## Flujo de Estados

```
[Nuevo Registro]
       │
       ▼
   ┌─────────────────────────────────┐
   │ ¿Es venta de HOY?               │
   └─────────────────────────────────┘
       │                    │
      Sí                   No
       │                    │
       ▼                    ▼
  ┌─────────┐    ┌─────────────────────────┐
  │REGISTRADA│    │¿Rol tiene fecha libre? │
  └─────────┘    └─────────────────────────┘
                      │              │
                     Sí             No
                      │              │
                      ▼              ▼
                ┌─────────┐  ┌──────────────────┐
                │REGISTRADA│  │PENDIENTE_APROBACION│
                └─────────┘  └──────────────────┘
```

---

## Datos Enviados al Backend

```typescript
{
  // Automáticos
  tienda_id: string | null,
  usuario_id: string,
  codigo_asesor: string,
  registrado_por: string,

  // Fecha y hora
  fecha: string,           // YYYY-MM-DD
  rango_horario: string,   // '08' - '21'
  es_venta_rezagada: boolean,
  motivo_rezago: string | null,

  // Estado
  estado: 'registrada' | 'pendiente_aprobacion',

  // Identificación
  orden_venta: string,
  telefono_linea: string,
  tipo_documento_cliente: string,  // DNI, CE, RUC, PASAPORTE, PTP
  numero_documento_cliente: string,
  nombre_cliente: string,

  // Clasificación
  tipo_venta: string,
  categoria_venta: string | null,
  operador_cedente: string | null,

  // Equipo
  imei_equipo: string | null,
  modelo_equipo: string | null,
  iccid_chip: string | null,

  // Seguro y accesorios
  incluye_seguro: boolean,
  incluye_accesorios: boolean,
  descripcion_accesorios: string | null,

  // Monto (se calcula después)
  monto_liquidado: 0,

  // Otros
  notas: string | null,
  estado_cruce: 'PENDIENTE',
}
```

---

## APIs Utilizadas

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/tipos-venta` | GET | Lista tipos de venta desde BD |
| `/api/operadores-cedentes` | GET | Lista operadores para portabilidad |
| `/api/ventas/verificar-orden` | GET | Verifica si orden existe en INAR o ventas |
| `/api/ventas` | POST | Registra nueva venta |

---

## Validaciones Críticas

1. **Orden de venta:** Formato `[78]XXXXXXXX` (9 dígitos, empieza con 7 u 8)
2. **Teléfono:** Formato `9XXXXXXXX` (9 dígitos, empieza con 9)
3. **Documento:** Según tipo seleccionado (ver tabla arriba)
4. **Nombre cliente:** Mínimo 3 caracteres
5. **IMEI:** 15 dígitos (si requerido por tipo de venta)
6. **ICCID:** 19-20 dígitos (opcional)
7. **Confirmación INAR:** Obligatoria si orden existe en INAR

---

## Características Especiales

### Línea Adicional
Cuando una orden ya tiene líneas registradas hoy:
- Se puede "Agregar otra línea a esta orden"
- Los datos del cliente se autocompletan
- Los campos de identificación se bloquean

### Verificación de Duplicados
- Sistema alerta si la orden ya fue procesada en INAR
- Requiere confirmación explícita para continuar
- Previene registros duplicados accidentales

### Contexto de Tienda
- Se muestra badge con tienda activa (nombre + zona)
- Roles sin tienda pueden registrar sin esta restricción

---

## Integración con INAR

El campo `estado_cruce` controla la reconciliación:

| Estado | Descripción |
|--------|-------------|
| PENDIENTE | Esperando cruce con INAR |
| COINCIDE | Encontrado en INAR, datos coinciden |
| DISCREPANCIA | Encontrado pero con diferencias |
| NO_ENCONTRADO | No existe en INAR |

La reconciliación se ejecuta en batch desde el módulo de importación INAR.

---

## Archivos Relacionados

```
app/(dashboard)/dashboard/ventas/nuevo/page.tsx  # Página principal
lib/constants/tipos-venta.ts                      # Constantes y helpers
api/tipos-venta/route.ts                          # API tipos de venta
api/operadores-cedentes/route.ts                  # API operadores
api/ventas/route.ts                               # API registro venta
api/ventas/verificar-orden/route.ts               # API verificación
```

---

## Notas de Implementación

1. **Zod Schema:** Toda validación del formulario usa Zod con `zodResolver`
2. **React Hook Form:** Gestión de estado del formulario
3. **UI Components:** shadcn/ui (Card, Form, Input, Select, etc.)
4. **Iconos:** lucide-react
5. **Responsive:** Grid de 2 columnas en desktop, 1 en mobile

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-01-XX | Versión inicial |
| 2.0 | 2026-01-27 | Actualización orden [78]XXXXXXXX |
| 2.1 | 2026-01-27 | Validación contra BD: confirmados 16 tipos (sin OPP_MONO, con PACK_OPEN). Corregidos constraints de tipo_documento. |
