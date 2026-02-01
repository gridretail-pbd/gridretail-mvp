# Issues Conocidos - GridRetail
## Registro Central de Detalles y Mejoras Pendientes

**Última actualización:** 2026-01-27  
**Propósito:** Tracking centralizado de issues detectados en producción/testing

---

## Resumen por Módulo

| Módulo | 🔴 Alta | 🟡 Media | 🟢 Baja | Total |
|--------|---------|----------|---------|-------|
| Registro de Ventas | 0 | 0 | 0 | 0 |
| Cuotas | 0 | 0 | 0 | 0 |
| Comisiones | 0 | 0 | 0 | 0 |
| Penalidades | 0 | 0 | 0 | 0 |
| Simulador | 0 | 0 | 0 | 0 |
| INAR | 0 | 0 | 0 | 0 |
| **TOTAL** | **0** | **0** | **0** | **0** |

---

## 🔴 Prioridad Alta
_Issues que bloquean el uso normal del sistema_

| ID | Módulo | Descripción | Reportado | Estado |
|----|--------|-------------|-----------|--------|
| - | - | _Sin issues reportados_ | - | - |

---

## 🟡 Prioridad Media
_Issues que afectan la experiencia pero tienen workaround_

| ID | Módulo | Descripción | Reportado | Estado |
|----|--------|-------------|-----------|--------|
| - | - | _Sin issues reportados_ | - | - |

---

## 🟢 Prioridad Baja
_Mejoras nice-to-have_

| ID | Módulo | Descripción | Reportado | Estado |
|----|--------|-------------|-----------|--------|
| - | - | _Sin issues reportados_ | - | - |

---

## Issues Resueltos ✅

| ID | Módulo | Descripción | Resuelto | Versión |
|----|--------|-------------|----------|---------|
| - | - | _Sin issues resueltos aún_ | - | - |

---

## Cómo Reportar un Issue

### Template para reportar en Claude.ai:

```
MÓDULO: [Nombre del módulo]
PANTALLA: [Pantalla o componente afectado]
PRIORIDAD: 🔴 Alta / 🟡 Media / 🟢 Baja

COMPORTAMIENTO ACTUAL:
[Qué está pasando]

COMPORTAMIENTO ESPERADO:
[Qué debería pasar]

PASOS PARA REPRODUCIR:
1. [Paso 1]
2. [Paso 2]
3. [...]

IMPACTO:
[Qué se ve afectado: datos, UX, cálculos, etc.]

NOTAS ADICIONALES:
[Screenshots, contexto, etc.]
```

### Ejemplo:

```
MÓDULO: Registro de Ventas
PANTALLA: Formulario principal
PRIORIDAD: 🟡 Media

COMPORTAMIENTO ACTUAL:
El formulario permite guardar una venta con PACK sin ingresar IMEI

COMPORTAMIENTO ESPERADO:
Debe validar que IMEI tenga 15 dígitos cuando el tipo de venta incluye equipo

PASOS PARA REPRODUCIR:
1. Seleccionar tipo "PACK_OSS"
2. Llenar campos obligatorios excepto IMEI
3. Click en Guardar
4. Se guarda sin error

IMPACTO:
Datos incompletos en BD, problemas en conciliación con INAR

NOTAS ADICIONALES:
Afecta tipos: PACK_VR, PACK_OSS, PACK_VR_BASE, RENO
```

---

## Flujo de Gestión

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Detectado  │ ──► │  Reportado  │ ──► │ En Progreso │ ──► │  Resuelto   │
│             │     │ (Claude.ai) │     │(Claude Code)│     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Documentado │
                    │ (Este file) │
                    └─────────────┘
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `CHANGELOG_VENTAS.md` | Historial de cambios módulo Ventas |
| `CHANGELOG_CUOTAS.md` | Historial de cambios módulo Cuotas |
| `GRIDRETAIL_ARCHITECTURE.md` | Arquitectura del sistema |
| `DATA_DICTIONARY.md` | Estructura de BD |

---

## Convenciones

### Estados
- **Pendiente**: Issue documentado, sin iniciar
- **En análisis**: Evaluando impacto en Claude.ai
- **En progreso**: Siendo implementado en Claude Code
- **En testing**: Implementado, pendiente validación
- **Resuelto**: Validado y cerrado

### IDs
- Formato: `GR-XXX` (GridRetail + número secuencial)
- Ejemplo: `GR-001`, `GR-002`

### Prioridades
- 🔴 **Alta**: Bloquea operación normal, debe resolverse inmediatamente
- 🟡 **Media**: Afecta UX o datos pero hay workaround, resolver esta semana
- 🟢 **Baja**: Mejora de calidad de vida, resolver cuando haya tiempo
