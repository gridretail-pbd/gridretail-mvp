# Instrucciones: Agrupar Sidebar por Categorías

## Objetivo

Modificar el sidebar para mostrar los ítems agrupados por categorías con separadores visuales.

## Archivo a Modificar

```
components/layout/sidebar.tsx
```

## Cambio de Estructura

### ANTES (array plano):
```typescript
const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [...] },
  { title: 'Tiendas', href: '/tiendas', icon: Store, roles: [...] },
  // ... más items
];
```

### DESPUÉS (array de secciones):
```typescript
type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
};

type NavSection = {
  title: string | null;  // null = sin header (para Dashboard)
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: null,  // Sin header
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, 
        roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA', 'VALIDADOR_ARRIBOS', 'ADMIN'] },
    ]
  },
  {
    title: null,  // Sin header - solo para HC
    items: [
      { title: 'Mi Comisión', href: '/mi-comision', icon: Wallet, 
        roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR'] },
    ]
  },
  {
    title: 'Operaciones',
    items: [
      { title: 'Tiendas', href: '/tiendas', icon: Store, 
        roles: ['SUPERVISOR', 'JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'ADMIN'] },
      { title: 'Registrar Arribo', href: '/registrar-arribo', icon: Users, 
        roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR', 'VALIDADOR_ARRIBOS', 'ADMIN'] },
      { title: 'Registrar Venta', href: '/registrar-venta', icon: ShoppingCart, 
        roles: ['ASESOR', 'ASESOR_REFERENTE', 'COORDINADOR', 'SUPERVISOR', 'ADMIN'] },
    ]
  },
  {
    title: 'Comisiones',
    items: [
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
    ]
  },
  {
    title: 'Administración',
    items: [
      { title: 'Usuarios', href: '/usuarios', icon: UserCog, 
        roles: ['ADMIN'] },
      { title: 'Reportes', href: '/reportes', icon: BarChart3, 
        roles: ['JEFE_VENTAS', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL', 'BACKOFFICE_OPERACIONES', 'BACKOFFICE_RRHH', 'BACKOFFICE_AUDITORIA', 'ADMIN'] },
      { title: 'Configuración', href: '/configuracion', icon: Settings, 
        roles: ['ADMIN'] },
    ]
  },
];
```

## Lógica de Filtrado

```typescript
// Filtrar secciones y sus items según el rol del usuario
const filteredSections = navSections
  .map(section => ({
    ...section,
    items: section.items.filter(item => item.roles.includes(user.rol))
  }))
  .filter(section => section.items.length > 0);  // Solo secciones con items visibles
```

## Renderizado JSX

```tsx
<nav className="space-y-2">
  {filteredSections.map((section, sectionIndex) => (
    <div key={sectionIndex} className="space-y-1">
      {/* Header de sección (si existe) */}
      {section.title && (
        <div className="px-3 py-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {section.title}
          </h3>
        </div>
      )}
      
      {/* Items de la sección */}
      {section.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === item.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </div>
  ))}
</nav>
```

## Estilos del Header de Sección

El header usa:
- `text-xs` - Texto pequeño
- `font-semibold` - Semi-negrita
- `text-muted-foreground` - Color gris sutil
- `uppercase` - Mayúsculas
- `tracking-wider` - Espaciado entre letras

Esto crea un estilo sutil que separa visualmente sin distraer.

## Resultado Visual Esperado

```
Dashboard

Mi Comisión          ← Solo visible para HC

OPERACIONES
  Tiendas
  Registrar Arribo
  Registrar Venta

COMISIONES
  Cuotas
  Esquemas Comisiones
  Penalidades
  Simulador Ingresos
  Importar INAR

ADMINISTRACIÓN
  Usuarios
  Reportes
  Configuración
```

## Alternativa: Con Línea Separadora

Si prefieres una línea visual además del texto:

```tsx
{section.title && (
  <div className="px-3 py-2 mt-4 first:mt-0">
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {section.title}
      </h3>
      <div className="flex-1 h-px bg-border" />  {/* Línea */}
    </div>
  </div>
)}
```

## Notas

1. Las secciones sin items visibles para el rol actual NO se muestran
2. El header con `title: null` no renderiza nada (útil para Dashboard y Mi Comisión)
3. Mantener los roles exactamente como están definidos en el constraint de la BD
