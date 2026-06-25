# Módulo: Reporte de Arribos

## Información General

| Campo | Valor |
|-------|-------|
| **Módulo** | Reporte de Arribos |
| **Versión** | 2.0 |
| **Última actualización** | 2026-06-09 |
| **Estado** | Implementado |
| **Dependencias** | Módulo Arribos v1.3 |

---

## 1. Descripción

El módulo de Reporte de Arribos proporciona visualización y análisis del tráfico de clientes en las tiendas Express de la red TEX. Permite a supervisores y gerentes monitorear el flujo de visitantes, evaluar conversión y tomar decisiones operativas basadas en datos.

### 1.1 Objetivos

- Visualizar tráfico por tienda y hora en tiempo real
- Comparar rendimiento entre tiendas y períodos
- Identificar patrones de tráfico (horas pico, días)
- Detectar tiendas con problemas de conversión
- Facilitar decisiones de staffing y operaciones

### 1.2 Usuarios Objetivo

| Rol | Acceso | Uso principal |
|-----|--------|---------------|
| Gerente General | Todas las tiendas | Visión estratégica |
| Gerente Regional | Tiendas de sus zonas | Gestión por zona |
| Supervisor/Coordinador | Tiendas de su zona | Operaciones diarias |
| Asesor | Solo su tienda | Consulta personal |

---

## 2. Principios de Diseño

### 2.1 Filosofía

> **"¿Qué puedo corregir HOY con esta métrica?"**

El diseño prioriza métricas accionables sobre información exhaustiva. Solo se muestran en la vista principal los KPIs que permiten tomar decisiones inmediatas.

### 2.2 Jerarquía de KPIs

| Tier | KPIs | Ubicación | Accionabilidad |
|------|------|-----------|----------------|
| **1 - Fundamentales** | Tráfico, Conversión | Vista principal, siempre visible | Alta - decisiones inmediatas |
| **2 - Contexto** | Hora Pico, Δ% vs N-7 | Columnas de tabla | Media - contexto temporal |
| **3 - Diagnóstico** | Motivos, Segmentación, Base/Nuevo | Solo en drill-down | Baja - análisis profundo |

### 2.3 Benchmarks de Referencia

| Métrica | Benchmark | Fuente |
|---------|-----------|--------|
| Conversión retail general | 20-40% | Retail TouchPoints, ShopperTrak |
| Conversión tienda celulares | 25-35% | Mobile retail studies |
| Cross-sell accesorios | 15-25% | Telecom retail |

---

## 3. Arquitectura de Vistas

### 3.1 Estructura de Navegación

```
/dashboard/reportes/arribos/
├── page.tsx                    ← Vista principal (tabs + sidebar)
└── [tienda_id]/
    └── page.tsx                ← Vista expandida de tienda
```

### 3.2 Vista Principal: 3 Tabs

| Tab | Nombre | Contenido | Uso principal |
|-----|--------|-----------|---------------|
| 1 | **Por Hora** | Matriz Tiendas × Horas (8-21h) | Gestión operativa en tiempo real |
| 2 | **Métricas** | Tabla: Tráfico, Δ%, Conv, Pico | Evaluación de desempeño |
| 3 | **Dual** | Métricas + Sparkline horario | Vista compacta combinada |

### 3.3 Barra de KPIs (siempre visible)

```
Total: 4,856 +8%  |  Conv: 42%  |  Pico: 2pm (528)  |  Líder: MEGA (612)
```

### 3.4 Drill-down Híbrido

El sistema implementa un drill-down en dos niveles:

| Nivel | Trigger | Contenido | Ancho |
|-------|---------|-----------|-------|
| **Sidebar** | Click en fila | KPIs, mini gráfico, embudo, top 3 motivos | 320px |
| **Página expandida** | Click "Expandir" | Detalle completo + gráficos grandes | Fullscreen |

---

## 4. Especificación de Columnas

### 4.1 Tab "Por Hora" (Matriz)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| Tienda | sticky | Nombre + código zona |
| 8, 9, 10... 21 | number | Arribos por hora con heatmap |
| Total | number | Suma del día |

**Formato de celdas:**
- Escala de color: 5 niveles de azul (bajo→alto)
- Pico de tienda: borde verde
- Pico de red (footer): fondo verde

### 4.2 Tab "Métricas"

| Columna | Tipo | Semáforo |
|---------|------|----------|
| Tienda | text | Alerta ⚠️ si problemas |
| Tráfico | number | - |
| Δ% | percent | Verde >0, Rojo <0 |
| Conv. | percent | Verde ≥42%, Rojo <35% |
| Pico | hour | - |

### 4.3 Tab "Dual"

| Columna | Tipo | Descripción |
|---------|------|-------------|
| Tienda | text | Con alerta si aplica |
| Tráf. | number | Total |
| Δ% | percent | Variación |
| Conv | percent | Conversión |
| Distribución | sparkline | Barras mini por hora |

---

## 5. Filtros

### 5.1 Filtros Globales

| Filtro | Opciones | Default |
|--------|----------|---------|
| Zona | Todas, Norte, Sur, Este, Centro | Todas |
| Fecha | DatePicker | Hoy |
| Comparación | vs N-1, vs N-7, vs Prom 4s | N-7 |

### 5.2 Tipos de Comparación

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `N-1` | Día Anterior | Cambios inmediatos |
| `N-7` | Mismo Día Semana Anterior | ⭐ Default - evita distorsión día |
| `AVG-4W` | Promedio 4 Semanas | Línea base estable |

---

## 6. Contenido del Sidebar

### 6.1 Estructura Visual

```
┌─────────────────────────────┐
│ TE VMT                    ✕ │
│ Sur • Sábado 7 Jun          │
├─────────────────────────────┤
│ ┌─────────┐ ┌─────────┐     │
│ │ Tráfico │ │ Conv.   │     │
│ │   486   │ │   44%   │     │
│ └─────────┘ └─────────┘     │
├─────────────────────────────┤
│ Por hora                    │
│ [▁▂▃▄▅▆█▆▅▄▅▆▄▂]           │
│  8am    2pm    9pm          │
├─────────────────────────────┤
│ Embudo                      │
│ ████████████ 486            │
│ ██████████ 420 (Venta)      │
│   ████ 185  ██████ 235      │
│    ✓         ✗              │
├─────────────────────────────┤
│ Top motivos ❌               │
│ Sin stock      24%          │
│ Precio alto    18%          │
│ No califica    15%          │
├─────────────────────────────┤
│ [Expandir ↗]                │
└─────────────────────────────┘
```

### 6.2 Comportamiento

- **Abrir**: Click en fila de tienda
- **Cerrar**: Click en ✕ o click fuera
- **Expandir**: Navega a `/reportes/arribos/[tienda_id]`

---

## 7. Contenido de Página Expandida

La página expandida incluye todo el contenido del sidebar más:

| Sección | Descripción |
|---------|-------------|
| KPIs grandes | 4 cards: Tráfico, Conv, Pico, Ranking |
| Gráfico por hora | Barras completas con comparación N-7 |
| Embudo completo | Con Cross-sell Posventa destacado |
| Segmentación | Base/Nuevo, Peruano/Extranjero |
| Motivos completos | Barras horizontales, todos los motivos |
| Navegación | ← Anterior / Siguiente → entre tiendas |

---

## 8. Umbrales y Alertas

### 8.1 Semáforos

| Métrica | Verde | Amarillo | Rojo |
|---------|-------|----------|------|
| Conversión | ≥42% | 35-41% | <35% |
| Δ% | >5% | 0-5% | <0% |
| Motivo top | <20% | 20-30% | >30% |

### 8.2 Alertas en Fila

Una tienda muestra ⚠️ si:
- Conversión < 35% **O**
- Δ% < -5% **O**
- Motivo principal > 30%

---

## 9. Base de Datos

### 9.1 Funciones SQL

| Función | Parámetros | Descripción |
|---------|------------|-------------|
| `get_arribos_matriz` | fecha, zona | Matriz pivoteada tiendas × horas |
| `get_arribos_metricas` | fecha, zona, comparacion | Métricas con comparación temporal |
| `get_arribos_resumen_red` | fecha, zona | KPIs agregados de toda la red |
| `get_arribos_detalle_tienda` | tienda_id, fecha | Detalle completo para sidebar |

### 9.2 Índices

```sql
-- Para consultas por fecha y hora
CREATE INDEX idx_arribos_fecha_hora 
ON arribos(fecha, (EXTRACT(HOUR FROM hora)));

-- Para filtro por tienda y fecha
CREATE INDEX idx_arribos_tienda_fecha 
ON arribos(tienda_id, fecha);

-- Para cálculo de conversión
CREATE INDEX idx_arribos_conversion 
ON arribos(tienda_id, fecha, tipo_visita, se_vendio);

-- Para segmentación
CREATE INDEX idx_arribos_segmentacion
ON arribos(tienda_id, fecha, es_cliente_entel, tipo_documento_cliente);
```

---

## 10. API Endpoints

### 10.1 GET /api/reportes/arribos/matriz

Retorna matriz de arribos por tienda y hora.

**Parámetros:**
| Param | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| fecha | date | No | Hoy |
| zona | string | No | null (todas) |

**Response:**
```json
{
  "fecha": "2026-06-07",
  "zona": null,
  "resumen": {
    "total": 4856,
    "delta_pct": 8.2,
    "conversion": 42,
    "hora_pico": 14,
    "hora_pico_cantidad": 528,
    "tienda_lider": { "id": "...", "codigo": "MEGA", "total": 612 },
    "tiendas_activas": 21
  },
  "tiendas": [
    {
      "id": "uuid",
      "nombre": "MEGA PLAZA",
      "codigo": "MEGA",
      "zona": "NORTE",
      "horas": { "8": 15, "9": 22, ... },
      "total": 612,
      "hora_pico": 14
    }
  ]
}
```

### 10.2 GET /api/reportes/arribos/metricas

Retorna métricas de arribos por tienda.

**Parámetros:**
| Param | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| fecha | date | No | Hoy |
| zona | string | No | null |
| comparacion | string | No | N-7 |

**Response:**
```json
{
  "fecha": "2026-06-07",
  "zona": null,
  "comparacion": "N-7",
  "resumen": { ... },
  "tiendas": [
    {
      "id": "uuid",
      "nombre": "MEGA PLAZA",
      "codigo": "MEGA",
      "zona": "NORTE",
      "trafico": 612,
      "trafico_comparacion": 532,
      "delta_pct": 15.0,
      "conversion": 52,
      "hora_pico": 14,
      "tiene_alerta": false
    }
  ]
}
```

### 10.3 GET /api/reportes/arribos/tienda/[id]

Retorna detalle completo de una tienda.

**Parámetros:**
| Param | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| fecha | date | No | Hoy |

**Response:**
```json
{
  "tienda": {
    "id": "uuid",
    "nombre": "TE VMT",
    "codigo": "VMT",
    "zona": "SUR",
    "direccion": "..."
  },
  "fecha": "2026-06-07",
  "metricas": {
    "trafico": 486,
    "trafico_n7": 438,
    "delta_pct": 11.0,
    "conversion": 44,
    "hora_pico": 14,
    "ranking": 3
  },
  "por_hora": [
    { "hora": 8, "cantidad": 12, "cantidad_n7": 10 },
    ...
  ],
  "embudo": {
    "total": 486,
    "venta": 420,
    "posventa": 66,
    "vendio": 185,
    "no_vendio": 235,
    "crosssell": 8,
    "tasa_venta": 44,
    "tasa_crosssell": 12
  },
  "segmentacion": {
    "base": 185,
    "nuevo": 301,
    "sin_dato": 0,
    "peruanos": 379,
    "extranjeros": 73,
    "sin_documento": 34,
    "pct_base": 38,
    "pct_nuevo": 62,
    "pct_extranjeros": 15
  },
  "motivos": [
    { "motivo": "SIN_STOCK", "cantidad": 56, "porcentaje": 24 },
    { "motivo": "PRECIO_ALTO", "cantidad": 42, "porcentaje": 18 },
    ...
  ]
}
```

---

## 11. Estructura de Archivos Frontend

```
app/
├── api/reportes/arribos/
│   ├── matriz/route.ts           # Endpoint matriz
│   ├── metricas/route.ts         # Endpoint métricas
│   └── tienda/[id]/route.ts      # Endpoint detalle
├── (dashboard)/dashboard/reportes/arribos/
│   ├── page.tsx                  # Página principal
│   ├── components/
│   │   ├── ArribosHeader.tsx     # Filtros + KPIs de red
│   │   ├── ArribosTabHoras.tsx   # Tab matriz
│   │   ├── ArribosTabMetricas.tsx # Tab métricas
│   │   ├── ArribosTabDual.tsx    # Tab dual
│   │   └── ArribosSidebar.tsx    # Panel lateral
│   └── [tienda_id]/
│       └── page.tsx              # Página expandida (pendiente)
hooks/
└── useArribosData.ts             # Hook con estado compartido
lib/auth/
└── permisos.ts                   # Helper de permisos
```

---

## 12. Hook useArribosData

El hook centraliza el estado y la lógica de datos:

```typescript
const {
  // Estado
  tabActivo,           // 'horas' | 'metricas' | 'dual'
  tiendaSeleccionada,  // string | null
  fecha,               // string (YYYY-MM-DD)
  zona,                // string | null
  comparacion,         // 'N-1' | 'N-7' | 'AVG-4W'
  
  // Setters
  setTabActivo,
  setFecha,
  setZona,
  setComparacion,
  seleccionarTienda,
  cerrarSidebar,
  
  // Datos
  resumen,             // KPIs de red
  matriz,              // Datos tab horas
  metricas,            // Datos tab métricas
  detalle,             // Datos sidebar
  
  // Estado de carga
  loading,
  loadingDetalle,
  
  // Errores
  error,
  errorDetalle,
  
  // Refetch
  refetch
} = useArribosData()
```

---

## 13. Permisos

### 13.1 Matriz de Acceso

| Rol | Tiendas | Exportar |
|-----|---------|----------|
| ADMIN | Todas | ✅ |
| BACKOFFICE | Todas | ✅ |
| GERENTE_GENERAL | Todas | ✅ |
| GERENTE_REGIONAL | Sus zonas | ✅ |
| SUPERVISOR | Su zona | ✅ |
| COORDINADOR | Su zona | ✅ |
| ASESOR_REFERENTE | Su tienda | ❌ |
| ASESOR | Su tienda | ❌ |

### 13.2 Implementación

```typescript
const permisos = await verificarPermisosReporte(supabase, userId, 'arribos')

// permisos.puede_ver: boolean
// permisos.puede_exportar: boolean
// permisos.tiendas_permitidas: string[] | null (null = todas)
// permisos.zonas_permitidas: string[] | null
```

---

## 14. Responsive

| Breakpoint | Comportamiento |
|------------|----------------|
| Desktop (>1024px) | Matriz completa, sidebar 320px |
| Tablet (768-1024px) | Matriz con scroll horizontal, sidebar 280px |
| Mobile (<768px) | Solo tabs Métricas/Dual, sidebar fullscreen |

---

## 15. Métricas de Rendimiento

| Métrica | Objetivo |
|---------|----------|
| Tiempo de carga vista principal | < 2s |
| Tiempo de carga sidebar | < 500ms |
| Tamaño de respuesta matriz | < 50KB |

---

## 16. Archivos de Migración

| Archivo | Descripción |
|---------|-------------|
| `028_reporte_arribos_funciones.sql` | Funciones SQL + índices |

---

## 17. Dependencias

### 17.1 NPM Packages

- `date-fns` - Formateo de fechas
- `lucide-react` - Iconos
- `@/components/ui/*` - Componentes shadcn/ui

### 17.2 Módulos Internos

- Módulo Arribos v1.3 (tabla `arribos`)
- Módulo Tiendas (tabla `tiendas`)
- Módulo Perfiles (tabla `perfiles`)

---

## 18. Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 2.0 | 2026-06-09 | Rediseño completo: 2 KPIs principales, 3 tabs, drill-down híbrido |
| 1.0 | 2026-06-07 | Versión inicial (descartada por exceso de KPIs) |

---

## 19. Pendientes

- [ ] Página expandida `/[tienda_id]/page.tsx`
- [ ] Heatmap semanal
- [ ] Exportar a Excel
- [ ] Vista materializada para performance en redes grandes

---

## 20. Contacto

Para dudas o sugerencias sobre este módulo, consultar la documentación del proyecto GridRetail o contactar al equipo de desarrollo.
