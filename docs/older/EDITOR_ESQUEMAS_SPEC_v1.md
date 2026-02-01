# Editor de Esquemas de Comisiones - Especificación Frontend
## GridRetail - Modelador de Comisiones HC

**Versión:** 2.1
**Fecha:** 2026-01-26
**Para:** Claude Code - Desarrollo Frontend

### Changelog
- **v2.1 (2026-01-26)**: Sistema de presets para partidas, mapeo flexible de tipos de venta
- **v1.0 (2026-01-25)**: Versión inicial  

---

## 1. RESUMEN EJECUTIVO

El Editor de Esquemas es el módulo central del Modelador de Comisiones HC. Permite a los operadores (Analista Principal, Gerente Comercial) crear, modificar y aprobar esquemas de comisiones para el personal comercial (asesores, supervisores) de las tiendas TEX. 

El flujo principal es: **Importar Excel → Revisar/Ajustar → Aprobar → Vigente**.

Los esquemas definen cuánto gana cada HC según sus ventas, incluyendo:
- Sueldo fijo y variable base
- Partidas con metas y comisiones
- Candados (condiciones que deben cumplirse)
- Restricciones de mix de productos

---

## 2. FLUJOS DE USUARIO POR ROL

### 2.1 Gerente Comercial / Admin (Operador Principal)

#### Flujo A: Crear nuevo esquema manualmente
```
1. Navegar a Comisiones > Esquemas
2. Click "Nuevo Esquema"
3. Seleccionar: Tipo (Asesor/Supervisor), Año, Mes
4. Ingresar: Nombre, Sueldo Fijo, Sueldo Variable, Cuota SS
5. Guardar (estado: DRAFT)
6. Agregar partidas una por una
7. Configurar candados si aplica
8. Configurar restricciones si aplica
9. Vista previa del esquema completo
10. Click "Aprobar" → Esquema vigente
```

#### Flujo B: Importar esquema desde Excel (con AI)
```
1. Navegar a Comisiones > Importar Esquema
2. Subir archivo Excel de Entel
3. Sistema procesa con AI y extrae estructura
4. Revisar partidas detectadas (con % confianza)
5. Corregir/ajustar si es necesario
6. Guardar como esquema OFICIAL
7. Opcional: Clonar a DRAFT para modificar
8. Aprobar versión final
```

#### Flujo C: Modificar esquema existente
```
1. Ver lista de esquemas
2. Seleccionar esquema (solo DRAFT o clonar desde OFICIAL)
3. Editar partidas/candados/restricciones
4. Guardar cambios
5. Vista previa con simulación
6. Aprobar cuando esté listo
```

#### Flujo D: Aprobar esquema
```
1. Ver esquema en estado DRAFT
2. Verificar todas las partidas
3. Click "Aprobar"
4. Confirmar: "Solo puede haber un esquema aprobado por período"
5. Si existe otro aprobado → Se archiva automáticamente
6. Nuevo esquema queda como APROBADO (vigente)
```

### 2.2 Jefe de Ventas

#### Flujo: Consulta y simulación
```
1. Navegar a Comisiones > Esquemas
2. Ver lista de esquemas (solo lectura)
3. Seleccionar un esquema para ver detalle
4. Puede usar el simulador para proyecciones
5. NO puede crear/editar/aprobar esquemas
```

### 2.3 Asesor / Supervisor (HC)

**NO tienen acceso al Editor de Esquemas.** Su interacción con comisiones es a través del Simulador HC (módulo separado).

---

## 3. PANTALLAS Y COMPONENTES

### 3.1 Lista de Esquemas (`/comisiones/esquemas`)

**Propósito:** Ver todos los esquemas, filtrar, acceder a acciones

**Permisos:** 
- Ver: ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, BACKOFFICE_OPERACIONES
- Crear/Editar: ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES

**Datos mostrados:**
| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre del esquema |
| Tipo | Asesor / Supervisor |
| Período | Mes/Año (ej: Enero 2026) |
| Estado | Badge: oficial/draft/aprobado/archivado |
| Origen | Entel / Socio |
| Cuota SS | Total de la cuota |
| Última modificación | Fecha |
| Acciones | Ver, Editar, Clonar, Aprobar |

**Filtros:**
- Por estado (checkbox múltiple)
- Por tipo (Asesor/Supervisor)
- Por período (año, mes)
- Búsqueda por nombre

**Acciones disponibles:**
- `+ Nuevo Esquema` → Crear manualmente
- `📥 Importar` → Ir a importador AI
- Por fila: Ver | Editar (si draft) | Clonar | Aprobar (si draft)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Esquemas de Comisiones                           [+ Nuevo] [📥 Importar]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filtros: [Estado ▼] [Tipo ▼] [Período ▼]        🔍 Buscar...              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Nombre              │ Tipo     │ Período    │ Estado    │ Acciones │   │
│  ├─────────────────────┼──────────┼────────────┼───────────┼──────────┤   │
│  │ Esquema Asesor Ene  │ Asesor   │ Ene 2026   │ ●APROBADO │ 👁 📋 ⚡│   │
│  │ Esquema Asesor Ene  │ Asesor   │ Ene 2026   │ ○Oficial  │ 👁 📋   │   │
│  │ Prueba Feb (draft)  │ Asesor   │ Feb 2026   │ ◐Draft    │ 👁 ✏️ ✓ │   │
│  │ Esquema Supervisor  │ Superv.  │ Ene 2026   │ ●APROBADO │ 👁 📋   │   │
│  └─────────────────────┴──────────┴────────────┴───────────┴──────────┘   │
│                                                                             │
│  Mostrando 4 de 12 esquemas                              < 1 2 3 >         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Crear/Editar Esquema (`/comisiones/esquemas/nuevo` o `/comisiones/esquemas/[id]/editar`)

**Propósito:** Configurar los datos generales del esquema

**Permisos:** ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES

**Secciones del formulario:**

#### Sección 1: Información General
| Campo | Tipo | Validación | Descripción |
|-------|------|------------|-------------|
| Nombre | Text | Requerido, max 150 | Nombre descriptivo |
| Código | Text | Requerido, único, max 50 | Código interno (ej: ESQ_ASESOR_ENE26) |
| Tipo | Select | Requerido | asesor / supervisor |
| Año | Number | 2020-2100 | Año de aplicación |
| Mes | Select | 1-12 | Mes de aplicación |
| Descripción | Textarea | Opcional | Notas adicionales |

#### Sección 2: Montos Base
| Campo | Tipo | Validación | Descripción |
|-------|------|------------|-------------|
| Sueldo Fijo | Currency | >= 0 | Monto fijo mensual |
| Sueldo Variable | Currency | >= 0 | Máximo variable alcanzable |
| Cuota SS Total | Integer | >= 0 | Meta total de líneas SS |
| Cumplimiento Mínimo Global | Percentage | 0-100% | Default 50% |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Volver                          Crear Nuevo Esquema                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INFORMACIÓN GENERAL                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Nombre: [_Esquema Asesor Febrero 2026_______________]               │   │
│  │ Código: [_ESQ_ASESOR_FEB26_] (autogenerado, editable)               │   │
│  │                                                                     │   │
│  │ Tipo de esquema:  (●) Asesor  ( ) Supervisor                        │   │
│  │ Período:          Año [2026 ▼]  Mes [Febrero ▼]                     │   │
│  │                                                                     │   │
│  │ Descripción: [_Basado en esquema oficial de Entel_______________]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  MONTOS BASE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Sueldo Fijo:     S/. [__1,050.00__]                                 │   │
│  │ Sueldo Variable: S/. [__1,025.00__]  (máximo alcanzable)            │   │
│  │                                                                     │   │
│  │ Cuota SS Total:  [__70__] líneas                                    │   │
│  │ Cumplimiento mínimo global: [__50__%]                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                    [Cancelar]  [Guardar y Continuar →]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Editor de Partidas (`/comisiones/esquemas/[id]/partidas`)

**Propósito:** Configurar las partidas comisionables del esquema

**Permisos:** ADMIN, GERENTE_COMERCIAL, BACKOFFICE_OPERACIONES

**Diseño:** Tabla editable con modal para cada partida

**Columnas de la tabla:**
| Columna | Descripción |
|---------|-------------|
| Tipo | Selección de commission_item_types |
| Categoría | principal/adicional/pxq/bono (readonly) |
| Meta | Cantidad objetivo |
| Peso % | Porcentaje del variable |
| Mix | Factor para subpartidas |
| Variable S/. | Monto máximo de la partida |
| Cumpl. Mín | Override del global (opcional) |
| Tope | Sí/No y valor |
| Estado | Activo/Inactivo |
| Acciones | Editar, Candados, Eliminar |

**Reglas de negocio visibles:**
- Las partidas PRINCIPALES deben sumar 100% de peso
- Las partidas ADICIONALES no tienen peso
- Se muestra suma de pesos en tiempo real

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Esquema    Partidas del Esquema: Asesor Feb 2026            [+ Agregar] │
├─────────────────────────────────────────────────────────────────────────────┤
│  PARTIDAS PRINCIPALES (deben sumar 100%)                    Suma: 100% ✓   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tipo        │ Meta │ Peso  │ Mix   │ Variable │ Min  │ Tope │ Acc  │   │
│  ├─────────────┼──────┼───────┼───────┼──────────┼──────┼──────┼──────┤   │
│  │ OSS         │ 31.5 │ 45%   │ 0.27  │ S/.324   │ 50%  │ No   │ ✏️🔒│   │
│  │ OPP         │ 5.6  │ 8%    │ 0.08  │ S/.82    │ 50%  │ No   │ ✏️🔒│   │
│  │ VR_BASE     │ 21   │ 30%   │ 0.30  │ S/.308   │ 50%  │ No   │ ✏️🔒│   │
│  │ VR_CAPTURA  │ 11.9 │ 17%   │ 0.17  │ S/.174   │ 70%  │ No   │ ✏️🔒│   │
│  └─────────────┴──────┴───────┴───────┴──────────┴──────┴──────┴──────┘   │
│                                                                             │
│  PARTIDAS ADICIONALES                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tipo        │ Meta │ Variable │ Cumpl. Mín │ Tope    │ Candados │   │   │
│  ├─────────────┼──────┼──────────┼────────────┼─────────┼──────────┤   │   │
│  │ RENO_SS     │ 20   │ S/.120   │ 50%        │ Sí 100% │ 🔒2 MEP  │ ✏️│   │
│  │ PACK_SS     │ 10   │ S/.60    │ 50%        │ Sí 100% │ 🔒2 MEP  │ ✏️│   │
│  │ PREPAGO     │ 50   │ S/.50    │ -          │ No      │ -        │ ✏️│   │
│  │ ACCESORIOS  │ -    │ 3%       │ -          │ No      │ -        │ ✏️│   │
│  └─────────────┴──────┴──────────┴────────────┴─────────┴──────────┴───┘   │
│                                                                             │
│  PARTIDAS PxQ                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tipo           │ Escalas definidas                        │ Acc    │   │
│  ├────────────────┼──────────────────────────────────────────┼────────┤   │
│  │ PXQ_PORTA      │ 50-60%: S/.10 | 61-80%: S/.15 | 81+: S/.20│ ✏️    │   │
│  │ PXQ_LLAA       │ 50-60%: S/.10 | 61-80%: S/.15 | 81+: S/.20│ ✏️    │   │
│  └────────────────┴──────────────────────────────────────────┴────────┘   │
│                                                                             │
│  BONOS                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tipo              │ Condición          │ Monto     │ Acc            │   │
│  ├───────────────────┼────────────────────┼───────────┼────────────────┤   │
│  │ BONO_NPS_VENTA    │ NPS Venta >= 60%   │ S/.50     │ ✏️             │   │
│  │ BONO_NPS_POSTVENTA│ NPS PV >= 50%      │ S/.50     │ ✏️             │   │
│  └───────────────────┴────────────────────┴───────────┴────────────────┘   │
│                                                                             │
│  [← Datos Generales]    [Restricciones →]    [Vista Previa]  [Guardar]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Modal: Editar Partida

**Propósito:** Configurar una partida individual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Editar Partida: OSS                                                [X]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tipo de partida: [OSS - Portabilidad PostPago ▼] (catálogo)               │
│  Categoría: Principal (readonly)                                            │
│  Tipo de cálculo: Porcentaje (readonly)                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  CONFIGURACIÓN DE META                                                      │
│                                                                             │
│  Meta (unidades):     [___31.5___]                                          │
│  Peso (%):            [___45____] % del variable                            │
│  Factor Mix:          [___0.27__] (para subpartidas)                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  COMISIÓN                                                                   │
│                                                                             │
│  Variable máximo:     S/. [__324.00__]                                      │
│  Cumplimiento mínimo: [__50__] % (vacío = usar global)                      │
│                                                                             │
│  ☐ Tiene tope máximo                                                        │
│     Porcentaje tope:  [____] %                                              │
│     Monto tope:       S/. [________]                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  CANDADOS (condiciones para comisionar)                                     │
│                                                                             │
│  [+ Agregar candado]                                                        │
│  (No hay candados configurados)                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ☑ Partida activa                                                           │
│                                                                             │
│                                              [Cancelar]  [Guardar Partida] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Modal: Configurar Candado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Configurar Candado para: RENO_SS                                     [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Para poder comisionar RENO_SS, el HC debe cumplir:                        │
│                                                                             │
│  Tipo de condición: [Cantidad mínima ▼]                                    │
│                      - Cantidad mínima                                      │
│                      - Monto mínimo                                         │
│                      - Porcentaje mínimo                                    │
│                      - Cumplimiento mínimo global                           │
│                                                                             │
│  Producto requerido: [SEGURO_MEP - Mi Equipo Protegido ▼]                  │
│  Valor mínimo:       [___2___] unidades                                    │
│                                                                             │
│  Descripción: [_Vender al menos 2 seguros MEP______________]               │
│                                                                             │
│  ☑ Candado activo                                                          │
│                                                                             │
│                                              [Cancelar]  [Guardar Candado] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Configurador de Restricciones (`/comisiones/esquemas/[id]/restricciones`)

**Propósito:** Definir límites de mix de productos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Partidas    Restricciones del Esquema                      [+ Agregar]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Las restricciones limitan qué unidades cuentan para comisión.             │
│                                                                             │
│  RESTRICCIONES ACTIVAS                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tipo          │ Detalle                              │ Estado │ Acc │   │
│  ├───────────────┼──────────────────────────────────────┼────────┼─────┤   │
│  │ Máx % Plan    │ Plan 39.90: máx 10% de cuota SS      │ ✓ Act  │ ✏️🗑│   │
│  │ Máx Cantidad  │ Plan 34.90: máx 20 unidades por TEX  │ ✓ Act  │ ✏️🗑│   │
│  │ Máx % Plan    │ Plan 44.9/45.9: máx 30% de cuota SS  │ ✓ Act  │ ✏️🗑│   │
│  │ Origen Porta  │ 40% mínimo de Claro (opcional)       │ ○ Inac │ ✏️🗑│   │
│  └───────────────┴──────────────────────────────────────┴────────┴─────┘   │
│                                                                             │
│  [← Partidas]                      [Vista Previa]  [Guardar y Continuar →] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Modal: Agregar Restricción

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Nueva Restricción                                                    [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tipo de restricción:                                                       │
│  (●) Máximo porcentaje de un plan                                          │
│  ( ) Máxima cantidad de un plan                                            │
│  ( ) Mínimo porcentaje (origen portabilidad)                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Código de plan:        [___39.90___]                                      │
│  Porcentaje máximo:     [____10____] % de la cuota SS                      │
│                                                                             │
│  Aplica a:                                                                  │
│  (●) Por HC individual                                                      │
│  ( ) Por TEX (tienda)                                                       │
│  ( ) Global                                                                 │
│                                                                             │
│  Partida afectada:      [Todas las SS ▼] (opcional)                        │
│                                                                             │
│  Descripción:           [_Máximo 10% del plan 39.90 para comisión_]        │
│                                                                             │
│  ☑ Restricción activa                                                       │
│                                                                             │
│                                            [Cancelar]  [Guardar Restricción]│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Vista Previa / Resumen del Esquema (`/comisiones/esquemas/[id]`)

**Propósito:** Ver el esquema completo antes de aprobar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Esquema: Asesor Febrero 2026                  Estado: ◐ DRAFT             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                  │
│  │ INFORMACIÓN GENERAL     │  │ MONTOS                  │                  │
│  │ Tipo: Asesor            │  │ Fijo:     S/. 1,050.00  │                  │
│  │ Período: Feb 2026       │  │ Variable: S/. 1,025.00  │                  │
│  │ Origen: Socio           │  │ Cuota SS: 70 líneas     │                  │
│  │ Creado: 25/01/2026      │  │ Cumpl. mín: 50%         │                  │
│  └─────────────────────────┘  └─────────────────────────┘                  │
│                                                                             │
│  RESUMEN DE PARTIDAS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PRINCIPALES (100%)          │ Meta  │ Peso │ Variable │ Cumpl.     │   │
│  │ OSS                         │ 31.5  │ 45%  │ S/.324   │ 50%        │   │
│  │ OPP                         │ 5.6   │ 8%   │ S/.82    │ 50%        │   │
│  │ VR_BASE                     │ 21    │ 30%  │ S/.308   │ 50%        │   │
│  │ VR_CAPTURA                  │ 11.9  │ 17%  │ S/.174   │ 70%        │   │
│  ├─────────────────────────────┼───────┼──────┼──────────┼────────────┤   │
│  │ ADICIONALES                 │       │      │          │            │   │
│  │ RENO_SS (🔒2 MEP)           │ 20    │ -    │ S/.120   │ 50%        │   │
│  │ PACK_SS (🔒2 MEP)           │ 10    │ -    │ S/.60    │ 50%        │   │
│  │ PREPAGO                     │ 50    │ -    │ S/.50    │ -          │   │
│  ├─────────────────────────────┼───────┼──────┼──────────┼────────────┤   │
│  │ PxQ                         │       │      │ Escalas  │            │   │
│  │ Portabilidad               │ -     │ -    │ S/.10-30 │ según %    │   │
│  ├─────────────────────────────┼───────┼──────┼──────────┼────────────┤   │
│  │ BONOS                       │       │      │          │            │   │
│  │ NPS Venta (>60%)            │ -     │ -    │ S/.50    │ binario    │   │
│  │ NPS Post Venta (>50%)       │ -     │ -    │ S/.50    │ binario    │   │
│  └─────────────────────────────┴───────┴──────┴──────────┴────────────┘   │
│                                                                             │
│  RESTRICCIONES ACTIVAS: 3                                                   │
│  • Plan 39.90: máx 10% de cuota SS                                         │
│  • Plan 34.90: máx 20 unidades por TEX                                     │
│  • Plan 44.9/45.9: máx 30% de cuota SS                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️ Este esquema está en estado DRAFT                                │   │
│  │    Al aprobar, reemplazará cualquier esquema aprobado del período.  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [✏️ Editar]  [📋 Clonar]  [⚡ Simular]  [✓ Aprobar Esquema]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. REGLAS DE NEGOCIO DEL FRONTEND

### 4.1 Estados de Esquemas

| Estado | Puede Editar | Puede Aprobar | Puede Clonar | Puede Eliminar |
|--------|-------------|---------------|--------------|----------------|
| `oficial` | NO | NO | SÍ | NO |
| `draft` | SÍ | SÍ | SÍ | SÍ |
| `aprobado` | NO | NO | SÍ | NO |
| `archivado` | NO | NO | SÍ | NO |

### 4.2 Validaciones de Formularios

**Al crear/editar esquema:**
1. Nombre es requerido y único por período
2. Código es requerido, único, sin espacios, máximo 50 caracteres
3. Año debe estar entre 2020 y 2100
4. Mes debe estar entre 1 y 12
5. Sueldo Fijo >= 0
6. Sueldo Variable >= 0
7. Cuota SS > 0

**Al agregar partida:**
1. Tipo de partida es único dentro del esquema
2. Si es tipo "principal": peso debe estar entre 0.01 y 1.00
3. Si es tipo "porcentaje": variable_amount > 0
4. Cumplimiento mínimo entre 0.01 y 1.00 si se especifica
5. Si tiene tope: porcentaje entre 0.01 y 2.00 (permite hasta 200%)

**Validación de pesos:**
```javascript
const partidasPrincipales = partidas.filter(p => p.category === 'principal');
const sumaPesos = partidasPrincipales.reduce((sum, p) => sum + p.weight, 0);
if (Math.abs(sumaPesos - 1.0) > 0.001) {
  error("Las partidas principales deben sumar 100%");
}
```

### 4.3 Reglas de Aprobación

1. Solo se puede aprobar un esquema en estado `draft`
2. Al aprobar, se verifica que exista al menos una partida
3. Se verifica que los pesos de partidas principales sumen 100%
4. Si existe otro esquema `aprobado` para el mismo tipo/período:
   - Se cambia automáticamente a `archivado`
   - Se registra quién/cuándo lo archivó
5. El nuevo esquema queda como `aprobado`
6. Se registra approved_by y approved_at

### 4.4 Comportamiento de Clonar

1. Crea una copia exacta del esquema
2. El nuevo esquema tiene estado `draft`
3. Se sugiere un nuevo código: `{codigo_original}_COPIA`
4. Se sugiere un nuevo nombre: `{nombre_original} (Copia)`
5. Las partidas, candados y restricciones se copian
6. Las escalas PxQ se copian

### 4.5 Restricciones según Estado

**Esquema OFICIAL (importado de Entel):**
- Botón Editar: OCULTO
- Botón Aprobar: OCULTO
- Botón Clonar: VISIBLE ("Clonar para modificar")
- Mensaje: "Este es el esquema oficial de Entel. Clone para crear una versión modificada."

**Esquema APROBADO (vigente):**
- Botón Editar: OCULTO
- Botón Aprobar: OCULTO
- Botón Clonar: VISIBLE
- Badge verde: "VIGENTE"

**Esquema ARCHIVADO:**
- Botón Editar: OCULTO
- Botón Aprobar: OCULTO
- Botón Clonar: VISIBLE
- Badge gris: "ARCHIVADO"

---

## 5. MATRIZ DE PERMISOS

| Pantalla/Acción | ADMIN | GERENTE_COMERCIAL | GERENTE_GENERAL | JEFE_VENTAS | BACKOFFICE_OP | BACKOFFICE_RRHH |
|-----------------|-------|-------------------|-----------------|-------------|---------------|-----------------|
| Ver lista esquemas | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver detalle esquema | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Crear esquema | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Editar esquema | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Clonar esquema | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Aprobar esquema | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Eliminar esquema draft | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Agregar partidas | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Configurar candados | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Configurar restricciones | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Usar simulador | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 6. INTEGRACIÓN CON DATOS EXISTENTES

### 6.1 Tabla `commission_item_types`

**Uso:** Poblar select de tipos de partida al agregar una nueva partida.

```typescript
// Consulta para obtener tipos de partida
const { data: itemTypes } = await supabase
  .from('commission_item_types')
  .select('id, code, name, category, calculation_type, group_code')
  .eq('is_active', true)
  .order('display_order');
```

**Agrupación en UI:**
- Principal: OSS, OPP, VR (y subtipos)
- Adicional: RENO, PACK, PREPAGO, ACCESORIOS, SEGURO
- PxQ: PXQ_PORTA, PXQ_LLAA, PXQ_RENO, PXQ_VEP
- Bono: BONO_NPS_VENTA, BONO_NPS_POSTVENTA

### 6.2 Tabla `usuarios`

**Uso:** 
- Obtener `created_by`, `approved_by` para esquemas
- Verificar rol del usuario actual para permisos

```typescript
// Verificar si puede editar
const { data: currentUser } = await supabase
  .from('usuarios')
  .select('id, rol')
  .eq('id', session.user.id)
  .single();

const canEdit = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES'].includes(currentUser.rol);
```

### 6.3 Tabla `tipos_venta`

**Uso:** Mapeo visual para mostrar qué ventas alimentan cada partida.

La columna `tipos_venta_codigos` en `commission_item_types` contiene los códigos de `tipos_venta` que aplican.

```typescript
// Ejemplo: Mostrar qué tipos de venta alimentan OSS
const ossItem = itemTypes.find(t => t.code === 'OSS');
// ossItem.tipos_venta_codigos = ['OSS_BASE', 'OSS_CAPTURA']
```

### 6.4 Para el Simulador (futuro)

**Tabla `lineas_inar`:** Datos reales de ventas confirmadas
**Tabla `ventas`:** Datos declarativos (BU)

Esto se usará en el Simulador de Ingresos (siguiente módulo).

---

## 7. COMPONENTES TÉCNICOS RECOMENDADOS

### 7.1 Estructura de Archivos

```
app/
└── (dashboard)/
    └── comisiones/
        └── esquemas/
            ├── page.tsx                    # Lista de esquemas
            ├── nuevo/
            │   └── page.tsx                # Crear esquema
            └── [id]/
                ├── page.tsx                # Vista detalle/resumen
                ├── editar/
                │   └── page.tsx            # Editar datos generales
                ├── partidas/
                │   └── page.tsx            # Editor de partidas
                └── restricciones/
                    └── page.tsx            # Configurador restricciones

components/
└── comisiones/
    ├── SchemeCard.tsx                      # Tarjeta de esquema en lista
    ├── SchemeForm.tsx                      # Formulario datos generales
    ├── SchemeItemsTable.tsx                # Tabla de partidas
    ├── SchemeItemModal.tsx                 # Modal editar partida
    ├── LockConfigModal.tsx                 # Modal configurar candado
    ├── RestrictionForm.tsx                 # Formulario de restricción
    ├── SchemeSummary.tsx                   # Vista resumen
    ├── SchemeStatusBadge.tsx               # Badge de estado
    └── WeightsSummary.tsx                  # Indicador suma de pesos

lib/
└── comisiones/
    ├── types.ts                            # Tipos TypeScript
    ├── validations.ts                      # Esquemas Zod
    └── calculations.ts                     # Funciones auxiliares
```

### 7.2 Tipos TypeScript Principales

```typescript
// types.ts
type SchemeStatus = 'oficial' | 'draft' | 'aprobado' | 'archivado';
type SchemeType = 'asesor' | 'supervisor';
type ItemCategory = 'principal' | 'adicional' | 'pxq' | 'postventa' | 'bono';
type CalculationType = 'percentage' | 'pxq' | 'binary' | 'fixed';
type LockType = 'min_quantity' | 'min_amount' | 'min_percentage' | 'min_fulfillment';
type RestrictionType = 'max_percentage' | 'max_quantity' | 'min_percentage' | 'operator_origin';

interface CommissionScheme {
  id: string;
  name: string;
  code: string;
  description?: string;
  scheme_type: SchemeType;
  year: number;
  month: number;
  status: SchemeStatus;
  source: 'entel' | 'socio';
  fixed_salary: number;
  variable_salary: number;
  total_ss_quota: number;
  default_min_fulfillment: number;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

interface CommissionSchemeItem {
  id: string;
  scheme_id: string;
  item_type_id: string;
  item_type?: CommissionItemType; // joined
  quota?: number;
  weight?: number;
  mix_factor?: number;
  variable_amount: number;
  min_fulfillment?: number;
  has_cap: boolean;
  cap_percentage?: number;
  cap_amount?: number;
  is_active: boolean;
  display_order: number;
}

interface CommissionItemLock {
  id: string;
  scheme_item_id: string;
  lock_type: LockType;
  required_item_type_id?: string;
  required_value: number;
  is_active: boolean;
  description?: string;
}
```

### 7.3 Validaciones Zod

```typescript
// validations.ts
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

export const schemeItemFormSchema = z.object({
  item_type_id: z.string().uuid(),
  quota: z.number().optional(),
  weight: z.number().min(0).max(1).optional(),
  mix_factor: z.number().optional(),
  variable_amount: z.number().min(0),
  min_fulfillment: z.number().min(0).max(1).optional(),
  has_cap: z.boolean(),
  cap_percentage: z.number().min(0).max(2).optional(),
  cap_amount: z.number().optional(),
  is_active: z.boolean().default(true),
});
```

---

## 8. NAVEGACIÓN Y UX

### 8.1 Breadcrumbs

```
Dashboard > Comisiones > Esquemas
Dashboard > Comisiones > Esquemas > Nuevo
Dashboard > Comisiones > Esquemas > [nombre] > Editar
Dashboard > Comisiones > Esquemas > [nombre] > Partidas
Dashboard > Comisiones > Esquemas > [nombre] > Restricciones
```

### 8.2 Menú de Navegación

En el sidebar, agregar sección:
```
📊 Comisiones
├── 📋 Esquemas
├── 📥 Importar
├── ⚡ Simulador
└── ⚠️ Penalidades
```

### 8.3 Flujo de Wizard (opcional pero recomendado)

Al crear esquema nuevo, guiar al usuario:
```
[1. Datos Generales] → [2. Partidas] → [3. Restricciones] → [4. Revisar y Aprobar]
```

Mostrar indicador de progreso y permitir navegación entre pasos.

---

## 9. ESTADOS DE UI Y FEEDBACK

### 9.1 Estados de Carga

- Lista de esquemas: Skeleton cards
- Detalle de esquema: Skeleton con estructura
- Guardando: Button loading + toast "Guardando..."
- Aprobando: Modal de confirmación + loading

### 9.2 Mensajes de Éxito

```typescript
// Ejemplos con react-hot-toast o shadcn toast
toast.success("Esquema creado exitosamente");
toast.success("Partida agregada");
toast.success("Esquema aprobado. Ahora es el vigente para Feb 2026");
```

### 9.3 Mensajes de Error

```typescript
toast.error("Las partidas principales deben sumar 100%");
toast.error("Ya existe un esquema con ese código");
toast.error("Error al guardar. Intente nuevamente.");
```

### 9.4 Confirmaciones

**Aprobar esquema:**
```
¿Aprobar este esquema?
Este esquema será el vigente para Asesor - Feb 2026.
Si existe otro esquema aprobado, será archivado automáticamente.
[Cancelar] [Aprobar]
```

**Eliminar partida:**
```
¿Eliminar esta partida?
Esta acción no se puede deshacer.
[Cancelar] [Eliminar]
```

---

## 10. PRÓXIMOS PASOS PARA CLAUDE CODE

### Orden recomendado de desarrollo:

1. **Crear tipos y validaciones** (`lib/comisiones/`)
2. **Lista de esquemas** (`/comisiones/esquemas`)
3. **Crear esquema** (formulario datos generales)
4. **Vista detalle** (resumen del esquema)
5. **Editor de partidas** (tabla + modal)
6. **Configuración de candados** (modal)
7. **Configuración de restricciones** (formulario)
8. **Flujo de aprobación** (modal + lógica)
9. **Clonar esquema** (función auxiliar)

### Dependencias a instalar:

```bash
npm install @tanstack/react-table  # Para tablas editables
npm install react-hook-form zod @hookform/resolvers  # Ya instalados
npm install sonner  # Para toasts (si no usa shadcn toast)
```

---

**Este documento es la guía completa para implementar el Editor de Esquemas. Adjuntar a Claude Code junto con GRIDRETAIL_QUICK_REFERENCE.md**
