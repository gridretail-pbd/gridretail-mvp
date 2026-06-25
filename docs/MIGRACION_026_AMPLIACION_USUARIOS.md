# GridRetail — Migración: Ampliación usuarios_rrhh + Tablas de Historial
## Propuesta Técnica

**Versión:** 1.0  
**Fecha:** 2026-02-17  
**Migración:** `026_rrhh_ampliacion_usuarios.sql`  
**Dependencia:** `024_rrhh_gestion.sql` (ejecutada), `025_rrhh_importacion.sql` (pendiente)

---

## RESUMEN DE CAMBIOS

| Objeto | Tipo | Descripción |
|--------|------|-------------|
| `usuarios_rrhh` | ALTER TABLE | +15 columnas nuevas con CHECK constraints |
| `historial_bancario` | CREATE TABLE | Historial de datos bancarios (grupo) |
| `historial_direcciones` | CREATE TABLE | Historial de direcciones (grupo) |
| `historial_cambios_rrhh` | CREATE TABLE | Historial genérico (teléfono, remuneración, jefe, cargo) |
| `entrevistas_colaborador` | CREATE TABLE | Exit interviews (extensible a futuro) |

**Total:** 15 columnas nuevas + 4 tablas nuevas

---

## 1. ALTER TABLE: usuarios_rrhh (+15 columnas)

### 1.1 Seguridad Social y Tributario (8 campos)

| Campo | Tipo | Nullable | Default | CHECK | Descripción |
|-------|------|----------|---------|-------|-------------|
| `sistema_pensionario` | VARCHAR(10) | YES | — | AFP, ONP | Sistema de pensiones |
| `afp_nombre` | VARCHAR(50) | YES | — | — | Nombre de la AFP (Integra, Prima, Habitat, Profuturo) |
| `cuspp` | VARCHAR(20) | YES | — | — | Código Único del SPP. Formato: XXX-XXXXXXXX-X |
| `eps_nombre` | VARCHAR(50) | YES | — | — | EPS contratada (Rímac, Pacífico, Mapfre, Sanitas, etc.) |
| `tiene_sctr` | BOOLEAN | YES | false | — | Seguro Complementario de Trabajo de Riesgo |
| `asignacion_familiar` | BOOLEAN | YES | false | — | Percibe asignación familiar (10% RMV) |
| `numero_dependientes` | INTEGER | YES | — | ≥ 0 | Dependientes declarados |
| `numero_hijos` | INTEGER | YES | — | ≥ 0 | Hijos (base para asignación familiar) |

### 1.2 Identificación Adicional (4 campos)

| Campo | Tipo | Nullable | Default | CHECK | Descripción |
|-------|------|----------|---------|-------|-------------|
| `tipo_documento` | VARCHAR(15) | YES | 'DNI' | DNI, CE, PASAPORTE, PTP | Tipo de documento de identidad |
| `lugar_nacimiento` | VARCHAR(100) | YES | — | — | Ciudad/departamento de nacimiento |
| `nacionalidad` | VARCHAR(50) | YES | 'PERUANA' | — | Sin CHECK (hay muchas nacionalidades) |
| `ruc` | VARCHAR(11) | YES | — | — | RUC personal. Relevante para contratos RxH |

### 1.3 Educación (2 campos)

| Campo | Tipo | Nullable | Default | CHECK | Descripción |
|-------|------|----------|---------|-------|-------------|
| `nivel_educativo` | VARCHAR(30) | YES | — | 7 valores | Nivel máximo alcanzado |
| `profesion_carrera` | VARCHAR(100) | YES | — | — | Carrera o profesión (texto libre) |

### 1.4 Salud (1 campo)

| Campo | Tipo | Nullable | Default | CHECK | Descripción |
|-------|------|----------|---------|-------|-------------|
| `grupo_sanguineo` | VARCHAR(5) | YES | — | 8 valores | Grupo sanguíneo y factor Rh |

---

## 2. TABLAS DE HISTORIAL (Modelo Híbrido)

### Principio de diseño

`usuarios_rrhh` siempre tiene el **valor vigente** (para queries rápidas). Las tablas de historial registran cada cambio con rango de fechas. Al actualizar un dato vigente, se cierra el registro anterior (`fecha_hasta = hoy`) y se abre uno nuevo.

### 2.1 `historial_bancario` — Datos que cambian como grupo

```
Columnas: banco + numero_cuenta + cci (siempre cambian juntos)
```

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | UUID | NO | PK |
| `usuario_id` | UUID | NO | FK → usuarios.id |
| `banco` | VARCHAR(100) | NO | Entidad bancaria |
| `numero_cuenta` | VARCHAR(50) | NO | Número de cuenta |
| `cci` | VARCHAR(25) | YES | Código interbancario (puede no tenerse) |
| `fecha_desde` | DATE | NO | Inicio de vigencia |
| `fecha_hasta` | DATE | YES | Fin de vigencia (NULL = vigente) |
| `motivo_cambio` | TEXT | YES | Razón del cambio |
| `registrado_por` | UUID | NO | FK → usuarios.id (quién registró) |
| `created_at` | TIMESTAMPTZ | NO | Fecha creación |

**Regla:** Solo puede haber UN registro con `fecha_hasta IS NULL` por usuario (el vigente).

### 2.2 `historial_direcciones` — Datos que cambian como grupo

```
Columnas: direccion + distrito + gps (siempre cambian juntos)
```

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | UUID | NO | PK |
| `usuario_id` | UUID | NO | FK → usuarios.id |
| `direccion_domiciliaria` | TEXT | NO | Dirección completa |
| `distrito_residencia` | VARCHAR(100) | YES | Distrito |
| `gps_domicilio_lat` | NUMERIC(10,7) | YES | Latitud |
| `gps_domicilio_lng` | NUMERIC(10,7) | YES | Longitud |
| `fecha_desde` | DATE | NO | Inicio de vigencia |
| `fecha_hasta` | DATE | YES | Fin de vigencia (NULL = vigente) |
| `motivo_cambio` | TEXT | YES | Razón del cambio (mudanza, etc.) |
| `registrado_por` | UUID | NO | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | Fecha creación |

### 2.3 `historial_cambios_rrhh` — Cambios de campos individuales

```
Campos individuales: teléfono, remuneración, jefe_directo, cargo
(y cualquier campo futuro sin crear tabla nueva)
```

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | UUID | NO | PK |
| `usuario_id` | UUID | NO | FK → usuarios.id |
| `campo` | VARCHAR(50) | NO | Nombre del campo cambiado |
| `valor_anterior` | TEXT | YES | Valor antes del cambio (NULL si es primera vez) |
| `valor_nuevo` | TEXT | NO | Valor nuevo |
| `fecha_cambio` | DATE | NO | Fecha efectiva del cambio |
| `motivo` | TEXT | YES | Razón del cambio |
| `registrado_por` | UUID | NO | FK → usuarios.id |
| `created_at` | TIMESTAMPTZ | NO | Fecha creación |

**Campos cubiertos (CHECK constraint en `campo`):**

| Valor de `campo` | Ejemplo `valor_anterior` → `valor_nuevo` |
|-------------------|------------------------------------------|
| `TELEFONO_PERSONAL` | '987654321' → '912345678' |
| `REMUNERACION` | '1130.00' → '1500.00' |
| `JEFE_DIRECTO` | 'uuid-jefe-anterior' → 'uuid-jefe-nuevo' |
| `CARGO_FORMAL` | 'Asesor de Ventas' → 'Coordinador' |

---

## 3. ENTREVISTAS DE COLABORADOR

### 3.1 `entrevistas_colaborador`

Tabla para registrar entrevistas a colaboradores activos o en proceso de salida. Actualmente solo **exit interviews**; se extenderá con el módulo de Capacitación para feedback de desempeño, retención y amonestaciones.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | UUID | NO | PK |
| `usuario_id` | UUID | NO | FK → usuarios.id (entrevistado) |
| `tipo` | VARCHAR(30) | NO | Tipo de entrevista (CHECK) |
| `entrevistador_id` | UUID | NO | FK → usuarios.id |
| `fecha` | DATE | NO | Fecha de la entrevista |
| `motivo` | TEXT | YES | Razón o contexto |
| `notas` | TEXT | YES | Notas libres del entrevistador |
| `datos_estructurados` | JSONB | YES | Scorecard, preguntas/respuestas, métricas |
| `resultado` | VARCHAR(20) | YES | Resultado/conclusión (CHECK) |
| `grabacion_url` | TEXT | YES | URL al archivo de audio/video |
| `transcripcion_url` | TEXT | YES | URL a transcripción |
| `ai_task_id` | UUID | YES | FK → ai_tasks.id (análisis AI) |
| `ai_resumen` | TEXT | YES | Resumen generado por AI |
| `movimiento_id` | UUID | YES | FK → movimientos_personal.id (si vinculada a offboarding) |
| `es_confidencial` | BOOLEAN | NO | Default: false |
| `created_at` | TIMESTAMPTZ | NO | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | Fecha actualización |

**Tipos de entrevista (CHECK):**

| Tipo | Disponible ahora | Descripción |
|------|-------------------|-------------|
| `EXIT_INTERVIEW` | ✅ | Entrevista de salida |
| `FEEDBACK_DESEMPENO` | 🔮 Futuro (Capacitación) | Evaluación por supervisor |
| `RETENCION` | 🔮 Futuro (Capacitación) | Cuando hay riesgo de fuga |
| `AMONESTACION_VERBAL` | 🔮 Futuro (Capacitación) | Amonestación documentada |

**Resultados de exit interview:**

| Resultado | Descripción |
|-----------|-------------|
| `SATISFACTORIA` | Salida en buenos términos, feedback útil |
| `CON_OBSERVACIONES` | Hay temas a mejorar identificados |
| `NO_REALIZADA` | No se pudo hacer (abandono, no quiso) |

**Relación con offboarding:** El campo `movimiento_id` vincula la exit interview al movimiento de cese correspondiente, lo que permite que desde offboarding se vea si ya se hizo la entrevista de salida.

---

## 4. SQL DE MIGRACIÓN COMPLETO

```sql
-- =====================================================
-- 026_rrhh_ampliacion_usuarios.sql
-- Ampliación de usuarios_rrhh + tablas de historial
-- Dependencia: 024_rrhh_gestion.sql
-- =====================================================

-- ===========================================
-- 1. ALTER TABLE usuarios_rrhh (+15 columnas)
-- ===========================================

-- Seguridad Social y Tributario
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS sistema_pensionario VARCHAR(10);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS afp_nombre VARCHAR(50);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS cuspp VARCHAR(20);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS eps_nombre VARCHAR(50);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS tiene_sctr BOOLEAN DEFAULT false;
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS asignacion_familiar BOOLEAN DEFAULT false;
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS numero_dependientes INTEGER;
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS numero_hijos INTEGER;

-- Identificación Adicional
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(15) DEFAULT 'DNI';
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS lugar_nacimiento VARCHAR(100);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(50) DEFAULT 'PERUANA';
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS ruc VARCHAR(11);

-- Educación
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(30);
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS profesion_carrera VARCHAR(100);

-- Salud
ALTER TABLE usuarios_rrhh ADD COLUMN IF NOT EXISTS grupo_sanguineo VARCHAR(5);

-- CHECK constraints
ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_sistema_pensionario_check 
  CHECK (sistema_pensionario IS NULL OR sistema_pensionario IN ('AFP', 'ONP'));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_tipo_documento_check 
  CHECK (tipo_documento IS NULL OR tipo_documento IN ('DNI', 'CE', 'PASAPORTE', 'PTP'));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_nivel_educativo_check 
  CHECK (nivel_educativo IS NULL OR nivel_educativo IN (
    'SECUNDARIA_INCOMPLETA', 'SECUNDARIA', 'TECNICO_INCOMPLETO', 'TECNICO', 
    'UNIVERSITARIO_INCOMPLETO', 'UNIVERSITARIO', 'POSTGRADO'
  ));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_grupo_sanguineo_check 
  CHECK (grupo_sanguineo IS NULL OR grupo_sanguineo IN (
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  ));

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_numero_dependientes_check 
  CHECK (numero_dependientes IS NULL OR numero_dependientes >= 0);

ALTER TABLE usuarios_rrhh ADD CONSTRAINT usuarios_rrhh_numero_hijos_check 
  CHECK (numero_hijos IS NULL OR numero_hijos >= 0);

-- Índices para los nuevos campos más consultados
CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_sistema_pensionario 
  ON usuarios_rrhh(sistema_pensionario) WHERE sistema_pensionario IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_rrhh_tipo_documento 
  ON usuarios_rrhh(tipo_documento);

-- ===========================================
-- 2. HISTORIAL BANCARIO
-- ===========================================

CREATE TABLE historial_bancario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  banco VARCHAR(100) NOT NULL,
  numero_cuenta VARCHAR(50) NOT NULL,
  cci VARCHAR(25),
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE,
  motivo_cambio TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_bancario_usuario ON historial_bancario(usuario_id);
CREATE INDEX idx_historial_bancario_vigente ON historial_bancario(usuario_id) 
  WHERE fecha_hasta IS NULL;

-- Constraint: solo un registro vigente por usuario
CREATE UNIQUE INDEX idx_historial_bancario_unico_vigente 
  ON historial_bancario(usuario_id) WHERE fecha_hasta IS NULL;

ALTER TABLE historial_bancario ENABLE ROW LEVEL SECURITY;

CREATE POLICY historial_bancario_select ON historial_bancario
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY historial_bancario_all ON historial_bancario
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 3. HISTORIAL DIRECCIONES
-- ===========================================

CREATE TABLE historial_direcciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  direccion_domiciliaria TEXT NOT NULL,
  distrito_residencia VARCHAR(100),
  gps_domicilio_lat NUMERIC(10,7),
  gps_domicilio_lng NUMERIC(10,7),
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE,
  motivo_cambio TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_direcciones_usuario ON historial_direcciones(usuario_id);
CREATE UNIQUE INDEX idx_historial_direcciones_unico_vigente 
  ON historial_direcciones(usuario_id) WHERE fecha_hasta IS NULL;

ALTER TABLE historial_direcciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY historial_direcciones_select ON historial_direcciones
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY historial_direcciones_all ON historial_direcciones
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 4. HISTORIAL CAMBIOS RRHH (genérico)
-- ===========================================

CREATE TABLE historial_cambios_rrhh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  campo VARCHAR(50) NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT NOT NULL,
  fecha_cambio DATE NOT NULL,
  motivo TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT historial_cambios_campo_check CHECK (
    campo IN ('TELEFONO_PERSONAL', 'REMUNERACION', 'JEFE_DIRECTO', 'CARGO_FORMAL')
  )
);

CREATE INDEX idx_historial_cambios_usuario ON historial_cambios_rrhh(usuario_id);
CREATE INDEX idx_historial_cambios_campo ON historial_cambios_rrhh(usuario_id, campo);
CREATE INDEX idx_historial_cambios_fecha ON historial_cambios_rrhh(fecha_cambio DESC);

ALTER TABLE historial_cambios_rrhh ENABLE ROW LEVEL SECURITY;

CREATE POLICY historial_cambios_select ON historial_cambios_rrhh
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL', 'JEFE_VENTAS', 'SUPERVISOR')
  );

CREATE POLICY historial_cambios_all ON historial_cambios_rrhh
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );

-- ===========================================
-- 5. ENTREVISTAS COLABORADOR
-- ===========================================

CREATE TABLE entrevistas_colaborador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL,
  entrevistador_id UUID NOT NULL REFERENCES usuarios(id),
  fecha DATE NOT NULL,
  motivo TEXT,
  notas TEXT,
  datos_estructurados JSONB,
  resultado VARCHAR(20),
  grabacion_url TEXT,
  transcripcion_url TEXT,
  ai_task_id UUID REFERENCES ai_tasks(id),
  ai_resumen TEXT,
  movimiento_id UUID REFERENCES movimientos_personal(id),
  es_confidencial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entrevistas_tipo_check CHECK (
    tipo IN ('EXIT_INTERVIEW', 'FEEDBACK_DESEMPENO', 'RETENCION', 'AMONESTACION_VERBAL')
  ),
  CONSTRAINT entrevistas_resultado_check CHECK (
    resultado IS NULL OR resultado IN ('SATISFACTORIA', 'CON_OBSERVACIONES', 'NO_REALIZADA')
  )
);

CREATE TRIGGER set_entrevistas_colaborador_updated_at
  BEFORE UPDATE ON entrevistas_colaborador
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_entrevistas_usuario ON entrevistas_colaborador(usuario_id);
CREATE INDEX idx_entrevistas_tipo ON entrevistas_colaborador(tipo);
CREATE INDEX idx_entrevistas_fecha ON entrevistas_colaborador(fecha DESC);
CREATE INDEX idx_entrevistas_movimiento ON entrevistas_colaborador(movimiento_id) 
  WHERE movimiento_id IS NOT NULL;

ALTER TABLE entrevistas_colaborador ENABLE ROW LEVEL SECURITY;

CREATE POLICY entrevistas_select ON entrevistas_colaborador
  FOR SELECT USING (
    (es_confidencial = false AND usuario_id = auth.uid())
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) 
       IN ('BACKOFFICE_RRHH', 'ADMIN', 'GERENTE_GENERAL')
  );

CREATE POLICY entrevistas_all ON entrevistas_colaborador
  FOR ALL USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('BACKOFFICE_RRHH', 'ADMIN')
  );
```

---

## 5. IMPACTO EN SPEC DEL IMPORTADOR

### 5.1 Campos mapeables: de 39 a 54 (+15)

Los 15 campos nuevos se agregan a la sección `usuarios_rrhh` del importador:

#### Seguridad Social (8 campos nuevos)

| Campo destino | Tipo | Req | Descripción |
|---------------|------|-----|-------------|
| `sistema_pensionario` | ENUM | ❌ | AFP, ONP |
| `afp_nombre` | VARCHAR | ❌ | Nombre de la AFP |
| `cuspp` | VARCHAR | ❌ | Código SPP |
| `eps_nombre` | VARCHAR | ❌ | Nombre de la EPS |
| `tiene_sctr` | BOOLEAN | ❌ | Tiene SCTR |
| `asignacion_familiar` | BOOLEAN | ❌ | Percibe asignación |
| `numero_dependientes` | INTEGER | ❌ | Dependientes |
| `numero_hijos` | INTEGER | ❌ | Hijos |

#### Identificación (4 campos nuevos)

| Campo destino | Tipo | Req | Descripción |
|---------------|------|-----|-------------|
| `tipo_documento` | ENUM | ❌ | DNI, CE, PASAPORTE, PTP |
| `lugar_nacimiento` | VARCHAR | ❌ | Ciudad/depto |
| `nacionalidad` | VARCHAR | ❌ | Default: PERUANA |
| `ruc` | VARCHAR | ❌ | RUC personal |

#### Educación (2 campos nuevos)

| Campo destino | Tipo | Req | Descripción |
|---------------|------|-----|-------------|
| `nivel_educativo` | ENUM | ❌ | 7 niveles |
| `profesion_carrera` | VARCHAR | ❌ | Texto libre |

#### Salud (1 campo nuevo)

| Campo destino | Tipo | Req | Descripción |
|---------------|------|-----|-------------|
| `grupo_sanguineo` | ENUM | ❌ | 8 valores |

### 5.2 Template del importador: de 32 a 47 columnas

Agregar columnas AG-AU al template:

| # | Columna | Ejemplo |
|---|---------|---------|
| AG | Tipo de Documento | DNI |
| AH | Lugar de Nacimiento | Lima |
| AI | Nacionalidad | Peruana |
| AJ | RUC | 10728456123 |
| AK | Sistema Pensionario | AFP |
| AL | AFP | Integra |
| AM | CUSPP | 123-12345678-1 |
| AN | EPS | Rímac |
| AO | Tiene SCTR | Sí |
| AP | Asignación Familiar | Sí |
| AQ | Número de Dependientes | 2 |
| AR | Número de Hijos | 1 |
| AS | Nivel Educativo | Técnico |
| AT | Profesión/Carrera | Administración |
| AU | Grupo Sanguíneo | O+ |

### 5.3 Normalización AI para nuevos enums

```typescript
const NORMALIZACION_SISTEMA_PENSIONARIO: Record<string, string> = {
  'afp': 'AFP', 'privado': 'AFP',
  'onp': 'ONP', 'público': 'ONP', 'nacional': 'ONP',
};

const NORMALIZACION_NIVEL_EDUCATIVO: Record<string, string> = {
  'secundaria incompleta': 'SECUNDARIA_INCOMPLETA',
  'secundaria': 'SECUNDARIA', 'sec. completa': 'SECUNDARIA',
  'técnico incompleto': 'TECNICO_INCOMPLETO', 'instituto incompleto': 'TECNICO_INCOMPLETO',
  'técnico': 'TECNICO', 'instituto': 'TECNICO',
  'universitario incompleto': 'UNIVERSITARIO_INCOMPLETO', 'univ. incompleto': 'UNIVERSITARIO_INCOMPLETO',
  'universitario': 'UNIVERSITARIO', 'universidad': 'UNIVERSITARIO', 'bachiller': 'UNIVERSITARIO',
  'postgrado': 'POSTGRADO', 'maestría': 'POSTGRADO', 'doctorado': 'POSTGRADO',
};

const NORMALIZACION_TIPO_DOCUMENTO: Record<string, string> = {
  'dni': 'DNI', 'documento nacional': 'DNI',
  'ce': 'CE', 'carnet de extranjería': 'CE', 'carné': 'CE',
  'pasaporte': 'PASAPORTE',
  'ptp': 'PTP', 'permiso temporal': 'PTP',
};
```

### 5.4 Categorías de brecha actualizadas

| Categoría | Campos originales | Campos nuevos |
|-----------|------------------|---------------|
| **Core** | dni, nombre, rol, fecha_ingreso | (sin cambios) |
| **Personal** | nacimiento, teléfono, dirección, distrito, emergencia | + tipo_documento, lugar_nacimiento, nacionalidad |
| **Bancario** | banco, cuenta, CCI | (sin cambios) |
| **Contractual** | tipo_contrato, fechas, cargo, remuneración | (sin cambios) |
| **Operativo** | tienda, zona, código_asesor | (sin cambios) |
| **Seguridad Social** 🆕 | — | sistema_pensionario, afp, cuspp, eps, sctr, asignación, dependientes, hijos |
| **Educación** 🆕 | — | nivel_educativo, profesion_carrera |
| **Salud** 🆕 | — | grupo_sanguineo |

---

## 6. TYPES E INTERFACES PARA `lib/rrhh/types.ts`

### 6.1 Nuevos enums

```typescript
// === SEGURIDAD SOCIAL ===

export const SISTEMA_PENSIONARIO = {
  AFP: 'AFP',
  ONP: 'ONP',
} as const;
export type SistemaPensionario = typeof SISTEMA_PENSIONARIO[keyof typeof SISTEMA_PENSIONARIO];

export const SISTEMA_PENSIONARIO_LABELS: Record<SistemaPensionario, string> = {
  AFP: 'AFP (Privado)',
  ONP: 'ONP (Público)',
};

// === IDENTIFICACIÓN ===

export const TIPO_DOCUMENTO_IDENTIDAD = {
  DNI: 'DNI',
  CE: 'CE',
  PASAPORTE: 'PASAPORTE',
  PTP: 'PTP',
} as const;
export type TipoDocumentoIdentidad = typeof TIPO_DOCUMENTO_IDENTIDAD[keyof typeof TIPO_DOCUMENTO_IDENTIDAD];

export const TIPO_DOCUMENTO_IDENTIDAD_LABELS: Record<TipoDocumentoIdentidad, string> = {
  DNI: 'DNI',
  CE: 'Carnet de Extranjería',
  PASAPORTE: 'Pasaporte',
  PTP: 'Permiso Temporal de Permanencia',
};

// === EDUCACIÓN ===

export const NIVEL_EDUCATIVO = {
  SECUNDARIA_INCOMPLETA: 'SECUNDARIA_INCOMPLETA',
  SECUNDARIA: 'SECUNDARIA',
  TECNICO_INCOMPLETO: 'TECNICO_INCOMPLETO',
  TECNICO: 'TECNICO',
  UNIVERSITARIO_INCOMPLETO: 'UNIVERSITARIO_INCOMPLETO',
  UNIVERSITARIO: 'UNIVERSITARIO',
  POSTGRADO: 'POSTGRADO',
} as const;
export type NivelEducativo = typeof NIVEL_EDUCATIVO[keyof typeof NIVEL_EDUCATIVO];

export const NIVEL_EDUCATIVO_LABELS: Record<NivelEducativo, string> = {
  SECUNDARIA_INCOMPLETA: 'Secundaria Incompleta',
  SECUNDARIA: 'Secundaria Completa',
  TECNICO_INCOMPLETO: 'Técnico Incompleto',
  TECNICO: 'Técnico Completo',
  UNIVERSITARIO_INCOMPLETO: 'Universitario Incompleto',
  UNIVERSITARIO: 'Universitario Completo',
  POSTGRADO: 'Postgrado',
};

// === SALUD ===

export const GRUPO_SANGUINEO = {
  'A+': 'A+', 'A-': 'A-',
  'B+': 'B+', 'B-': 'B-',
  'AB+': 'AB+', 'AB-': 'AB-',
  'O+': 'O+', 'O-': 'O-',
} as const;
export type GrupoSanguineo = typeof GRUPO_SANGUINEO[keyof typeof GRUPO_SANGUINEO];

// === HISTORIAL ===

export const CAMPO_HISTORIAL = {
  TELEFONO_PERSONAL: 'TELEFONO_PERSONAL',
  REMUNERACION: 'REMUNERACION',
  JEFE_DIRECTO: 'JEFE_DIRECTO',
  CARGO_FORMAL: 'CARGO_FORMAL',
} as const;
export type CampoHistorial = typeof CAMPO_HISTORIAL[keyof typeof CAMPO_HISTORIAL];

export const CAMPO_HISTORIAL_LABELS: Record<CampoHistorial, string> = {
  TELEFONO_PERSONAL: 'Teléfono personal',
  REMUNERACION: 'Remuneración',
  JEFE_DIRECTO: 'Jefe directo',
  CARGO_FORMAL: 'Cargo formal',
};

// === ENTREVISTAS COLABORADOR ===

export const TIPO_ENTREVISTA_COLABORADOR = {
  EXIT_INTERVIEW: 'EXIT_INTERVIEW',
  FEEDBACK_DESEMPENO: 'FEEDBACK_DESEMPENO',
  RETENCION: 'RETENCION',
  AMONESTACION_VERBAL: 'AMONESTACION_VERBAL',
} as const;
export type TipoEntrevistaColaborador = typeof TIPO_ENTREVISTA_COLABORADOR[keyof typeof TIPO_ENTREVISTA_COLABORADOR];

export const TIPO_ENTREVISTA_COLABORADOR_LABELS: Record<TipoEntrevistaColaborador, string> = {
  EXIT_INTERVIEW: 'Entrevista de salida',
  FEEDBACK_DESEMPENO: 'Feedback de desempeño',
  RETENCION: 'Entrevista de retención',
  AMONESTACION_VERBAL: 'Amonestación verbal',
};

export const RESULTADO_ENTREVISTA = {
  SATISFACTORIA: 'SATISFACTORIA',
  CON_OBSERVACIONES: 'CON_OBSERVACIONES',
  NO_REALIZADA: 'NO_REALIZADA',
} as const;
export type ResultadoEntrevista = typeof RESULTADO_ENTREVISTA[keyof typeof RESULTADO_ENTREVISTA];
```

### 6.2 Nuevas interfaces para `lib/rrhh/interfaces.ts`

```typescript
export interface HistorialBancario {
  id: string;
  usuario_id: string;
  banco: string;
  numero_cuenta: string;
  cci: string | null;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo_cambio: string | null;
  registrado_por: string;
  created_at: string;
  registrado_por_usuario?: { nombre_completo: string };
}

export interface HistorialDireccion {
  id: string;
  usuario_id: string;
  direccion_domiciliaria: string;
  distrito_residencia: string | null;
  gps_domicilio_lat: number | null;
  gps_domicilio_lng: number | null;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo_cambio: string | null;
  registrado_por: string;
  created_at: string;
}

export interface HistorialCambioRRHH {
  id: string;
  usuario_id: string;
  campo: CampoHistorial;
  valor_anterior: string | null;
  valor_nuevo: string;
  fecha_cambio: string;
  motivo: string | null;
  registrado_por: string;
  created_at: string;
}

export interface EntrevistaColaborador {
  id: string;
  usuario_id: string;
  tipo: TipoEntrevistaColaborador;
  entrevistador_id: string;
  fecha: string;
  motivo: string | null;
  notas: string | null;
  datos_estructurados: Record<string, any> | null;
  resultado: ResultadoEntrevista | null;
  grabacion_url: string | null;
  transcripcion_url: string | null;
  ai_task_id: string | null;
  ai_resumen: string | null;
  movimiento_id: string | null;
  es_confidencial: boolean;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales
  entrevistador?: { nombre_completo: string };
  usuario?: { nombre_completo: string; dni: string };
  movimiento?: { tipo_movimiento: string; fecha_efectiva: string };
}
```

---

## 7. RESUMEN FINAL

### Antes de esta migración
- `usuarios_rrhh`: 31 columnas
- Tablas RRHH: 21 (migraciones 020-024)
- Campos mapeables importador: 39

### Después de esta migración
- `usuarios_rrhh`: **46 columnas** (+15)
- Tablas RRHH: **25** (+4 nuevas)
- Campos mapeables importador: **54** (+15)

### Tablas nuevas

| Tabla | Registros por colaborador | Propósito |
|-------|--------------------------|-----------|
| `historial_bancario` | ~1-3 (cambia poco) | Auditoría bancaria, nómina histórica |
| `historial_direcciones` | ~1-2 (cambia poco) | Auditoría de domicilio |
| `historial_cambios_rrhh` | Variable (~5-20 lifetime) | Teléfono, remuneración, jefe, cargo |
| `entrevistas_colaborador` | ~1-2 (exit interviews) | Exit interviews, futuro: evaluaciones |

### Módulo futuro documentado

**Capacitación y Evaluaciones** — Módulo nuevo a planificar en conversación separada:
- Banco de preguntas por tema
- Evaluaciones tipo quiz (móvil/desktop)
- Scoring y certificaciones internas
- Feedback de desempeño, retención, amonestaciones verbales
- Extensión de `entrevistas_colaborador` (tipos FEEDBACK_DESEMPENO, RETENCION, AMONESTACION_VERBAL)
- Gamificación y rankings

---

## 8. CHANGELOG

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-17 | 1.0 | 15 columnas nuevas en usuarios_rrhh (seguridad social, identificación, educación, salud). 3 tablas historial (bancario, direcciones, cambios genérico). 1 tabla entrevistas_colaborador (exit interviews). Actualización del importador (54 campos mapeables). CHECK constraints para todos los enums nuevos. Types e interfaces para lib/rrhh/. |
