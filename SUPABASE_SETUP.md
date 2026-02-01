# Configuración de Supabase para GridRetail

Este documento te guía paso a paso para configurar la base de datos de Supabase para GridRetail.

## Paso 1: Ejecutar el Schema SQL

1. Ve a tu proyecto de Supabase: https://kivnevgnjowuxiicmpaj.supabase.co
2. En el menú lateral, ve a **SQL Editor**
3. Crea una nueva query
4. Copia y pega todo el contenido del archivo `supabase-schema.sql`
5. Ejecuta la query (botón "Run" o Ctrl+Enter)

Esto creará todas las tablas necesarias:
- `usuarios` - Tabla de usuarios del sistema
- `stores` - Tabla de tiendas
- `products` - Tabla de productos
- `sales` - Tabla de ventas

## Paso 2: Crear Usuario Admin en Supabase Auth

### 2.1. Crear usuario en Authentication

1. Ve a **Authentication** > **Users** en Supabase
2. Haz clic en "Add user" > "Create new user"
3. Ingresa los siguientes datos:
   - Email: `ADMIN001@gridretail.local`
   - Password: Elige una contraseña segura (la usarás para login)
   - Auto Confirm User: ✅ (activado)
4. Haz clic en "Create user"
5. **IMPORTANTE**: Copia el UUID del usuario que se generó (lo necesitarás en el siguiente paso)

### 2.2. Vincular usuario Auth con tabla usuarios

1. Regresa al **SQL Editor**
2. Ejecuta el siguiente SQL, reemplazando `YOUR_AUTH_USER_ID` con el UUID que copiaste:

```sql
INSERT INTO usuarios (id, codigo_asesor, full_name, email, role)
VALUES ('YOUR_AUTH_USER_ID', 'ADMIN001', 'Administrador', 'ADMIN001@gridretail.local', 'admin');
```

## Paso 3: Crear Usuarios Adicionales (Opcional)

Para crear más usuarios:

### 3.1. Crear en Supabase Auth
1. Ve a **Authentication** > **Users**
2. Crea nuevo usuario con email: `CODIGO@gridretail.local`
   - Ejemplo: `VEND001@gridretail.local` para un vendedor
3. Copia el UUID generado

### 3.2. Insertar en tabla usuarios
```sql
-- Para un Manager
INSERT INTO usuarios (id, codigo_asesor, full_name, email, role, store_id)
VALUES (
  'UUID_DEL_AUTH_USER',
  'MNGR001',
  'María García',
  'MNGR001@gridretail.local',
  'manager',
  (SELECT id FROM stores WHERE code = 'T001')
);

-- Para un Seller
INSERT INTO usuarios (id, codigo_asesor, full_name, email, role, store_id)
VALUES (
  'UUID_DEL_AUTH_USER',
  'VEND001',
  'Juan Pérez',
  'VEND001@gridretail.local',
  'seller',
  (SELECT id FROM stores WHERE code = 'T001')
);
```

## Paso 4: Verificar la Configuración

### Verificar tablas creadas:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

Deberías ver: usuarios, stores, products, sales

### Verificar usuario admin:
```sql
SELECT * FROM usuarios WHERE role = 'admin';
```

### Verificar stores:
```sql
SELECT * FROM stores;
```

## Paso 5: Probar el Login

1. Inicia el servidor de desarrollo:
   ```bash
   cd gridretail
   npm run dev
   ```

2. Abre http://localhost:3000

3. Deberías ser redirigido a `/login`

4. Ingresa las credenciales:
   - Código de Asesor: `ADMIN001`
   - Password: (la que configuraste en Supabase Auth)

5. Si todo está correcto, serás redirigido al dashboard

## Estructura de Roles

### Admin
- Acceso completo a todas las tiendas
- Puede gestionar usuarios, productos, y configuración
- Ve todos los reportes

### Manager
- Acceso a su tienda asignada
- Puede gestionar productos y ventas de su tienda
- Ve reportes de su tienda

### Seller
- Acceso a su tienda asignada
- Puede registrar ventas
- Ve dashboard básico de ventas

## Row Level Security (RLS)

Las políticas de RLS están configuradas automáticamente para:
- Los usuarios solo pueden ver datos de sus tiendas asignadas (excepto admin)
- Los vendedores solo pueden registrar ventas de su tienda
- Los admins tienen acceso completo a todos los datos

## Notas Importantes

1. **Formato de Email para Login**: El sistema usa el formato `CODIGO@gridretail.local`
   - En el login, el usuario ingresa solo el código (ej: `ADMIN001`)
   - El sistema agrega automáticamente `@gridretail.local`

2. **Passwords**: Los passwords se gestionan en Supabase Auth
   - Para resetear password de un usuario, usa el panel de Supabase

3. **Store Assignment**:
   - Managers y Sellers deben tener un `store_id` asignado
   - Admins pueden tener `store_id` null (acceso a todas)

## Troubleshooting

### Error: "Usuario no encontrado"
- Verifica que el usuario exista en la tabla `usuarios`
- Verifica que el `codigo_asesor` sea correcto

### Error: "Credenciales inválidas"
- Verifica que el usuario exista en Supabase Auth
- Verifica que el password sea correcto
- Verifica que el email en Auth sea `CODIGO@gridretail.local`

### No puedo ver datos
- Verifica las políticas de RLS
- Verifica que el usuario tenga el `store_id` correcto (si es manager/seller)
