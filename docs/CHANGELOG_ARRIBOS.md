# CHANGELOG - Módulo Registro de Arribos
## GridRetail

**Última actualización:** 2026-06-07

---

## [Pendiente]

### Validaciones
- [ ] Evaluar cambiar `registrado_por` de VARCHAR a UUID con FK a usuarios (consistencia con módulo Ventas)

### UX/UI
- [ ] Contador visual de arribos del día en tiempo real
- [ ] Modo offline con sync posterior
- [ ] Registro masivo (múltiples arribos rápidamente)

### Lógica de Negocio
- [ ] Dashboard de tienda: vista de arribos vs ventas en tiempo real
- [ ] Alertas cuando la conversión cae por debajo de umbral

---

## [2026-06-07] v1.3 - Fix Documentos, Hardening API, Hora Servidor y Reparación de Nombres con IA

### Fix
- ✅ 🔴 **Corregido constraint `arribos_dni_cliente_format_check`**: exigía exactamente 8 dígitos (`^\d{8}$`) para `dni_cliente`, lo que hacía **fallar el registro de documentos CE (9 dígitos) y OTRO**, ya que el formulario guarda esos documentos en la misma columna. Ahora el formato depende de `tipo_documento_cliente`. (Migración `027`)
- ✅ 🔴 **Corregido token de json.pe**: `system_config.JSON_PE_TOKEN` tenía un token caducado que devolvía HTTP 401 ("Error de autenticación con API"). Actualizado al token válido. Verificado contra `api.json.pe/api/dni` (HTTP 200).

### Base de Datos
- ✅ Migración `027_fix_arribos_documento_constraint.sql` (EJECUTADA): reemplaza el CHECK rígido por uno dependiente del tipo de documento:
  - `DNI` → exactamente 8 dígitos
  - `CE` → exactamente 9 dígitos
  - `OTRO` → cualquier valor no vacío
  - `NULL` → siempre válido (cliente sin documento)

### Backend
- ✅ **Hardening de `/api/arribos` (POST)**: ahora valida el payload server-side con Zod (`arriboInsertSchema`) antes de insertar, devolviendo `400` con detalle de errores en lugar de un error de constraint de Postgres. No confía en el frontend.
- ✅ **Lista blanca de columnas**: solo se insertan los campos validados, evitando que el cliente inyecte columnas arbitrarias (`id`, `created_at`, etc.).
- ✅ **Fecha y hora autoritativas del servidor**: `fecha` y `hora` se calculan en el servidor en zona horaria `America/Lima` (UTC-5) vía `Intl.DateTimeFormat`, **ya no dependen del reloj del dispositivo del cliente**. La API ignora cualquier `fecha`/`hora` que envíe el cliente.

### Nuevas Funcionalidades
- ✅ **Reparación de nombres con IA**: json.pe entrega los nombres con el carácter `�` (U+FFFD) donde el origen tenía tildes, eñes o diéresis (corrupción irrecuperable en la fuente, confirmada inspeccionando los bytes `ef bf bd`). Se restauran con un modelo económico (Claude Haiku) vía la capa AI:
  - Nuevo task type `REPARACION_NOMBRE` (tier `economy`) en `lib/ai/config.ts`.
  - Solo se invoca a la IA si el nombre contiene `�` (cero costo en el caso común).
  - **Salvaguarda anti-alucinación**: una máscara regex valida que el modelo solo reemplazó las posiciones del `�` por una letra especial española y no tocó ningún otro carácter; si la salida no cumple, se conserva el nombre original.
  - Degrada de forma segura: si la IA está deshabilitada o falla, se devuelve el nombre original sin romper la consulta.
  - Probado 12/12 casos OK (TOMÁS, MARTÍN, MUÑOZ, NÚÑEZ, CONCEPCIÓN, etc.).
- ℹ️ **Nota de negocio**: RENIEC introdujo tildes solo en DNIs recientes; los DNIs antiguos vienen sin tilde (y sin `�`), por lo que correctamente **no** se modifican (no se inventan tildes donde el origen no las marca).

### Archivos Creados/Modificados
```
supabase/migrations/027_fix_arribos_documento_constraint.sql  # Nuevo - fix constraint
lib/arribos/validations.ts                                    # Nuevo - schema Zod server-side
lib/ai/prompts/arribos/reparacion-nombre.ts                   # Nuevo - prompt + helper IA
lib/ai/config.ts                                              # Mod - task type REPARACION_NOMBRE
app/api/arribos/route.ts                                      # Mod - validación + fecha/hora servidor
app/api/consulta-documento/route.ts                          # Mod - integración reparación IA
app/(dashboard)/dashboard/arribos/nuevo/page.tsx             # Mod - deja de enviar fecha/hora
```

### SQL Ejecutado
```sql
-- Migración 027: constraint de documento dependiente del tipo
ALTER TABLE public.arribos DROP CONSTRAINT IF EXISTS arribos_dni_cliente_format_check;

ALTER TABLE public.arribos
  ADD CONSTRAINT arribos_dni_cliente_format_check CHECK (
    dni_cliente IS NULL
    OR (tipo_documento_cliente = 'DNI'  AND dni_cliente ~ '^\d{8}$')
    OR (tipo_documento_cliente = 'CE'   AND dni_cliente ~ '^\d{9}$')
    OR (tipo_documento_cliente = 'OTRO' AND length(dni_cliente) > 0)
  );

-- Actualización del token de json.pe (vía REST/UI, no archivo de migración)
UPDATE system_config SET value = '<token-valido>' WHERE key = 'JSON_PE_TOKEN';
```

### Notas sobre fecha/hora
- `fecha` y `hora` reflejan la hora local de Perú (UTC-5), calculada por el servidor.
- `created_at` permanece en UTC (`now()` de la BD), por eso difiere exactamente +5h respecto a `hora`. No es un error.

### Configuración Requerida (capa IA)
```
# system_config debe tener configurada la capa AI:
AI_ENABLED            = true
AI_PROVIDER_DEFAULT   = anthropic
AI_ANTHROPIC_API_KEY  = sk-ant-...
AI_MODEL_ECONOMY      = claude-haiku-4-5-20251001
```

---

## [2026-01-28] v1.2 - Integración API Consulta Documento

### Nuevas Funcionalidades
- ✅ Consulta automática de DNI vía API json.pe (RENIEC)
- ✅ Consulta automática de CE vía API json.pe (Migraciones)
- ✅ Campo `nombre_cliente` se autocompleta al ingresar documento válido
- ✅ Soporte para 4 tipos de documento: DNI, CE, Otro, No lo dio

### Base de Datos
- ✅ Nueva tabla `system_config` para almacenar tokens y configuración
- ✅ Nueva columna `tipo_documento_cliente` en tabla `arribos`
- ✅ Nueva columna `nombre_cliente` en tabla `arribos`
- ✅ Constraint `arribos_tipo_documento_cliente_check` (DNI, CE, OTRO)
- ✅ Constraint `arribos_dni_cliente_format_check` (validación formato por tipo)

### Backend
- ✅ Nuevo endpoint `/api/consulta-documento` con soporte DNI y CE
- ✅ Cache de token (5 min) para reducir consultas a BD
- ✅ Logging detallado con prefijo `[consulta-documento]`
- ✅ Manejo de errores con mensajes descriptivos

### UX/UI Mejorada
- ✅ **Sin valores por defecto** - Usuario debe seleccionar activamente cada campo
- ✅ **Placeholders descriptivos** - "Selecciona una opción" en todos los selects
- ✅ **Validación con mensajes claros** - "Selecciona el motivo de no venta" en vez de error genérico
- ✅ **Grid alineado** - Campos de documento alineados por la base con `items-end`
- ✅ **Labels simplificados** - "Documento", "Número", "Nombre del Cliente"
- ✅ **Ancho fijo en selects** - Evita que se vean demasiado anchos
- ✅ Indicador de carga (spinner) mientras consulta API
- ✅ Prevención de consultas duplicadas con `useRef`

### Archivos Creados/Modificados
```
app/api/consulta-documento/route.ts    # Nuevo endpoint API
app/(dashboard)/dashboard/arribos/nuevo/page.tsx  # Formulario mejorado
```

### SQL Ejecutado
```sql
-- Nueva tabla de configuración
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES usuarios(id)
);

-- Token de API
INSERT INTO system_config (key, value, description, is_secret, category)
VALUES ('JSON_PE_TOKEN', 'tu-token-aqui', 'Token para API json.pe', true, 'api');

-- Nuevas columnas en arribos
ALTER TABLE arribos ADD COLUMN tipo_documento_cliente VARCHAR(20);
ALTER TABLE arribos ADD COLUMN nombre_cliente VARCHAR(200);

-- Constraints
ALTER TABLE arribos ADD CONSTRAINT arribos_tipo_documento_cliente_check
  CHECK (tipo_documento_cliente IS NULL OR tipo_documento_cliente IN ('DNI', 'CE', 'OTRO'));

ALTER TABLE arribos ADD CONSTRAINT arribos_dni_cliente_format_check
  CHECK (
    dni_cliente IS NULL 
    OR (tipo_documento_cliente = 'DNI' AND dni_cliente ~ '^\d{8}$')
    OR (tipo_documento_cliente = 'CE' AND dni_cliente ~ '^\d{9}$')
    OR (tipo_documento_cliente = 'OTRO')
    OR (tipo_documento_cliente IS NULL)
  );
```

### Configuración Requerida
```env
# .env.local - Agregar service_role key para acceder a system_config
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Debugging
Si la consulta no funciona, verificar:
1. Token en `system_config` (no placeholder)
2. Variable `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
3. Logs en terminal: `[consulta-documento] ...`
4. Créditos disponibles en json.pe

---

## [2026-01-27] v1.1 - Validación y Correcciones de BD

### Base de Datos
- ✅ Agregado constraint `arribos_motivo_no_venta_check` para validar 7 motivos válidos
- ✅ Documentada semántica de `es_cliente_entel`: true=SI, false=NO, null=NO_SABE

### Documentación
- ✅ Validada estructura de tabla `arribos` (14 columnas)
- ✅ Confirmados constraints existentes: PK, 2 FK, 1 CHECK (tipo_visita)
- ✅ Creado fragmento para DATA_DICTIONARY.md
- ✅ Actualizado SPECS_REGISTRO_ARRIBOS.md a v1.1
- ✅ Identificada inconsistencia: `registrado_por` es VARCHAR (debería ser UUID)

### SQL Ejecutado
```sql
-- Agregar constraint para motivo_no_venta
ALTER TABLE arribos ADD CONSTRAINT arribos_motivo_no_venta_check 
  CHECK (motivo_no_venta IS NULL OR motivo_no_venta IN (
    'SIN_STOCK', 'PRECIO_ALTO', 'NO_CALIFICA', 'SOLO_CONSULTA', 
    'DOCS_INCOMPLETOS', 'PROBLEMA_SISTEMA', 'OTRO'
  ));
```

---

## [2026-01-27] v1.0 - Versión Inicial

### Funcionalidades Implementadas
- ✅ Formulario de registro de arribo
- ✅ Soporte para 2 tipos de visita (VENTA, POSVENTA)
- ✅ 7 motivos de no venta
- ✅ Campos condicionales según tipo de visita:
  - `se_vendio` solo visible si tipo_visita = VENTA
  - `motivo_no_venta` solo visible si se_vendio = NO
- ✅ Selector de tienda filtrado por usuario
- ✅ Validación de permisos por rol
- ✅ Integración con tabla `arribos`

### Estructura de Datos (v1.0)
```
arribos (14 columnas):
- id, fecha, hora
- tienda_id (FK), usuario_id (FK), registrado_por
- dni_cliente, es_cliente_entel
- tipo_visita, concreto_operacion
- se_vendio, motivo_no_venta
- created_at, updated_at
```

### Estructura de Datos (v1.2 - actualizada)
```
arribos (16 columnas):
- id, fecha, hora
- tienda_id (FK), usuario_id (FK), registrado_por
- tipo_documento_cliente, dni_cliente, nombre_cliente  # Nuevos/modificados
- es_cliente_entel
- tipo_visita, concreto_operacion
- se_vendio, motivo_no_venta
- created_at, updated_at
```

### Roles con Acceso (10 de 12)
```
Con acceso: ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR,
            JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL,
            BACKOFFICE_OPERACIONES, VALIDADOR_ARRIBOS, ADMIN

Sin acceso: BACKOFFICE_RRHH, BACKOFFICE_AUDITORIA
```

### Dependencias
- Tabla `usuarios` (usuario actual, FK)
- Tabla `tiendas` (selector de tienda, FK)
- Tabla `usuarios_tiendas` (filtro de tiendas por usuario)
- Tabla `system_config` (token API) - **nuevo en v1.2**

---

## Comparación con Módulo Ventas

| Aspecto | Ventas | Arribos |
|---------|--------|---------|
| Columnas | 40+ | 16 |
| CHECK constraints | 6 | 4 |
| Complejidad | Alta | Media |
| registrado_por | UUID FK ✅ | VARCHAR ⚠️ |
| Consulta API documento | ❌ | ✅ json.pe |

---

## Integraciones Externas

| Servicio | Endpoint | Uso |
|----------|----------|-----|
| json.pe | `api.json.pe/api/dni` | Consulta DNI (RENIEC) |
| json.pe | `api.json.pe/api/cee` | Consulta CE (Migraciones) |
| Anthropic | Claude Haiku (via capa AI) | Reparación de tildes/ñ/ü en nombres RENIEC (v1.3) |

---

## Convenciones de este archivo

### Estados de items pendientes
- `[ ]` Pendiente
- `[~]` En progreso
- `[x]` Completado (mover a sección de versión)

### Categorías
- **Validaciones**: Reglas de validación de campos
- **UX/UI**: Cambios visuales, mensajes, flujo de usuario
- **Lógica de Negocio**: Reglas que afectan cálculos o datos
- **Fix**: Corrección de errores
- **Base de Datos**: Cambios en estructura o constraints
- **Backend**: APIs, endpoints, lógica servidor

### Prioridades (usar en descripción)
- 🔴 Alta - Bloquea uso normal
- 🟡 Media - Afecta experiencia pero hay workaround
- 🟢 Baja - Mejora nice-to-have
