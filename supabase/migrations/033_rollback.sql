-- ============================================================
-- ROLLBACK de la MIGRACIÓN 033 (desacople usuarios_rrhh)
-- ------------------------------------------------------------
-- Revierte usuarios_rrhh a PK compartida con usuarios y devuelve las FKs
-- de dominio-persona a usuarios(id) con su ON DELETE original.
-- Posible sin pérdida porque la 033 NO regeneró usuarios_rrhh.id
-- (sigue == usuarios.id para todas las fichas que tenían cuenta).
--
-- PRECONDICIÓN: no debe existir personal solo-RRHH creado tras la 033
-- (filas de usuarios_rrhh con usuario_id NULL, o cuya id no exista en
-- usuarios). Si las hay, este rollback fallará al re-crear el FK del PK;
-- limpiarlas o migrar su id antes.
-- ============================================================
BEGIN;

-- 1) Devolver las FKs de dominio-persona a usuarios(id)
ALTER TABLE contratos DROP CONSTRAINT IF EXISTS contratos_usuario_id_fkey;
ALTER TABLE contratos ADD CONSTRAINT contratos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE movimientos_personal DROP CONSTRAINT IF EXISTS movimientos_personal_usuario_id_fkey;
ALTER TABLE movimientos_personal ADD CONSTRAINT movimientos_personal_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

-- usuarios_status_log: restaurar ON DELETE CASCADE original
ALTER TABLE usuarios_status_log DROP CONSTRAINT IF EXISTS usuarios_status_log_usuario_id_fkey;
ALTER TABLE usuarios_status_log ADD CONSTRAINT usuarios_status_log_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS asistencia_usuario_id_fkey;
ALTER TABLE asistencia ADD CONSTRAINT asistencia_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE asignacion_turnos DROP CONSTRAINT IF EXISTS asignacion_turnos_usuario_id_fkey;
ALTER TABLE asignacion_turnos ADD CONSTRAINT asignacion_turnos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE incidencias_laborales DROP CONSTRAINT IF EXISTS incidencias_laborales_usuario_id_fkey;
ALTER TABLE incidencias_laborales ADD CONSTRAINT incidencias_laborales_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE solicitudes_permiso DROP CONSTRAINT IF EXISTS solicitudes_permiso_usuario_id_fkey;
ALTER TABLE solicitudes_permiso ADD CONSTRAINT solicitudes_permiso_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE offboarding_checklist DROP CONSTRAINT IF EXISTS offboarding_checklist_usuario_id_fkey;
ALTER TABLE offboarding_checklist ADD CONSTRAINT offboarding_checklist_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE documentos_colaborador DROP CONSTRAINT IF EXISTS documentos_colaborador_usuario_id_fkey;
ALTER TABLE documentos_colaborador ADD CONSTRAINT documentos_colaborador_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE renovacion_decisiones DROP CONSTRAINT IF EXISTS renovacion_decisiones_usuario_id_fkey;
ALTER TABLE renovacion_decisiones ADD CONSTRAINT renovacion_decisiones_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

-- 2) Restaurar usuarios_rrhh a PK compartida con usuarios
ALTER TABLE usuarios_rrhh DROP CONSTRAINT IF EXISTS usuarios_rrhh_usuario_id_key;
DROP INDEX IF EXISTS uq_usuarios_rrhh_dni;
ALTER TABLE usuarios_rrhh DROP CONSTRAINT IF EXISTS usuarios_rrhh_usuario_id_fkey;
ALTER TABLE usuarios_rrhh ALTER COLUMN id DROP DEFAULT;
ALTER TABLE usuarios_rrhh
  ADD CONSTRAINT usuarios_rrhh_id_fkey
  FOREIGN KEY (id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE usuarios_rrhh
  DROP COLUMN IF EXISTS usuario_id,
  DROP COLUMN IF EXISTS nombre_completo,
  DROP COLUMN IF EXISTS dni,
  DROP COLUMN IF EXISTS codigo_asesor;

COMMIT;
