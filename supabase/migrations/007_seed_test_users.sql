-- ============================================================================
-- SCRIPT: Usuarios Ficticios para Pruebas - GridRetail
-- Versión: 2.0 (con UUIDs reales de tiendas)
-- Total: 52 usuarios (42 asesores, 6 supervisores, 2 JV, 1 analista, 1 gerente)
-- ============================================================================

-- ============================================================================
-- DISTRIBUCIÓN DE TIENDAS POR ZONA
-- ============================================================================
-- ZONA NORTE (11 tiendas):
--   TE_AGUSTINO, TE_HUANDOY, TE_JICAMARCA, TE_MARANON, TE_NARANJAL,
--   TE_YZAGUIRRE, TE_PACHACUTEC, TE_COMAS, TE_BAYOVAR, TE_TUPAC, TE_VILLA_SOL
--
-- ZONA SUR (10 tiendas):
--   TE_HIGUERETA, TE_SJM, TE_CHIMU, TE_CAMOTE, TE_ALMENDRAS,
--   TE_SAN_JUAN, TE_CAJA_AGUA, TE_SAT_CHIMU, TE_VES, TE_VMT
-- ============================================================================

-- ============================================================================
-- PARTE 1: INSERTAR USUARIOS
-- ============================================================================

-- 1.1 Gerencia y Jefatura (4)
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, email, rol, zona, activo, password_hash) VALUES
('PBD_GCOMERCIAL', '10000001', 'Carlos Alberto Mendoza Rivera', 'carlos.mendoza@pbd.pe', 'GERENTE_COMERCIAL', NULL, true, NULL),
('PBD_JVNORTE', '10000002', 'María Elena Vargas Castillo', 'maria.vargas@pbd.pe', 'JEFE_VENTAS', 'NORTE', true, NULL),
('PBD_JVSUR', '10000003', 'Roberto Carlos Huamán López', 'roberto.huaman@pbd.pe', 'JEFE_VENTAS', 'SUR', true, NULL),
('PBD_ANALISTA', '10000004', 'Ana Lucía Torres Ramos', 'ana.torres@pbd.pe', 'BACKOFFICE_OPERACIONES', NULL, true, NULL);

-- 1.2 Supervisores (6)
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, email, rol, zona, activo, password_hash) VALUES
-- Zona Norte (3)
('PBD_SUPN01', '20000001', 'Jorge Luis Pérez Sánchez', 'jorge.perez@pbd.pe', 'SUPERVISOR', 'NORTE', true, NULL),
('PBD_SUPN02', '20000002', 'Patricia Carmen Quispe Flores', 'patricia.quispe@pbd.pe', 'SUPERVISOR', 'NORTE', true, NULL),
('PBD_SUPN03', '20000003', 'Miguel Ángel Rodríguez Díaz', 'miguel.rodriguez@pbd.pe', 'SUPERVISOR', 'NORTE', true, NULL),
-- Zona Sur (3)
('PBD_SUPS01', '20000004', 'Carmen Rosa Gutiérrez Vega', 'carmen.gutierrez@pbd.pe', 'SUPERVISOR', 'SUR', true, NULL),
('PBD_SUPS02', '20000005', 'Fernando José Espinoza Cruz', 'fernando.espinoza@pbd.pe', 'SUPERVISOR', 'SUR', true, NULL),
('PBD_SUPS03', '20000006', 'Luz Marina Chávez Rojas', 'luz.chavez@pbd.pe', 'SUPERVISOR', 'SUR', true, NULL);

-- 1.3 Asesores Zona Norte (21)
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, email, rol, zona, activo, password_hash) VALUES
('PBD_ASE001', '30000001', 'Juan Carlos Medina Torres', 'juan.medina@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE002', '30000002', 'Rosa María Campos Silva', 'rosa.campos@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE003', '30000003', 'Pedro Pablo Núñez García', 'pedro.nunez@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE004', '30000004', 'Sofía Alejandra Rivas Luna', 'sofia.rivas@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE005', '30000005', 'Diego Armando Castro Vera', 'diego.castro@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE006', '30000006', 'Lucía Fernanda Morales Ríos', 'lucia.morales@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE007', '30000007', 'Andrés Felipe Salazar Poma', 'andres.salazar@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE008', '30000008', 'Valeria Isabel Paredes Cornejo', 'valeria.paredes@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE009', '30000009', 'Gabriel Antonio Herrera Montes', 'gabriel.herrera@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE010', '30000010', 'Camila Beatriz Ortega Salas', 'camila.ortega@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE011', '30000011', 'Sebastián Alonso Vásquez Ruiz', 'sebastian.vasquez@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE012', '30000012', 'Daniela Rocío Fernández Aguilar', 'daniela.fernandez@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE013', '30000013', 'Matías Eduardo Romero Paz', 'matias.romero@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE014', '30000014', 'Isabella María Delgado Cabrera', 'isabella.delgado@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE015', '30000015', 'Nicolás Alejandro Mendoza Tello', 'nicolas.mendoza@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE016', '30000016', 'Antonella Lucía Soto Vargas', 'antonella.soto@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE017', '30000017', 'Emilio José Ramírez Coronel', 'emilio.ramirez@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE018', '30000018', 'Martina Sofía Acosta León', 'martina.acosta@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE019', '30000019', 'Joaquín Ignacio Villanueva Prado', 'joaquin.villanueva@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE020', '30000020', 'Valentina Andrea Zárate Molina', 'valentina.zarate@pbd.pe', 'ASESOR', 'NORTE', true, NULL),
('PBD_ASE021', '30000021', 'Tomás Benjamín Esquivel Navarro', 'tomas.esquivel@pbd.pe', 'ASESOR', 'NORTE', true, NULL);

-- 1.4 Asesores Zona Sur (21)
INSERT INTO usuarios (codigo_asesor, dni, nombre_completo, email, rol, zona, activo, password_hash) VALUES
('PBD_ASE022', '30000022', 'Renato Alonso Cárdenas Huanca', 'renato.cardenas@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE023', '30000023', 'Jimena Patricia Lozano Arias', 'jimena.lozano@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE024', '30000024', 'Adrián Mauricio Benítez Cueva', 'adrian.benitez@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE025', '30000025', 'Mariana Celeste Pacheco Reyes', 'mariana.pacheco@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE026', '30000026', 'Franco Daniel Ibarra Meza', 'franco.ibarra@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE027', '30000027', 'Catalina Rosa Figueroa Alva', 'catalina.figueroa@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE028', '30000028', 'Lucas Martín Peña Solís', 'lucas.pena@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE029', '30000029', 'Ariana Michelle Torres Mamani', 'ariana.torres@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE030', '30000030', 'Bruno Alejandro Castañeda Quiroz', 'bruno.castaneda@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE031', '30000031', 'Regina Fernanda Aliaga Condori', 'regina.aliaga@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE032', '30000032', 'Maximiliano José Palomino Yupanqui', 'maximiliano.palomino@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE033', '30000033', 'Florencia Milagros Ochoa Velarde', 'florencia.ochoa@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE034', '30000034', 'Santiago Rafael Vera Cáceres', 'santiago.vera@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE035', '30000035', 'Bianca Stephanie Ríos Calderón', 'bianca.rios@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE036', '30000036', 'Thiago Nicolás Aguirre Ponce', 'thiago.aguirre@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE037', '30000037', 'Samantha Nicole Mendívil Lagos', 'samantha.mendivil@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE038', '30000038', 'Facundo Ezequiel Lazo Ccama', 'facundo.lazo@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE039', '30000039', 'Miranda Alessandra Núñez Ticona', 'miranda.nunez@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE040', '30000040', 'Ian Christopher Palacios Anco', 'ian.palacios@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE041', '30000041', 'Abril Valentina Montoya Huamani', 'abril.montoya@pbd.pe', 'ASESOR', 'SUR', true, NULL),
('PBD_ASE042', '30000042', 'Dylan Sebastián Rojas Apaza', 'dylan.rojas@pbd.pe', 'ASESOR', 'SUR', true, NULL);

-- ============================================================================
-- PARTE 2: ASIGNAR ASESORES A TIENDAS (2 por tienda)
-- ============================================================================

-- ZONA NORTE (11 tiendas × 2 asesores = 22, tenemos 21, última tienda tiene 1)
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
-- TE_AGUSTINO (El Agustino)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE001'), '5e6a4686-4281-4e4e-bf78-84556b65335a', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE002'), '5e6a4686-4281-4e4e-bf78-84556b65335a', true),
-- TE_HUANDOY (Los Olivos)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE003'), 'a72280e6-0000-4792-8d45-7f629467d557', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE004'), 'a72280e6-0000-4792-8d45-7f629467d557', true),
-- TE_JICAMARCA (SJL)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE005'), '130a0573-0c69-411c-af4a-e8d85fac655b', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE006'), '130a0573-0c69-411c-af4a-e8d85fac655b', true),
-- TE_MARANON (SMP)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE007'), '9d499fe1-bcd1-48fa-a207-c916a9bd6cc6', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE008'), '9d499fe1-bcd1-48fa-a207-c916a9bd6cc6', true),
-- TE_NARANJAL (Independencia)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE009'), '42c1493a-4ab1-4bc4-824d-2f73219e4b3e', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE010'), '42c1493a-4ab1-4bc4-824d-2f73219e4b3e', true),
-- TE_YZAGUIRRE (SMP)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE011'), '3297eb0b-1f95-4fae-9281-480d5d25467b', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE012'), '3297eb0b-1f95-4fae-9281-480d5d25467b', true),
-- TE_PACHACUTEC (Ventanilla)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE013'), '2ba8e87c-a3a6-4aa6-89e3-562b3bfadd29', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE014'), '2ba8e87c-a3a6-4aa6-89e3-562b3bfadd29', true),
-- TE_COMAS (San Felipe Comas)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE015'), 'bb4f953b-464f-4246-b9aa-4368f14170ce', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE016'), 'bb4f953b-464f-4246-b9aa-4368f14170ce', true),
-- TE_BAYOVAR (SJL)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE017'), '5e2c127f-b9f4-43de-b8a1-d5555bfab31c', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE018'), '5e2c127f-b9f4-43de-b8a1-d5555bfab31c', true),
-- TE_TUPAC (Túpac Amaru)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE019'), '1485b0c4-aec4-4f08-b0a3-72cd3eb47f5f', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE020'), '1485b0c4-aec4-4f08-b0a3-72cd3eb47f5f', true),
-- TE_VILLA_SOL (Los Olivos)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE021'), '28d6c492-b37a-4cec-b99a-8aeb026b491f', true);

-- ZONA SUR (10 tiendas × 2 asesores = 20, tenemos 21, primera tienda tiene 3)
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
-- TE_HIGUERETA (Surco) - 3 asesores
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE022'), '4cad0e7c-7614-4f25-8586-cdaab835056d', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE023'), '4cad0e7c-7614-4f25-8586-cdaab835056d', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE042'), '4cad0e7c-7614-4f25-8586-cdaab835056d', true),
-- TE_SJM (San Juan de Miraflores)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE024'), '761fdb1a-ef0c-4d44-83a8-5744eb17cd3d', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE025'), '761fdb1a-ef0c-4d44-83a8-5744eb17cd3d', true),
-- TE_CHIMU (Ate)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE026'), '472c5892-111d-4610-bc31-320bd362d3ba', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE027'), '472c5892-111d-4610-bc31-320bd362d3ba', true),
-- TE_CAMOTE (Puente Camote)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE028'), '5ee3ffde-d66c-4307-aea5-c951b0389bca', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE029'), '5ee3ffde-d66c-4307-aea5-c951b0389bca', true),
-- TE_ALMENDRAS (VES Satélite)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE030'), '31aa2c7c-fc15-4e21-b7d7-6400e55788a3', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE031'), '31aa2c7c-fc15-4e21-b7d7-6400e55788a3', true),
-- TE_SAN_JUAN (Av San Juan)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE032'), 'f9cac201-9d5f-42a3-89eb-d512297dfee1', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE033'), 'f9cac201-9d5f-42a3-89eb-d512297dfee1', true),
-- TE_CAJA_AGUA (Caja de Agua)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE034'), 'de838058-2f1d-49d2-88d3-41103d61cdb2', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE035'), 'de838058-2f1d-49d2-88d3-41103d61cdb2', true),
-- TE_SAT_CHIMU (Satélite Chimú)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE036'), '971968c7-ed96-4ca1-b97a-30a994eaeb2d', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE037'), '971968c7-ed96-4ca1-b97a-30a994eaeb2d', true),
-- TE_VES (Villa El Salvador)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE038'), '6dc6c9cf-229e-471c-a510-f32a2b38b0ae', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE039'), '6dc6c9cf-229e-471c-a510-f32a2b38b0ae', true),
-- TE_VMT (Villa María del Triunfo)
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE040'), '446c1a32-83f2-4f7a-8fa5-5833d83dfa8e', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_ASE041'), '446c1a32-83f2-4f7a-8fa5-5833d83dfa8e', true);

-- ============================================================================
-- PARTE 3: ASIGNAR SUPERVISORES A TIENDAS (cada supervisor ~3-4 tiendas)
-- ============================================================================

-- Supervisor Norte 1 (PBD_SUPN01): TE_AGUSTINO, TE_HUANDOY, TE_JICAMARCA, TE_MARANON
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN01'), '5e6a4686-4281-4e4e-bf78-84556b65335a', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN01'), 'a72280e6-0000-4792-8d45-7f629467d557', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN01'), '130a0573-0c69-411c-af4a-e8d85fac655b', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN01'), '9d499fe1-bcd1-48fa-a207-c916a9bd6cc6', false);

-- Supervisor Norte 2 (PBD_SUPN02): TE_NARANJAL, TE_YZAGUIRRE, TE_PACHACUTEC, TE_COMAS
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN02'), '42c1493a-4ab1-4bc4-824d-2f73219e4b3e', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN02'), '3297eb0b-1f95-4fae-9281-480d5d25467b', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN02'), '2ba8e87c-a3a6-4aa6-89e3-562b3bfadd29', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN02'), 'bb4f953b-464f-4246-b9aa-4368f14170ce', false);

-- Supervisor Norte 3 (PBD_SUPN03): TE_BAYOVAR, TE_TUPAC, TE_VILLA_SOL
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN03'), '5e2c127f-b9f4-43de-b8a1-d5555bfab31c', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN03'), '1485b0c4-aec4-4f08-b0a3-72cd3eb47f5f', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPN03'), '28d6c492-b37a-4cec-b99a-8aeb026b491f', false);

-- Supervisor Sur 1 (PBD_SUPS01): TE_HIGUERETA, TE_SJM, TE_CHIMU
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS01'), '4cad0e7c-7614-4f25-8586-cdaab835056d', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS01'), '761fdb1a-ef0c-4d44-83a8-5744eb17cd3d', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS01'), '472c5892-111d-4610-bc31-320bd362d3ba', false);

-- Supervisor Sur 2 (PBD_SUPS02): TE_CAMOTE, TE_ALMENDRAS, TE_SAN_JUAN, TE_CAJA_AGUA
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS02'), '5ee3ffde-d66c-4307-aea5-c951b0389bca', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS02'), '31aa2c7c-fc15-4e21-b7d7-6400e55788a3', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS02'), 'f9cac201-9d5f-42a3-89eb-d512297dfee1', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS02'), 'de838058-2f1d-49d2-88d3-41103d61cdb2', false);

-- Supervisor Sur 3 (PBD_SUPS03): TE_SAT_CHIMU, TE_VES, TE_VMT
INSERT INTO usuarios_tiendas (usuario_id, tienda_id, es_principal) VALUES
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS03'), '971968c7-ed96-4ca1-b97a-30a994eaeb2d', true),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS03'), '6dc6c9cf-229e-471c-a510-f32a2b38b0ae', false),
((SELECT id FROM usuarios WHERE codigo_asesor = 'PBD_SUPS03'), '446c1a32-83f2-4f7a-8fa5-5833d83dfa8e', false);

-- ============================================================================
-- PARTE 4: VERIFICACIÓN
-- ============================================================================

-- 4.1 Resumen de usuarios creados
SELECT rol, zona, COUNT(*) as cantidad
FROM usuarios
WHERE codigo_asesor LIKE 'PBD_%'
GROUP BY rol, zona
ORDER BY 
    CASE rol 
        WHEN 'GERENTE_COMERCIAL' THEN 1
        WHEN 'JEFE_VENTAS' THEN 2
        WHEN 'BACKOFFICE_OPERACIONES' THEN 3
        WHEN 'SUPERVISOR' THEN 4
        WHEN 'ASESOR' THEN 5
    END,
    zona;

-- 4.2 Asesores por tienda
SELECT 
    t.codigo as tienda,
    t.nombre,
    COUNT(DISTINCT ut.usuario_id) FILTER (WHERE u.rol = 'ASESOR') as asesores,
    COUNT(DISTINCT ut.usuario_id) FILTER (WHERE u.rol = 'SUPERVISOR') as supervisores,
    STRING_AGG(
        CASE WHEN u.rol = 'ASESOR' THEN u.codigo_asesor END, 
        ', ' ORDER BY u.codigo_asesor
    ) as cod_asesores
FROM tiendas t
LEFT JOIN usuarios_tiendas ut ON t.id = ut.tienda_id
LEFT JOIN usuarios u ON ut.usuario_id = u.id
WHERE t.activa = true
GROUP BY t.id, t.codigo, t.nombre
ORDER BY t.codigo;

-- 4.3 Tiendas por supervisor
SELECT 
    u.codigo_asesor,
    u.nombre_completo,
    u.zona,
    COUNT(ut.tienda_id) as tiendas_asignadas,
    STRING_AGG(t.codigo, ', ' ORDER BY t.codigo) as tiendas
FROM usuarios u
JOIN usuarios_tiendas ut ON u.id = ut.usuario_id
JOIN tiendas t ON ut.tienda_id = t.id
WHERE u.rol = 'SUPERVISOR'
GROUP BY u.id, u.codigo_asesor, u.nombre_completo, u.zona
ORDER BY u.zona, u.codigo_asesor;

-- ============================================================================
-- RESUMEN DE DATOS CREADOS
-- ============================================================================
/*
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USUARIOS CREADOS (52)                               │
├─────────────────────────┬────────┬────────┬─────────────────────────────────┤
│ Rol                     │ Norte  │ Sur    │ Sin Zona                        │
├─────────────────────────┼────────┼────────┼─────────────────────────────────┤
│ GERENTE_COMERCIAL       │   -    │   -    │ 1 (carlos.mendoza@pbd.pe)       │
│ JEFE_VENTAS             │   1    │   1    │ -                               │
│ BACKOFFICE_OPERACIONES  │   -    │   -    │ 1 (ana.torres@pbd.pe)           │
│ SUPERVISOR              │   3    │   3    │ -                               │
│ ASESOR                  │  21    │  21    │ -                               │
├─────────────────────────┼────────┼────────┼─────────────────────────────────┤
│ TOTAL                   │  25    │  25    │ 2                               │
└─────────────────────────┴────────┴────────┴─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUCIÓN POR TIENDA                                  │
├─────────────────────────┬─────────────────────────────────────┬─────────────┤
│ Tienda                  │ Asesores                            │ Supervisor  │
├─────────────────────────┼─────────────────────────────────────┼─────────────┤
│ TE_AGUSTINO             │ PBD_ASE001, PBD_ASE002              │ PBD_SUPN01  │
│ TE_HUANDOY              │ PBD_ASE003, PBD_ASE004              │ PBD_SUPN01  │
│ TE_JICAMARCA            │ PBD_ASE005, PBD_ASE006              │ PBD_SUPN01  │
│ TE_MARANON              │ PBD_ASE007, PBD_ASE008              │ PBD_SUPN01  │
│ TE_NARANJAL             │ PBD_ASE009, PBD_ASE010              │ PBD_SUPN02  │
│ TE_YZAGUIRRE            │ PBD_ASE011, PBD_ASE012              │ PBD_SUPN02  │
│ TE_PACHACUTEC           │ PBD_ASE013, PBD_ASE014              │ PBD_SUPN02  │
│ TE_COMAS                │ PBD_ASE015, PBD_ASE016              │ PBD_SUPN02  │
│ TE_BAYOVAR              │ PBD_ASE017, PBD_ASE018              │ PBD_SUPN03  │
│ TE_TUPAC                │ PBD_ASE019, PBD_ASE020              │ PBD_SUPN03  │
│ TE_VILLA_SOL            │ PBD_ASE021                          │ PBD_SUPN03  │
│ TE_HIGUERETA            │ PBD_ASE022, PBD_ASE023, PBD_ASE042  │ PBD_SUPS01  │
│ TE_SJM                  │ PBD_ASE024, PBD_ASE025              │ PBD_SUPS01  │
│ TE_CHIMU                │ PBD_ASE026, PBD_ASE027              │ PBD_SUPS01  │
│ TE_CAMOTE               │ PBD_ASE028, PBD_ASE029              │ PBD_SUPS02  │
│ TE_ALMENDRAS            │ PBD_ASE030, PBD_ASE031              │ PBD_SUPS02  │
│ TE_SAN_JUAN             │ PBD_ASE032, PBD_ASE033              │ PBD_SUPS02  │
│ TE_CAJA_AGUA            │ PBD_ASE034, PBD_ASE035              │ PBD_SUPS02  │
│ TE_SAT_CHIMU            │ PBD_ASE036, PBD_ASE037              │ PBD_SUPS03  │
│ TE_VES                  │ PBD_ASE038, PBD_ASE039              │ PBD_SUPS03  │
│ TE_VMT                  │ PBD_ASE040, PBD_ASE041              │ PBD_SUPS03  │
└─────────────────────────┴─────────────────────────────────────┴─────────────┘
*/
