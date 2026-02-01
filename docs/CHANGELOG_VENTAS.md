# CHANGELOG - Módulo Registro de Ventas
## GridRetail

**Última actualización:** 2026-01-27

---

## [Pendiente]

### Validaciones
- [ ] Agregar campo `validacion_huella` al formulario (HUELLERO/DJ/VENTA EXTRANJERO)
- [ ] Agregar campo `vep_contado` al formulario (VEP/CONTADO)
- [ ] Agregar campo `plan_tarifario` al formulario
- [ ] Usar flag `requiere_iccid` de BD para mostrar/ocultar campo

### UX/UI
- [ ] _Sin issues pendientes_

### Lógica de Negocio
- [ ] Limpiar campos legacy (telefono_asignado, imei, iccid)

---

## [2026-01-27] v1.1 - Validación y Correcciones de BD

### Base de Datos
- ✅ Corregido constraint `tipo_documento_cliente`: ahora acepta 'CE' y 'RUC' (antes 'C.E.' y 'RUC 20')
- ✅ Eliminado constraint hardcodeado de `operador_cedente` (ahora valida contra tabla)
- ✅ Agregado constraint `ventas_estado_check` para estados válidos
- ✅ Agregado constraint `ventas_estado_cruce_check` para estados de cruce

### Documentación
- ✅ Validados 16 tipos de venta contra BD de producción
- ✅ Confirmado: OPP_MONO no existe (error en documentación original)
- ✅ Documentado: PACK_OPEN (existía en BD pero no en docs)
- ✅ Creado fragmento para DATA_DICTIONARY.md con tabla `ventas` completa
- ✅ Actualizado SPECS_REGISTRO_VENTA_DIARIA.md a v2.1

### SQL Ejecutado
```sql
-- Corrección tipo_documento_cliente
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_tipo_documento_cliente_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_tipo_documento_cliente_check 
  CHECK (tipo_documento_cliente IN ('DNI', 'CE', 'RUC', 'PASAPORTE', 'PTP'));

-- Eliminar constraint operador_cedente
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_operador_cedente_check;

-- Agregar constraints de estado
ALTER TABLE ventas ADD CONSTRAINT ventas_estado_check 
  CHECK (estado IN ('registrada', 'pendiente_aprobacion', 'aprobada', 'rechazada', 'anulada'));

ALTER TABLE ventas ADD CONSTRAINT ventas_estado_cruce_check 
  CHECK (estado_cruce IN ('PENDIENTE', 'COINCIDE', 'DISCREPANCIA', 'NO_ENCONTRADO'));
```

---

## [2026-01-24] v1.0 - Versión Inicial

### Funcionalidades Implementadas
- ✅ Formulario de registro de venta (Boca de Urna)
- ✅ Soporte para 16 tipos de venta
- ✅ Campos condicionales según tipo de venta:
  - IMEI/ICCID para ventas con equipo
  - Operador cedente para portabilidades
  - Número a portar para portabilidades
  - Plan tarifario para postpago
- ✅ Selector de tienda filtrado por usuario
- ✅ Validación de permisos por rol
- ✅ Integración con tabla `ventas`
- ✅ Validación de orden [78]XXXXXXXX (empieza con 7 u 8)

### Tipos de Venta Soportados (16)
```
POSTPAGO (8): OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, 
              VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN
PACK (2):     PACK_VR, PACK_OPEN
PACK_SS (2):  PACK_OSS, PACK_VR_BASE
RENO (1):     RENO
PREPAGO (2):  PREPAGO, PORTA_PP
OTROS (1):    ACCESORIOS
```

### Dependencias
- Tabla `usuarios` (usuario actual)
- Tabla `tiendas` (selector de tienda)
- Tabla `tipos_venta` (catálogo)
- Tabla `operadores_cedentes` (para portabilidades)
- Tabla `ventas` (destino de datos)

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

### Prioridades (usar en descripción)
- 🔴 Alta - Bloquea uso normal
- 🟡 Media - Afecta experiencia pero hay workaround
- 🟢 Baja - Mejora nice-to-have
