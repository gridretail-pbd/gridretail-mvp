# GridRetail

Sistema de gestión de ventas para 21 tiendas retail.

## Stack Tecnológico

- **Framework**: Next.js 14 (App Router con TypeScript)
- **Base de datos**: Supabase (PostgreSQL + Auth + Storage)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Formularios**: React Hook Form + Zod
- **Gráficos**: Recharts
- **Utilidades**: date-fns

## Estructura del Proyecto

```
gridretail/
├── app/              # App Router de Next.js
├── components/       # Componentes React
│   ├── ui/          # Componentes de shadcn/ui
│   ├── layout/      # Componentes de layout (Header, Sidebar, etc.)
│   ├── forms/       # Componentes de formularios
│   ├── charts/      # Componentes de gráficos
│   └── dashboard/   # Componentes del dashboard
├── lib/             # Utilidades y configuración
│   ├── supabase/    # Cliente y configuración de Supabase
│   └── utils.ts     # Funciones utilitarias
├── types/           # Definiciones de tipos TypeScript
├── hooks/           # Custom React hooks
├── services/        # Servicios y lógica de negocio
└── public/          # Archivos estáticos
```

## Configuración Inicial

### 1. Variables de Entorno

Copia el archivo `.env.example` a `.env.local` y configura las variables de Supabase:

```bash
cp .env.example .env.local
```

Luego edita `.env.local` con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=tu-url-de-proyecto
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Características Principales

- Autenticación y autorización de usuarios
- Gestión de 21 tiendas retail
- Sistema de ventas y productos
- Dashboard con métricas en tiempo real
- Reportes y gráficos estadísticos
- Gestión de inventario
- Roles de usuario (admin, manager, seller)

## Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm start` - Inicia el servidor de producción
- `npm run lint` - Ejecuta el linter

## Supabase

Este proyecto utiliza Supabase para:
- **Autenticación**: Sistema de usuarios con roles
- **Base de datos**: PostgreSQL con Row Level Security
- **Storage**: Almacenamiento de archivos (imágenes, documentos)

## shadcn/ui

Para agregar nuevos componentes de shadcn/ui:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add form
# etc.
```

## Recursos

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Hook Form Documentation](https://react-hook-form.com)
- [Recharts Documentation](https://recharts.org)
