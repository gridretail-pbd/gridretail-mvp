-- ============================================================
-- MIGRACIÓN 033: Desacoplar usuarios_rrhh (persona) de usuarios (cuenta)
-- Fecha: 2026-06-24
-- Diseño: docs/SPEC_DESACOPLE_USUARIOS_RRHH.md / plan aprobado
-- ------------------------------------------------------------
-- Hoy `usuarios_rrhh.id` es PK y FK a usuarios(id) ON DELETE CASCADE
-- (1:1 con PK compartida). Esta migración convierte usuarios_rrhh en el
-- MAESTRO DE PERSONAL con identidad propia, capaz de existir sin cuenta
-- de login (personal solo-RRHH: limpieza, seguridad), y repunta las FKs
-- de dominio-persona a usuarios_rrhh(id).
--
-- IMPORTANTE:
--   * Ejecutar A MANO en el SQL Editor de Supabase (no hay migrate auto).
--   * Hacer SNAPSHOT/backup antes. Rollback en 033_rollback.sql.
--   * NO se regenera usuarios_rrhh.id: conserva su valor actual (= viejo
--     usuarios.id), lo que permite repuntar FKs sin reescribir datos.
--   * RLS permanece deshabilitado (auth propio).
-- ============================================================

-- ------------------------------------------------------------
-- PASO 0 (OPCIONAL, INFORMATIVO): contar fichas que se crearán por backfill.
-- Ejecutar ESTE SELECT primero y revisar. El backfill del PASO 2 las crea.
-- ------------------------------------------------------------
-- SELECT COUNT(*) AS fichas_a_crear FROM usuarios u
-- WHERE u.id IN (
--   SELECT usuario_id FROM contratos
--   UNION SELECT usuario_id FROM movimientos_personal
--   UNION SELECT usuario_id FROM usuarios_status_log
--   UNION SELECT usuario_id FROM asistencia
--   UNION SELECT usuario_id FROM asignacion_turnos
--   UNION SELECT usuario_id FROM incidencias_laborales
--   UNION SELECT usuario_id FROM solicitudes_permiso
--   UNION SELECT usuario_id FROM offboarding_checklist
--   UNION SELECT usuario_id FROM documentos_colaborador
--   UNION SELECT usuario_id FROM renovacion_decisiones
-- ) AND NOT EXISTS (SELECT 1 FROM usuarios_rrhh r WHERE r.id = u.id);

BEGIN;

-- ------------------------------------------------------------
-- PASO 1: usuarios_rrhh — PK propia + usuario_id + identidad propia
-- ------------------------------------------------------------

-- 1.1 Identidad propia de la persona (antes vivía solo en usuarios)
ALTER TABLE usuarios_rrhh
  ADD COLUMN IF NOT EXISTS usuario_id      UUID,
  ADD COLUMN IF NOT EXISTS nombre_completo VARCHAR(200),
  ADD COLUMN IF NOT EXISTS dni             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS codigo_asesor   VARCHAR(50);

-- 1.2 Backfill: la cuenta actual es el origen (hoy id == usuarios.id)
UPDATE usuarios_rrhh r
  SET usuario_id      = COALESCE(r.usuario_id, r.id),
      nombre_completo = COALESCE(r.nombre_completo, u.nombre_completo),
      dni             = COALESCE(r.dni, u.dni),
      codigo_asesor   = COALESCE(r.codigo_asesor, u.codigo_asesor)
  FROM usuarios u
  WHERE u.id = r.id;

-- 1.3 El PK propio (id) deja de depender de usuarios: soltar el FK viejo.
--     (El PRIMARY KEY usuarios_rrhh_pkey se conserva; solo se quita el FK.)
ALTER TABLE usuarios_rrhh DROP CONSTRAINT IF EXISTS usuarios_rrhh_id_fkey;

-- 1.4 id autogenerable para fichas nuevas creadas sin cuenta
ALTER TABLE usuarios_rrhh ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 1.5 Nueva FK: usuario_id -> usuarios, desvincula (no borra) al borrar cuenta
ALTER TABLE usuarios_rrhh
  ADD CONSTRAINT usuarios_rrhh_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 1.6 Unicidad: 1 cuenta = 1 ficha. SQL trata cada NULL como distinto, así que
--     un UNIQUE CONSTRAINT permite múltiples fichas sin cuenta (usuario_id NULL).
--     Se usa CONSTRAINT (no índice parcial) para que el upsert
--     ON CONFLICT(usuario_id) del importador resuelva correctamente.
ALTER TABLE usuarios_rrhh
  ADD CONSTRAINT usuarios_rrhh_usuario_id_key UNIQUE (usuario_id);
-- dni: índice parcial (no se hace upsert por dni; permite NULL múltiples)
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_rrhh_dni
  ON usuarios_rrhh(dni) WHERE dni IS NOT NULL;

-- ------------------------------------------------------------
-- PASO 2: Backfill de fichas faltantes (para no romper los FK repuntados)
-- Cualquier usuario referenciado por una tabla-persona que aún no tenga
-- ficha recibe una ficha mínima (conserva su historial).
-- ------------------------------------------------------------
INSERT INTO usuarios_rrhh (id, usuario_id, nombre_completo, dni, codigo_asesor, fecha_ingreso, status)
SELECT u.id, u.id, u.nombre_completo, u.dni, u.codigo_asesor,
       COALESCE(u.created_at::date, CURRENT_DATE), 'ACTIVO'
FROM usuarios u
WHERE u.id IN (
  SELECT usuario_id FROM contratos
  UNION SELECT usuario_id FROM movimientos_personal
  UNION SELECT usuario_id FROM usuarios_status_log
  UNION SELECT usuario_id FROM asistencia
  UNION SELECT usuario_id FROM asignacion_turnos
  UNION SELECT usuario_id FROM incidencias_laborales
  UNION SELECT usuario_id FROM solicitudes_permiso
  UNION SELECT usuario_id FROM offboarding_checklist
  UNION SELECT usuario_id FROM documentos_colaborador
  UNION SELECT usuario_id FROM renovacion_decisiones
)
AND NOT EXISTS (SELECT 1 FROM usuarios_rrhh r WHERE r.id = u.id);

-- ------------------------------------------------------------
-- PASO 3: Repuntar FKs de dominio-persona a usuarios_rrhh(id) (RESTRICT)
-- Reusa el mismo nombre de constraint <tabla>_usuario_id_fkey.
-- ------------------------------------------------------------

ALTER TABLE contratos DROP CONSTRAINT IF EXISTS contratos_usuario_id_fkey;
ALTER TABLE contratos ADD CONSTRAINT contratos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE movimientos_personal DROP CONSTRAINT IF EXISTS movimientos_personal_usuario_id_fkey;
ALTER TABLE movimientos_personal ADD CONSTRAINT movimientos_personal_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

-- usuarios_status_log: hoy ON DELETE CASCADE -> pasa a RESTRICT
ALTER TABLE usuarios_status_log DROP CONSTRAINT IF EXISTS usuarios_status_log_usuario_id_fkey;
ALTER TABLE usuarios_status_log ADD CONSTRAINT usuarios_status_log_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_usuario_id_fkey;
ALTER TABLE asistencia ADD CONSTRAINT asistencia_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE asignacion_turnos DROP CONSTRAINT IF EXISTS asignacion_turnos_usuario_id_fkey;
ALTER TABLE asignacion_turnos ADD CONSTRAINT asignacion_turnos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE incidencias_laborales DROP CONSTRAINT IF EXISTS incidencias_laborales_usuario_id_fkey;
ALTER TABLE incidencias_laborales ADD CONSTRAINT incidencias_laborales_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE solicitudes_permiso DROP CONSTRAINT IF EXISTS solicitudes_permiso_usuario_id_fkey;
ALTER TABLE solicitudes_permiso ADD CONSTRAINT solicitudes_permiso_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE offboarding_checklist DROP CONSTRAINT IF EXISTS offboarding_checklist_usuario_id_fkey;
ALTER TABLE offboarding_checklist ADD CONSTRAINT offboarding_checklist_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE documentos_colaborador DROP CONSTRAINT IF EXISTS documentos_colaborador_usuario_id_fkey;
ALTER TABLE documentos_colaborador ADD CONSTRAINT documentos_colaborador_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

ALTER TABLE renovacion_decisiones DROP CONSTRAINT IF EXISTS renovacion_decisiones_usuario_id_fkey;
ALTER TABLE renovacion_decisiones ADD CONSTRAINT renovacion_decisiones_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios_rrhh(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------
-- NOTA: NO se tocan (siguen apuntando a usuarios = cuenta/auditoría/comercial):
--   ventas/arribos/lineas_inar/hc_quotas/commission_hc_assignments/
--   hc_penalties/asesor_incidencias, todas las *_por / *_by / registrado_por /
--   autorizado_por / aprobado_por / decision_jv_id / decision_kam_id /
--   generado_por / enrolado_por / subido_por / entrevistador_id, y
--   usuarios_rrhh.jefe_directo_id, candidatos.usuario_generado_id.
-- ------------------------------------------------------------

COMMIT;

-- ------------------------------------------------------------
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar tras COMMIT; todo debe dar 0)
-- ------------------------------------------------------------
-- SELECT 'contratos' t, COUNT(*) FROM contratos c LEFT JOIN usuarios_rrhh r ON r.id=c.usuario_id WHERE r.id IS NULL
-- UNION ALL SELECT 'asistencia', COUNT(*) FROM asistencia a LEFT JOIN usuarios_rrhh r ON r.id=a.usuario_id WHERE r.id IS NULL
-- UNION ALL SELECT 'movimientos_personal', COUNT(*) FROM movimientos_personal m LEFT JOIN usuarios_rrhh r ON r.id=m.usuario_id WHERE r.id IS NULL;
