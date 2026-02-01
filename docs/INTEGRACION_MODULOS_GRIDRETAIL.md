# Integración de Módulos GridRetail
## Mapa Completo de Módulos y Flujos de Datos

**Versión:** 2.0
**Fecha:** 2026-01-27
**Propósito:** Documentar todos los módulos existentes y cómo se integran entre sí

---

## 1. MAPA DE MÓDULOS

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              GRIDRETAIL - MÓDULOS                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐ │
│   │                        MÓDULOS OPERATIVOS (DIARIOS)                           │ │
│   ├───────────────────────────────────────────────────────────────────────────────┤ │
│   │                                                                               │ │
│   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │ │
│   │   │   DASHBOARD     │    │ REGISTRO ARRIBOS│    │ REGISTRO VENTAS │          │ │
│   │   │   /dashboard    │    │ /dashboard/     │    │ /dashboard/     │          │ │
│   │   │                 │    │ arribos/nuevo   │    │ ventas/nuevo    │          │ │
│   │   │ • KPIs tiempo   │    │                 │    │                 │          │ │
│   │   │   real          │    │ • Conteo        │    │ • Formulario BU │          │ │
│   │   │ • Métricas      │    │   clientes      │    │ • 16 tipos venta│          │ │
│   │   │   tiendas       │    │ • Motivos no-   │    │ • Validación    │          │ │
│   │   │ • Conversión    │    │   venta         │    │   INAR          │          │ │
│   │   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘          │ │
│   │            │                      │                      │                    │ │
│   │            └──────────────────────┼──────────────────────┘                    │ │
│   │                                   ▼                                           │ │
│   │                          ┌─────────────────┐                                  │ │
│   │                          │    TABLAS BD    │                                  │ │
│   │                          │ • arribos       │                                  │ │
│   │                          │ • ventas        │                                  │ │
│   │                          └─────────────────┘                                  │ │
│   │                                                                               │ │
│   └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐ │
│   │                        MÓDULOS DE IMPORTACIÓN                                 │ │
│   ├───────────────────────────────────────────────────────────────────────────────┤ │
│   │                                                                               │ │
│   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │ │
│   │   │      INAR       │    │     CUOTAS      │    │  PENALIDADES    │          │ │
│   │   │      /inar      │    │     /cuotas     │    │ /comisiones/    │          │ │
│   │   │                 │    │                 │    │ penalidades     │          │ │
│   │   │ • Importar      │    │ • Importar      │    │                 │          │ │
│   │   │   Excel Entel   │    │   Excel Entel   │    │ • Importar FICHA│          │ │
│   │   │ • Líneas        │    │ • Distribuir    │    │ • Registro      │          │ │
│   │   │   activadas     │    │   a HCs         │    │   manual        │          │ │
│   │   │ • Conciliación  │    │ • Aprobar       │    │ • Configuración │          │ │
│   │   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘          │ │
│   │            │                      │                      │                    │ │
│   │            ▼                      ▼                      ▼                    │ │
│   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │ │
│   │   │ • lineas_inar   │    │ • quota_imports │    │ • penalty_imports│         │ │
│   │   │ • inar_         │    │ • store_quotas  │    │ • hc_penalties  │          │ │
│   │   │   importaciones │    │ • hc_quotas     │    │ • penalty_types │          │ │
│   │   └─────────────────┘    └─────────────────┘    └─────────────────┘          │ │
│   │                                                                               │ │
│   └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐ │
│   │                        MÓDULOS DE COMISIONES                                  │ │
│   ├───────────────────────────────────────────────────────────────────────────────┤ │
│   │                                                                               │ │
│   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │ │
│   │   │    ESQUEMAS     │    │   SIMULADOR     │    │  MI COMISIÓN    │          │ │
│   │   │ /comisiones/    │    │ /comisiones/    │    │  /mi-comision   │          │ │
│   │   │ esquemas        │    │ simulador       │    │                 │          │ │
│   │   │                 │    │                 │    │                 │          │ │
│   │   │ • Crear/editar  │    │ • Calcular      │    │ • Vista HC      │          │ │
│   │   │ • Partidas      │    │   proyección    │    │ • Progreso      │          │ │
│   │   │ • Restricciones │    │ • Escenarios    │    │ • Detalle       │          │ │
│   │   │ • Asignar HCs   │    │ • Comparar      │    │   partidas      │          │ │
│   │   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘          │ │
│   │            │                      │                      │                    │ │
│   │            ▼                      │                      │                    │ │
│   │   ┌─────────────────┐             │                      │                    │ │
│   │   │ • commission_   │◄────────────┴──────────────────────┘                    │ │
│   │   │   schemes       │                                                         │ │
│   │   │ • commission_   │                                                         │ │
│   │   │   scheme_items  │                                                         │ │
│   │   │ • commission_   │                                                         │ │
│   │   │   hc_assignments│                                                         │ │
│   │   └─────────────────┘                                                         │ │
│   │                                                                               │ │
│   └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DETALLE DE CADA MÓDULO

### 2.1 Dashboard (`/dashboard`)

**Propósito:** Vista principal con KPIs en tiempo real.

**Características:**
- Métricas: Total Arribos, Total Ventas, Monto, Tasa Conversión, Tasa Cumplimiento
- Tabla de tiendas con datos de ventas
- Gráfico de ventas
- Filtro por fecha y tienda (según rol)

**Tablas que consume:**
- `tiendas` - Lista de tiendas
- `ventas` - Datos de ventas BU
- `arribos` - Datos de arribos
- `usuarios` - Filtro por rol

**Permisos:**
- Todos los usuarios autenticados pueden ver (filtrado por rol/tienda)

---

### 2.2 Registro de Arribos (`/dashboard/arribos/nuevo`)

**Propósito:** Registrar clientes que ingresan a tienda.

**Campos del formulario:**
- Tienda (según asignación del usuario)
- DNI cliente (opcional)
- ¿Es cliente Entel? (Sí/No/No sé)
- Tipo de visita (Ventas / Post-venta)
- ¿Operación concretada? (Sí/No)
- Motivo de no-venta (si aplica):
  - Falta de stock
  - Precio elevado
  - No califica crédito
  - Solo consulta
  - Documentos incompletos
  - Problemas de sistema
  - Otro

**Tablas que escribe:**
- `arribos`

**Permisos:**
- HC (ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR)
- Solo tiendas asignadas

---

### 2.3 Registro de Ventas (`/dashboard/ventas/nuevo`)

**Propósito:** Registro declarativo de ventas (Boca de Urna).

**Secciones del formulario:**

1. **Fecha y Hora:**
   - Fecha de venta (Hoy, Ayer, Otra)
   - Rango horario
   - Venta diferida (con motivo)

2. **Verificación de Orden:**
   - Número de orden (7 u 8 dígitos)
   - Verificación contra INAR
   - Detección de duplicados

3. **Identificación Cliente:**
   - Número de línea (9 dígitos, inicia con 9)
   - Tipo documento (DNI, CE, RUC, Pasaporte, PTP)
   - Número de documento
   - Nombre cliente

4. **Clasificación de Venta:**
   - 16 tipos de venta (ver tipos_venta)
   - Operador cedente (para portabilidades)

5. **Equipo y Seguro:**
   - IMEI (15 dígitos)
   - Modelo
   - ICCID chip (19-20 dígitos, opcional)
   - Seguro MEP
   - Accesorios

**Tablas que escribe:**
- `ventas`

**Tablas que consulta:**
- `lineas_inar` - Verificación de orden
- `tipos_venta` - Catálogo
- `operadores_cedentes` - Para portabilidades

**Permisos:**
- HC (ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR)
- Solo tiendas asignadas

---

### 2.4 INAR (`/inar`)

**Propósito:** Gestionar líneas activadas oficiales de Entel.

**Funcionalidades:**
- Dashboard con estadísticas (total líneas, importaciones)
- Importar Excel de INAR (`/inar/importar`)
- Historial de importaciones
- Resúmenes por día, tienda, vendedor

**Flujo de importación:**
1. Subir archivo Excel
2. Mapeo automático de columnas
3. Importación incremental (detecta duplicados)
4. Resumen de resultados

**Tablas:**
- `lineas_inar` - 49 campos de líneas
- `inar_importaciones` - Historial
- `inar_mapeo_columnas` - Mapeo Excel→BD

**Vistas:**
- `v_inar_resumen_diario`
- `v_inar_resumen_tienda`
- `v_inar_resumen_vendedor`

**Permisos:**
- Ver: ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES
- Importar: ADMIN, GERENTE_COMERCIAL

---

### 2.5 Cuotas (`/cuotas`)

**Propósito:** Gestionar metas mensuales por tienda y HC.

**Funcionalidades:**
- Dashboard con KPIs del período
- Importar Excel de cuotas Entel (`/cuotas/importar`)
- Editar cuota SSNN (diferente de cuota Entel)
- Distribuir a HCs (`/cuotas/distribucion`)
- Aprobar distribuciones (`/cuotas/aprobacion`)

**Sistema de cuota dual (v2.3):**
- `ss_quota_entel` - Cuota original de Entel (inmutable)
- `ss_quota` - Cuota operativa SSNN (editable)
- Diferencia = ajuste del SSNN

**Tablas:**
- `quota_imports` - Historial importaciones
- `store_quotas` - Cuotas por tienda
- `hc_quotas` - Cuotas por HC (con prorrateo)

**Funciones RPC:**
- `get_quota_period_summary(year, month)`
- `update_store_quota_ssnn(store_quota_id, new_quota, user_id)`
- `distribute_store_quota(store_quota_id, distributions[])`
- `get_hc_effective_quota(user_id, year, month)`

**Permisos:**
- Ver: ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, BACKOFFICE_OPERACIONES
- Editar/Importar: ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES
- Aprobar: ADMIN, GERENTE_COMERCIAL

---

### 2.6 Penalidades (`/comisiones/penalidades`)

**Propósito:** Gestionar descuentos por infracciones.

**Dos orígenes:**
- **Entel (FICHA):** Penalidades externas (Port Out, DJ, Suspendida)
- **Internas (PBD):** Penalidades internas (Tardanza, Inasistencia, Uniforme)

**Funcionalidades:**
- Dashboard con resumen mensual
- Importar FICHA (`/comisiones/penalidades/importar`)
- Registro manual (`/comisiones/penalidades/registro`)
- Historial con filtros (`/comisiones/penalidades/historial`)
- Configuración de equivalencias (`/comisiones/penalidades/configuracion`)
- Resumen mensual detallado (`/comisiones/penalidades/resumen`)

**Estados de penalidad:**
- `pending` - Pendiente de aplicar
- `applied` - Aplicada
- `waived` - Condonada
- `disputed` - En disputa

**Tablas:**
- `penalty_types` - Catálogo de tipos
- `penalty_equivalences` - Reglas de transferencia SSNN→HC
- `hc_penalties` - Penalidades por HC
- `penalty_imports` - Historial importaciones

**Permisos:**
- Ver: ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, BACKOFFICE_*
- Importar/Registrar: ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES
- Condonar: ADMIN, GERENTE_COMERCIAL
- Configurar: ADMIN, GERENTE_COMERCIAL

---

### 2.7 Esquemas de Comisiones (`/comisiones/esquemas`)

**Propósito:** Configurar esquemas de pago variable.

**Funcionalidades:**
- Listar esquemas con filtros
- Crear nuevo esquema (`/comisiones/esquemas/nuevo`)
- Ver/editar detalle (`/comisiones/esquemas/[id]`)
- Gestionar partidas (`/comisiones/esquemas/[id]/partidas`)
- Configurar restricciones (`/comisiones/esquemas/[id]/restricciones`)
- Clonar esquemas
- Aprobar esquemas

**Tipos de esquema:**
- Asesor
- Supervisor

**Estados:**
- Draft
- Active
- Archived

**Tablas:**
- `commission_schemes` - Esquemas
- `commission_scheme_items` - Partidas
- `commission_item_ventas` - Mapeo partida→tipos_venta
- `commission_pxq_scales` - Escalas PxQ
- `commission_item_locks` - Candados
- `commission_item_restrictions` - Restricciones
- `commission_hc_assignments` - Asignación a HCs

**Permisos:**
- Ver: ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, BACKOFFICE_OPERACIONES
- Editar: ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES
- Aprobar: ADMIN, GERENTE_COMERCIAL

---

### 2.8 Simulador de Ingresos (`/comisiones/simulador`) - PENDIENTE

**Propósito:** Proyectar ingresos del HC basado en ventas.

**Funcionalidades (planificadas):**
- Seleccionar HC y esquema
- Ingresar ventas reales o proyectadas
- Calcular comisión desglosada
- Comparar escenarios
- Predecir penalidades

**Integración con otros módulos:**
- **Cuotas:** Obtiene metas via `get_hc_effective_quota()`
- **INAR:** Obtiene ventas confirmadas
- **Penalidades:** Predice descuentos via `predict_hc_penalties()`
- **Esquemas:** Aplica fórmulas de cálculo

---

### 2.9 Mi Comisión (`/mi-comision`)

**Propósito:** Vista personal para que el HC vea su comisión.

**Funcionalidades:**
- Ver esquema asignado
- Progreso de ventas vs cuota
- Detalle por partida
- Proyección de ingreso

---

## 3. DIAGRAMA DE FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE DATOS GRIDRETAIL                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ╔═══════════════╗                                                              │
│  ║    ENTEL      ║                                                              │
│  ╚═══════════════╝                                                              │
│         │                                                                       │
│         ├─── Excel INAR ──────► MÓDULO INAR                                    │
│         │                        └── lineas_inar ───────────────────────┐      │
│         │                                                                │      │
│         ├─── Excel Cuotas ────► MÓDULO CUOTAS                           │      │
│         │                        ├── quota_imports                      │      │
│         │                        ├── store_quotas (entel/ssnn)          │      │
│         │                        └── hc_quotas ─────────────────────────┼──┐   │
│         │                             ↓                                  │  │   │
│         │                        get_hc_effective_quota()                │  │   │
│         │                                                                │  │   │
│         └─── Excel FICHA ─────► MÓDULO PENALIDADES                      │  │   │
│                                  ├── penalty_imports                     │  │   │
│                                  ├── hc_penalties ──────────────────────┼──┼──┐│
│                                  └── predict_hc_penalties() ────────────┘  │  ││
│                                                                             │  ││
│  ╔═══════════════╗                                                          │  ││
│  ║  PBD (SSNN)   ║                                                          │  ││
│  ╚═══════════════╝                                                          │  ││
│         │                                                                   │  ││
│         ├─── Esquemas ────────► MÓDULO COMISIONES                          │  ││
│         │                        ├── commission_schemes                     │  ││
│         │                        ├── commission_scheme_items                │  ││
│         │                        └── commission_hc_assignments ─────────────┼──┼┼┐
│         │                                                                   │  │││
│         ├─── Ventas BU ───────► ventas ─────────────────────────────────────┘  │││
│         │                                                                       │││
│         └─── Arribos ─────────► arribos                                        │││
│                                                                                 │││
│                                                                                 │││
│  ╔═══════════════════════════════════════════════════════════════════════════════╗
│  ║                          SIMULADOR DE INGRESOS HC                             ║
│  ╠═══════════════════════════════════════════════════════════════════════════════╣
│  ║                                                                               ║
│  ║   ENTRADAS:                                                                   ║
│  ║   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              ║
│  ║   │ CUOTA           │  │ ESQUEMA         │  │ VENTAS          │              ║
│  ║   │ (hc_quotas)     │  │ (commission_    │  │ (lineas_inar    │              ║
│  ║   │                 │  │  schemes)       │  │  o ventas BU)   │              ║
│  ║   │ • ss_quota      │  │ • partidas      │  │ • count por     │              ║
│  ║   │ • breakdown     │  │ • variables     │  │   tipo_venta    │              ║
│  ║   │ • prorrateo     │  │ • candados      │  │                 │              ║
│  ║   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              ║
│  ║            │                    │                    │                       ║
│  ║            └────────────────────┼────────────────────┘                       ║
│  ║                                 ▼                                            ║
│  ║                    ┌───────────────────────┐                                 ║
│  ║                    │ simulate_hc_commission │                                ║
│  ║                    └───────────┬───────────┘                                 ║
│  ║                                │                                             ║
│  ║                                ▼                                             ║
│  ║   ┌─────────────────────────────────────────────────────────────────────┐   ║
│  ║   │                     RESULTADO SIMULACIÓN                            │   ║
│  ║   ├─────────────────────────────────────────────────────────────────────┤   ║
│  ║   │  Sueldo Fijo      +  Variable  +  PxQ  +  Bonos  -  Penalidades    │   ║
│  ║   │  (del esquema)       (calculado)                    (predichas)     │   ║
│  ║   └─────────────────────────────────────────────────────────────────────┘   ║
│  ║                                                                               ║
│  ╚═══════════════════════════════════════════════════════════════════════════════╝
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. RESUMEN DE MÓDULOS Y TABLAS

| Módulo | Propósito | Fuente de Datos | Tablas Principales |
|--------|-----------|-----------------|-------------------|
| **Dashboard** | KPIs tiempo real | Ventas + Arribos | `ventas`, `arribos`, `tiendas` |
| **Reg. Arribos** | Conteo clientes | Manual | `arribos` |
| **Reg. Ventas** | Ventas declarativas | Manual (BU) | `ventas` |
| **INAR** | Líneas oficiales Entel | Excel Entel diario | `lineas_inar` |
| **Cuotas** | Metas mensuales | Excel Entel mensual | `store_quotas`, `hc_quotas` |
| **Comisiones** | Esquemas y fórmulas | Configuración PBD | `commission_schemes`, `*_items` |
| **Penalidades** | Descuentos | Excel FICHA mensual | `hc_penalties`, `penalty_types` |
| **Simulador** | Proyección ingresos | Todos los anteriores | (usa funciones RPC) |
| **Mi Comisión** | Vista personal HC | Esquemas + Ventas | `commission_hc_assignments` |

---

## 5. FUNCIONES DE INTEGRACIÓN ENTRE MÓDULOS

### 5.1 Simulador ← Cuotas

| Función | Propósito | Entrada | Salida |
|---------|-----------|---------|--------|
| `get_hc_effective_quota` | Obtener cuota del HC con prorrateo | user_id, year, month | ss_quota, effective_quota, breakdown |

### 5.2 Simulador ← Penalidades

| Función | Propósito | Entrada | Salida |
|---------|-----------|---------|--------|
| `predict_hc_penalties` | Predecir penalidades basado en historial | user_id, months_lookback | [{penalty_code, predicted_amount, confidence}] |

### 5.3 Simulador ← Comisiones

| Función | Propósito | Entrada | Salida |
|---------|-----------|---------|--------|
| `simulate_hc_commission` | Calcular comisión completa | scheme_id, sales_data, plan_breakdown, user_id | fixed, variable, pxq, bonus, penalties, net |
| `compare_commission_scenarios` | Comparar dos esquemas | scheme_a_id, scheme_b_id, sales_data | diferencias |
| `get_sales_profile` | Generar perfil de ventas | scheme_id, profile_type | sales_data |

---

## 6. PUNTO CLAVE: CUOTAS ↔ SIMULADOR

### Flujo real de cuotas:
1. Entel envía Excel con cuotas → `store_quotas.ss_quota_entel`
2. SSNN puede ajustar → `store_quotas.ss_quota`
3. Se distribuye a HCs → `hc_quotas.ss_quota`
4. Simulador usa → `get_hc_effective_quota(user_id, year, month)`

### Ejemplo de cálculo:
```typescript
// Obtener cuota efectiva del HC
const { data: hcQuota } = await supabase
  .rpc('get_hc_effective_quota', {
    p_user_id: userId,
    p_year: year,
    p_month: month
  });

// La cuota viene de hc_quotas, incluye prorrateo
const effectiveQuota = {
  ss_quota: hcQuota.effective_quota,  // Ya incluye prorrateo
  proration_factor: hcQuota.proration_factor,
  breakdown: hcQuota.quota_breakdown  // {"OSS": 31.5, "VR": 21, ...}
};
```

---

## 7. TABLA DE CAMPOS DE USUARIOS (REFERENCIA)

Para evitar inconsistencias entre módulos:

| Campo BD | Tipo | Descripción | Usar en UI |
|----------|------|-------------|------------|
| `id` | UUID | PK | (interno) |
| `codigo_asesor` | VARCHAR | PBD_AGARCIA | Sí - como identificador |
| `dni` | VARCHAR | DNI | Solo en imports |
| `nombre_completo` | VARCHAR | "Ana García López" | Sí - nombre display |
| `email` | VARCHAR | (opcional) | Notificaciones |
| `rol` | VARCHAR | ASESOR, SUPERVISOR, etc. | Permisos |
| `zona` | VARCHAR | NORTE, SUR, etc. | Filtros |
| `activo` | BOOLEAN | true/false | Filtros |

**NO existen estos campos:**
- ~~`codigo_entel`~~ → usar `codigo_asesor`
- ~~`nombres`~~ → usar `nombre_completo`
- ~~`apellidos`~~ → usar `nombre_completo`

---

## 8. RUTAS DEL SISTEMA

```
/dashboard                              # Dashboard principal
  /dashboard/arribos/nuevo              # Registro de arribos
  /dashboard/ventas/nuevo               # Registro de ventas

/inar                                   # INAR - líneas activadas
  /inar/importar                        # Importar Excel INAR

/cuotas                                 # Cuotas mensuales
  /cuotas/importar                      # Importar Excel cuotas
  /cuotas/distribucion                  # Distribuir a HCs
  /cuotas/aprobacion                    # Aprobar distribuciones

/comisiones/esquemas                    # Esquemas de comisiones
  /comisiones/esquemas/nuevo            # Crear esquema
  /comisiones/esquemas/[id]             # Ver esquema
  /comisiones/esquemas/[id]/partidas    # Gestionar partidas
  /comisiones/esquemas/[id]/restricciones # Restricciones

/comisiones/penalidades                 # Penalidades
  /comisiones/penalidades/importar      # Importar FICHA
  /comisiones/penalidades/registro      # Registro manual
  /comisiones/penalidades/configuracion # Configuración
  /comisiones/penalidades/historial     # Historial
  /comisiones/penalidades/resumen       # Resumen mensual

/comisiones/simulador                   # Simulador de ingresos

/mi-comision                            # Vista personal HC
```

---

## 9. FLUJO COMPLETO DE CÁLCULO DE COMISIÓN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. OBTENER DATOS DEL HC                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Usuario: Ana García (PBD_AGARCIA)                                        │
│   Período: Enero 2026                                                       │
│                                                                             │
│   ┌─────────────────────┐    ┌─────────────────────┐                       │
│   │ get_hc_effective_   │    │ commission_hc_      │                       │
│   │ quota()             │    │ assignments         │                       │
│   │                     │    │                     │                       │
│   │ • ss_quota: 70      │    │ • scheme_id: xxx    │                       │
│   │ • effective: 58     │    │ • is_active: true   │                       │
│   │ • factor: 0.83      │    └─────────────────────┘                       │
│   │ • breakdown: {...}  │                                                   │
│   └─────────────────────┘                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. OBTENER VENTAS DEL MES                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Prioridad: lineas_inar > ventas (BU)                                     │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ SELECT * FROM lineas_inar                                           │  │
│   │ WHERE vchvendedordni = '12345678'                                   │  │
│   │   AND dtefecha_alta BETWEEN '2026-01-01' AND '2026-01-31'          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Resultado: 53 líneas clasificadas por tipo_venta                         │
│   - OSS_BASE: 8, OSS_CAPTURA: 16, VR_BASE: 16, VR_CAPTURA: 9, etc.        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. AGRUPAR POR PARTIDA DEL ESQUEMA                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Usando commission_item_ventas (mapeo N:N):                               │
│                                                                             │
│   Partida "OSS" = OSS_BASE + OSS_CAPTURA = 8 + 16 = 24 unidades           │
│   Partida "VR_BASE" = VR_BASE = 16 unidades                                │
│   Partida "VR_CAPTURA" = VR_CAPTURA + VR_MONO = 9 unidades                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. CALCULAR CUMPLIMIENTO                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┬───────────┬──────────┬────────────┐                     │
│   │ Partida      │ Cuota*    │ Logro    │ Cumplim.   │                     │
│   ├──────────────┼───────────┼──────────┼────────────┤                     │
│   │ OSS          │ 26.1      │ 24       │ 92%        │                     │
│   │ VR_BASE      │ 17.4      │ 16       │ 92%        │                     │
│   │ VR_CAPTURA   │ 9.9       │ 9        │ 91%        │                     │
│   │ OPP          │ 4.6       │ 4        │ 87%        │                     │
│   └──────────────┴───────────┴──────────┴────────────┘                     │
│   * Cuota ya prorrateada (factor 0.83)                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. APLICAR FÓRMULAS DEL ESQUEMA                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Sueldo Fijo:        S/. 1,050                                            │
│   Variable:           S/.   720 (92% de S/. 805)                           │
│   PxQ:                S/.    75 (5 portas × S/.15)                         │
│   Bonos:              S/.    50 (NPS alcanzado)                            │
│   ────────────────────────────                                              │
│   Bruto:              S/. 1,895                                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. RESTAR PENALIDADES PREDICHAS                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   predict_hc_penalties(user_id, 6 meses):                                  │
│   - Port Out: ~1 caso (S/.25), confianza 0.72                              │
│                                                                             │
│   Penalidades:        S/.   -25                                            │
│   ────────────────────────────                                              │
│   NETO PROYECTADO:    S/. 1,870                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-27 | 1.0 | Documento inicial con integración Cuotas-Simulador |
| 2026-01-27 | **2.0** | **Expansión completa: agregados todos los módulos (Dashboard, Arribos, Ventas, INAR, Esquemas, Mi Comisión). Reorganización en secciones. Mapa visual de módulos. Rutas del sistema.** |

---

**IMPORTANTE**: Actualizar este documento cuando se agreguen nuevos módulos o cambien las integraciones.
