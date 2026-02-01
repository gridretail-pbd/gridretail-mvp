# Especificaciones: Módulo de Gestión de Usuarios
## GridRetail - Administración de Personal

**Versión:** 1.0  
**Fecha:** 2026-01-28  
**Estado:** 📋 Listo para implementación  
**Prioridad:** 🔴 Alta (requerido para piloto)

---

## 1. Resumen Ejecutivo

El módulo de Gestión de Usuarios permite administrar el personal que accede a GridRetail. Es prerequisito para el piloto de producción en 3 tiendas (Higuereta, SJM, Chimú) con 16 usuarios iniciales.

### Alcance del Piloto
| Rol | Cantidad | Tiendas |
|-----|----------|---------|
| ASESOR | 11 | 1 tienda asignada c/u |
| SUPERVISOR | 3 | 1 tienda c/u |
| JEFE_VENTAS | 1 | 3 tiendas |
| BACKOFFICE_OPERACIONES | 1 | Todas |
| **Total** | **16** | |

---

## 2. Estructura de Base de Datos Existente

### 2.1 Tabla `usuarios` (ya existe)

```sql
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_asesor VARCHAR NOT NULL,        -- Ej: PBD_JPEREZ
    dni VARCHAR NOT NULL,                   -- 8 dígitos
    nombre_completo VARCHAR NOT NULL,       -- Nombre completo
    email VARCHAR,                          -- Opcional
    rol VARCHAR NOT NULL,                   -- Ver constraint
    zona VARCHAR,                           -- NORTE, SUR, ESTE, etc.
    activo BOOLEAN NOT NULL DEFAULT true,
    password_hash VARCHAR,                  -- Hash bcrypt
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint de roles (12 roles)
CHECK (rol IN (
    'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
    'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
    'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
    'VALIDADOR_ARRIBOS', 'ADMIN'
))
```

### 2.2 Tabla `usuarios_tiendas` (ya existe)

```sql
CREATE TABLE usuarios_tiendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tienda_id UUID NOT NULL REFERENCES tiendas(id),
    es_principal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, tienda_id)
);
```

### 2.3 Tabla `tiendas` (ya existe - 21 tiendas)

Tiendas del piloto:
- `TE_HIGUERETA` - Higuereta
- `TE_SJM` - San Juan de Miraflores  
- `TE_CHIMU` - Chimú

---

## 3. Rutas y Navegación

```
/dashboard/usuarios
├── /                        → Lista de usuarios (con filtros)
├── /nuevo                   → Crear usuario
├── /[id]                    → Ver detalle usuario
├── /[id]/editar             → Editar usuario
└── /[id]/tiendas            → Gestionar tiendas asignadas
```

### Navegación en Sidebar

```tsx
// Agregar al sidebar existente
{
  title: "Administración",
  icon: Settings,
  items: [
    { title: "Usuarios", href: "/dashboard/usuarios", icon: Users },
    { title: "Tiendas", href: "/dashboard/tiendas", icon: Store }, // futuro
  ]
}
```

---

## 4. Permisos por Rol

### 4.1 Matriz de Acceso

| Acción | ADMIN | GERENTE_COMERCIAL | GERENTE_GENERAL | BACKOFFICE_RRHH | Otros |
|--------|-------|-------------------|-----------------|-----------------|-------|
| Ver lista usuarios | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver detalle usuario | ✅ | ✅ | ✅ | ✅ | ❌ |
| Crear usuario | ✅ | ✅ | ❌ | ✅ | ❌ |
| Editar usuario | ✅ | ✅ | ❌ | ✅ | ❌ |
| Cambiar rol a ADMIN | ✅ | ❌ | ❌ | ❌ | ❌ |
| Desactivar usuario | ✅ | ✅ | ❌ | ✅ | ❌ |
| Eliminar usuario | ✅ | ❌ | ❌ | ❌ | ❌ |
| Asignar tiendas | ✅ | ✅ | ❌ | ✅ | ❌ |
| Reset contraseña | ✅ | ✅ | ❌ | ✅ | ❌ |

### 4.2 Roles que Acceden al Módulo

```typescript
const ROLES_GESTION_USUARIOS = [
  'ADMIN',
  'GERENTE_COMERCIAL', 
  'GERENTE_GENERAL',
  'BACKOFFICE_RRHH'
];

const ROLES_PUEDEN_CREAR = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'BACKOFFICE_RRHH'
];

const ROLES_PUEDEN_ELIMINAR = ['ADMIN'];
```

---

## 5. Pantallas del Módulo

### 5.1 Lista de Usuarios (`/dashboard/usuarios`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  👥 Gestión de Usuarios                              [+ Nuevo Usuario]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Filtros:                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ 🔍 Buscar... │ │ Rol: Todos ▼ │ │ Tienda: All ▼│ │ Estado: Todos ▼│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Código      │ Nombre           │ Rol        │ Tienda(s)  │ Estado  ││
│  ├─────────────┼──────────────────┼────────────┼────────────┼─────────┤│
│  │ PBD_JPEREZ  │ Juan Pérez       │ ASESOR     │ Higuereta  │ 🟢 Act  ││
│  │ PBD_MLOPEZ  │ María López      │ SUPERVISOR │ SJM        │ 🟢 Act  ││
│  │ PBD_CROJAS  │ Carlos Rojas     │ ASESOR     │ Chimú      │ 🔴 Inact││
│  │ ...         │ ...              │ ...        │ ...        │ ...     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Mostrando 1-10 de 16 usuarios                    [← Anterior] [Sig →] │
└─────────────────────────────────────────────────────────────────────────┘
```

**Características:**
- Búsqueda por código, nombre o DNI
- Filtros por rol, tienda, estado
- Paginación (10 por página)
- Click en fila → Ver detalle
- Acciones rápidas: Editar, Activar/Desactivar

### 5.2 Crear/Editar Usuario (`/dashboard/usuarios/nuevo` y `/[id]/editar`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  👤 Nuevo Usuario                                        [✕ Cancelar]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Información Personal                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  Código Asesor *              DNI *                                 ││
│  │  ┌─────────────────────┐      ┌─────────────────────┐              ││
│  │  │ PBD_                │      │ 12345678            │              ││
│  │  └─────────────────────┘      └─────────────────────┘              ││
│  │                                                                     ││
│  │  Nombre Completo *                                                  ││
│  │  ┌───────────────────────────────────────────────────┐             ││
│  │  │ Juan Carlos Pérez García                          │             ││
│  │  └───────────────────────────────────────────────────┘             ││
│  │                                                                     ││
│  │  Email                                                              ││
│  │  ┌───────────────────────────────────────────────────┐             ││
│  │  │ jperez@pbd.com.pe                                 │             ││
│  │  └───────────────────────────────────────────────────┘             ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Rol y Zona                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  Rol *                        Zona                                  ││
│  │  ┌─────────────────────┐      ┌─────────────────────┐              ││
│  │  │ ASESOR            ▼ │      │ SUR               ▼ │              ││
│  │  └─────────────────────┘      └─────────────────────┘              ││
│  │                                                                     ││
│  │  ☑ Usuario activo                                                   ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Credenciales (solo al crear)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  Contraseña *                 Confirmar Contraseña *                ││
│  │  ┌─────────────────────┐      ┌─────────────────────┐              ││
│  │  │ ••••••••            │      │ ••••••••            │              ││
│  │  └─────────────────────┘      └─────────────────────┘              ││
│  │                                                                     ││
│  │  ⚠️ Mínimo 8 caracteres, incluir al menos 1 número                  ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Tiendas Asignadas                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  ☑ TE Higuereta ⭐ (principal)                                      ││
│  │  ☐ TE San Juan de Miraflores                                        ││
│  │  ☐ TE Chimú                                                         ││
│  │  ☐ TE El Agustino                                                   ││
│  │  ... (mostrar todas las tiendas activas)                            ││
│  │                                                                     ││
│  │  ⭐ = Tienda principal (click para cambiar)                         ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│                                            [Cancelar]  [💾 Guardar]    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Detalle de Usuario (`/dashboard/usuarios/[id]`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Volver                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────┐                                                             │
│  │  👤    │  Juan Carlos Pérez García                                  │
│  │        │  PBD_JPEREZ · DNI: 12345678                                │
│  └────────┘  🟢 Activo                                                  │
│                                                                         │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐        │
│  │ [✏️ Editar]      │ │ [🔑 Reset Pass]  │ │ [🚫 Desactivar] │        │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘        │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📋 Información                          🏪 Tiendas Asignadas          │
│  ┌─────────────────────────┐             ┌─────────────────────────┐   │
│  │ Rol: ASESOR             │             │ • TE Higuereta ⭐       │   │
│  │ Zona: SUR               │             │                         │   │
│  │ Email: jperez@pbd.com   │             │ [+ Agregar tienda]      │   │
│  │ Creado: 28/01/2026      │             └─────────────────────────┘   │
│  │ Último acceso: Hoy 14:30│                                           │
│  └─────────────────────────┘                                           │
│                                                                         │
│  📊 Estadísticas del Mes                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Ventas: 45  │  Arribos registrados: 120  │  Conversión: 37.5%     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Validaciones

### 6.1 Esquema Zod

```typescript
import { z } from 'zod';

export const usuarioSchema = z.object({
  codigo_asesor: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^PBD_[A-Z0-9_]+$/, 'Formato: PBD_XXXXX (mayúsculas)'),
  
  dni: z
    .string()
    .regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  
  nombre_completo: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  
  rol: z.enum([
    'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
    'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
    'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
    'VALIDADOR_ARRIBOS', 'ADMIN'
  ]),
  
  zona: z
    .enum(['NORTE', 'SUR', 'ESTE', 'OESTE', 'CENTRO', 'LIMA_NORTE', 'LIMA_SUR', 'CALLAO'])
    .optional()
    .nullable(),
  
  activo: z.boolean().default(true),
  
  // Solo al crear
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/\d/, 'Debe incluir al menos un número')
    .optional(),
  
  confirm_password: z.string().optional(),
  
  tiendas: z
    .array(z.object({
      tienda_id: z.string().uuid(),
      es_principal: z.boolean().default(false)
    }))
    .min(1, 'Debe asignar al menos una tienda'),
    
}).refine((data) => {
  if (data.password) {
    return data.password === data.confirm_password;
  }
  return true;
}, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password']
});

export type UsuarioFormData = z.infer<typeof usuarioSchema>;
```

### 6.2 Validaciones de Negocio

| Campo | Validación | Mensaje |
|-------|------------|---------|
| `codigo_asesor` | Único en BD | "Este código ya existe" |
| `dni` | Único en BD | "Este DNI ya está registrado" |
| `email` | Único si se proporciona | "Este email ya está en uso" |
| `tiendas` | Al menos 1 tienda | "Debe asignar al menos una tienda" |
| `tiendas` | Solo 1 principal | "Solo puede haber una tienda principal" |
| `rol` → `ADMIN` | Solo ADMIN puede asignar | "No tiene permisos para asignar rol ADMIN" |

---

## 7. APIs

### 7.1 Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/usuarios` | Lista usuarios (con filtros) |
| GET | `/api/usuarios/[id]` | Detalle de usuario |
| POST | `/api/usuarios` | Crear usuario |
| PUT | `/api/usuarios/[id]` | Actualizar usuario |
| DELETE | `/api/usuarios/[id]` | Eliminar usuario (soft delete) |
| POST | `/api/usuarios/[id]/reset-password` | Reset contraseña |
| GET | `/api/usuarios/[id]/tiendas` | Tiendas del usuario |
| PUT | `/api/usuarios/[id]/tiendas` | Actualizar tiendas |
| POST | `/api/usuarios/verificar-disponibilidad` | Verificar código/DNI único |

### 7.2 GET `/api/usuarios` - Lista

**Query params:**
```typescript
interface ListaUsuariosParams {
  search?: string;      // Buscar en código, nombre, DNI
  rol?: string;         // Filtrar por rol
  tienda_id?: string;   // Filtrar por tienda
  activo?: boolean;     // Filtrar por estado
  page?: number;        // Página (default: 1)
  limit?: number;       // Por página (default: 10, max: 50)
}
```

**Response:**
```typescript
interface ListaUsuariosResponse {
  data: Usuario[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 7.3 POST `/api/usuarios` - Crear

**Request body:**
```typescript
interface CrearUsuarioRequest {
  codigo_asesor: string;
  dni: string;
  nombre_completo: string;
  email?: string;
  rol: string;
  zona?: string;
  activo?: boolean;
  password: string;
  tiendas: {
    tienda_id: string;
    es_principal: boolean;
  }[];
}
```

**Response:**
```typescript
interface CrearUsuarioResponse {
  success: true;
  usuario: Usuario;
}
```

### 7.4 POST `/api/usuarios/[id]/reset-password`

**Request body:**
```typescript
interface ResetPasswordRequest {
  new_password: string;
}
```

**Response:**
```typescript
interface ResetPasswordResponse {
  success: true;
  message: "Contraseña actualizada correctamente";
}
```

---

## 8. Tipos TypeScript

```typescript
// types/usuarios.ts

export interface Usuario {
  id: string;
  codigo_asesor: string;
  dni: string;
  nombre_completo: string;
  email: string | null;
  rol: RolUsuario;
  zona: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsuarioConTiendas extends Usuario {
  tiendas: UsuarioTienda[];
}

export interface UsuarioTienda {
  id: string;
  tienda_id: string;
  es_principal: boolean;
  tienda: {
    id: string;
    codigo: string;
    nombre: string;
  };
}

export type RolUsuario = 
  | 'ASESOR' 
  | 'ASESOR_REFERENTE' 
  | 'COORDINADOR' 
  | 'SUPERVISOR'
  | 'JEFE_VENTAS' 
  | 'GERENTE_COMERCIAL' 
  | 'GERENTE_GENERAL'
  | 'BACKOFFICE_OPERACIONES' 
  | 'BACKOFFICE_RRHH' 
  | 'BACKOFFICE_AUDITORIA'
  | 'VALIDADOR_ARRIBOS' 
  | 'ADMIN';

export const ROLES_LABELS: Record<RolUsuario, string> = {
  ASESOR: 'Asesor de Venta',
  ASESOR_REFERENTE: 'Asesor Referente',
  COORDINADOR: 'Coordinador',
  SUPERVISOR: 'Supervisor',
  JEFE_VENTAS: 'Jefe de Ventas',
  GERENTE_COMERCIAL: 'Gerente Comercial',
  GERENTE_GENERAL: 'Gerente General',
  BACKOFFICE_OPERACIONES: 'Backoffice Operaciones',
  BACKOFFICE_RRHH: 'Backoffice RRHH',
  BACKOFFICE_AUDITORIA: 'Backoffice Auditoría',
  VALIDADOR_ARRIBOS: 'Validador de Arribos',
  ADMIN: 'Administrador',
};

export const ZONAS = [
  'NORTE',
  'SUR', 
  'ESTE',
  'OESTE',
  'CENTRO',
  'LIMA_NORTE',
  'LIMA_SUR',
  'CALLAO'
] as const;

export type Zona = typeof ZONAS[number];
```

---

## 9. Componentes UI

### 9.1 Estructura de Archivos

```
app/(dashboard)/dashboard/usuarios/
├── page.tsx                    # Lista de usuarios
├── nuevo/
│   └── page.tsx               # Crear usuario
├── [id]/
│   ├── page.tsx               # Detalle usuario
│   ├── editar/
│   │   └── page.tsx           # Editar usuario
│   └── tiendas/
│       └── page.tsx           # Gestionar tiendas

components/usuarios/
├── UsuariosTable.tsx          # Tabla con filtros
├── UsuarioForm.tsx            # Formulario crear/editar
├── UsuarioCard.tsx            # Card en detalle
├── TiendasSelector.tsx        # Selector de tiendas
├── RolBadge.tsx               # Badge de rol con color
├── EstadoBadge.tsx            # Badge activo/inactivo
├── ResetPasswordDialog.tsx    # Dialog reset contraseña
└── DeleteUsuarioDialog.tsx    # Dialog confirmación eliminar

lib/
├── api/usuarios.ts            # Funciones API client
└── validations/usuario.ts     # Esquemas Zod
```

### 9.2 Colores por Rol

```typescript
export const ROL_COLORS: Record<RolUsuario, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  GERENTE_GENERAL: 'bg-purple-100 text-purple-800',
  GERENTE_COMERCIAL: 'bg-purple-100 text-purple-800',
  JEFE_VENTAS: 'bg-blue-100 text-blue-800',
  SUPERVISOR: 'bg-cyan-100 text-cyan-800',
  COORDINADOR: 'bg-teal-100 text-teal-800',
  ASESOR_REFERENTE: 'bg-green-100 text-green-800',
  ASESOR: 'bg-green-100 text-green-800',
  BACKOFFICE_OPERACIONES: 'bg-orange-100 text-orange-800',
  BACKOFFICE_RRHH: 'bg-orange-100 text-orange-800',
  BACKOFFICE_AUDITORIA: 'bg-orange-100 text-orange-800',
  VALIDADOR_ARRIBOS: 'bg-gray-100 text-gray-800',
};
```

---

## 10. Migraciones SQL Requeridas

### 10.1 RLS para tabla `usuarios`

```sql
-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios con permisos de gestión pueden ver todos
CREATE POLICY "usuarios_select_gestion" ON usuarios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid()
            AND u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_RRHH')
        )
    );

-- Política: Solo roles específicos pueden crear
CREATE POLICY "usuarios_insert_gestion" ON usuarios
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid()
            AND u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_RRHH')
        )
    );

-- Política: Solo roles específicos pueden actualizar
CREATE POLICY "usuarios_update_gestion" ON usuarios
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid()
            AND u.rol IN ('ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_RRHH')
        )
    );

-- Política: Solo ADMIN puede eliminar
CREATE POLICY "usuarios_delete_admin" ON usuarios
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid()
            AND u.rol = 'ADMIN'
        )
    );
```

### 10.2 Índices de Rendimiento

```sql
-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo_asesor);
CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre_completo);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- Índice compuesto para filtros comunes
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_activo ON usuarios(rol, activo);
```

### 10.3 Vista de Usuarios con Tiendas

```sql
CREATE OR REPLACE VIEW vw_usuarios_con_tiendas AS
SELECT 
    u.id,
    u.codigo_asesor,
    u.dni,
    u.nombre_completo,
    u.email,
    u.rol,
    u.zona,
    u.activo,
    u.created_at,
    u.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'tienda_id', t.id,
                'codigo', t.codigo,
                'nombre', t.nombre,
                'es_principal', ut.es_principal
            )
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
    ) AS tiendas,
    COUNT(t.id) AS tiendas_count
FROM usuarios u
LEFT JOIN usuarios_tiendas ut ON u.id = ut.usuario_id
LEFT JOIN tiendas t ON ut.tienda_id = t.id
GROUP BY u.id;
```

---

## 11. Flujos de Usuario

### 11.1 Crear Usuario

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Click       │     │ Llenar      │     │ Verificar   │     │ Guardar     │
│ "+ Nuevo"   │────►│ Formulario  │────►│ Disponib.   │────►│ Usuario     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               │ Si código/DNI existe
                                               ▼
                                        ┌─────────────┐
                                        │ Mostrar     │
                                        │ Error       │
                                        └─────────────┘
```

### 11.2 Editar Usuario

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Click       │     │ Cargar      │     │ Editar      │
│ "Editar"    │────►│ Datos       │────►│ Formulario  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Guardar     │
                                        │ Cambios     │
                                        └─────────────┘
```

### 11.3 Reset Contraseña

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Click       │     │ Abrir       │     │ Ingresar    │     │ Confirmar   │
│ "Reset"     │────►│ Dialog      │────►│ Nueva Pass  │────►│ Actualizar  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 12. Datos de Prueba - Piloto

### 12.1 Usuarios a Crear

```sql
-- Ejecutar después de crear la UI (o directamente en BD para pruebas)

-- Supervisores (1 por tienda)
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, rol, zona, activo) VALUES
('PBD_SUP_HIGUERETA', '11111111', 'Supervisor Higuereta', 'SUPERVISOR', 'SUR', true),
('PBD_SUP_SJM', '22222222', 'Supervisor SJM', 'SUPERVISOR', 'SUR', true),
('PBD_SUP_CHIMU', '33333333', 'Supervisor Chimú', 'SUPERVISOR', 'ESTE', true);

-- Jefe de Ventas
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, rol, zona, activo) VALUES
('PBD_JV_SUR', '44444444', 'Jefe Ventas Sur', 'JEFE_VENTAS', 'SUR', true);

-- Backoffice
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, rol, activo) VALUES
('PBD_BO_OPS', '55555555', 'Backoffice Operaciones', 'BACKOFFICE_OPERACIONES', true);

-- Asesores (ejemplo - ajustar según datos reales)
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, rol, zona, activo) VALUES
('PBD_ASE001', '66666661', 'Asesor 1 Higuereta', 'ASESOR', 'SUR', true),
('PBD_ASE002', '66666662', 'Asesor 2 Higuereta', 'ASESOR', 'SUR', true),
('PBD_ASE003', '66666663', 'Asesor 3 Higuereta', 'ASESOR', 'SUR', true),
('PBD_ASE004', '66666664', 'Asesor 1 SJM', 'ASESOR', 'SUR', true),
('PBD_ASE005', '66666665', 'Asesor 2 SJM', 'ASESOR', 'SUR', true),
('PBD_ASE006', '66666666', 'Asesor 3 SJM', 'ASESOR', 'SUR', true),
('PBD_ASE007', '66666667', 'Asesor 4 SJM', 'ASESOR', 'SUR', true),
('PBD_ASE008', '66666668', 'Asesor 1 Chimú', 'ASESOR', 'ESTE', true),
('PBD_ASE009', '66666669', 'Asesor 2 Chimú', 'ASESOR', 'ESTE', true),
('PBD_ASE010', '66666670', 'Asesor 3 Chimú', 'ASESOR', 'ESTE', true),
('PBD_ASE011', '66666671', 'Asesor 4 Chimú', 'ASESOR', 'ESTE', true);
```

---

## 13. Checklist de Implementación

### Fase 1: Backend (APIs)
- [ ] `GET /api/usuarios` - Lista con filtros y paginación
- [ ] `GET /api/usuarios/[id]` - Detalle con tiendas
- [ ] `POST /api/usuarios` - Crear con hash de password
- [ ] `PUT /api/usuarios/[id]` - Actualizar
- [ ] `DELETE /api/usuarios/[id]` - Soft delete
- [ ] `POST /api/usuarios/[id]/reset-password` - Reset
- [ ] `PUT /api/usuarios/[id]/tiendas` - Actualizar tiendas
- [ ] `POST /api/usuarios/verificar-disponibilidad` - Validar único

### Fase 2: Frontend (UI)
- [ ] Página lista de usuarios con tabla
- [ ] Filtros (búsqueda, rol, tienda, estado)
- [ ] Paginación
- [ ] Formulario crear usuario
- [ ] Formulario editar usuario
- [ ] Página detalle usuario
- [ ] Selector de tiendas con checkbox
- [ ] Dialog reset contraseña
- [ ] Dialog confirmar eliminar
- [ ] Toast de notificaciones

### Fase 3: Migraciones
- [ ] Ejecutar políticas RLS
- [ ] Crear índices
- [ ] Crear vista `vw_usuarios_con_tiendas`

### Fase 4: Testing
- [ ] Crear usuario nuevo
- [ ] Editar usuario existente
- [ ] Asignar/quitar tiendas
- [ ] Reset contraseña
- [ ] Filtros funcionan correctamente
- [ ] Permisos por rol funcionan

---

## 14. Dependencias

### Paquetes NPM Requeridos
```json
{
  "bcryptjs": "^2.4.3",        // Hash de contraseñas
  "@types/bcryptjs": "^2.4.6"  // Tipos
}
```

### Instalación
```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

---

## 15. Notas de Seguridad

1. **Contraseñas**: Usar bcrypt con salt rounds = 12
2. **No exponer password_hash**: Nunca incluir en responses
3. **Validar permisos**: Verificar rol en cada endpoint
4. **Audit log**: Registrar cambios críticos (crear, eliminar, cambiar rol)
5. **Rate limiting**: Limitar intentos de reset password

---

**Documento listo para implementación en Claude Code.**
