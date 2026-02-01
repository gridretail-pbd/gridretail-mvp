# Instrucciones para Actualizar Sidebar de GridRetail

## Contexto

GridRetail ha crecido con nuevos módulos que necesitan agregarse al sidebar. El código está en `components/layout/sidebar.tsx` en el array `navItems`.

## Archivo a Modificar

```
components/layout/sidebar.tsx
```

Específicamente el array `navItems` (actualmente líneas 28-71 aproximadamente).

## Estructura de Cada Entrada

```typescript
{
  title: string,           // Texto visible en el menú
  href: string,            // Ruta de navegación
  icon: LucideIcon,        // Ícono de lucide-react
  roles: string[]          // Roles que pueden ver este ítem
}
```

## Roles del Sistema (Referencia)

```typescript
// Grupo HC (Personal Comercial)
const ROLES_HC = ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR'];

// Grupo Jefatura
const ROLES_JEFATURA = ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'];

// Grupo Backoffice
const ROLES_BACKOFFICE = ['BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA'];

// Todos los roles
const ALL_ROLES = [
  'ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR',
  'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL',
  'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA',
  'VALIDADOR_ARRIBOS', 'ADMIN'
];
```

## Nuevas Entradas a Agregar

### 1. Importador INAR
```typescript
{
  title: 'Importar INAR',
  href: '/inar/importar',
  icon: FileUp,  // o Upload, FileSpreadsheet
  roles: ['BACKOFFICE_OPERACIONES', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN']
}
```

### 2. Cuotas (Gestión - para analistas/gerencia)
```typescript
{
  title: 'Cuotas',
  href: '/cuotas',
  icon: Target,  // o Goal, Crosshair
  roles: ['BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN']
}
```

### 3. Esquemas de Comisiones (Modelador)
```typescript
{
  title: 'Esquemas Comisiones',
  href: '/comisiones/esquemas',
  icon: Settings2,  // o Sliders, Calculator
  roles: ['GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN']
}
```

### 4. Simulador de Ingresos (Vista Gerencia)
```typescript
{
  title: 'Simulador Ingresos',
  href: '/comisiones/simulador',
  icon: Calculator,  // o TrendingUp, LineChart
  roles: ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'ADMIN']
}
```

### 5. Mi Comisión (Vista Personal del HC)
```typescript
{
  title: 'Mi Comisión',
  href: '/mi-comision',
  icon: Wallet,  // o DollarSign, PiggyBank, CircleDollarSign
  roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR']
}
```

### 6. Penalidades
```typescript
{
  title: 'Penalidades',
  href: '/penalidades',
  icon: AlertTriangle,  // o ShieldAlert, Ban
  roles: ['BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN']
}
```

## Íconos a Importar

Agregar a los imports de lucide-react:
```typescript
import {
  // ... íconos existentes ...
  FileUp,           // Para Importar INAR
  Target,           // Para Cuotas
  Settings2,        // Para Esquemas Comisiones
  Calculator,       // Para Simulador
  Wallet,           // Para Mi Comisión
  AlertTriangle,    // Para Penalidades
} from 'lucide-react'
```

## Estructura Sugerida del Menú (Orden)

Organizar `navItems` en este orden lógico:

```typescript
const navItems = [
  // === GENERAL ===
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [...] },
  
  // === MI ÁREA (Solo HC) ===
  { title: 'Mi Comisión', href: '/mi-comision', icon: Wallet, 
    roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR'] },
  
  // === OPERACIONES DIARIAS ===
  { title: 'Tiendas', href: '/tiendas', icon: Store, roles: [...] },
  { title: 'Registrar Arribo', href: '/registrar-arribo', icon: Users, roles: [...] },
  { title: 'Registrar Venta', href: '/registrar-venta', icon: ShoppingCart, roles: [...] },
  
  // === COMISIONES Y CUOTAS ===
  { title: 'Cuotas', href: '/cuotas', icon: Target,
    roles: ['BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'] },
  { title: 'Esquemas Comisiones', href: '/comisiones/esquemas', icon: Settings2,
    roles: ['GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'] },
  { title: 'Penalidades', href: '/penalidades', icon: AlertTriangle,
    roles: ['BACKOFFICE_OPERACIONES', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'] },
  { title: 'Simulador Ingresos', href: '/comisiones/simulador', icon: Calculator,
    roles: ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'ADMIN'] },
  { title: 'Importar INAR', href: '/inar/importar', icon: FileUp,
    roles: ['BACKOFFICE_OPERACIONES', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'] },
  
  // === ADMINISTRACIÓN ===
  { title: 'Usuarios', href: '/usuarios', icon: UserCog, roles: ['ADMIN'] },
  { title: 'Reportes', href: '/reportes', icon: BarChart3, roles: [...] },
  { title: 'Configuración', href: '/configuracion', icon: Settings, roles: ['ADMIN'] },
];
```

## Vista por Rol (Resultado Esperado)

### ASESOR verá:
- Dashboard
- **Mi Comisión** ← NUEVO
- Registrar Arribo
- Registrar Venta

### SUPERVISOR verá:
- Dashboard
- **Mi Comisión** ← NUEVO
- Tiendas
- Registrar Arribo
- Registrar Venta

### JEFE_VENTAS verá:
- Dashboard
- Tiendas
- **Cuotas** ← NUEVO
- **Penalidades** ← NUEVO
- **Simulador Ingresos** ← NUEVO
- Reportes

### GERENTE_COMERCIAL verá:
- Dashboard
- Tiendas
- **Cuotas** ← NUEVO
- **Esquemas Comisiones** ← NUEVO
- **Penalidades** ← NUEVO
- **Simulador Ingresos** ← NUEVO
- **Importar INAR** ← NUEVO
- Reportes

### BACKOFFICE_OPERACIONES verá:
- Dashboard
- **Cuotas** ← NUEVO
- **Penalidades** ← NUEVO
- **Simulador Ingresos** ← NUEVO
- **Importar INAR** ← NUEVO

### ADMIN verá:
- Todo

## Opcional: Separadores Visuales

Si quieres agregar separadores entre secciones, puedes crear un tipo especial:

```typescript
type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
} | {
  type: 'separator';
  title: string;  // Ej: "COMISIONES"
  roles: string[];
};
```

Y renderizar condicionalmente en el JSX.

## Notas Importantes

1. **Las rutas deben existir**: Antes de agregar un ítem, verifica que la página existe en `app/(dashboard)/[ruta]/page.tsx`. Si no existe, créala como placeholder.

2. **Consistencia de íconos**: Revisa los íconos existentes para mantener coherencia visual.

3. **No hardcodear roles**: El sistema ya tiene los 12 roles definidos en la BD. No crear roles nuevos.

4. **Probar con diferentes usuarios**: Después de los cambios, probar login con usuarios de diferentes roles para verificar que ven los menús correctos.

## Páginas Placeholder (si no existen)

Si alguna ruta no existe, crear archivo básico:

```typescript
// app/(dashboard)/mi-comision/page.tsx
export default function MiComisionPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Mi Comisión</h1>
      <p className="text-muted-foreground">Módulo en desarrollo...</p>
    </div>
  )
}
```

Repetir para: `/cuotas`, `/comisiones/esquemas`, `/comisiones/simulador`, `/penalidades`, `/inar/importar`
