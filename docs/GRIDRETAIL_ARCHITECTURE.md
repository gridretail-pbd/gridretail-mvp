# GridRetail - Arquitectura del Sistema
## Documento de Referencia Central
**Versión:** 1.0  
**Última actualización:** 2026-01-24  
**Propósito:** Este documento es la FUENTE DE VERDAD para todas las conversaciones de desarrollo de GridRetail. Debe adjuntarse a cada nueva conversación del proyecto.

---

## 1. VISIÓN GENERAL

GridRetail es una plataforma de gestión comercial para tiendas TEX (Tiendas Express) que operan bajo el modelo de franquicia de Entel Perú, administradas por el socio de negocio PBD (Peru Best Deals).

### 1.1 Objetivos del Sistema
- Registrar ventas declarativas (Boca de Urna) en tiempo real
- Importar y conciliar datos oficiales del INAR de Entel
- Calcular comisiones del personal comercial
- Gestionar arribos y métricas de conversión
- Proporcionar dashboards operativos en tiempo real

### 1.2 Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS |
| Componentes UI | shadcn/ui |
| Validación | Zod + react-hook-form |
| IDE | VS Code + Claude Code |

---

## 2. MÓDULOS DEL SISTEMA

### 2.1 Módulos Implementados ✅

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| **Registro de Ventas** | Formulario BU (Boca de Urna) para registro declarativo de ventas | ✅ Implementado |
| **Importador INAR** | Importación incremental de líneas activadas desde Excel de Entel | ✅ Implementado |
| **Registro de Arribos** | Conteo manual de clientes que ingresan a tienda | ✅ Implementado |
| **Gestión de Usuarios** | ABM de usuarios con roles y asignación a tiendas | ✅ Implementado |

### 2.2 Módulos En Desarrollo 🔄

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| **Modelador de Comisiones** | Diseño y configuración de esquemas de comisiones | 🔄 Pendiente migración BD |
| **Simulador HC** | Simulador de ingresos para personal comercial | 🔄 Diseño |

### 2.3 Módulos Planificados 📋

| Módulo | Descripción |
|--------|-------------|
| **Calculador de Comisiones** | Cálculo riguroso mensual para nómina |
| **Conciliador BU-INAR** | Cruce automático entre ventas declarativas e INAR |
| **Dashboard Operativo** | Métricas en tiempo real por tienda/zona |
| **Gestión de Penalidades** | Registro e importación de penalidades |

---

## 3. ESTRUCTURA DE BASE DE DATOS

### 3.1 Tablas Existentes (17 objetos)

```
TABLAS CORE
├── usuarios              # Personal comercial y administrativo
├── tiendas               # 21 tiendas TEX
├── usuarios_tiendas      # Relación M:N usuarios-tiendas
├── tipos_venta           # Catálogo de 16 tipos de venta
└── operadores_cedentes   # Movistar, Claro, Bitel

OPERACIONES DIARIAS
├── ventas                # Registro declarativo (BU)
└── arribos               # Conteo de clientes

MÓDULO INAR
├── lineas_inar           # Líneas activadas (49 campos)
├── inar_importaciones    # Historial de importaciones
├── inar_mapeo_columnas   # Mapeo de columnas Excel → BD
├── v_inar_resumen_diario # Vista: resumen por día
├── v_inar_resumen_tienda # Vista: resumen por tienda
└── v_inar_resumen_vendedor # Vista: resumen por vendedor

CONTROL Y AUDITORÍA
├── asesor_incidencias    # Incidencias por asesor
├── asesor_score_mensual  # Vista: score mensual
├── logs_auditoria        # Logs de cambios
└── v_tipos_venta_config  # Vista: config tipos venta
```

### 3.2 Diagrama de Relaciones Principales

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  usuarios   │──M:N─│ usuarios_tiendas │──M:N─│   tiendas   │
└─────────────┘      └──────────────────┘      └─────────────┘
       │                                              │
       │ FK                                           │ FK
       ▼                                              ▼
┌─────────────┐                               ┌─────────────┐
│   ventas    │───────────────────────────────│ lineas_inar │
└─────────────┘                               └─────────────┘
       │                                              │
       │ FK                                           │
       ▼                                              │
┌─────────────┐                                       │
│ tipos_venta │◄──────────────────────────────────────┘
└─────────────┘
```

---

## 4. ROLES Y PERMISOS

### 4.1 Roles Definidos (12 roles)

Los roles están definidos mediante CHECK CONSTRAINT en la tabla `usuarios`:

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `ASESOR` | Asesor de Venta | Personal de atención en tienda |
| `ASESOR_REFERENTE` | Asesor Referente | Asesor con responsabilidades adicionales |
| `COORDINADOR` | Coordinador | Coordina múltiples tiendas |
| `SUPERVISOR` | Supervisor | Supervisa zona/región |
| `JEFE_VENTAS` | Jefe de Ventas | Responsable comercial de zona |
| `GERENTE_COMERCIAL` | Gerente Comercial | Dirección comercial |
| `GERENTE_GENERAL` | Gerente General | Dirección general |
| `BACKOFFICE_OPERACIONES` | Backoffice Operaciones | Soporte operativo |
| `BACKOFFICE_RRHH` | Backoffice RRHH | Recursos humanos |
| `BACKOFFICE_AUDITORIA` | Backoffice Auditoría | Control y auditoría |
| `VALIDADOR_ARRIBOS` | Validador de Arribos | Valida arribos con cámaras |
| `ADMIN` | Administrador | Acceso total al sistema |

### 4.2 Matriz de Permisos por Módulo

| Módulo | ASESOR | SUPERVISOR | JEFE_VENTAS | GERENTE_COMERCIAL | ADMIN |
|--------|--------|------------|-------------|-------------------|-------|
| Registrar ventas | ✅ (su tienda) | ✅ (su tienda) | ❌ | ❌ | ✅ |
| Ver ventas | ✅ (propias) | ✅ (su tienda) | ✅ (su zona) | ✅ (todas) | ✅ |
| Editar ventas | ❌ | ✅ (su tienda) | ✅ (su zona) | ✅ | ✅ |
| Importar INAR | ❌ | ❌ | ❌ | ✅ | ✅ |
| Modelar comisiones | ❌ | ❌ | ❌ | ✅ | ✅ |
| Simular comisiones | ✅ (propias) | ✅ (su tienda) | ✅ (su zona) | ✅ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.3 Agrupación de Roles para Permisos

Para simplificar las políticas RLS, se definen estos grupos:

```sql
-- Grupo: HC (Personal Comercial)
rol IN ('ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR')

-- Grupo: Jefatura
rol IN ('JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL')

-- Grupo: Backoffice
rol IN ('BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA', 'VALIDADOR_ARRIBOS')

-- Grupo: Administración
rol IN ('ADMIN')

-- Grupo: Puede editar comisiones
rol IN ('GERENTE_COMERCIAL', 'ADMIN')

-- Grupo: Puede ver todo
rol IN ('JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN')
```

---

## 5. TIPOS DE VENTA

### 5.1 Catálogo Oficial (16 tipos)

| Código | Nombre | Categoría | Descripción |
|--------|--------|-----------|-------------|
| **POSTPAGO** ||||
| `OSS_BASE` | Porta OSS - Base | POSTPAGO | Portabilidad PostPago→PostPago, cliente BASE (>30 días Entel) |
| `OSS_CAPTURA` | Porta OSS - Captura | POSTPAGO | Portabilidad PostPago→PostPago, cliente nuevo |
| `OPP_MONO` | Porta OPP Mono | POSTPAGO | Portabilidad PrePago→PostPago, línea única |
| `OPP_CAPTURA` | Porta OPP Captura | POSTPAGO | Portabilidad PrePago→PostPago, 2da línea+ |
| `OPP_BASE` | Porta OPP LLAA | POSTPAGO | Portabilidad PrePago→PostPago, cliente BASE |
| `VR_MONO` | VR Mono | POSTPAGO | Venta Regular, línea única (cliente nuevo) |
| `VR_CAPTURA` | VR Captura | POSTPAGO | Venta Regular, 2da línea+ (cliente nuevo) |
| `VR_BASE` | VR LLAA | POSTPAGO | Venta Regular, línea adicional (cliente BASE) |
| `MISS_IN` | Miss In (Pre→Pos Entel) | POSTPAGO | Prepago Entel se convierte a Postpago |
| **PACK** ||||
| `PACK_VR` | Pack + VR Mono | PACK | Equipo con VR Mono |
| `PACK_OSS` | Pack Porta OSS | PACK_SS | Equipo con portabilidad OSS |
| `PACK_VR_BASE` | Pack VR | PACK_SS | Equipo con VR BASE |
| **RENO** ||||
| `RENO` | Renovación Equipo | RENO | Renovación de equipo existente |
| **PREPAGO** ||||
| `PREPAGO` | Venta Prepago | PREPAGO | Chip prepago nuevo |
| `PORTA_PP` | Portabilidad Prepago | PREPAGO | Portabilidad a prepago |
| **OTROS** ||||
| `ACCESORIOS` | Solo Accesorios | OTROS | Venta solo de accesorios |

### 5.2 Reglas de Conteo Múltiple (para Comisiones)

Algunas ventas suman a múltiples partidas de comisión:

| Tipo de Venta | Suma a partidas |
|---------------|-----------------|
| `RENO` + `VR_BASE` (RENO con attach) | RENO + VR_BASE |
| `PACK_OSS` | PACKS + OSS (según subtipo) |
| `PACK_VR` | PACKS + VR (según subtipo) |

### 5.3 Equivalencias para Cálculo de Comisiones

Para el cálculo de comisiones, algunos tipos se agrupan:

| Partida Comisión | Tipos de Venta incluidos |
|------------------|--------------------------|
| VR CAPTURA/MONO | `VR_MONO`, `VR_CAPTURA` |
| VR BASE/LLAA | `VR_BASE` |
| OSS | `OSS_BASE`, `OSS_CAPTURA` |
| OPP | `OPP_MONO`, `OPP_CAPTURA`, `OPP_BASE` |
| PACK SS | `PACK_OSS`, `PACK_VR_BASE` |
| RENO | `RENO` |

---

## 6. TIENDAS TEX

### 6.1 Lista de Tiendas (21)

Las tiendas están almacenadas en la tabla `tiendas` con los campos:
- `id` (UUID)
- `codigo` (ej: "TE_AGUSTINO")
- `nombre` (ej: "TE El Agustino")
- `direccion`
- `distrito`
- `activa` (boolean)

### 6.2 Nomenclatura de Tiendas

El código de tienda sigue el patrón: `TE_[UBICACIÓN]`
- TE = Tienda Express
- Ubicación en mayúsculas sin espacios

---

## 7. GLOSARIO DE TÉRMINOS TEX

### 7.1 Términos Generales

| Término | Significado |
|---------|-------------|
| **TEX** | Tienda Express - formato de tienda pequeña de Entel |
| **SSNN** | Socio de Negocio - operador de las TEX (PBD) |
| **HC** | Personal Comercial (Asesor, Encargado, Coordinador, Supervisor) |
| **BU** | Boca de Urna - registro declarativo de ventas |
| **INAR** | Base de Entel con líneas activadas confirmadas |
| **FICHA** | Documento mensual de Entel con cálculo de comisiones del SSNN |
| **GUÍA COMERCIAL** | Documento mensual con condiciones y esquema de comisiones |

### 7.2 Tipos de Línea

| Término | Significado |
|---------|-------------|
| **SS / POSTPAGO** | Línea por Suscripción |
| **PP / PREPAGO** | Línea PrePago |
| **PORTABILIDAD** | Línea que viene de otro operador |
| **BASE** | Cliente con >30 días en Entel Postpago |
| **CAPTURA** | Cliente nuevo o con <30 días en Entel |
| **LLAA** | Línea Adicional (a cliente BASE) |
| **MONO** | Línea única en una orden |

### 7.3 Tipos de Portabilidad

| Término | Significado |
|---------|-------------|
| **OSS** | Portabilidad PostPago de Origen PostPago |
| **OPP** | Portabilidad PostPago de Origen PrePago |

### 7.4 Equipos y Accesorios

| Término | Significado |
|---------|-------------|
| **PACK** | Equipo/terminal vendido |
| **PACK SS** | Equipo con línea OSS, OPP BASE o VR BASE |
| **RENO** | Renovación de equipo |
| **VEP** | Venta a Plazos (equipo al crédito) |
| **MEP** | "Mi Equipo Protegido" - seguro de Entel |

### 7.5 Post-Venta

| Término | Significado |
|---------|-------------|
| **MISS-IN** | Prepago Entel → Postpago Entel |
| **MISS-OUT** | Postpago → Prepago (penalidad) |
| **UPSALE** | Upgrade de plan |
| **PORT-OUT** | Cliente se va a otro operador (penalidad) |

---

## 8. CONVENCIONES DE CÓDIGO

### 8.1 Nomenclatura de Tablas
- Nombres en español, snake_case
- Plural para tablas de entidades: `usuarios`, `tiendas`, `ventas`
- Singular para tablas de configuración: `tipos_venta`
- Prefijo `v_` para vistas: `v_inar_resumen_diario`

### 8.2 Nomenclatura de Columnas
- snake_case en español
- Sufijo `_id` para foreign keys: `usuario_id`, `tienda_id`
- Sufijo `_at` para timestamps: `created_at`, `updated_at`
- Prefijo `es_` o `tiene_` para booleanos: `es_activo`, `tiene_seguro`

### 8.3 Nomenclatura de Código TypeScript
- camelCase para variables y funciones
- PascalCase para tipos e interfaces
- Interfaces con prefijo descriptivo: `VentaFormData`, `TipoVentaConfig`

---

## 9. REGLAS DE INTEGRACIÓN ENTRE MÓDULOS

### 9.1 Principios Fundamentales

1. **Single Source of Truth**: La base de datos Supabase es la única fuente de verdad
2. **No hardcodear datos**: Los catálogos (tipos_venta, roles, tiendas) siempre se leen de BD
3. **Consistencia de FK**: Todas las relaciones usan los IDs de las tablas maestras
4. **Roles unificados**: Usar siempre los 12 roles definidos en el constraint de `usuarios`

### 9.2 Checklist para Nuevos Módulos

Antes de crear un nuevo módulo, verificar:

- [ ] ¿Los roles que necesito ya existen en el constraint de `usuarios`?
- [ ] ¿Los tipos de venta que necesito ya existen en `tipos_venta`?
- [ ] ¿Estoy usando las tablas existentes (`usuarios`, `tiendas`, `tipos_venta`) como FK?
- [ ] ¿Mis nuevas tablas siguen las convenciones de nomenclatura?
- [ ] ¿He documentado las nuevas tablas en DATA_DICTIONARY.md?

### 9.3 Patrón de Migración SQL

```sql
-- Template para nuevas migraciones
-- ============================================================================
-- MIGRACIÓN XXX: [Nombre descriptivo]
-- Módulo: [Nombre del módulo]
-- Fecha: [YYYY-MM-DD]
-- ============================================================================

-- 1. Crear tablas nuevas (usar FK a tablas existentes)
CREATE TABLE IF NOT EXISTS nueva_tabla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id),  -- FK a tabla existente
    tienda_id UUID REFERENCES tiendas(id),    -- FK a tabla existente
    -- campos específicos...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_nueva_tabla_usuario ON nueva_tabla(usuario_id);

-- 3. Crear trigger updated_at (reutilizar función existente)
DROP TRIGGER IF EXISTS set_updated_at ON nueva_tabla;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON nueva_tabla
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- 4. RLS Policies (usar roles existentes)
ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nueva_tabla_select_policy" ON nueva_tabla
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'JEFE_VENTAS')
        )
    );
```

---

## 10. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-01-24 | 1.0 | Documento inicial con arquitectura consolidada |

---

**IMPORTANTE**: Este documento debe mantenerse actualizado y adjuntarse a cada nueva conversación de desarrollo de GridRetail para garantizar consistencia entre módulos.
