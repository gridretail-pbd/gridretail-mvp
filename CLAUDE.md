# GridRetail - Contexto del Proyecto

## Descripción
Plataforma de gestión comercial para tiendas TEX (Tiendas Express) operadas por PBD (Peru Best Deals) bajo franquicia de Entel Perú. Gestiona ventas, comisiones, cuotas y métricas del personal comercial.

## Stack Tecnológico
- **Frontend:** Next.js 14 (App Router)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS + shadcn/ui
- **Validación:** Zod + react-hook-form
- **Estado:** Redux Toolkit (para simulador)

## Estructura Principal
```
app/
├── (auth)/                    # Login y selección de tienda
├── (dashboard)/
│   ├── comisiones/           # Esquemas y simulador
│   │   ├── esquemas/         # CRUD de esquemas
│   │   └── simulador/        # Simulador de ingresos
│   ├── cuotas/               # Módulo de cuotas (NUEVO)
│   │   ├── importar/         # Importador Excel
│   │   ├── distribucion/     # Distribución a HCs
│   │   └── aprobacion/       # Aprobación gerencial
│   ├── dashboard/            # Ventas y arribos
│   ├── inar/                 # Importador INAR
│   └── mi-comision/          # Vista del asesor
└── api/                      # API Routes

components/
├── comisiones/               # Componentes del módulo comisiones
├── simulador/                # Componentes del simulador
└── ui/                       # shadcn/ui components

lib/
├── comisiones/               # Lógica de comisiones
├── cuotas/                   # Lógica de cuotas
├── simulador/                # Lógica del simulador
└── supabase/                 # Cliente Supabase

supabase/migrations/          # Migraciones SQL
docs/                         # Documentación del proyecto
```

## ⚠️ IMPORTANTE: Estructura Real de la Tabla usuarios

```sql
-- Columnas REALES (USAR ESTAS):
id              UUID PRIMARY KEY
codigo_asesor   VARCHAR        -- Código del asesor (ej: PBD_ASCHUMPITAZ)
dni             VARCHAR        -- DNI
nombre_completo VARCHAR        -- Nombre completo (un solo campo)
email           VARCHAR
rol             VARCHAR        -- Ver roles abajo
zona            VARCHAR        -- NORTE, SUR, etc.
activo          BOOLEAN
password_hash   VARCHAR
created_at      TIMESTAMP
updated_at      TIMESTAMP

-- ❌ Columnas que NO EXISTEN (no usar):
-- codigo_entel, nombres, apellidos, auth_id, telefono
```

## 12 Roles Válidos
```
ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR,
JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL,
BACKOFFICE_OPERACIONES, BACKOFFICE_RRHH, BACKOFFICE_AUDITORIA,
VALIDADOR_ARRIBOS, ADMIN
```

## 16 Tipos de Venta (tabla tipos_venta)
```
POSTPAGO: OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, 
          VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN
PACK:     PACK_VR, PACK_OPEN
PACK_SS:  PACK_OSS, PACK_VR_BASE
RENO:     RENO
PREPAGO:  PREPAGO, PORTA_PP
OTROS:    ACCESORIOS
```

## Módulos Implementados
1. **Registro de Ventas (BU)** - Ventas declarativas
2. **Importador INAR** - Líneas activadas de Entel
3. **Esquemas de Comisiones** - Configuración de partidas
4. **Simulador de Ingresos** - Proyección para analistas
5. **Módulo de Cuotas** - Importación y distribución (NUEVO)

## Migraciones SQL Ejecutadas
- 001-005: Core, INAR, Comisiones, Partidas flexibles
- 006: Módulo de Cuotas (quota_imports, store_quotas, hc_quotas)

## Documentación Clave
- `docs/DATA_DICTIONARY.md` - Diccionario de datos completo
- `docs/GRIDRETAIL_ARCHITECTURE.md` - Arquitectura del sistema
- `docs/GRIDRETAIL_QUICK_REFERENCE.md` - Referencia rápida

## Convenciones de Código
- **Tablas BD:** español, snake_case, plural (usuarios, ventas)
- **Columnas:** snake_case (usuario_id, created_at)
- **Vistas:** prefijo v_ o vw_ (vw_quotas_vigentes)
- **TypeScript:** camelCase variables, PascalCase tipos

## Patrones Comunes

### Query Supabase con usuario
```typescript
const { data } = await supabase
  .from('hc_quotas')
  .select(`
    *,
    user:usuarios(id, codigo_asesor, nombre_completo, rol, zona)
  `)
  .eq('store_id', storeId);
```

### API Route Pattern
```typescript
// app/api/[modulo]/route.ts
export async function GET(request: NextRequest) {
  const supabase = createClient();
  // ... lógica
  return NextResponse.json(data);
}
```

## Glosario TEX
- **TEX:** Tienda Express
- **SSNN:** Socio de Negocio (PBD)
- **HC:** Personal Comercial
- **BU:** Boca de Urna (registro declarativo)
- **INAR:** Base de líneas activadas de Entel
- **OSS:** Portabilidad PostPago→PostPago
- **OPP:** Portabilidad PrePago→PostPago
- **VR:** Venta Regular
- **PACK:** Equipo vendido
- **RENO:** Renovación de equipo
