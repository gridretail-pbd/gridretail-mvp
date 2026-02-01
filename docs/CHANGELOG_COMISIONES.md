# CHANGELOG - Módulo de Comisiones
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
- ✅ `commission_item_types` - Catálogo de tipos de partida
- ✅ `commission_schemes` - Esquemas de comisiones
- ✅ `commission_scheme_items` - Partidas individuales
- ✅ `commission_pxq_scales` - Escalas PxQ
- ✅ `commission_item_locks` - Candados
- ✅ `commission_item_restrictions` - Restricciones de mix
- ✅ `commission_hc_assignments` - Asignación de esquemas a HC

### Sistema de Partidas Flexible (v2.1)
- ✅ `partition_presets` - 25 presets predefinidos
- ✅ `partition_preset_ventas` - Mapeo preset → tipo_venta
- ✅ `commission_item_ventas` - Mapeo partida → tipo_venta

### Funciones Creadas
- ✅ `simulate_hc_commission()` - Calcular comisión completa
- ✅ `compare_commission_scenarios()` - Comparar dos esquemas
- ✅ `get_sales_profile()` - Generar perfil de ventas
- ✅ `predict_hc_penalties()` - Predecir penalidades (en módulo Penalidades)

### Estados de Esquema
```
oficial    → Importado de Entel (solo lectura)
draft      → En edición (pueden existir múltiples)
aprobado   → Vigente para el período (solo uno)
archivado  → Histórico
```

### Tipos de Cálculo Soportados
- **percentage**: Comisión por % de cumplimiento
- **pxq**: Precio por cantidad con escalas
- **binary**: Todo o nada (bonos)

### Dependencias
- Tabla `usuarios` (created_by, approved_by)
- Tabla `tipos_venta` (mapeo de partidas)

---

## Frontend (Pendiente de Implementar)

### SPECs Generados
- ✅ EDITOR_ESQUEMAS_SPEC.md
- ✅ SIMULADOR_INGRESOS_SPEC_v1.2.md

### Pantallas Diseñadas
- [ ] Lista de esquemas
- [ ] Editor de esquema
- [ ] Editor de partidas
- [ ] Importador de Excel
- [ ] Simulador de ingresos

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
