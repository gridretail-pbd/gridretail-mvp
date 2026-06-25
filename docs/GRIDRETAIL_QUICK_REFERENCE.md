# GridRetail - Referencia Rápida
**Adjuntar este archivo a cada conversación nueva del proyecto**
**Versión:** 3.1 — 2026-06-24

> **Novedades v3.1** (migraciones 027–030, validadas contra la BD real vía PostgREST 2026-06-24):
> - **Arribos↔Ventas:** `arribos.se_vendio` → `arribos.resultado` (5 estados); `ventas.arribo_id` ahora **NOT NULL** (toda venta nace de un arribo); trigger `ventas_recompute_arribo` mantiene `resultado` sincronizado.
> - **Documento en arribos** ampliado a DNI/CE/RUC/PASAPORTE/PTP/OTRO.
> - **+6 funciones** de arribos (4 de reporte + `recompute_arribo_resultado` + trigger).
> - **Conteos reales corregidos** abajo (la BD ya incluía tablas RRHH de las migraciones 025/026 no reflejadas antes).
> - ⚠️ 2 funciones de reporte fallan en runtime: `get_arribos_resumen_red` (42804) y `get_arribos_detalle_tienda` (42803) — pendiente de corrección.

---

## ESTADO ACTUAL DE LA BD (57 tablas, 10 vistas, 24 funciones RPC)

> Verificado contra Supabase (PostgREST) el 2026-06-24. Las 24 funciones son las expuestas como RPC; no incluye funciones de trigger (`trigger_set_updated_at`, `trg_ventas_recompute_arribo`, etc.).

### 1. Core (5 tablas)
- `usuarios` — 12 roles, ~100 usuarios activos
- `tiendas` — 21 tiendas TEX + GPS, zona, headcount, horarios *(v3.0)*
- `usuarios_tiendas` — relación M:N
- `tipos_venta` — 18 tipos en 6 categorías
- `operadores_cedentes` — 3: Movistar, Claro, Bitel

### 2. Operaciones (2 tablas + 6 funciones) *(v3.1)*
- `ventas` — registro BU (declarativo), 40+ columnas. **`arribo_id` NOT NULL** → FK a `arribos` (ON DELETE RESTRICT) *(v3.1)*
- `arribos` — conteo de clientes, integración json.pe. Columna **`resultado`** (reemplaza `se_vendio`): `NO_VENDIO`, `VENTA_DECLARADA_PENDIENTE`, `VENTA_PENDIENTE_APROBACION`, `VENDIDO_CONFIRMADO`, `VENTA_ANULADA` (NULL si POSVENTA) *(v3.1)*
- Funciones reporte: `get_arribos_matriz`, `get_arribos_metricas`, `get_arribos_resumen_red`⚠️, `get_arribos_detalle_tienda`⚠️
- Vinculación: `recompute_arribo_resultado(uuid)` + trigger `ventas_recompute_arribo` (recalcula `resultado` al cambiar ventas)

### 3. INAR (3 tablas + 3 vistas)
- `lineas_inar` — 49 campos, datos oficiales Entel
- `inar_importaciones` — historial de importaciones Excel
- `inar_mapeo_columnas` — mapeo dinámico de columnas
- Vistas: `v_inar_resumen_diario`, `v_inar_resumen_tienda`, `v_inar_resumen_vendedor`

### 4. Control (2 tablas + 2 vistas)
- `asesor_incidencias` — incidencias comerciales
- `logs_auditoria` — auditoría de acciones
- Vistas: `v_tipos_venta_config`, `asesor_score_mensual` (score mensual consolidado del asesor)

### 5. Comisiones (8 tablas + funciones de cálculo/simulación)
- `commission_item_types` — catálogo de tipos de partida
- `commission_schemes` — esquemas de comisión
- `commission_scheme_items` — partidas individuales *(corregido v2.7)*
- `commission_pxq_scales` — escalas precio×cantidad
- `commission_item_locks` — candados legacy
- `commission_item_restrictions` — restricciones de descuento
- `commission_hc_assignments` — asignación HC↔esquema
- `commission_item_multipliers` — multiplicadores *(v3.2)*

### 6. Penalidades (4 tablas + 1 vista + 1 función)
- `penalty_types` — 18 tipos
- `penalty_equivalences` — equivalencias SSNN↔HC
- `hc_penalties` — registro histórico
- `penalty_imports` — historial importaciones

### 7. Presets Partidas (3 tablas + 2 vistas + 2 funciones)
- `partition_presets` — 25 presets (9 agrupaciones + 16 individuales)
- `partition_preset_ventas` — mapeo N:N preset↔tipo_venta
- `commission_item_ventas` — mapeo partida↔tipo_venta

### 8. Cuotas (3 tablas + 2 vistas + 6 funciones)
- `quota_imports` — importaciones de cuota Entel
- `store_quotas` — cuota dual Entel/SSNN por tienda
- `hc_quotas` — distribución a HC con prorrateo

### 9. Configuración (1 tabla)
- `system_config` — parámetros, tokens API, feature flags

### 10. RRHH (26 tablas) *(v3.0 + v3.1)*

**Core:**
- `usuarios_rrhh` — extensión 1:1 de usuarios (datos personales, bancarios, laborales, 9 estados)
- `usuarios_status_log` — historial de cambios de estado
- `ai_tasks` — log centralizado de tareas AI (**compartida entre módulos**)

**Reclutamiento:**
- `candidatos` — pipeline 9 etapas (CAPTACION→ALTA/DESCARTADO)
- `candidatos_etapas` — historial de movimiento por pipeline
- `candidatos_entrevistas` — entrevistas multi-nivel + scorecard + AI
- `candidatos_documentos` — repositorio de documentos del candidato

**Contratos:**
- `contratos` — historial con firma electrónica, 7 estados
- `renovacion_lotes` — ciclos mensuales de renovación
- `renovacion_decisiones` — decisiones JV→KAM→RRHH por colaborador

**Operativo:**
- `asistencia` — marcaciones GPS + selfie + anti-fraude 4 capas
- `apertura_cierre_tienda` — registro diario de apertura/cierre
- `horarios_tienda` — horarios base por día de semana
- `turnos` — catálogo (APERTURA, CIERRE, COMPLETO)
- `asignacion_turnos` — programación por colaborador/día
- `incidencias_laborales` — disciplinarias con flujo descargo/resolución
- `solicitudes_permiso` — permisos, vacaciones, licencias

**Gestión:**
- `movimientos_personal` — historial completo (ingresos, transferencias, ceses)
- `offboarding_checklist` — checklist adaptativo de salida
- `documentos_colaborador` — repositorio digital con OCR/AI
- `alertas_rrhh` — alertas contextuales automáticas (14 tipos, 3 niveles)

**Importación + Ampliación** *(migraciones 025/026, ya en BD):*
- `importaciones_rrhh` — wizard de importación inicial de colaboradores (Excel + mapeo AI, 7 estados) *(025)*
- `entrevistas_colaborador` — entrevistas del colaborador ya contratado *(026)*
- `historial_bancario` — historial de cuentas/CCI del colaborador *(026)*
- `historial_direcciones` — historial de domicilios *(026)*
- `historial_cambios_rrhh` — auditoría de cambios sobre datos RRHH *(026)*

> Nota: `usuarios_rrhh` fue ampliada a 46 columnas en la migración 026 (sistema pensionario, AFP/CUSPP, EPS/SCTR, educación, etc.).

---

## 12 ROLES (constraint en usuarios.rol)

```
ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR,
JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL,
BACKOFFICE_OPERACIONES, BACKOFFICE_RRHH, BACKOFFICE_AUDITORIA,
VALIDADOR_ARRIBOS, ADMIN
```

**Grupos para RLS:**

| Grupo | Roles | Uso típico |
|-------|-------|-----------|
| HC | ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR | Operación en tienda |
| Supervisión | COORDINADOR, SUPERVISOR, JEFE_VENTAS | Gestión operativa, turnos, incidencias |
| Jefatura | JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL | Visado, aprobaciones, reportes |
| Backoffice | BACKOFFICE_OPERACIONES, BACKOFFICE_RRHH, BACKOFFICE_AUDITORIA | Gestión administrativa |
| Gestión RRHH | BACKOFFICE_RRHH, ADMIN | CRUD completo módulo RRHH |
| Gestión completa | BACKOFFICE_RRHH, ADMIN, GERENTE_COMERCIAL, GERENTE_GENERAL, JEFE_VENTAS, SUPERVISOR | SELECT en datos RRHH |
| Visado renovación | JEFE_VENTAS (JV), GERENTE_COMERCIAL (KAM) | Flujo de renovación contratos |
| Admin | ADMIN | Acceso total |

---

## 18 TIPOS DE VENTA (tabla tipos_venta)

| Categoría | Códigos |
|-----------|---------|
| POSTPAGO (8) | OSS_BASE, OSS_CAPTURA, OPP_CAPTURA, OPP_BASE, VR_MONO, VR_CAPTURA, VR_BASE, MISS_IN |
| PACK (2) | PACK_VR, PACK_OPEN |
| PACK_SS (3) | PACK_OSS, PACK_VR_BASE, PACK_OPP_BASE |
| RENO (2) | RENO, RENO_LLAA |
| PREPAGO (2) | PREPAGO, PORTA_PP |
| OTROS (1) | ACCESORIOS |

**Conteo Múltiple (para comisiones):**
- PACK_OSS → PACKS + OSS
- PACK_VR_BASE → PACKS + VR_BASE
- PACK_OPP_BASE → PACKS + OPP_BASE
- RENO_LLAA → RENO + VR_BASE

### Detalle por Tipo

| Código | Nombre | Req. Cedente | Req. IMEI | Permite Seguro |
|--------|--------|--------------|-----------|----------------|
| **POSTPAGO** |||||
| OSS_BASE | Porta OSS - Base | ✅ | ❌ | ❌ |
| OSS_CAPTURA | Porta OSS - Captura | ✅ | ❌ | ❌ |
| OPP_CAPTURA | Porta OPP Captura | ✅ | ❌ | ❌ |
| OPP_BASE | Porta OPP LLAA | ✅ | ❌ | ❌ |
| VR_MONO | VR Mono | ❌ | ❌ | ❌ |
| VR_CAPTURA | VR Captura | ❌ | ❌ | ❌ |
| VR_BASE | VR LLAA | ❌ | ❌ | ❌ |
| MISS_IN | Miss In (Pre→Pos Entel) | ❌ | ❌ | ❌ |
| **PACK** |||||
| PACK_VR | Pack + VR Mono | ❌ | ✅ | ✅ |
| PACK_OPEN | Pack Open (Solo Equipo) | ❌ | ✅ | ✅ |
| **PACK_SS** |||||
| PACK_OSS | Pack Porta OSS | ✅ | ✅ | ✅ |
| PACK_VR_BASE | Pack VR | ❌ | ✅ | ✅ |
| PACK_OPP_BASE | Pack Porta OPP LLAA | ✅ | ✅ | ✅ |
| **RENO** |||||
| RENO | Renovación Equipo | ❌ | ✅ | ✅ |
| RENO_LLAA | Renovación + LLAA | ❌ | ✅ | ✅ |
| **PREPAGO** |||||
| PREPAGO | Venta Prepago | ❌ | ❌ | ❌ |
| PORTA_PP | Portabilidad Prepago | ✅ | ❌ | ❌ |
| **OTROS** |||||
| ACCESORIOS | Solo Accesorios | ❌ | ❌ | ❌ |

---

## ESTADOS DE VENTA (tabla ventas)

### Estado de la Venta (`estado`)
| Estado | Descripción |
|--------|-------------|
| `registrada` | Venta del día, aprobada automáticamente |
| `pendiente_aprobacion` | Venta rezagada, requiere aprobación |
| `aprobada` | Venta rezagada aprobada |
| `rechazada` | Venta rezagada rechazada |
| `anulada` | Venta anulada |

### Estado de Cruce INAR (`estado_cruce`)
| Estado | Descripción |
|--------|-------------|
| `PENDIENTE` | Sin procesar |
| `COINCIDE` | Datos coinciden con INAR |
| `DISCREPANCIA` | Diferencias con INAR |
| `NO_ENCONTRADO` | No existe en INAR |

---

## ESTADOS RRHH *(v3.0)*

### Estado del Colaborador (`usuarios_rrhh.status`)
```
CANDIDATO → EN_INDUCCION → EN_SOMBRA → PERIODO_PRUEBA → ACTIVO
                                                          ↓
                                            SUSPENDIDO / LICENCIA
                                                          ↓
                                                      PRE_CESE → CESADO
```

### Etapas del Pipeline (`candidatos.etapa_actual`)
```
CAPTACION → FILTRO_CV → ENTREVISTAS → CONSULTA_ENTEL → USUARIO_ENTEL → INDUCCION → SOMBRA → ALTA
     ↘          ↘           ↘              ↘                ↘             ↘          ↘
                                      DESCARTADO (desde cualquier etapa)
```

### Estado de Contrato (`contratos.estado`)
```
BORRADOR → ENVIADO → FIRMADO → VIGENTE → VENCIDO / NO_RENOVADO
                         ↘ CANCELADO
```

### Flujo de Renovación (`renovacion_lotes.estado`)
```
GENERADO → EN_VISADO_JV → EN_VISADO_KAM → LISTO_PARA_RRHH → EJECUTADO
```

---

## TIPOS DE DOCUMENTO

| Código | Nombre | Patrón |
|--------|--------|--------|
| DNI | DNI | 8 dígitos |
| CE | Carné Extranjería | 9 dígitos |
| RUC | RUC | 11 dígitos (10 o 20 + 9) |
| PASAPORTE | Pasaporte | 6-12 alfanumérico |
| PTP | PTP | 6-15 alfanumérico |

> **`ventas`** acepta DNI/CE/RUC/PASAPORTE/PTP. **`arribos`** acepta los mismos **+ `OTRO`** (texto no vacío) desde v3.1 (migración 029). json.pe solo autocompleta DNI y CE.

---

## OPERADORES CEDENTES (tabla operadores_cedentes)

| Código | Nombre |
|--------|--------|
| MOVISTAR | Movistar |
| CLARO | Claro |
| BITEL | Bitel |

---

## STACK TECNOLÓGICO

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Validación | Zod + react-hook-form |
| AI | Claude API (Sonnet/Opus) via ai_tasks |
| IDE | VS Code + Claude Code |

---

## CONVENCIONES

### Nomenclatura BD
- Tablas: español, snake_case, plural (`usuarios`, `ventas`)
- Columnas: snake_case (`usuario_id`, `created_at`)
- Vistas: prefijo `v_` o `vw_` (`v_inar_resumen_diario`, `vw_store_quotas_summary`)
- Funciones: snake_case descriptivo (`get_quota_period_summary`)

### Nomenclatura Código
- Variables/funciones: camelCase
- Tipos/interfaces: PascalCase (`VentaFormData`, `UsuarioRRHH`)
- Enums: UPPER_SNAKE_CASE como `as const`

---

## REGLAS DE INTEGRACIÓN

1. **NO hardcodear** roles ni tipos de venta — leer de BD
2. **Usar FK** a tablas existentes (`usuarios`, `tiendas`, `tipos_venta`)
3. **Reutilizar** función `trigger_set_updated_at()` para updated_at
4. **Seguir** los 12 roles del constraint (no crear nuevos)
5. **Mapear** nuevos tipos de comisión con `tipos_venta` existentes
6. **Extensión 1:1** — datos RRHH van en `usuarios_rrhh`, no en `usuarios` *(v3.0)*
7. **AI centralizado** — toda tarea AI se registra en `ai_tasks` con tipo, costo y resultado *(v3.0)*
8. **Storage organizado** — buckets RRHH: `rrhh-fotos`, `rrhh-cvs`, `rrhh-contratos`, `rrhh-documentos`, `rrhh-entrevistas`, `rrhh-asistencia`, `rrhh-incidencias` *(v3.0)*

---

## PATRÓN MIGRACIÓN SQL

```sql
-- Nueva tabla
CREATE TABLE IF NOT EXISTS nueva_tabla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id),
    tienda_id UUID REFERENCES tiendas(id),
    -- campos...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at (reutilizar función existente)
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON nueva_tabla
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- RLS con roles existentes
ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_name" ON nueva_tabla
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM usuarios 
                WHERE id = auth.uid() 
                AND rol IN ('ADMIN', 'GERENTE_COMERCIAL'))
    );
```

---

## GLOSARIO ESENCIAL

| Término | Significado |
|---------|-------------|
| **Operación TEX** ||
| TEX | Tienda Express |
| SSNN | Socio de Negocio (PBD) |
| HC | Personal Comercial (headcount) |
| BU | Boca de Urna (registro declarativo) |
| INAR | Base de líneas activadas de Entel |
| MEP | Seguro "Mi Equipo Protegido" |
| VEP | Venta a Plazos |
| **Tipos de venta** ||
| OSS | Portabilidad PostPago→PostPago |
| OPP | Portabilidad PrePago→PostPago |
| VR | Venta Regular |
| BASE | Cliente >30 días en Entel |
| CAPTURA | Cliente nuevo |
| LLAA | Línea Adicional |
| MONO | Línea única |
| PACK | Equipo vendido |
| RENO | Renovación |
| **Roles y gestión** ||
| JV | Jefe de Ventas (visa renovaciones por zona) |
| KAM | Key Account Manager (visa renovaciones global) |
| **RRHH** ||
| Pipeline | Flujo de reclutamiento (9 etapas) |
| Sombra | Período de entrenamiento en tienda con mentor |
| Offboarding | Proceso de salida del colaborador |
| RXH | Recibo por Honorarios |
| Visado | Proceso de aprobación JV→KAM para renovaciones |
| Lote | Conjunto mensual de renovaciones a procesar |

---

**Documentación completa:** `DATA_DICTIONARY.md` (v3.1) y `GRIDRETAIL_ARCHITECTURE.md`
