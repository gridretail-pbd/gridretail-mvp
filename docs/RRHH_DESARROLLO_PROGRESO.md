# Módulo RRHH — Progreso de Desarrollo
## GridRetail

**Última actualización:** 2026-02-16
**Para:** Claude Code — Retomar desarrollo en nueva conversación
**Prerrequisito:** Adjuntar este archivo + `SPEC_MODULO_RRHH.md` + `SPEC_RRHH_MIGRACION_FUNDACIONAL.md`

---

## ESTADO GENERAL

| Fase | Descripción | Estado |
|------|-------------|--------|
| **Fase 1** | Fundación (types, schemas, utils, layout, dashboard) | **COMPLETADA** |
| **Fase 2** | Ficha del Colaborador (CRUD usuarios_rrhh) | **COMPLETADA** |
| **Fase 3** | Reclutamiento (Pipeline Kanban, captación, entrevistas) | **COMPLETADA** |
| **Fase 4** | Contratos (Lista, renovación con visado JV/KAM) | **COMPLETADA** |
| **Fase 5** | Operativo (Asistencia, horarios, incidencias, permisos) | **COMPLETADA** |
| **Fase 6** | Gestión (Movimientos, offboarding, alertas, dashboard métricas) | **COMPLETADA** |
| **Fase 7A** | Importación Inicial — Foundation (types, interfaces, schemas, migration, layout) | **COMPLETADA** |
| **Fase 7B** | Importación Inicial — Upload + Análisis + Mapeo (Wizard Steps 1-3) | **COMPLETADA** |
| **Fase 7C** | Importación Inicial — Validación + Revisión + Inserción (Wizard Steps 4-6) | **COMPLETADA** |

---

## FASE 1 — COMPLETADA (2026-02-16)

### Archivos creados

#### Capa de datos (`lib/rrhh/`)

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/types.ts` | 30+ enums `as const` con types derivados. Incluye `_LABELS` y `_COLORS` para UI. Cubre: `UsuarioStatus`, `EtapaPipeline`, `FuenteCaptacion`, `TipoContrato`, `EstadoContrato`, `EstadoLote`, `DecisionJV/KAM`, `TipoMarcacion`, `EstadoAsistencia`, `TipoIncidencia`, `EstadoIncidencia`, `TipoPermiso`, `EstadoPermiso`, `TipoMovimiento`, `TipoSalida`, `TipoAlerta`, `NivelAlerta`, `TipoAITask`, `EstadoAITask`, `AreaFuncional`, `Genero`, `EstadoCivil` |
| `lib/rrhh/interfaces.ts` | 20+ interfaces mapeando 1:1 tablas BD. Incluye interfaces tipadas para JSONB: `CvDatosExtraidos`, `InduccionChecklist`, `ScorecardData`, `ScorecardCriterio`, `IndicadoresSnapshot`, `OffboardingTarea`. Relaciones opcionales para queries con join. |
| `lib/rrhh/schemas.ts` | Schemas Zod: `candidatoCreateSchema`, `candidatoAvanzarEtapaSchema`, `candidatoDescartarSchema`, `entrevistaCreateSchema`, `entrevistaEvaluarSchema`, `contratoCreateSchema`, `renovacionVisadoJVSchema`, `renovacionVisadoKAMSchema`, `asistenciaMarcacionSchema`, `incidenciaCreateSchema`, `incidenciaDescargoSchema`, `permisoCreateSchema`, `permisoAprobarSchema`, `usuarioRRHHCreateSchema`, `movimientoCreateSchema`, `offboardingCreateSchema`. Incluye refinements condicionales. |

#### Utilidades (`lib/rrhh/utils/`)

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/utils/gps.ts` | `calcularDistanciaMetros()` (Haversine), `validarDentroRadio()`, `detectarViajeImposible()` (velocidad max 120km/h) |
| `lib/rrhh/utils/pipeline.ts` | `TRANSICIONES_VALIDAS` (mapa completo), `puedeAvanzar()`, `obtenerSiguientesEtapas()`, `esEtapaTerminal()`, `ETAPA_COLORES`, `ETAPA_LABELS`, `ETAPAS_KANBAN` (sin terminales), `ETAPA_ORDEN` |
| `lib/rrhh/utils/permisos-rrhh.ts` | 10 funciones: `puedeGestionarRRHH()`, `puedeVerDashboardRRHH()`, `puedeRegistrarIncidencia()`, `puedeVisarRenovacion()`, `puedeAprobarPermisos()`, `puedeAsignarTurnos()`, `puedeGestionarPipeline()`, `puedeVerPipeline()`, `puedeEntrevistarNivel1/2()`, `puedeVerAsistenciaEquipo()`, `puedeGestionarOffboarding()`, `tieneAccesoModuloRRHH()` |

#### UI (`app/(dashboard)/rrhh/`)

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/layout.tsx` | Sub-navegación horizontal con 11 secciones (Dashboard, Colaboradores, Reclutamiento, Contratos, Asistencia, Horarios, Incidencias, Permisos, Movimientos, Offboarding, Alertas). Items filtrados por rol (`requiereGestion` para RRHH/ADMIN only). Valida acceso al módulo. |
| `app/(dashboard)/rrhh/page.tsx` | Dashboard con 6 KPI cards consultando Supabase: HC Activo, Candidatos en Pipeline, Contratos por vencer (30d), Alertas pendientes, Incidencias del mes, Activos. Distribución por status con badges coloreados. Placeholders para secciones futuras. |

#### Modificación existente

| Archivo | Cambio |
|---------|--------|
| `components/layout/sidebar.tsx` | Nueva sección "RRHH" con item "Gestión RRHH" (`/rrhh`, icono `Briefcase`). Roles: ADMIN, GERENTE_GENERAL, GERENTE_COMERCIAL, JEFE_VENTAS, SUPERVISOR, COORDINADOR, BACKOFFICE_RRHH. Ubicada entre Comisiones y Administración. |

### Compilación

- **0 errores nuevos** introducidos por el módulo RRHH
- ~50 errores pre-existentes en módulo comisiones (MultiplierModal, simulador, mi-comision — react-hook-form resolver types y SimulationResult/V2 incompatibility). Sin relación con RRHH.

---

## FASE 2 — COMPLETADA (2026-02-16): Ficha del Colaborador

### Archivos creados

#### Capa de datos

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/queries/usuarios-rrhh.ts` | `fetchUsuariosRRHH()`, `fetchUsuarioRRHHById()`, `insertUsuarioRRHH()`, `updateUsuarioRRHH()`. Reciben `SupabaseClient`, joins con `usuarios` + `jefe_directo`. Filtros: status, area_funcional, search, jefe_directo_id. |
| `lib/rrhh/hooks/useUsuariosRRHH.ts` | `useUsuariosRRHH(filtros)` → lista con debounce. `useUsuarioRRHH(id)` → ficha individual. Ambos con loading, error, refetch. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/usuarios-rrhh/route.ts` | **GET** lista con filtros (status, area, search). **POST** crear ficha con validación Zod + verificación de usuario existente y no duplicado. |
| `app/api/rrhh/usuarios-rrhh/[id]/route.ts` | **GET** ficha individual con joins. **PATCH** actualización parcial con whitelist de campos permitidos. |

#### Páginas UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/colaboradores/page.tsx` | Lista de colaboradores con filtros (búsqueda, status, área funcional). Tabla con columnas: Nombre, DNI, Código, Rol, Status (badge), Área, Contrato, Ingreso, Acciones. Click en fila navega a ficha. Dropdown: Ver ficha, Editar (solo gestión). |
| `app/(dashboard)/rrhh/colaboradores/[id]/page.tsx` | Ficha individual con 4 tabs: Datos Laborales, Datos Personales, Contacto Emergencia, Bancarios/Operativo. Modo vista/edición toggle. Guardar detecta solo campos cambiados y envía PATCH. Toast con sonner. |

#### Modificaciones existentes

| Archivo | Cambio |
|---------|--------|
| `lib/rrhh/types.ts` | Agregados `GENERO_LABELS` y `ESTADO_CIVIL_LABELS` |
| `lib/rrhh/interfaces.ts` | Agregado campo `zona` a la relación `usuario` de `UsuarioRRHH` |

### Compilación

- **0 errores nuevos** introducidos
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

---

## FASE 3 — COMPLETADA (2026-02-16): Reclutamiento (Pipeline Kanban)

### Archivos creados

#### Capa de datos

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/queries/candidatos.ts` | `fetchCandidatos()`, `fetchCandidatoById()`, `insertCandidato()`, `updateCandidato()`, `avanzarEtapa()`, `descartarCandidato()`. Reciben `SupabaseClient`. Joins con `usuarios` (referido_por) + `tiendas` (destino). Detalle incluye joins con `candidatos_etapas`, `candidatos_entrevistas`, `candidatos_documentos`. Filtros: etapa_actual, fuente_captacion, descartado, search, tienda_destino_id. |
| `lib/rrhh/hooks/useCandidatos.ts` | `useCandidatos(filtros)` → lista con debounce. `useCandidato(id)` → detalle individual. Ambos con loading, error, refetch. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/candidatos/route.ts` | **GET** lista con filtros (etapa_actual, fuente, descartado, search). **POST** crear candidato con validación Zod + verificación DNI duplicado en activos + registro automático de primera etapa en historial. |
| `app/api/rrhh/candidatos/[id]/route.ts` | **GET** detalle con joins completos (etapas, entrevistas, documentos). **PATCH** actualización parcial con whitelist de campos permitidos (datos personales, Entel, inducción, sombra). |
| `app/api/rrhh/candidatos/[id]/avanzar/route.ts` | **POST** avanzar etapa. Valida transición con `puedeAvanzar()`, cierra etapa actual en historial, crea nueva entrada, actualiza candidato. |
| `app/api/rrhh/candidatos/[id]/descartar/route.ts` | **POST** descartar candidato. Cierra etapa actual, crea entrada DESCARTADO, marca candidato como descartado con motivo y fecha. |

#### Páginas UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/reclutamiento/page.tsx` | Vista Kanban con 7 columnas (CAPTACION → SOMBRA, sin terminales). Toggle Kanban/Lista. Filtros: búsqueda, fuente captación. Tarjetas con nombre, teléfono, días en pipeline, fuente, AI score. Acciones por tarjeta: ver detalle, avanzar etapa (con dialog de confirmación + notas), descartar (con dialog + motivo obligatorio). Role-based: solo `puedeGestionarPipeline()` ve acciones, `puedeVerPipeline()` requerido para acceder. |
| `app/(dashboard)/rrhh/reclutamiento/[id]/page.tsx` | Detalle del candidato con 4 tabs: Datos Personales (info + experiencia + pipeline), Historial Pipeline (timeline de etapas con resultados), Entrevistas (listado con scorecard visible), Datos de Etapa (Entel, Usuario Entel, Inducción, Sombra). Barra de progreso visual del pipeline. Botones de avanzar/descartar en header. Info de descarte resaltada si aplica. |
| `app/(dashboard)/rrhh/reclutamiento/nuevo/page.tsx` | Formulario de captación con 3 secciones: Datos Personales (DNI, nombre, teléfono, email, fecha nacimiento, género, distrito, dirección), Experiencia y Disponibilidad (checkbox telecom + detalle condicional, disponibilidad), Fuente de Captación (select + notas). Validación Zod client-side. Solo accesible con `puedeGestionarPipeline()`. |

### Compilación

- **0 errores nuevos** introducidos por Fase 3
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

---

## FASE 4 — COMPLETADA (2026-02-16): Contratos (Lista, renovación con visado JV/KAM)

### Archivos creados

#### Capa de datos

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/queries/contratos.ts` | `fetchContratos()`, `fetchContratoById()`, `insertContrato()`, `updateContrato()`, `fetchLotesRenovacion()`, `fetchLoteById()`, `insertLoteRenovacion()`, `avanzarEstadoLote()`, `visadoJV()`, `visadoKAM()`, `ejecutarDecision()`, `fetchDecisionesByLote()`. Reciben `SupabaseClient`. Joins con `usuarios` + `tiendas`. Creación de lote genera automáticamente decisiones para contratos que vencen en el periodo. Ejecutar decisión: RENOVAR crea nuevo contrato; NO_RENOVAR marca contrato como NO_RENOVADO. |
| `lib/rrhh/hooks/useContratos.ts` | `useContratos(filtros)` → lista con debounce (estado, tipo_contrato, usuario_id, search, proximos_a_vencer). `useContrato(id)` → detalle individual. Ambos con loading, error, refetch. |
| `lib/rrhh/hooks/useRenovacion.ts` | `useLotesRenovacion(filtros)` → lista de lotes con filtro por estado. `useLoteRenovacion(id)` → detalle de lote con decisiones. Ambos con loading, error, refetch. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/contratos/route.ts` | **GET** lista con filtros (estado, tipo_contrato, usuario_id, search, proximos_a_vencer). **POST** crear contrato con validación Zod + verificación de usuario y contrato activo duplicado. |
| `app/api/rrhh/contratos/[id]/route.ts` | **GET** detalle con joins. **PATCH** actualización parcial con whitelist de campos (tipo_contrato, fechas, cargo, remuneración, estado, firma electrónica). |
| `app/api/rrhh/renovacion/route.ts` | **GET** lista de lotes con filtro por estado. **POST** crear lote de renovación (valida periodo YYYY-MM, busca contratos vigentes que vencen, genera decisiones automáticamente). |
| `app/api/rrhh/renovacion/[loteId]/route.ts` | **GET** detalle del lote con decisiones y datos de usuario. |
| `app/api/rrhh/renovacion/[loteId]/avanzar/route.ts` | **POST** avanzar estado del lote (GENERADO→EN_VISADO_JV→EN_VISADO_KAM→LISTO_PARA_RRHH→EJECUTADO) con validación de transiciones. |
| `app/api/rrhh/renovacion/[loteId]/visado-jv/route.ts` | **POST** registrar visado JV con validación Zod. Verifica que decisión pertenece al lote. Opciones: RENOVAR, NO_RENOVAR, PENDIENTE_EVALUAR (motivo obligatorio si no renueva). |
| `app/api/rrhh/renovacion/[loteId]/visado-kam/route.ts` | **POST** registrar visado KAM con validación Zod. Verifica visado JV previo. Opciones: CONFIRMAR, REVERTIR (motivo obligatorio si revierte). |
| `app/api/rrhh/renovacion/[loteId]/ejecutar/route.ts` | **POST** ejecutar decisión final. RENOVAR → genera nuevo contrato (BORRADOR) con datos del anterior. NO_RENOVAR → marca contrato como NO_RENOVADO con motivo. |

#### Páginas UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/contratos/page.tsx` | Lista de contratos con filtros (búsqueda, estado, tipo contrato). Tabla con columnas: Colaborador, DNI, Tipo, Inicio, Fin, Estado (badge coloreado), Vencimiento (alerta si < 30 días). Botón a Lotes de Renovación para RRHH. Dropdown: Ver ficha colaborador. |
| `app/(dashboard)/rrhh/contratos/renovacion/page.tsx` | Lista de lotes de renovación con filtro por estado. Tabla: Periodo, Fecha Generación, Fecha Límite Visado, Colaboradores, Estado (badge coloreado). Dialog para generar nuevo lote (periodo + fecha límite). Navegación inteligente según rol (JV→visado-jv, KAM→visado-kam, RRHH→detalle). |
| `app/(dashboard)/rrhh/contratos/renovacion/[loteId]/page.tsx` | Vista RRHH del lote. 4 KPI cards (Total, Visado JV, Visado KAM, Ejecutados). Tabla de decisiones con columnas: Colaborador, DNI, Rol, Decisión JV, Decisión KAM, Decisión Final. Botón "Avanzar Estado" con validación (todos los visados completos). Botón "Ejecutar" por decisión cuando estado=LISTO_PARA_RRHH. Dialog de ejecución con select RENOVAR/NO_RENOVAR y resumen de decisiones previas. |
| `app/(dashboard)/rrhh/contratos/renovacion/[loteId]/visado-jv/page.tsx` | Vista para Jefe de Ventas. Sección Pendientes con botones Renovar/No Renovar/Evaluar por cada colaborador. Sección Completados con decisiones ya tomadas. Dialog de confirmación con campo de motivo (obligatorio si no renueva). Muestra AI resumen y recomendación si disponible. Role-guard con `puedeVisarRenovacion()`. |
| `app/(dashboard)/rrhh/contratos/renovacion/[loteId]/visado-kam/page.tsx` | Vista para KAM/Gerente Comercial. Solo muestra decisiones con visado JV completo. Botones Confirmar/Revertir por decisión. Muestra decisión y motivo del JV. Dialog con campo de motivo (obligatorio al revertir). Role-guard con `puedeVisarRenovacion()`. |

### Compilación

- **0 errores nuevos** introducidos por Fase 4
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

---

## FASE 5 — COMPLETADA (2026-02-16): Operativo (Asistencia, horarios, incidencias, permisos)

### Archivos creados

#### Capa de datos

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/queries/asistencia.ts` | `fetchAsistencia()`, `fetchAsistenciaById()`, `insertAsistencia()`, `updateAsistencia()`. Reciben `SupabaseClient`. Joins con `usuarios` + `tiendas`. Filtros: usuario_id, tienda_id, fecha, fecha_desde/hasta, estado, tipo, search. |
| `lib/rrhh/queries/horarios.ts` | `fetchHorariosTienda()`, `upsertHorarioTienda()`, `fetchTurnos()`, `fetchAsignacionTurnos()`, `insertAsignacionTurno()`, `insertAsignacionTurnosBulk()`, `updateAsignacionTurno()`, `deleteAsignacionTurno()`. Joins con `usuarios` + `tiendas` + `turnos`. |
| `lib/rrhh/queries/incidencias.ts` | `fetchIncidencias()`, `fetchIncidenciaById()`, `insertIncidencia()`, `updateIncidencia()`. Joins con `usuarios`. Filtros: usuario_id, tipo, estado, fecha_desde/hasta, search. |
| `lib/rrhh/queries/permisos.ts` | `fetchPermisos()`, `fetchPermisoById()`, `insertPermiso()`, `aprobarRechazarPermiso()`. Joins con `usuarios`. Filtros: usuario_id, tipo, estado, fecha_desde/hasta. |
| `lib/rrhh/hooks/useAsistencia.ts` | `useAsistencia(filtros)` → lista con loading, error, total, refetch. |
| `lib/rrhh/hooks/useHorarios.ts` | `useTurnos()` → catálogo de turnos. `useAsignacionTurnos(filtros)` → lista de asignaciones. |
| `lib/rrhh/hooks/useIncidencias.ts` | `useIncidencias(filtros)` → lista con loading, error, total, refetch. |
| `lib/rrhh/hooks/usePermisos.ts` | `usePermisos(filtros)` → lista con loading, error, total, refetch. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/asistencia/route.ts` | **GET** lista con filtros. **POST** marcación con validación GPS (radio 100m), detección mock location, cálculo distancia con Haversine. |
| `app/api/rrhh/asistencia/[id]/route.ts` | **GET** detalle. **PATCH** edición/justificación con whitelist de campos y timestamp de edición. |
| `app/api/rrhh/horarios/route.ts` | **GET** horarios base por tienda. **PUT** upsert horario (tienda_id + dia_semana). |
| `app/api/rrhh/horarios/turnos/route.ts` | **GET** catálogo de turnos activos. |
| `app/api/rrhh/horarios/asignacion/route.ts` | **GET** lista con filtros (tienda, usuario, rango fechas). **POST** asignar turno (single o bulk con upsert). |
| `app/api/rrhh/horarios/asignacion/[id]/route.ts` | **PATCH** modificar asignación. **DELETE** eliminar asignación. |
| `app/api/rrhh/incidencias/route.ts` | **GET** lista con filtros. **POST** crear incidencia con validación Zod + verificación usuario existente. |
| `app/api/rrhh/incidencias/[id]/route.ts` | **GET** detalle. **PATCH** descargo (auto-cambia estado a EN_DESCARGO), resolución (auto-cambia a RESUELTA). |
| `app/api/rrhh/permisos/route.ts` | **GET** lista con filtros. **POST** crear solicitud con validación Zod + verificación usuario. |
| `app/api/rrhh/permisos/[id]/route.ts` | **GET** detalle. **PATCH** aprobar/rechazar con validación Zod (motivo obligatorio al rechazar), solo actúa sobre estado PENDIENTE. |

#### Páginas UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/asistencia/page.tsx` | Vista consolidada de marcaciones por fecha. Filtros: fecha (date picker), búsqueda, estado. Tabla agrupa por usuario: Nombre, Tienda, Entrada, Salida, Estado (badge), Tardanza (minutos), GPS (OK/Fuera de radio). Dialog de edición para RRHH/ADMIN con campo de motivo. Role-guard: `puedeVerAsistenciaEquipo()`. |
| `app/(dashboard)/rrhh/horarios/page.tsx` | Programación semanal tipo grilla. Selector de tienda en header. Navegación por semana (anterior/siguiente/hoy). Filas = colaboradores, columnas = Lun-Dom. Celdas coloreadas por turno (Apertura=azul, Cierre=morado, Completo=verde) o "Descanso". Dialog de asignación (turno o descanso) para `puedeAsignarTurnos()`. Leyenda de turnos con horarios. |
| `app/(dashboard)/rrhh/incidencias/page.tsx` | Lista de incidencias con filtros: búsqueda, tipo, estado. Tabla: Colaborador, Tipo (badge coloreado), Fecha, Estado (badge), Descripción, Acciones. Botón "Nueva Incidencia" para `puedeRegistrarIncidencia()`. Dropdown: Registrar Descargo (dialog con textarea), Resolver (dialog con estado final + resolución) para gestión. |
| `app/(dashboard)/rrhh/incidencias/nueva/page.tsx` | Formulario de nueva incidencia. Buscador de colaborador con autocomplete (nombre/código/DNI). Select de tipo, fecha, descripción. Role-guard: `puedeRegistrarIncidencia()`. |
| `app/(dashboard)/rrhh/permisos/page.tsx` | Lista de solicitudes. Gestión ve todas, otros ven solo propias. Filtros: tipo, estado. Tabla: Colaborador (si gestión), Tipo (badge), Desde, Hasta, Motivo, Estado (badge), Acciones. Botones aprobar/rechazar (verde/rojo) inline para `puedeAprobarPermisos()` en solicitudes PENDIENTE. Dialog de rechazo con motivo obligatorio. |
| `app/(dashboard)/rrhh/permisos/nueva/page.tsx` | Formulario de nueva solicitud. Tipo, fechas (inicio/fin), horas solicitadas (condicional si PERMISO_HORAS), motivo. Cualquier usuario con acceso al módulo puede crear para sí mismo. Validación con `permisoCreateSchema`. |

#### Modificaciones existentes

| Archivo | Cambio |
|---------|--------|
| `lib/rrhh/types.ts` | Agregados: `ESTADO_ASISTENCIA_LABELS`, `TIPO_INCIDENCIA_COLORS`, `ESTADO_INCIDENCIA_LABELS`, `ESTADO_INCIDENCIA_COLORS`, `TIPO_PERMISO_COLORS`, `ESTADO_PERMISO_LABELS`, `ESTADO_PERMISO_COLORS`, `DIA_SEMANA_LABELS`, `DIA_SEMANA_SHORT` |

### Compilación

- **0 errores nuevos** introducidos por Fase 5
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

---

## FASE 6 — COMPLETADA (2026-02-16): Gestión (Movimientos, offboarding, alertas, dashboard)

### Archivos creados

#### Capa de datos

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/queries/movimientos.ts` | `fetchMovimientos()`, `fetchMovimientoById()`, `insertMovimiento()`. Reciben `SupabaseClient`. Joins con `usuarios` + `tienda_origen` + `tienda_destino`. Filtros: usuario_id, tipo_movimiento, fecha_desde/hasta, search. |
| `lib/rrhh/queries/offboarding.ts` | `fetchOffboardings()`, `fetchOffboardingById()`, `insertOffboarding()`, `updateOffboarding()`. Joins con `usuarios`. Filtros: estado, tipo_salida, search. |
| `lib/rrhh/queries/alertas.ts` | `fetchAlertas()`, `updateAlerta()`. Filtros: tipo, nivel, estado, destinatario_id, destinatario_rol, search. |
| `lib/rrhh/hooks/useMovimientos.ts` | `useMovimientos(filtros)` → lista con loading, error, total, refetch. |
| `lib/rrhh/hooks/useOffboarding.ts` | `useOffboardings(filtros)` → lista con loading, error, total, refetch. |
| `lib/rrhh/hooks/useAlertas.ts` | `useAlertas(filtros)` → lista con loading, error, total, refetch. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/movimientos/route.ts` | **GET** lista con filtros. **POST** crear movimiento con Zod + snapshot datos_anteriores automático (rol, zona, cargo, remuneración, tienda). |
| `app/api/rrhh/movimientos/[id]/route.ts` | **GET** detalle con joins. |
| `app/api/rrhh/offboarding/route.ts` | **GET** lista con filtros. **POST** crear offboarding con Zod + verificación no duplicado + auto-generación checklist por tipo_salida (6 plantillas: RENUNCIA, NO_RENOVACION, DESPIDO, ABANDONO, PERIODO_PRUEBA, MUTUO_ACUERDO). |
| `app/api/rrhh/offboarding/[id]/route.ts` | **GET** detalle. **PATCH** actualizar tareas (JSONB), estado, notas, fecha_cierre. |
| `app/api/rrhh/alertas/route.ts` | **GET** lista con filtros (tipo, nivel, estado, destinatario_id, destinatario_rol). |
| `app/api/rrhh/alertas/[id]/route.ts` | **PATCH** marcar leída (LEIDA + leida_at), accionar (ACCIONADA + accion_tomada + accion_por), descartar (DESCARTADA). |

#### Páginas UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/movimientos/page.tsx` | Lista de movimientos con filtros (búsqueda, tipo). Tabla: Colaborador, Tipo (badge coloreado), Fecha Efectiva, Tiendas (origen→destino), Motivo. Dialog para crear nuevo con buscador de colaborador autocomplete, select tipo, fecha, motivo. Role-guard: `puedeGestionarRRHH()`. |
| `app/(dashboard)/rrhh/offboarding/page.tsx` | Lista de offboardings con filtros (estado, tipo salida, búsqueda). Tabla: Colaborador, Tipo Salida (badge), Fecha Inicio, Estado (badge), Progreso (X/Y tareas). Botón "Ver" navega a detalle. Dialog para crear nuevo con buscador, select tipo salida, notas. Role-guard: `puedeGestionarOffboarding()`. |
| `app/(dashboard)/rrhh/offboarding/[id]/page.tsx` | Detalle con 2 columnas. Izquierda: checklist interactivo con checkboxes (toggle tarea completada, auto-save PATCH), barra de progreso visual. Derecha: info card (colaborador, tipo salida, fechas) + notas editables. Botón "Completar Offboarding" cuando todas las tareas están completadas. |
| `app/(dashboard)/rrhh/alertas/page.tsx` | Lista de alertas con filtros (nivel, estado, búsqueda). KPI cards para alertas críticas y warnings pendientes. Cards coloreadas por nivel (rojo/amarillo/azul). Acciones inline: marcar leída (ojo), accionar (dialog con texto), descartar. Muestra acción tomada si existe. |

#### Modificaciones existentes

| Archivo | Cambio |
|---------|--------|
| `lib/rrhh/types.ts` | Agregados: `TIPO_MOVIMIENTO_COLORS`, `TIPO_SALIDA_COLORS`, `ESTADO_OFFBOARDING` + LABELS + COLORS, `TIPO_ALERTA_LABELS`, `ESTADO_ALERTA` + LABELS + COLORS |
| `app/(dashboard)/rrhh/page.tsx` | Dashboard mejorado: 8 KPI cards (agregados Movimientos mes + Offboarding en proceso). Sección "Movimientos Recientes" (últimos 5) y "Offboardings Activos" reemplazan placeholders. Links a secciones. |

### Compilación

- **0 errores nuevos** introducidos por Fase 6
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

---

## FASE 7A — COMPLETADA (2026-02-16): Importación Inicial — Foundation

### Archivos creados

#### Migración SQL

| Archivo | Contenido |
|---------|-----------|
| `supabase/migrations/025_rrhh_importacion.sql` | CREATE TABLE `importaciones_rrhh` (30+ columnas, trigger updated_at, índices estado+fecha, RLS). ALTER TABLE `alertas_rrhh` ADD COLUMN `fecha_limite DATE` con índice parcial. INSERT `system_config` para `TENANT_CODIGO_ASESOR_PREFIX = 'PBD'`. |

#### Capa de datos

| Archivo | Contenido |
|---------|-----------|
| `lib/rrhh/queries/importacion.ts` | `fetchImportaciones()`, `fetchImportacionById()`, `insertImportacion()`, `updateImportacion()`. Reciben `SupabaseClient`. Join con `usuarios` (ejecutado_por). Filtros: estado, search. |
| `lib/rrhh/hooks/useImportacion.ts` | `useImportaciones(filtros)` → lista con loading, error, total, refetch. `useImportacion(id)` → detalle individual. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/importacion/route.ts` | **GET** lista con filtros (estado, search) + detalle individual por `?id=`. |

#### Modificaciones existentes

| Archivo | Cambio |
|---------|--------|
| `lib/rrhh/types.ts` | Agregados: `ESTADO_IMPORTACION` + LABELS + COLORS, `NIVEL_COMPLETITUD` + LABELS + COLORS, `MOTIVO_CESE` + LABELS. Modificados: `TIPO_ALERTA` (+5 nuevos: IMPORTACION_COMPLETADA, DATOS_INCOMPLETOS, ASIGNACION_PENDIENTE, DUPLICADO_DETECTADO, REFERENCIA_PENDIENTE + labels). `TIPO_AI_TASK` (+MAPEO_COLUMNAS_IMPORT). |
| `lib/rrhh/interfaces.ts` | Agregado `fecha_limite: string | null` a `AlertaRRHH`. 8 interfaces nuevas: `ImportacionRRHH`, `MapeoColumnas`, `MapeoColumna`, `ColumnaDetectada`, `AnalisisBrechas`, `CategoriaCompletitud`, `ReporteBrechas`, `DetalleFilaImportacion`. |
| `lib/rrhh/schemas.ts` | 3 schemas Zod: `importacionUploadSchema`, `importacionMapeoConfirmSchema`, `importacionEjecutarSchema` + types exportados. |
| `app/(dashboard)/rrhh/layout.tsx` | Item "Importación" (`/rrhh/importacion`, icono `Upload`, `requiereGestion: true`). Último en sub-nav. |

#### Dependencia instalada

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@anthropic-ai/sdk` | latest | AI column mapping (opcional, requiere `ANTHROPIC_API_KEY`) |

### Compilación

- **0 errores nuevos** introducidos por Fase 7A
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

### Pendiente para ejecutar manualmente

- Ejecutar `supabase/migrations/025_rrhh_importacion.sql` en Supabase Dashboard

---

## FASE 7B — COMPLETADA (2026-02-16): Upload + Análisis + Mapeo (Wizard Steps 1-3)

### Archivos creados

#### Capa de datos / tipos

| Archivo | Cambio |
|---------|--------|
| `lib/rrhh/types.ts` | Agregados: `CampoDestino` interface, `CAMPOS_DESTINO` (39 campos mapeables con tipo, label, tabla, requerido, enumValores), `FIELD_ALIASES` (mapeo heurístico de 39 campos con aliases comunes en español/inglés) |

#### Hooks del wizard

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/importacion/hooks/useWizardImportacion.ts` | `useWizardImportacion()` — useReducer con 6 steps, state machine completa (file, analisis, mapeos, validacion, resultado). 15+ actions: SET_FILE, SET_ANALISIS, SET_MAPEO, UPDATE_MAPEO, SET_VALIDACION, TOGGLE_FILA, SET_RESULTADO, RESET, etc. Export `WIZARD_STEPS` array y `WizardStepKey` type. |
| `app/(dashboard)/rrhh/importacion/hooks/useMapeoAI.ts` | `useMapeoAI()` — Hook para llamar POST `/api/rrhh/importacion/mapear`. Retorna `ejecutarMapeo(columnas, importacionId?)`, loading, error. |

#### Componentes UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/importacion/components/ProgressWizard.tsx` | Barra horizontal de 6 pasos con íconos check para completados, azul para actual, gris para pendientes. Líneas conectoras coloreadas por progreso. |
| `app/(dashboard)/rrhh/importacion/components/TablaPreview.tsx` | Tabla reusable de preview con scroll, números de fila, truncamiento de columnas y filas (maxFilas/maxColumnas). Indicador "+N más". |
| `app/(dashboard)/rrhh/importacion/components/StepSubida.tsx` | Paso 1: Dropzone drag-and-drop + input file. Validación extensión (.xlsx/.xls/.csv) y tamaño (≤10MB). Link "Descargar template de ejemplo". Preview del archivo seleccionado con tamaño. |
| `app/(dashboard)/rrhh/importacion/components/StepAnalisis.tsx` | Paso 2: 3 KPI cards (hojas, columnas, filas). Selector de hoja si múltiples. Grid de columnas detectadas con tipo (badge coloreado) y % llenado. Preview de datos con TablaPreview. |
| `app/(dashboard)/rrhh/importacion/components/ColumnaMapper.tsx` | Mapper individual: columna origen (nombre, tipo, % lleno, únicos) → Select destino agrupado por tabla (Usuarios, Datos RRHH, Tienda, Contrato, Cesado). Badge confianza coloreado. Previene duplicados de campos ya asignados. Valores muestra en desktop. |
| `app/(dashboard)/rrhh/importacion/components/StepMapeo.tsx` | Paso 3: 4 KPI cards (mapeados, sin mapear, campos vacíos, confianza AI). Warning de campos obligatorios sin mapear. Lista completa de ColumnaMapper por columna. Sección de campos destino sin dato (badges con indicador de requerido). Botón deshabilitado si faltan campos obligatorios. |

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/importacion/route.ts` | **MODIFICADO:** Agregados POST (crear importación con estado ANALIZADO) y PATCH (actualizar con whitelist de 20+ campos permitidos). |
| `app/api/rrhh/importacion/template/route.ts` | **GET:** Genera .xlsx dinámico con 3 hojas: "Colaboradores" (headers de CAMPOS_DESTINO), "Valores Válidos" (9 columnas: roles, tiendas del tenant, zonas, tipos contrato, áreas, géneros, estado civil, status, motivos cese), "Instrucciones" (guía de uso con prefijo del tenant). Tiendas y prefijo cargados dinámicamente de BD. |
| `app/api/rrhh/importacion/analizar/route.ts` | **POST:** Recibe FormData con archivo. Validación tipo/tamaño. Parsing con `xlsx` (cellDates: true). Auto-detección de fila de encabezados (mejores 5 filas por score de texto). Filtrado de filas vacías y subtotales. Inferencia de tipo por columna (texto, numero, fecha, booleano, email, telefono) con heurísticas para contexto peruano (DNI 8 dígitos, celular 9XX, serial Excel como fecha). Retorna: hojas, columnas_detectadas (con muestras, % lleno, únicos), preview_datos (10 filas). |
| `app/api/rrhh/importacion/mapear/route.ts` | **POST:** Dual mapping — 1) AI con `claude-haiku-4-5` si `AI_ANTHROPIC_API_KEY` disponible en system_config, registra en `ai_tasks`. 2) Fallback heurístico con `FIELD_ALIASES` + `string-similarity` fuzzy matching (threshold 40%). Retorna mapeos con confianza, columnas sin mapeo, campos sin dato, confianza promedio, método usado. Actualiza `importaciones_rrhh` si importacion_id proporcionado. |

#### Página principal

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/importacion/page.tsx` | Wizard principal con auth guard (`puedeGestionarRRHH`). Orquesta flujo: Step 0 (subida) → analyzeFile via POST → Step 1 (análisis) → mappingAPI via POST → Step 2 (mapeo manual) → confirmar → Steps 3-5 (placeholders Phase 7C). Crea registro `importaciones_rrhh` al analizar. Actualiza estado a MAPEADO al confirmar. |

### Dependencias instaladas

| Paquete | Versión | Uso |
|---------|---------|-----|
| `string-similarity` | ^4.0.4 | Fuzzy matching en mapeo heurístico de columnas |
| `@types/string-similarity` | — | Types para string-similarity |

### Decisiones implementadas

- **Wizard state:** `useReducer` con state machine (6 steps, 15+ actions)
- **AI Mapping:** Dual — Claude `haiku-4-5` si `AI_ANTHROPIC_API_KEY` en system_config, sino heurísticas (`FIELD_ALIASES` + fuzzy matching)
- **Excel parsing:** In-memory con `xlsx` (patrón INAR, agregando auto-detect header row y filtro subtotales)
- **Template:** 3 hojas dinámicas con `xlsx` (tiendas y prefijo cargados del tenant)
- **FileUploader:** Componente propio `StepSubida` (drag-and-drop + input, patrón similar a INAR pero integrado al wizard)
- **Mapeo confianza:** Verde ≥90%, Amarillo 60-89%, Rojo <60%. Campos obligatorios bloquean avance si no mapeados.

### Compilación

- **0 errores nuevos** introducidos por Fase 7B
- 50 errores pre-existentes en módulo comisiones (sin relación con RRHH)

---

## FASE 7C — COMPLETADA (2026-02-16): Validación + Revisión + Inserción (Wizard Steps 4-6)

### Archivos creados

#### API Routes

| Archivo | Contenido |
|---------|-----------|
| `app/api/rrhh/importacion/validar/route.ts` | **POST:** Re-parsea Excel completo con mapeos confirmados. Normalización inteligente de enums (ROL: "vendedor"→ASESOR, TIPO_CONTRATO: "plazo fijo"→PLAZO_FIJO, GENERO, ESTADO_CIVIL, AREA, STATUS, MOTIVO_CESE). Validaciones: DNI 8 dígitos + duplicados archivo + existencia BD, nombre obligatorio, rol válido, fecha_ingreso obligatoria, email formato, CCI 20 dígitos. Resolución de tiendas (exacto→parcial→contenido). Parsing fechas (DD/MM/YYYY, YYYY-MM-DD, serial Excel con heurística día>12). Detección automática activo/cesado con validación de contradicciones. Cálculo `NivelCompletitud` (COMPLETO/PARCIAL/MINIMO/INSUFICIENTE) por criterios diferenciados activo vs cesado. Genera `ReporteBrechas` con distribución, top campos faltantes, brechas por colaborador. Actualiza importación a estado VALIDADO. |
| `app/api/rrhh/importacion/ejecutar/route.ts` | **POST:** Recibe importacion_id + filas_incluidas + ejecutado_por. Inserta en orden: `usuarios` → `usuarios_rrhh` (upsert) → `usuarios_tiendas` (solo activos) → `contratos` (si hay datos contractuales, solo activos) → `movimientos_personal` (INGRESO o tipo cese) → `usuarios_status_log`. Manejo diferenciado cesados (activo=false, sin tienda, sin contrato, movimiento tipo cese). Auto-genera `codigo_asesor` con prefijo tenant + iniciales. Upsert si DNI existente. Alertas 3 capas: individuales (DATOS_INCOMPLETOS bancarios/emergencia, ASIGNACION_PENDIENTE sin tienda, CONTRATO_POR_VENCER ≤30 días) + resumen (IMPORTACION_COMPLETADA con totales). Actualiza importación a estado IMPORTADO con totales finales. Marca ERROR si falla transacción. |

#### Componentes UI

| Archivo | Contenido |
|---------|-----------|
| `app/(dashboard)/rrhh/importacion/components/StepValidacion.tsx` | Paso 4: 4 KPI cards (total, válidos, warnings, errores). Grid activos vs cesados. Distribución completitud con progress bars coloreadas por nivel. Top 8 campos más faltantes con barras proporcionales. Lista de filas con errores expandible (campo + mensaje). Resumen de importables (válidos + warnings). Botón bloqueado si 0 importables. |
| `app/(dashboard)/rrhh/importacion/components/StepRevision.tsx` | Paso 5: 3 KPI cards (incluidos, excluidos, con errores). Barra de búsqueda por nombre/DNI/fila. 3 filtros select (estado, completitud, tipo activo/cesado). Tabla interactiva con checkboxes include/exclude por fila. Icono estado por fila (check/warning/error). Badges completitud y tipo. Expandir fila muestra observaciones + datos mapeados. Select all/deselect con soporte parcial. Paginación (25 por página). Botón "Importar N colaboradores". |
| `app/(dashboard)/rrhh/importacion/components/StepResultado.tsx` | Paso 6: Header éxito con ícono check animado. 3 KPI cards grandes (procesados, nuevos, actualizados). Card desglose: activos, cesados, saltados, alertas generadas (badges coloreados). 3 botones de navegación: ir a colaboradores, revisar alertas, nueva importación. |

#### Modificaciones existentes

| Archivo | Cambio |
|---------|--------|
| `app/(dashboard)/rrhh/importacion/page.tsx` | **REESCRITO:** Reemplaza 3 placeholders de Phase 7C con componentes reales. Agrega handlers: `handleConfirmarMapeo` (guarda mapeo + llama validar), `handleEjecutar` (POST ejecutar con filas seleccionadas), `handleToggleFila`, `handleSetFilasIncluidas`. Importa StepValidacion, StepRevision, StepResultado. Oculta ProgressWizard en paso resultado. Usa `dispatch` directo + helpers del wizard hook. |

### Decisiones implementadas

- **Validación server-side:** El validar/ re-parsea el Excel completo (no solo preview) para asegurar consistencia
- **Normalización exhaustiva:** 7 mapas de normalización (rol, tipo_contrato, genero, estado_civil, area, status, motivo_cese) con variantes en español
- **Resolución de referencias:** Tiendas por nombre exacto → código → contenido parcial. Jefe directo pendiente para futura versión.
- **Completitud diferenciada:** Activos requieren datos core + bancarios + contractuales. Cesados solo core + personales parcial.
- **Inserción secuencial:** Una fila a la vez (no batch de 50) por simplicidad y manejo de errores granular
- **Alertas selectivas:** Solo para activos con situaciones accionables. Cesados solo van al reporte estático.
- **Componentes simplificados:** ResumenBrechas, DetalleColaborador y AlertasPreview se integraron directamente en StepValidacion y StepRevision en vez de ser componentes separados

### Compilación

- **0 errores nuevos** introducidos por Fase 7C
- 0 errores pre-existentes (resueltos previamente)

---

## DECISIONES TOMADAS

1. **No se crearon nuevos roles.** Se usan los 12 existentes del constraint de `usuarios`.
2. **Sub-navegación horizontal** en lugar de sidebar secundario (más limpio con el sidebar existente).
3. **Dashboard funcional** desde el inicio (consulta Supabase real, no placeholder estático).
4. **Un solo item en sidebar principal** ("Gestión RRHH") que lleva al módulo con su propia sub-nav interna.
5. **Types con labels y colors** integrados para evitar duplicación en componentes UI.

---

## NOTAS TÉCNICAS

### Estructura de carpetas actual del módulo

```
lib/rrhh/
├── types.ts              ✅
├── interfaces.ts         ✅
├── schemas.ts            ✅
├── utils/
│   ├── gps.ts            ✅
│   ├── pipeline.ts       ✅
│   └── permisos-rrhh.ts  ✅
├── queries/
│   ├── usuarios-rrhh.ts  ✅ (Fase 2)
│   ├── candidatos.ts     ✅ (Fase 3)
│   ├── contratos.ts      ✅ (Fase 4)
│   ├── asistencia.ts     ✅ (Fase 5)
│   ├── horarios.ts       ✅ (Fase 5)
│   ├── incidencias.ts    ✅ (Fase 5)
│   ├── permisos.ts       ✅ (Fase 5)
│   ├── movimientos.ts    ✅ (Fase 6)
│   ├── offboarding.ts    ✅ (Fase 6)
│   ├── alertas.ts        ✅ (Fase 6)
│   └── importacion.ts    ✅ (Fase 7A)
└── hooks/
    ├── useUsuariosRRHH.ts ✅ (Fase 2)
    ├── useCandidatos.ts   ✅ (Fase 3)
    ├── useContratos.ts    ✅ (Fase 4)
    ├── useRenovacion.ts   ✅ (Fase 4)
    ├── useAsistencia.ts   ✅ (Fase 5)
    ├── useHorarios.ts     ✅ (Fase 5)
    ├── useIncidencias.ts  ✅ (Fase 5)
    ├── usePermisos.ts     ✅ (Fase 5)
    ├── useMovimientos.ts  ✅ (Fase 6)
    ├── useOffboarding.ts  ✅ (Fase 6)
    ├── useAlertas.ts      ✅ (Fase 6)
    └── useImportacion.ts  ✅ (Fase 7A)

app/api/rrhh/
├── usuarios-rrhh/
│   ├── route.ts           ✅ (Fase 2)
│   └── [id]/route.ts      ✅ (Fase 2)
├── candidatos/
│   ├── route.ts           ✅ (Fase 3)
│   └── [id]/
│       ├── route.ts       ✅ (Fase 3)
│       ├── avanzar/route.ts   ✅ (Fase 3)
│       └── descartar/route.ts ✅ (Fase 3)
├── contratos/
│   ├── route.ts           ✅ (Fase 4)
│   └── [id]/route.ts      ✅ (Fase 4)
├── renovacion/
│   ├── route.ts           ✅ (Fase 4)
│   └── [loteId]/
│       ├── route.ts       ✅ (Fase 4)
│       ├── avanzar/route.ts   ✅ (Fase 4)
│       ├── visado-jv/route.ts ✅ (Fase 4)
│       ├── visado-kam/route.ts ✅ (Fase 4)
│       └── ejecutar/route.ts  ✅ (Fase 4)
├── asistencia/
│   ├── route.ts           ✅ (Fase 5)
│   └── [id]/route.ts      ✅ (Fase 5)
├── horarios/
│   ├── route.ts           ✅ (Fase 5)
│   ├── turnos/route.ts    ✅ (Fase 5)
│   └── asignacion/
│       ├── route.ts       ✅ (Fase 5)
│       └── [id]/route.ts  ✅ (Fase 5)
├── incidencias/
│   ├── route.ts           ✅ (Fase 5)
│   └── [id]/route.ts      ✅ (Fase 5)
├── permisos/
│   ├── route.ts           ✅ (Fase 5)
│   └── [id]/route.ts      ✅ (Fase 5)
├── movimientos/
│   ├── route.ts           ✅ (Fase 6)
│   └── [id]/route.ts      ✅ (Fase 6)
├── offboarding/
│   ├── route.ts           ✅ (Fase 6)
│   └── [id]/route.ts      ✅ (Fase 6)
├── alertas/
│   ├── route.ts           ✅ (Fase 6)
│   └── [id]/route.ts      ✅ (Fase 6)
└── importacion/
    ├── route.ts           ✅ (Fase 7A — lista + detalle + POST + PATCH)
    ├── analizar/route.ts  ✅ (Fase 7B — Excel parsing)
    ├── mapear/route.ts    ✅ (Fase 7B — AI + heuristic mapping)
    ├── template/route.ts  ✅ (Fase 7B — Dynamic xlsx template)
    ├── validar/route.ts   ✅ (Fase 7C — Row validation + gaps)
    └── ejecutar/route.ts  ✅ (Fase 7C — DB insert + alerts)

app/(dashboard)/rrhh/
├── layout.tsx            ✅
├── page.tsx              ✅ (dashboard)
├── colaboradores/
│   ├── page.tsx          ✅ (Fase 2)
│   └── [id]/page.tsx     ✅ (Fase 2)
├── reclutamiento/
│   ├── page.tsx          ✅ (Fase 3 — Kanban)
│   ├── nuevo/page.tsx    ✅ (Fase 3 — Formulario captación)
│   └── [id]/page.tsx     ✅ (Fase 3 — Detalle candidato)
├── contratos/
│   ├── page.tsx          ✅ (Fase 4 — Lista contratos)
│   └── renovacion/
│       ├── page.tsx      ✅ (Fase 4 — Lista lotes)
│       └── [loteId]/
│           ├── page.tsx      ✅ (Fase 4 — Detalle lote RRHH)
│           ├── visado-jv/page.tsx  ✅ (Fase 4 — Vista JV)
│           └── visado-kam/page.tsx ✅ (Fase 4 — Vista KAM)
├── asistencia/
│   └── page.tsx          ✅ (Fase 5 — Vista consolidada por fecha)
├── horarios/
│   └── page.tsx          ✅ (Fase 5 — Grilla semanal por tienda)
├── incidencias/
│   ├── page.tsx          ✅ (Fase 5 — Lista con filtros)
│   └── nueva/page.tsx    ✅ (Fase 5 — Formulario nueva incidencia)
├── permisos/
│   ├── page.tsx          ✅ (Fase 5 — Lista con aprobación)
│   └── nueva/page.tsx    ✅ (Fase 5 — Formulario nueva solicitud)
├── movimientos/
│   └── page.tsx          ✅ (Fase 6 — Lista + nuevo movimiento)
├── offboarding/
│   ├── page.tsx          ✅ (Fase 6 — Lista + nuevo offboarding)
│   └── [id]/page.tsx     ✅ (Fase 6 — Detalle con checklist interactivo)
├── alertas/
│   └── page.tsx          ✅ (Fase 6 — Lista con acciones)
└── importacion/
    ├── page.tsx              ✅ (Fase 7B+7C — Wizard 6 pasos completo)
    ├── hooks/
    │   ├── useWizardImportacion.ts ✅ (Fase 7B — State machine)
    │   └── useMapeoAI.ts          ✅ (Fase 7B — AI mapping hook)
    └── components/
        ├── ProgressWizard.tsx ✅ (Fase 7B)
        ├── TablaPreview.tsx   ✅ (Fase 7B)
        ├── StepSubida.tsx     ✅ (Fase 7B — Paso 1)
        ├── StepAnalisis.tsx   ✅ (Fase 7B — Paso 2)
        ├── ColumnaMapper.tsx  ✅ (Fase 7B)
        ├── StepMapeo.tsx      ✅ (Fase 7B — Paso 3)
        ├── StepValidacion.tsx ✅ (Fase 7C — Paso 4)
        ├── StepRevision.tsx   ✅ (Fase 7C — Paso 5)
        └── StepResultado.tsx  ✅ (Fase 7C — Paso 6)
```

### Migraciones SQL ejecutadas

| Migración | Tablas | Estado |
|-----------|--------|--------|
| `020_rrhh_core.sql` | usuarios_rrhh, usuarios_status_log, ai_tasks + ALTER tiendas | ✅ Ejecutada |
| `021_rrhh_reclutamiento.sql` | candidatos, candidatos_etapas, candidatos_entrevistas, candidatos_documentos | ✅ Ejecutada |
| `022_rrhh_contratos.sql` | contratos, renovacion_lotes, renovacion_decisiones | ✅ Ejecutada |
| `023_rrhh_operativo.sql` | asistencia, apertura_cierre_tienda, horarios_tienda, turnos, asignacion_turnos, incidencias_laborales, solicitudes_permiso | ✅ Ejecutada |
| `024_rrhh_gestion.sql` | movimientos_personal, offboarding_checklist, documentos_colaborador, alertas_rrhh | ✅ Ejecutada |
| `025_rrhh_importacion.sql` | importaciones_rrhh + ALTER alertas_rrhh (fecha_limite) + system_config | 🔲 Pendiente |

### Imports importantes para nuevos archivos

```typescript
// Supabase
import { createClient } from '@/lib/supabase/client'    // browser
import { createClient } from '@/lib/supabase/server'    // API routes

// Auth
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'

// RRHH types
import { USUARIO_STATUS, USUARIO_STATUS_LABELS, USUARIO_STATUS_COLORS } from '@/lib/rrhh/types'
import type { UsuarioStatus, EtapaPipeline } from '@/lib/rrhh/types'
import type { UsuarioRRHH, Candidato, Contrato } from '@/lib/rrhh/interfaces'
import { candidatoCreateSchema, type CandidatoCreateData } from '@/lib/rrhh/schemas'

// RRHH utils
import { puedeGestionarRRHH, puedeVerDashboardRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { ETAPA_LABELS, ETAPA_COLORES, puedeAvanzar } from '@/lib/rrhh/utils/pipeline'
import { validarDentroRadio } from '@/lib/rrhh/utils/gps'

// UI (shadcn)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Utility
import { cn } from '@/lib/utils'
```

---

## CÓMO RETOMAR

### Estado actual: Módulo RRHH v3.0 — COMPLETO (Fases 1-7)

Todas las 7 fases del módulo RRHH están implementadas. El módulo incluye:
- **Ficha del Colaborador** (CRUD completo)
- **Reclutamiento** (Pipeline Kanban 7 etapas)
- **Contratos** (Lista + Renovación con visado JV/KAM)
- **Operativo** (Asistencia GPS, Horarios grilla, Incidencias, Permisos)
- **Gestión** (Movimientos, Offboarding con checklist, Alertas)
- **Importación Inicial** (Wizard 6 pasos: subida → análisis → mapeo AI → validación → revisión → inserción + alertas 3 capas)

### Prerequisito pendiente

- **Ejecutar migración `025_rrhh_importacion.sql`** en Supabase Dashboard (tabla importaciones_rrhh + ALTER alertas_rrhh fecha_limite + system_config)

### Para continuar con mejoras o nuevas funcionalidades

1. Adjuntar: `RRHH_DESARROLLO_PROGRESO.md` + spec relevante
2. **Posibles siguientes pasos:**
   - Reporte Excel descargable de brechas (`/api/rrhh/importacion/reporte/`)
   - Edición inline en StepRevision (actualmente solo vista)
   - Manejo de duplicados con opción "actualizar vs saltar" interactivo
   - Resolución de jefe_directo_id por DNI o nombre fuzzy
