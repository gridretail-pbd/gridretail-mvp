# Referencia del Schema de Base de Datos

## IMPORTANTE: Este archivo es solo de referencia
La base de datos ya está creada en Supabase. Este documento describe el schema existente.

## Tablas Principales

### tiendas
```sql
- id (uuid, PK)
- codigo (varchar, unique)
- nombre (varchar)
- direccion (text)
- zona (varchar)
- gps_lat (decimal)
- gps_long (decimal)
- cuota_diaria (decimal)
- activa (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### usuarios
```sql
- id (uuid, PK)
- codigo_asesor (varchar, unique)
- dni (varchar)
- nombre_completo (varchar)
- email (varchar)
- rol (varchar: 'admin', 'gerente', 'asesor')
- zona (varchar)
- activo (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### usuarios_tiendas
```sql
- id (uuid, PK)
- usuario_id (uuid, FK -> usuarios)
- tienda_id (uuid, FK -> tiendas)
- created_at (timestamp)
```

### ventas
```sql
- id (uuid, PK)
- fecha (date)
- hora (time)
- tienda_id (uuid, FK -> tiendas)
- usuario_id (uuid, FK -> usuarios)
- codigo_asesor (varchar)
- dni_asesor (varchar)
- tipo_documento_cliente (varchar)
- numero_documento_cliente (varchar)
- nombre_cliente (varchar)
- telefono_asignado (varchar)
- orden_venta (varchar)
- monto_plan (decimal)
- monto_liquidado (decimal)
- tipo_venta (varchar)
- base_captura (varchar)
- validacion_huella (boolean)
- operador_cedente (varchar)
- vep_contado (varchar)
- iccid_chip (varchar)
- imei_equipo (varchar)
- modelo_accesorio (varchar)
- created_at (timestamp)
```

### arribos
```sql
- id (uuid, PK)
- fecha (date)
- hora (time)
- tienda_id (uuid, FK -> tiendas)
- usuario_id (uuid, FK -> usuarios)
- registrado_por (varchar)
- dni_cliente (varchar)
- es_cliente_entel (boolean)
- tipo_visita (varchar)
- concreto_operacion (boolean)
- se_vendio (boolean)
- motivo_no_venta (varchar)
- created_at (timestamp)
```

### logs_auditoria
```sql
- id (uuid, PK)
- tabla (varchar)
- operacion (varchar)
- usuario_id (uuid)
- datos_anteriores (jsonb)
- datos_nuevos (jsonb)
- ip_address (varchar)
- created_at (timestamp)
```

## Queries Útiles para el Dashboard

### Obtener métricas del día por tienda
```sql
SELECT
  t.id as tienda_id,
  t.nombre as tienda_nombre,
  t.codigo as tienda_codigo,
  t.cuota_diaria as cuota,
  COUNT(DISTINCT v.id) as total_ventas,
  COALESCE(SUM(v.monto_liquidado), 0) as monto_total,
  COUNT(DISTINCT a.id) as total_arribos,
  t.cuota_diaria - COALESCE(SUM(v.monto_liquidado), 0) as falta,
  CASE
    WHEN t.cuota_diaria > 0
    THEN (COALESCE(SUM(v.monto_liquidado), 0) / t.cuota_diaria * 100)
    ELSE 0
  END as cumplimiento,
  CASE
    WHEN COUNT(DISTINCT a.id) > 0
    THEN (COUNT(DISTINCT v.id)::decimal / COUNT(DISTINCT a.id) * 100)
    ELSE 0
  END as conversion
FROM tiendas t
LEFT JOIN ventas v ON t.id = v.tienda_id AND v.fecha = CURRENT_DATE
LEFT JOIN arribos a ON t.id = a.tienda_id AND a.fecha = CURRENT_DATE
WHERE t.activa = true
GROUP BY t.id, t.nombre, t.codigo, t.cuota_diaria
ORDER BY t.codigo
```

### Obtener métricas totales del día
```sql
SELECT
  COUNT(DISTINCT a.id) as total_arribos,
  COUNT(DISTINCT v.id) as total_ventas,
  COALESCE(SUM(v.monto_liquidado), 0) as monto_total,
  SUM(t.cuota_diaria) as cuota_total,
  CASE
    WHEN SUM(t.cuota_diaria) > 0
    THEN (COALESCE(SUM(v.monto_liquidado), 0) / SUM(t.cuota_diaria) * 100)
    ELSE 0
  END as cumplimiento,
  CASE
    WHEN COUNT(DISTINCT a.id) > 0
    THEN (COUNT(DISTINCT v.id)::decimal / COUNT(DISTINCT a.id) * 100)
    ELSE 0
  END as conversion
FROM tiendas t
LEFT JOIN ventas v ON t.id = v.tienda_id AND v.fecha = CURRENT_DATE
LEFT JOIN arribos a ON t.id = a.tienda_id AND a.fecha = CURRENT_DATE
WHERE t.activa = true
```

## Configuración de Autenticación

Los usuarios se autentican con:
- Email: `{codigo_asesor}@gridretail.local`
- Password: (configurado en Supabase Auth)

La aplicación verifica:
1. Usuario existe en tabla `usuarios`
2. Usuario está activo (`activo = true`)
3. Credenciales válidas en Supabase Auth

## Row Level Security (RLS)

Las políticas de seguridad permiten:
- Admin: acceso total a todas las tiendas
- Gerente: acceso solo a tiendas asignadas vía `usuarios_tiendas`
- Asesor: acceso solo a tiendas asignadas vía `usuarios_tiendas`
