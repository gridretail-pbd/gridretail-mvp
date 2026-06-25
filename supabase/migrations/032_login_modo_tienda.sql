-- ============================================================
-- MIGRACIÓN 032: Login y Modo Tienda (dispositivos compartidos)
-- Fecha: 2026-06-24
-- Diseño: docs/SPEC_LOGIN_MODO_TIENDA.md v1.0 (Fase 0)
-- ------------------------------------------------------------
-- Introduce el modelo de autenticación de dos niveles:
--   Nivel 1: dispositivo enrolado a una tienda (tabla `dispositivos`)
--   Nivel 2: usuario que entra con PIN rápido (columnas PIN en `usuarios`)
-- + OTP de un solo uso (`otp_codes`) para enrolar/resetear el PIN.
--
-- GridRetail NO usa Supabase Auth: RLS deshabilitado en las tablas nuevas,
-- coherente con la migración 008_disable_rls_for_mvp.
-- Reutiliza `telefono_personal` de `usuarios_rrhh` para el envío de OTP
-- (no se agregan columnas a usuarios_rrhh).
-- ============================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1) dispositivos: equipos enrolados a una tienda (sesión larga)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispositivos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tienda_id     UUID NOT NULL REFERENCES tiendas(id),
    nombre        VARCHAR(100) NOT NULL,            -- ej: "Laptop Caja 1 - El Agustino"
    token_hash    VARCHAR(255) NOT NULL,            -- hash bcrypt del device_token
    enrolado_por  UUID NOT NULL REFERENCES usuarios(id),
    activo        BOOLEAN NOT NULL DEFAULT true,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_tienda
    ON dispositivos(tienda_id) WHERE activo;

DROP TRIGGER IF EXISTS set_updated_at ON dispositivos;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON dispositivos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE dispositivos DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2) usuarios: credencial de acceso rápido (PIN) + avatar del roster
-- ---------------------------------------------------------------------
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS pin_hash              VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pin_actualizado_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pin_intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pin_bloqueado_hasta   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS foto_url              TEXT;

-- ---------------------------------------------------------------------
-- 3) otp_codes: códigos OTP de un solo uso (enrolar/resetear PIN, step-up)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id),
    code_hash   VARCHAR(255) NOT NULL,
    proposito   VARCHAR(30) NOT NULL,                 -- ENROLAR_PIN | RESET_PIN | STEP_UP
    canal       VARCHAR(10) NOT NULL DEFAULT 'WHATSAPP', -- WHATSAPP | SMS
    vence_at    TIMESTAMPTZ NOT NULL,
    usado_at    TIMESTAMPTZ,
    intentos    SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT otp_codes_proposito_check
        CHECK (proposito IN ('ENROLAR_PIN', 'RESET_PIN', 'STEP_UP')),
    CONSTRAINT otp_codes_canal_check
        CHECK (canal IN ('WHATSAPP', 'SMS'))
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_usuario
    ON otp_codes(usuario_id, proposito) WHERE usado_at IS NULL;

ALTER TABLE otp_codes DISABLE ROW LEVEL SECURITY;

COMMIT;
