# GridRetail - Referencia Rápida
**Adjuntar este archivo a cada conversación nueva del proyecto**

---

## ESTADO ACTUAL DE LA BD (17 objetos)

### Tablas Core
- `usuarios` (12 roles definidos)
- `tiendas` (21 tiendas TEX)
- `usuarios_tiendas` (relación M:N)
- `tipos_venta` (16 tipos)
- `operadores_cedentes` (3: Movistar, Claro, Bitel)

### Operaciones
- `ventas` (registro BU)
- `arribos` (conteo clientes)

### Módulo INAR
- `lineas_inar` (49 campos)
- `inar_importaciones`
- `inar_mapeo_columnas`
- `v_inar_resumen_diario` (vista)
- `v_inar_resumen_tienda` (vista)
- `v_inar_resumen_vendedor` (vista)

### Control
- `asesor_incidencias`
- `asesor_score_mensual` (vista)
- `logs_auditoria`
- `v_tipos_venta_config` (vista)

---

## 12 ROLES (constraint en usuarios.rol)

```
ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR,
JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL,
BACKOFFICE_OPERACIONES, BACKOFFICE_RRHH, BACKOFFICE_AUDITORIA,
VALIDADOR_ARRIBOS, ADMIN
```

**Grupos para RLS:**
- HC: `ASESOR, ASESOR_REFERENTE, COORDINADOR, SUPERVISOR`
- Jefatura: `JEFE_VENTAS, GERENTE_COMERCIAL, GERENTE_GENERAL`
- Backoffice: `BACKOFFICE_*`
- Admin: `ADMIN`

---

# Fragmento para GRIDRETAIL_QUICK_REFERENCE.md
## Reemplazar sección "16 TIPOS DE VENTA"

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
| PACK_OPP_BASE | Pack Porta OPP LLAA | PACK_SS | ✅ | ✅ | ✅ |
| **RENO** |||||
| RENO | Renovación Equipo | ❌ | ✅ | ✅ |
| RENO_LLAA | Renovación + LLAA | RENO | ❌ | ✅ | ✅ |
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

## TIPOS DE DOCUMENTO

| Código | Nombre | Patrón |
|--------|--------|--------|
| DNI | DNI | 8 dígitos |
| CE | Carné Extranjería | 9 dígitos |
| RUC | RUC | 11 dígitos (10 o 20 + 9) |
| PASAPORTE | Pasaporte | 6-12 alfanumérico |
| PTP | PTP | 6-15 alfanumérico |

---

## OPERADORES CEDENTES (tabla operadores_cedentes)

| Código | Nombre |
|--------|--------|
| MOVISTAR | Movistar |
| CLARO | Claro |
| BITEL | Bitel |

---

## STACK TECNOLÓGICO

- **Frontend:** Next.js 14 (App Router)
- **Backend:** Supabase (PostgreSQL)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS + shadcn/ui
- **Validación:** Zod + react-hook-form

---

## CONVENCIONES

### Nomenclatura BD
- Tablas: español, snake_case, plural (`usuarios`, `ventas`)
- Columnas: snake_case (`usuario_id`, `created_at`)
- Vistas: prefijo `v_` (`v_inar_resumen_diario`)

### Nomenclatura Código
- Variables/funciones: camelCase
- Tipos/interfaces: PascalCase (`VentaFormData`)

---

## REGLAS DE INTEGRACIÓN

1. **NO hardcodear** roles ni tipos de venta - leer de BD
2. **Usar FK** a tablas existentes (`usuarios`, `tiendas`, `tipos_venta`)
3. **Reutilizar** función `trigger_set_updated_at()` para updated_at
4. **Seguir** los 12 roles del constraint (no crear nuevos)
5. **Mapear** nuevos tipos de comisión con `tipos_venta` existentes

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
| TEX | Tienda Express |
| SSNN | Socio de Negocio (PBD) |
| HC | Personal Comercial |
| BU | Boca de Urna (registro declarativo) |
| INAR | Base de líneas activadas de Entel |
| OSS | Portabilidad PostPago→PostPago |
| OPP | Portabilidad PrePago→PostPago |
| VR | Venta Regular |
| BASE | Cliente >30 días en Entel |
| CAPTURA | Cliente nuevo |
| LLAA | Línea Adicional |
| MONO | Línea única |
| PACK | Equipo vendido |
| RENO | Renovación |
| MEP | Seguro "Mi Equipo Protegido" |
| VEP | Venta a Plazos |

---

**Documentación completa:** GRIDRETAIL_ARCHITECTURE.md y DATA_DICTIONARY.md
