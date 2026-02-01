# CHANGELOG - Módulo de Cuotas
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

## [2026-01-27] v1.0 - Versión Inicial (BD)

### Tablas Creadas
- ✅ `quota_imports` - Historial de importaciones de Excel
- ✅ `store_quotas` - Cuotas por tienda con sistema dual Entel/SSNN
- ✅ `hc_quotas` - Cuotas individuales por HC con prorrateo

### Vistas Creadas
- ✅ `vw_store_quotas_summary` - Resumen por tienda con estadísticas
- ✅ `vw_quotas_vigentes` - Cuotas HC con detalles de usuario/tienda

### Funciones Creadas
- ✅ `get_quota_period_summary()` - Resumen consolidado del período
- ✅ `update_store_quota_ssnn()` - Editar cuota SSNN con validación
- ✅ `calculate_quota_breakdown()` - Desglose proporcional para HC
- ✅ `distribute_store_quota()` - Distribuir cuota a HCs
- ✅ `approve_store_quotas()` - Aprobar cuotas
- ✅ `get_hc_effective_quota()` - Cuota efectiva para simulador

### Características del Sistema Dual
```
ss_quota_entel  → Cuota original de Entel (inmutable)
ss_quota        → Cuota operativa SSNN (editable)
diferencia      → ss_quota - ss_quota_entel
```

### Prorrateo
- Factor calculado: `días_restantes / días_del_mes`
- Cuota efectiva: `ss_quota × proration_factor`
- Breakdown proporcional automático

### Dependencias
- Tabla `tiendas` (FK store_id)
- Tabla `usuarios` (FK user_id, approved_by, etc.)

---

## Flujo de Datos

```
Excel Entel → quota_imports → store_quotas → hc_quotas → Simulador
                                   │
                            ┌──────┴──────┐
                            │             │
                      ss_quota_entel  ss_quota
                      (inmutable)    (editable)
```

---

## Frontend (Pendiente de Implementar)

### Pantallas Diseñadas
- [ ] Lista de cuotas por período
- [ ] Importador de Excel
- [ ] Editor de cuota por tienda
- [ ] Distribuidor a HCs
- [ ] Aprobación masiva

### Componentes Requeridos
- [ ] QuotaImporter (upload + preview)
- [ ] StoreQuotaEditor (edición inline)
- [ ] HCQuotaDistributor (asignación)
- [ ] QuotaApprovalDialog (confirmación)

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

### Prioridades (usar en descripción)
- 🔴 Alta - Bloquea uso normal
- 🟡 Media - Afecta experiencia pero hay workaround
- 🟢 Baja - Mejora nice-to-have
