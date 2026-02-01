# CHANGELOG - Módulo de Penalidades
## GridRetail

**Última actualización:** 2026-01-27

---

## [Pendiente]

### Validaciones
- [ ] _Agregar issues aquí cuando se detecten_

### UX/UI
- [ ] _Agregar issues aquí cuando se detecten_

### Lógica de Negocio
- [ ] _Agregar issues aquí cuando se detecten_

---

## [2026-01-XX] v1.1 (Próxima versión)

_Cambios pendientes de implementar_

---

## [2026-01-25] v1.0 - Versión Inicial (BD)

### Tablas Creadas
- ✅ `penalty_types` - Catálogo de 18 tipos de penalidad
- ✅ `penalty_equivalences` - Equivalencias SSNN → HC
- ✅ `hc_penalties` - Registro histórico de penalidades
- ✅ `penalty_imports` - Historial de importaciones de FICHA

### Vista Creada
- ✅ `vw_penalty_summary` - Resumen de penalidades por HC

### Función Creada
- ✅ `predict_hc_penalties()` - Predecir penalidades basado en historial

### Tipos de Penalidad (18)

**De Entel (FICHA):**
- PORT_OUT, SUSPENDIDA, MISS_OUT
- DJ, DESCUENTO_MAL_APLICADO
- FOTO_EXITO_APERTURAS, RECAUDO

**Internas PBD:**
- INASISTENCIA_CAPACITACION, NO_UNIFORME
- TARDANZA, FALTA_INJUSTIFICADA
- INCUMPLIMIENTO_PROTOCOLO, ERROR_CAJA
- FALTANTE_INVENTARIO, MAL_USO_SISTEMA
- QUEJA_CLIENTE, INCUMPLIMIENTO_HORARIO
- OTROS

### Opciones de Traslado SSNN → HC
```
NO_COBRAR     → El SSNN absorbe la penalidad
MONTO_TOTAL   → Se cobra 100% al HC
PORCENTAJE    → Se cobra X% del monto
MONTO_FIJO    → Se cobra monto fijo independiente del original
FRACCION      → Se cobra solo parte de las incidencias
```

### Dependencias
- Tabla `usuarios` (user_id, created_by)
- Tabla `tiendas` (store_id opcional)

---

## Frontend (Pendiente de Implementar)

### SPEC Generado
- ✅ MODULO_PENALIDADES_SPEC_v1.1.md

### Pantallas Diseñadas
- [ ] Lista de penalidades (con filtros)
- [ ] Importador de FICHA
- [ ] Editor de equivalencias
- [ ] Registro manual de penalidad
- [ ] Vista de penalidades del HC

---

## Convenciones de este archivo

### Estados de items pendientes
- `[ ]` Pendiente
- `[~]` En progreso
- `[x]` Completado (mover a sección de versión)

### Prioridades (usar en descripción)
- 🔴 Alta - Bloquea uso normal
- 🟡 Media - Afecta experiencia pero hay workaround
- 🟢 Baja - Mejora nice-to-have
