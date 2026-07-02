-- ====================================================================
--  SEED SCRIPT — MOLINOS DE COLOMBIA · ERP v4
--  Migración de datos: molinos_erp_v1 → molinos_erp_v4
--  Generado: 2026-06-28
-- --------------------------------------------------------------------
--  INSTRUCCIONES DE EJECUCIÓN:
--    1. Ejecutar PRIMERO el DDL (molinos_create_v4.sql)
--       → El DDL ya inserta: Tipos_Material, Tipos_Turno, Tipos_Alquiler,
--         Tipos_Analisis, Tipos_Gasto_Operativo, Categorias_Proveedor,
--         Categorias_CxP, Categorias_CxC, Tarifas_Calculo y Zona('Sin zona').
--    2. Ejecutar ESTE ARCHIVO en la base molinos_erp_v4.
--
--  ADVERTENCIAS GLOBALES:
--    ⚠️  Usuarios.password_hash = '123' es TEXTO PLANO. Reemplazar con
--        hashes bcrypt/argon2 generados por el backend ANTES de producción.
--    ⚠️  Empleados.cc ('0000000001'...'0000000026') son PLACEHOLDERS.
--        Actualizar con cédulas reales antes de producción.
--    ⚠️  Mineros y Dueno_Volqueta sin datos bancarios en el sistema anterior;
--        los campos correspondientes quedan NULL para completar posteriormente.
-- ====================================================================

USE molinos_erp_v4;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES   = 0;


-- ====================================================================
--  BLOQUE 1 · ROLES
--  Fuente: tabla `roles` del export_v2_info.sql
--  Mapeo: directo 1:1 — misma estructura.
-- ====================================================================

INSERT INTO Roles (id, nombre, descripcion) VALUES
(1, 'David_admin',   'Acceso total a reportes, utilidad y finanzas'),
(2, 'Juliana_Tesoreria',  'Módulo Juliana: Pagos, depósitos, nómina'),
(3, 'Vicky_material',     'Módulo Victoria: Entradas de material, inventario, laboratorio'),
(4, 'Valeria_volqueta',     'Módulo Valeria: Volquetas entrada o salida de la planta'),
(5, 'Ginna_planta',     'Módulo Ginna: Enlace y trazabilidad material en planta que se procesa que se analisa'),
(6, 'Angela_exportaciones',     'Módulo Angela: Importacion del material'),
(7, 'Cindy_planta',     'Módulo Cindy: Contaduria hacia la dian');


-- ====================================================================
--  BLOQUE 2 · PERMISOS
--  El sistema anterior NO tenía permisos definidos (tabla vacía).
--  Deben ser diseñados y cargados por el equipo técnico según los módulos.
--
--  Ejemplo de estructura (DESCOMENTAR cuando se definan):
--  INSERT INTO Permisos (codigo, descripcion) VALUES
--      ('ver_entradas',        'Ver registros de material_planta_entrada'),
--      ('crear_entrada',       'Registrar nueva entrada de material'),
--      ('ver_cuentas_pagar',   'Consultar Cuentas_Por_Pagar'),
--      ('crear_pago',          'Crear y abonar Cuentas_Por_Pagar'),
--      ('ver_nomina',          'Acceder al módulo de nómina y turnos'),
--      ('admin_catalogos',     'Editar tablas maestras (minas, mineros, etc.)'),
--      ('ver_reportes',        'Acceder a vistas y reportes gerenciales');
-- ====================================================================


-- ====================================================================
--  BLOQUE 3 · EMPLEADOS
--  Fuente: tabla `empleados` del export.
--  Mapeo: directo 1:1 — misma estructura.
--  ⚠️  CCs '0000000001'...'0000000026' son PLACEHOLDERS del sistema anterior.
--      Deben ser reemplazados con las cédulas reales de cada empleado.
-- ====================================================================

INSERT INTO Empleados (id, nombre, apellido, cc, cuenta, nequi, labor) VALUES
(1,  'EDER',      'HERNANDEZ',   '0000000001', NULL, 0, 'PLANTA'),
(2,  'GINA',      'MONTEALEGRE', '0000000002', NULL, 0, 'PLANTA'),
(3,  'ESTEFANIA', 'MONTEALEGRE', '0000000003', NULL, 0, 'PLANTA'),
(4,  'ULPIANO',   'CAMPO',       '0000000004', NULL, 0, 'PLANTA'),
(5,  'MARYORIS',  'LABORAT',     '0000000005', NULL, 0, 'PLANTA'),
(6,  'MILADYS',   NULL,          '0000000006', NULL, 0, 'PLANTA'),
(7,  'CALIXTO',   'LOZANO',      '0000000007', NULL, 0, 'OPERACION PLANTA - LIDER'),
(8,  'EDINSON',   'MARTINEZ',    '0000000008', NULL, 0, 'OPERACION PLANTA'),
(9,  'ANDRES',    'RUEDA',       '0000000009', NULL, 0, 'OPERACION PLANTA'),
(10, 'ANDRES',    'CASTILLO',    '0000000010', NULL, 0, 'OPERACION PLANTA'),
(11, 'ENEL',      'ZAMBRANO',    '0000000011', NULL, 0, 'OPERACION PLANTA - LIDER'),
(12, 'SEBASTIAN', 'NARVAEZ',     '0000000012', NULL, 0, 'OPERACION PLANTA'),
(13, 'RICARDO',   NULL,          '0000000013', NULL, 0, 'OPERACION PLANTA'),
(14, 'ALCIDES',   'PADILLA',     '0000000014', NULL, 0, 'OPERACION PLANTA'),
(15, 'CESAR',     'JIMENEZ',     '0000000015', NULL, 0, 'OPERACION PLANTA'),
(16, 'FRANCISCO', 'JAVIER',      '0000000016', NULL, 0, 'OPERACION PLANTA'),
(17, 'ENGER',     NULL,          '0000000017', NULL, 0, 'OPERACION PLANTA'),
(18, 'CRISTIAN',  'JIMENEZ',     '0000000018', NULL, 0, 'OPERACION PLANTA'),
(19, 'DAVID',     'HERNANDEZ',   '0000000019', NULL, 0, 'SECADO'),
(20, 'YHONNY',    NULL,          '0000000020', NULL, 0, 'SECADO'),
(21, 'DANIEL',    NULL,          '0000000021', NULL, 0, 'SECADO'),
(22, 'ANDRES',    'CAMPO',       '0000000022', NULL, 0, 'SECADO'),
(23, 'MAURICIO',  'GIRALDO',     '0000000023', NULL, 0, 'MATERIAL - CARGUES'),
(24, 'LUIS',      'SOLDADOR',    '0000000024', NULL, 0, 'SOLDADOR'),
(25, 'WILDER',    'SOLDADOR',    '0000000025', NULL, 0, 'SOLDADOR'),
(26, 'ALFREDO',   'RICO',        '0000000026', NULL, 0, 'SOLDADOR-AYUDANTE'),
(27, 'DAVID',   'OYUELA',        '0000000027', NULL, 0, 'JEFE-ADMINISTRITATIVO'),
(27, 'JULIANA',   'OTERO',       '0000000028', NULL, 0, 'CONTADORA-ADMINISTRATIVO'),
(29, 'VICTORIA',   'DIAZ',       '0000000029', NULL, 0, 'MATERIAL-ADMINISTRATIVO'),
(30, 'ANGELA',   'GARCIA',       '0000000030', NULL, 0, 'EXPORTACIONES-ADMINISTRATIVO'),
(31, 'CINDY',   '',        '0000000031', NULL, 0, '-ADMINISTRATIVO'),
(32, 'VALERIA',   'OYUELA',        '0000000032', NULL, 0, 'VOLQUETA-ADMINISTRATIVO'),
(33, 'JUAN DAVID',   'OYUELA',        '0000000033', NULL, 0, 'JEFE-APRENDIS-ADMINISTRATIVO');


-- ====================================================================
--  BLOQUE 4 · USUARIOS
--  Fuente: tabla `usuarios` del export.
--  Mapeo: directo 1:1.
--  ⚠️  CRÍTICO DE SEGURIDAD: password_hash = '123' es TEXTO PLANO.
--      Generar hashes bcrypt/argon2 desde el backend y actualizar ANTES
--      de que cualquier usuario acceda al sistema en producción.
-- ====================================================================

INSERT INTO Usuarios (id, username, password_hash, id_rol, id_empleado, activo) VALUES
(1, 'david',    '123', 1, 27, 1),   -- Gerencia    — ⚠️ cambiar hash
(2, 'juliana',  '123', 2, 28, 1),   -- Tesoreria   — ⚠️ cambiar hash
(3, 'victoria', '123', 3, 29, 1),   -- Planta      — ⚠️ cambiar hash
(4, 'valeria', '123', 4, 32, 1),  
(5, 'ginna', '123', 5, 2, 1),
(6, 'angela', '123', 6, 30, 1),
(7, 'cindy', '123', 7, 31, 1); 


-- ====================================================================
--  BLOQUE 5 · TIPOS_TURNO  (validación — ya cargados por DDL)
-- ====================================================================
-- Los registros (1,'TURNO 1','06:00:00','14:00:00'), (2,'TURNO 2',...),
-- (3,'TURNO 3',...) ya fueron insertados por el DDL. No se repiten.


-- ====================================================================
--  BLOQUE 6 · PLANTA
--  Fuente: tabla `planta` del export.
--  Mapeo: directo 1:1.
-- ====================================================================

INSERT INTO Planta (id, nombre, ubicacion) VALUES
(1, 'PLANTA GRANDE',       'MOLINOS DE COLOMBIA - PLANTA PRINCIPAL'),
(2, 'PLANTA CASA',         'MOLINOS DE COLOMBIA - PLANTA PEQUEÑA'),
(3, 'PLANTA BARRANQUILLA', 'BARRANQUILLA - PROCESAMIENTO EXTERNO'),
(4, 'OFICINA BUCARAMANGA', 'BUCARAMANGA - SEDE ADMINISTRATIVA');


-- Insertando los procesos operativos para la PLANTA GRANDE (id = 1)
-- Insertando los procesos operativos para la PLANTA GRANDE (id = 1)
INSERT INTO Planta_Procesos (id, planta_id, nombre, descripcion) VALUES
(1, 1, 'FILTRO PRENSA',    'Operación de la maquinaria de filtro prensa'),
(2, 1, 'MOLIENDA',         'Área principal de molienda y trituración'),
(3, 1, 'FLOTACIÓN',        'Piscinas o tanques del proceso de flotación'),
(4, 1, 'ANÁLISIS',         'Laboratorio o zona de análisis de calidad del material'),
(5, 1, 'PLANTA ELÉCTRICA', 'Operación de generadores y control de energía');
-- Insertando procesos/áreas administrativas para la OFICINA BUCARAMANGA (id = 4)
INSERT INTO Planta_Procesos (planta_id, nombre, descripcion) VALUES
(4, 'ADMINISTRACIÓN', 'Área de gerencia y labores administrativas generales'),
(4, 'FINANZAS',       'Pagos, egresos y control de nómina');



-- ====================================================================
--  BLOQUE 7 · TURNOS
--  Fuente: tabla `turnos` del export (registros operativos mayo 2026).
--  Mapeo: directo 1:1. Se omite la columna `quincena` (GENERATED ALWAYS).
--  ⚠️  IDs 122 y 123 del export son duplicados exactos de 64 y 65
--      (re-importación en v2). Se excluyen.
--  NOTA: Los primeros 63 IDs no aparecen en el export (probablemente
--        pertenecían a una versión anterior y no fueron exportados).
-- ====================================================================

INSERT INTO Turnos (id, fecha, id_empleado, id_tipo_turno, id_planta_proceso, horas_trabajadas, comentarios) VALUES
(64,  '2026-05-11', 7,  1, 2, 8.00, NULL),
(65,  '2026-05-11', 8,  2, 2, 6.00, NULL),
(66,  '2026-05-11', 9,  3, 2, 6.00, NULL),
(67,  '2026-05-11', 10, 2, 3, 6.00, NULL),
(68,  '2026-05-11', 11, 1, 3, 8.00, NULL),
(69,  '2026-05-11', 12, 2, 3, 8.00, NULL),
(70,  '2026-05-11', 13, 3, 3, 6.00, NULL),
(71,  '2026-05-11', 14, 2, 5, 8.00, NULL),
(72,  '2026-05-11', 15, 1, 5, 2.00, NULL),
(73,  '2026-05-12', 7,  1, 2, 6.00, NULL),
(74,  '2026-05-12', 8,  2, 2, 7.00, NULL),
(75,  '2026-05-12', 9,  3, 2, 6.00, NULL),
(76,  '2026-05-12', 10, 2, 3, 8.00, NULL),
(77,  '2026-05-12', 11, 1, 3, 6.00, NULL),
(78,  '2026-05-12', 12, 2, 3, 8.00, NULL),
(79,  '2026-05-12', 13, 3, 3, 6.00, NULL),
(80,  '2026-05-12', 14, 2, 1, 5.00, NULL),
(81,  '2026-05-12', 15, 1, 5, 8.00, NULL),
(82,  '2026-05-13', 7,  1, 2, 7.00, 'Se perdió 1h de molienda por soldadura'),
(83,  '2026-05-13', 8,  2, 2, 7.00, NULL),
(84,  '2026-05-13', 9,  3, 2, 7.00, NULL),
(85,  '2026-05-13', 10, 2, 3, 8.00, NULL),
(86,  '2026-05-13', 11, 1, 3, 7.00, NULL),
(87,  '2026-05-13', 12, 2, 3, 8.00, NULL),
(88,  '2026-05-13', 13, 3, 3, 8.00, NULL),
(89,  '2026-05-13', 14, 2, 5, 8.00, NULL),
(90,  '2026-05-13', 15, 1, 5, 7.00, NULL),
(91,  '2026-05-14', 7,  1, 2, 8.00, NULL),
(92,  '2026-05-14', 8,  2, 2, 6.00, 'Paro 20 min por taponamiento hidrociclon'),
(93,  '2026-05-14', 9,  3, 2, 8.00, NULL),
(94,  '2026-05-14', 10, 2, 3, 8.00, NULL),
(95,  '2026-05-14', 11, 1, 3, 8.00, NULL),
(96,  '2026-05-14', 12, 2, 3, 8.00, NULL),
(97,  '2026-05-14', 13, 3, 3, 8.00, NULL),
(98,  '2026-05-14', 14, 2, 1, 0.00, NULL),
(99,  '2026-05-14', 15, 1, 5, 8.00, NULL),
(100, '2026-05-15', 7,  1, 2, 8.00, NULL),
(101, '2026-05-15', 8,  2, 2, 6.00, NULL),
(102, '2026-05-15', 9,  3, 2, 6.00, NULL),
(103, '2026-05-15', 10, 2, 3, 8.00, NULL),
(104, '2026-05-15', 11, 1, 3, 8.00, NULL),
(105, '2026-05-15', 12, 2, 3, 8.00, NULL),
(106, '2026-05-15', 13, 3, 3, 8.00, NULL),
(107, '2026-05-15', 14, 2, 1, 9.00, NULL),
(108, '2026-05-15', 15, 1, 5, 6.00, 'Planta grande solo trabajó 6h'),
(109, '2026-05-16', 7,  1, 2, 1.00, 'Falla bomba agua, se soldó'),
(110, '2026-05-16', 8,  2, 2, 0.00, NULL),
(111, '2026-05-16', 9,  3, 2, 8.00, 'Se trabajó con dos molinos pequeños'),
(112, '2026-05-16', 10, 2, 3, 8.00, 'Limpiaron molinos y flotacion por cambio de material'),
(113, '2026-05-16', 11, 1, 3, 8.00, NULL),
(114, '2026-05-16', 12, 2, 3, 0.00, NULL),
(115, '2026-05-16', 13, 3, 3, 0.00, NULL),
(116, '2026-05-16', 14, 2, 1, 9.00, 'Se desocupó piscina de filtroprensa'),
(117, '2026-05-16', 15, 1, 5, 0.00, NULL),
(118, '2026-05-17', 7,  1, 2, 7.00, 'Trabajo molino pequeño'),
(119, '2026-05-17', 11, 1, 3, 0.00, 'No se laboró'),
(120, '2026-05-17', 14, 2, 1, 0.00, 'No se laboró'),
(121, '2026-05-17', 15, 1, 5, 0.00, 'No se laboró');
-- IDs 122 y 123 del export OMITIDOS — duplicados de 64 y 65 por re-importación.


-- ====================================================================
--  BLOQUE 8 · ZONA  (validación — 'Sin zona' ya en DDL)
-- ====================================================================
-- Zona id=1 ('Sin zona') ya insertada en el DDL.
-- ⚠️  FALTA INFORMACIÓN: el sistema anterior NO manejaba zonas geográficas.
--     Las minas no tenían zona asignada. Todas quedan en id_zona=1 ('Sin zona').
--     Definir zonas reales (Ej: Zona Mina 80, Zona Mina Negra) e insertar aquí:
--
-- INSERT INTO Zona (id, nombre, descripcion) VALUES
--     (2, 'ZONA SUR - MINAS 80/30',  'Área de minas OMAR, cercanía media'),
--     (3, 'ZONA ALTA - MINA NEGRA',  'Área Mina Negra, mayor distancia');


-- ====================================================================
--  BLOQUE 9 · TARIFA_ZONA
-- ====================================================================
-- ⚠️  FALTA INFORMACIÓN: sin zonas definidas, no hay tarifas por zona.
--     Insertar cuando se definan zonas reales. Ejemplo:
--
-- INSERT INTO Tarifa_Zona (id_zona, valor_tonelada, vigente_desde, activo) VALUES
--     (2, 120000.00, '2026-07-01', TRUE),
--     (3, 150000.00, '2026-07-01', TRUE);
--
-- Mientras tanto el sistema usa el fallback de Tarifas_Calculo.flete_ton_seca
-- (ya cargado por DDL: $100.000/ton seca).

INSERT INTO Zona (id, nombre, descripcion) VALUES
(1, 'General', 'Mina General'),
(2, 'Mina 30', 'Zona de extracción Mina 30'),
(3, 'Mina 80', 'Zona de extracción Mina 80'),
(4, 'Santa Rosa', 'Zona de extracción Santa Rosa'),
(5, 'Culo Alzado', 'Zona de extracción Culo Alzado'),
(6, 'Mina cachete', 'Zona de extracción Mina cachete');


 INSERT INTO Tarifa_Zona (id_zona, valor_tonelada, vigente_desde, activo) VALUES
     (3, 110000.00, '2026-07-01', TRUE),
     (5, 400000.00, '2026-07-01', TRUE),
     (1, 100000.00, '2026-07-01', TRUE),
     (6, 110000.00, '2026-07-01', TRUE);
     

-- ====================================================================
--  BLOQUE 10 · TABLAS TIPO_* (validación — ya en DDL)
-- ====================================================================
-- Todas las tablas con prefijo Tipos_ (Tipos_Material, Tipos_Turno,
-- Tipos_Alquiler, Tipos_Analisis, Tipos_Gasto_Operativo) ya fueron
-- cargadas por el DDL con los mismos datos que tenía el sistema anterior.
-- No se repiten aquí.


-- ====================================================================
--  BLOQUE 11 · MINERO
--  NUEVA TABLA en v4 — no existía en v1/v2.
--  Fuente: tabla `proveedores` del export (id_categoria = 4 'Transportador')
--          + tabla `mina` (campo `propietario`) + análisis de pagos históricos.
-- --------------------------------------------------------------------
--  LÓGICA DE EXTRACCIÓN (v1 mezclaba todo en `proveedores`):
--    • Old proveedores cat=4 con pagos de MATERIAL → son MINEROS
--    • Old proveedores cat=4 con alias de vehículo  → son DUENO_VOLQUETA
--    • La separación se validó cruzando `volqueta.id_proveedor` con `pagos`
--      donde categoría = 'Material' (id=1 en old sistema).
-- --------------------------------------------------------------------
--  METODO_CALCULO derivado del historial de `volqueta`:
--    • NAUM:          precio_por_gramo activo en historial → 'por_gramo'
--    • OMAR:          precio_por_tonelada en todos sus registros → 'por_tonelada'
--    • LEONEL:        precio_por_gramo=100000 en sus entradas → 'por_gramo'
--    • Resto:         sin suficientes datos → default 'por_tonelada'
-- --------------------------------------------------------------------
--  ⚠️  Datos bancarios y CC de mineros NO existían en el sistema anterior.
--      Completar con información real antes de configurar pagos.
--  ⚠️  CAMILO (id=7) tiene ROL DUAL: también aparece como Dueno_Volqueta (id=6).
--      Fue proveedor de material de MINA 30 en ciertos períodos Y dueño de camión.
-- ====================================================================

INSERT INTO Minero (id, nombre, titular, cc, alias, telefono, ciudad, banco, numero_cuenta, nequi, metodo_calculo, estado) VALUES
(1, 'NAUM',
    NULL, NULL, 'Naum', NULL, NULL, NULL, NULL, 0,
    'por_gramo', 'activo'),
    -- Proveedor habitual de MINA 30 (id=2). Pagos históricos con precio/gramo.
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(2, 'OMAR MINA 80',
    NULL, NULL, 'Omar', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- Propietario/operador de MINA 80 (id=1) y MINA NEGRA (id=5).
    -- Todos los pagos históricos usaron precio/tonelada.
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(3, 'LEONEL NAVARRO',
    NULL, NULL, 'Leonel', NULL, NULL, NULL, NULL, 0,
    'por_gramo', 'activo'),
    -- Propietario MINA 30 POZO 3 (id=12) y MINA AGUA (id=11).
    -- Historial con precio/gramo ($100.000/gr a tenor 10.8).
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(4, 'JEFERSON',
    NULL, NULL, 'Jeferson', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- Proveedor de material (pagos registrados en historial de `pagos`).
    -- ⚠️ Buscar información: ¿A cuál mina está asociado?
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(5, 'MARLON ARENAS',
    NULL, NULL, 'Marlon', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- Propietario MINA MARLON (id=7).
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(6, 'RICARDO POVEDA',
    NULL, NULL, 'Ricardo', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- Propietario CULO ALZADO (id=4). Material tipo Lodos/Relave.
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(7, 'CAMILO',
    NULL, NULL, 'Camilo', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- ⚠️ ROL DUAL: También es Dueno_Volqueta id=6 (titular: Luis Angel Furnieles).
    -- Como MINERO: proveyó material de MINA 30 en algunos períodos.
    -- ⚠️ Buscar: datos de contacto como minero (pueden diferir del titular bancario).

(8, 'ALEX MINA',
    NULL, NULL, 'Alex', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- Registrado como transportador en sistema anterior.
    -- Asociado posiblemente a MINA ALEX (id=9).
    -- ⚠️ Sin registros de pago en el export — confirmar si sigue activo.
    -- ⚠️ Buscar: CC, teléfono, banco, número de cuenta.

(9, 'JOSE SAN ISIDRO',
    NULL, NULL, 'Jose', NULL, NULL, NULL, NULL, 0,
    'por_tonelada', 'activo'),
    -- Propietario de MINA SAN ISIDRO (id=6) según campo `propietario` del export.
    -- ⚠️ FALTA INFORMACIÓN: apellido, CC, teléfono, datos bancarios.
    -- ⚠️ Buscar: nombre completo y todos sus datos de pago.

(10, 'JAINIER',
    NULL, NULL, 'Jainier', NULL, NULL, NULL, NULL, 0,
    'por_gramo', 'activo');
    -- Propietario de MINA SAN ISIDRO (id=6) según campo `propietario` del export.
    -- ⚠️ FALTA INFORMACIÓN: apellido, CC, teléfono, datos bancarios.
    -- ⚠️ Buscar: nombre completo y todos sus datos de pago.





-- ====================================================================
--  BLOQUE 12 · DUENO_VOLQUETA
--  NUEVA TABLA en v4 — no existía en v1/v2 (estaba mezclada en `proveedores`).
--  Fuente: datos crudos proporcionados por el usuario + export antiguo.
-- --------------------------------------------------------------------
--  COLUMNAS:
--    nombre         → alias operativo (cómo se le conoce en la operación)
--    titular        → nombre del titular de la cuenta bancaria (para pagos)
--    cc             → cédula del TITULAR (verificación bancaria Bancolombia)
--    banco/cuenta   → datos de la cuenta de ahorro
--    alias          → nombre corto para la interfaz
-- --------------------------------------------------------------------
--  ⚠️  CAMILO (id=6): ROL DUAL con Minero id=7. Misma persona.
--  ⚠️  CLIXMAN (id=7): CC falta en los datos proporcionados — actualizar.
--  ⚠️  GEIBER (id=2) y NELSON (id=9): sin datos — buscar información.
--  ⚠️  JOEL (id=10) y JARAMILLO (id=11): existían en sistema anterior como
--      transportadores pero NO estaban en la lista provista — datos POR DEFINIR.
--  NOTA: MySQL permite múltiples NULL en columnas UNIQUE — no hay conflicto.
-- ====================================================================

INSERT INTO Dueno_Volqueta (id, nombre, titular, cc, banco, numero_cuenta, alias, telefono, ciudad, nequi, estado) VALUES
(1,  'ANIBAL',
     'Zusan Cristina Santiago', '1193034408',
     'Bancolombia', '29779958688', 'Anibal', NULL, NULL, 0, 'activo'),

(2,  'GEIBER',
     NULL, NULL, NULL, NULL,
     'Geiber', NULL, NULL, 0, 'activo'),
     -- ⚠️ Buscar información bancaria completa.

(3,  'ISAIAS',
     'Osmel Isaia Cabezas', '1012410300',
     'Bancolombia', '91238946773', 'Isaias', NULL, NULL, 0, 'activo'),

(4,  'DEIMER',
     'Leydis Garcia Rivera', '1096223260',
     'Bancolombia', '91286243750', 'Deimer', NULL, NULL, 0, 'activo'),

(5,  'CARLOS',
     'Carlos Acuña Povea', '12401398',
     'Bancolombia', '95107240757', 'Pata de palo', NULL, NULL, 0, 'activo'),
     -- Alias histórico en el sistema anterior: 'CARLOS PATA PALO'.

(6,  'CAMILO',
     'Luis Angel Furnieles', '1047391774',
     'Bancolombia', '48427520806', 'Camilo', NULL, NULL, 0, 'activo'),
     -- ⚠️ ROL DUAL: también es Minero id=7.

(7,  'CLIXMAN',
     'Elianny Jimenez', NULL,
     'Bancolombia', '29766712850', 'Clixman', NULL, NULL, 0, 'activo'),
     -- ⚠️ CC faltante en los datos proporcionados — actualizar cuando se obtenga.
     -- Alias en sistema anterior: 'CLISMA VOLQUETA'.

(8,  'MANUEL',
     'Alfred Sanguino Guevara', '88280855',
     'Bancolombia', '31872419031', 'Manuel', NULL, NULL, 0, 'activo'),
     -- En el sistema anterior también controlaba 'VOLQUETA AMARILLA'
     -- (gasto_operativo: 'Adelanto Volqueta Amarilla Manuel').
     -- → La 'Volqueta Amarilla' debe registrarse en Volqueta_Vehiculo con id_dueno=8.

(9,  'NELSON',
     NULL, NULL, NULL, NULL,
     'Nelson', NULL, NULL, 0, 'activo'),
     -- ⚠️ Buscar información bancaria completa.
     -- En sistema anterior era proveedor id=30, categoría Dotación (probablemente error).

(10, 'JOEL',
     NULL, NULL, NULL, NULL,
     'Joel', NULL, NULL, 0, 'activo'),
     -- Existía en sistema anterior como 'JOEL VOLQUETA' (proveedores id=13).
     -- ⚠️ No estaba en la lista provista. Buscar datos completos.

(11, 'JARAMILLO',
     NULL, NULL, NULL, NULL,
     'Jaramillo', NULL, NULL, 0, 'activo');
     -- Existía en sistema anterior como 'JARAMILLO' (proveedores id=15).
     -- ⚠️ No estaba en la lista provista. Confirmar si sigue activo y buscar datos.


-- ====================================================================
--  BLOQUE 13 · PROVEEDORES
--  Fuente: tabla `proveedores` del export — EXCLUIDOS los de id_categoria=4
--          (Transportador), que migraron a Minero o Dueno_Volqueta.
-- --------------------------------------------------------------------
--  CAMBIOS DE CATEGORÍA APLICADOS (correcciones respecto al sistema anterior):
--    • ANGIE LORENA CAMACHO: old cat=1(Dotación) → new cat=7(Quimicos)  [CORREGIDA]
--    • INSUMINER QUIMICOS:   old cat=1(Dotación) → new cat=7(Quimicos)  [CORREGIDA]
--    • ELIZABETH AMADO:      old cat=1(Dotación) → new cat=7(Quimicos)  [CORREGIDA]
--    • MULA GUILLERMO:       old cat=5(Maquinaria)→ new cat=6(Transporte_Mula) [RECLASIFICADA]
--  CAMBIO DE IDs DE CATEGORÍA (por nueva tabla Categorias_Proveedor en v4):
--    • old Maquinaria(5)    → new id=4(Maquinaria)
--    • old Procesamiento(6) → new id=5(Procesamiento)
--  NOTA: `metodo_calculo` del sistema anterior en Proveedores ya NO existe
--        en la tabla Proveedores de v4 (ese campo es ahora de Minero).
-- ====================================================================

INSERT INTO Proveedores (id, nombre, id_categoria, contacto, telefono, ciudad, alias, nequi, compra_realizada, estado) VALUES
(1,  'AHK LABORATORIO',
     2, NULL, NULL, NULL, NULL, 0,
     'Análisis de minerales', 'activo'),

(2,  'SGS LABORATORIO',
     2, NULL, NULL, NULL, NULL, 0,
     'Análisis de minerales', 'activo'),

(3,  'ACTLABS LABORATORIO',
     2, 'JHOAN JAIMES', '3104625334', 'MEDELLIN', NULL, 0,
     'Análisis de minerales', 'activo'),

(4,  'ALPHA LABORATORIO',
     2, NULL, '3133640426', 'BOGOTA', NULL, 0,
     'Análisis de minerales', 'activo'),

(5,  'AMBROSIO CARRILLO LABORATORIO',
     2, NULL, '3172334235', 'BUCARAMANGA', NULL, 0,
     'Análisis de minerales', 'activo'),

(6,  'CONSURRECON COMBUSTIBLE',
     3, NULL, NULL, NULL, NULL, 0,
     'ACPM / Gasolina', 'activo'),
     -- Saldo pendiente al corte: ~$28.955.000 (historial de pagos antiguo).

(7,  'ALVELIZ LTDA COMBUSTIBLE',
     3, NULL, '3184397395', 'GIRON', NULL, 0,
     'ACPM / Gasolina', 'activo'),

(8,  'CARLOS EDUARDO RINCON',
     4, NULL, '3108698763', 'BUCARAMANGA', NULL, 0,
     'Alquiler camioneta / maquinaria', 'activo'),
     -- Historial: alquiler camioneta mensual $7.800.000-$8.100.000.

(9,  'DIEGO RAMIREZ COMPRESOR',
     4, NULL, NULL, NULL, NULL, 0,
     'Alquiler compresor', 'activo'),

(10, 'MULA GUILLERMO PAULA CALDERON',
     6, NULL, NULL, NULL, NULL, 0,
     'Transporte concentrado a Barranquilla', 'activo'),
     -- ⚠️ Reclasificado: era Maquinaria en sistema anterior → Transporte_Mula en v4.
     -- Saldo pendiente al corte: ~$22.225.000.

(11, 'ANGIE LORENA CAMACHO',
     7, NULL, '3227633001', 'SANTA ROSA', NULL, 0,
     'Insumos químicos (reactivos)', 'activo'),
     -- ⚠️ Categoría CORREGIDA: era Dotación → ahora Quimicos.

(12, 'INSUMINER QUIMICOS',
     7, NULL, NULL, NULL, NULL, 0,
     'Insumos químicos (cianuro, zinc, reactivos)', 'activo'),
     -- ⚠️ Categoría CORREGIDA: era Dotación → ahora Quimicos.

(13, 'ELIZABETH AMADO LOS GEMELOS',
     7, NULL, NULL, NULL, NULL, 0,
     'Insumos químicos (sulfato, bicarbonato)', 'activo');
     -- ⚠️ Categoría CORREGIDA: era Dotación → ahora Quimicos.
     -- Historial: factura SUQUIN 5127 - Sulfato y Bicarbonato.


-- ====================================================================
--  BLOQUE 14 · MINA
--  Fuente: tabla `mina` del export.
--  CAMBIOS vs v2/v3:
--    · Eliminado campo `id_tipo_material` (el tipo ahora va por entrada)
--    · Eliminado campo `tipo_material` (TEXT — mismo motivo)
--    · Añadido `id_minero` → FK a Minero (mapeado en esta migración)
--    · Añadido `id_zona`   → FK a Zona   (todas = id=1 'Sin zona' por ahora)
-- --------------------------------------------------------------------
--  DECISIONES DE MAPEO id_minero (basadas en pagos históricos + propietario):
--    • MINA 80 (id=1):       propietario='OMAR'         → Minero id=2
--    • MINA 30 (id=2):       propietario='OMAR' PERO pagos históricos → NAUM (id=1)
--                            ⚠️ Verificar: ¿Omar es dueño y NAUM el operador/mediador?
--    • MINA CACHETE (id=3):  sin propietario ni pagos identificados → NULL
--    • CULO ALZADO (id=4):   propietario='RICARDO POVEDA' y pagos → Minero id=6
--    • MINA NEGRA (id=5):    propietario='OMAR' y pagos → Minero id=2
--    • SAN ISIDRO (id=6):    propietario='JOSE' → Minero id=9 (POR DEFINIR)
--    • MINA MARLON (id=7):   propietario='MARLON ARENAS' → Minero id=5
--    • MINA JAINER (id=8):   sin datos → NULL ⚠️ buscar información
--    • MINA ALEX (id=9):     sin propietario en export; asociado a ALEX → id=8 (incierto)
--    • MINA AZUL (id=10):    sin datos → NULL ⚠️ buscar información
--    • MINA AGUA (id=11):    propietario='LEONEL' → LEONEL NAVARRO id=3
--    • MINA 30 POZO 3(id=12): propietario='LEONEL NAVARRO' → Minero id=3
-- ====================================================================

INSERT INTO Mina (id, nombre, id_minero, id_zona, ubicacion, estado) VALUES
(1,  'MINA 80',            2,    3, NULL, 'activa'),   -- OMAR
(2,  'MINA 30 (OMAR)',     2,    2, NULL, 'activa'),   -- Frente de OMAR en Mina 30
(3,  'MINA CACHETE',       NULL, 6, NULL, 'activa'),   
(4,  'CULO ALZADO',        6,    5, NULL, 'activa'),   -- RICARDO POVEDA
(5,  'MINA NEGRA',         2,    1, NULL, 'activa'),   -- OMAR
(6,  'SAN ISIDRO',         9,    1, NULL, 'activa'),   -- JOSE
(7,  'MINA MARLON',        5,    1, NULL, 'activa'),   -- MARLON
(8,  'MINA JAINER',        10, 	 1, NULL, 'activa'),   
(9,  'MINA ALEX',          8,    1, NULL, 'activa'),   -- ALEX
(10, 'MINA AZUL',          NULL, 1, NULL, 'activa'),   
(11, 'MINA AGUA',          3,    1, NULL, 'activa'),   -- LEONEL
(12, 'MINA 30 POZO 3',     3,    2, NULL, 'activa'),   -- LEONEL en Mina 30
(13, 'MINA San Isidro',    3,    1, NULL, 'activa'),   -- LEONEL
(14, 'MINA 30 (NAUM)',     1,    2, NULL, 'activa');   -- NUEVO: Frente de NAUM en Mina 30


-- ====================================================================
--  BLOQUE 15 · PRECIO_MATERIAL
--  Fuente: tabla `precio_material` del export.
--  CAMBIOS vs v2/v3:
--    · Añadido campo `metodo` ENUM('por_gramo','por_tonelada') — antes implícito
--    · Añadido `id_minero` (NULL = precio global, aplica a todos)
--    · Añadido `id_zona`   (NULL = independiente de zona)
--  NOTA: el sistema anterior manejaba únicamente precios globales.
--        Se migran como globales (id_minero=NULL, id_zona=NULL).
--        La asignación por minero específico puede configurarse luego.
--  CAMBIO DE ARQUITECTURA: la tarifa 'excedente_ton_seca' del sistema anterior
--        NO EXISTE en v4. El excedente se calcula en trigger al insertar
--        en material_planta_entrada.
-- ====================================================================

INSERT INTO Precio_Material
    (id, id_minero, id_zona, metodo, precio_por_gramo, precio_por_tonelada,
     intervalo_tenor_min, intervalo_tenor_max, fecha_inicio, activo)
VALUES
-- Precios POR TONELADA (vigentes según historial)
(1,  NULL, NULL, 'por_tonelada', NULL,       100000.00,  2.0000,  2.9000, '2026-01-01', 1),
(2,  NULL, NULL, 'por_tonelada', NULL,       150000.00,  3.0000,  3.9000, '2026-01-01', 1),
(3,  NULL, NULL, 'por_tonelada', NULL,       280000.00,  4.0000,  4.9000, '2026-04-27', 1),
(4,  NULL, NULL, 'por_tonelada', NULL,       400000.00,  5.0000,  5.9000, '2026-04-11', 1),
(5,  NULL, NULL, 'por_tonelada', NULL,       650000.00,  6.0000,  7.9000, '2026-05-23', 1),
(6,  NULL, NULL, 'por_tonelada', NULL,       850000.00,  8.0000,  9.9000, '2026-02-01', 1),
(7,  NULL, NULL, 'por_tonelada', NULL,      1000000.00, 10.0000, 10.9000, '2026-03-01', 1),
-- Precios POR GRAMO (concentrado con tenor variable — escala de gramos de Au)
(8,  NULL, NULL, 'por_gramo',    65000.00,  NULL,        4.0000,  6.0000, '2026-01-01', 1),
(9,  NULL, NULL, 'por_gramo',    72000.00,  NULL,        6.1000,  7.9000, '2026-01-01', 1),
(10, NULL, NULL, 'por_gramo',    85000.00,  NULL,        8.0000, 10.0000, '2026-01-01', 1),
(11, NULL, NULL, 'por_gramo',   100000.00,  NULL,       10.1000, 12.0000, '2026-01-01', 1),
(12, NULL, NULL, 'por_gramo',   115000.00,  NULL,       12.1000, 14.0000, '2026-01-01', 1),
(13, NULL, NULL, 'por_gramo',   125000.00,  NULL,       14.1000, 16.0000, '2026-01-01', 1);

SELECT * FROM Precio_Material 
WHERE activo = 1 
  AND (id_minero = ? OR id_minero IS NULL) 
  AND (id_zona = ? OR id_zona IS NULL)
  AND (? BETWEEN intervalo_tenor_min AND intervalo_tenor_max)
ORDER BY id_minero DESC, id_zona DESC 
LIMIT 1;


-- ====================================================================
--  BLOQUE 16 · VOLQUETA_VEHICULO  (= "volquetas" del esquema v4)
-- ====================================================================
-- ❌ NO SE PUEDE POBLAR — FALTA INFORMACIÓN CRÍTICA
--
-- El sistema anterior (v1/v2) NO tenía un catálogo de vehículos.
-- La tabla `volqueta` en v1/v2 era un REGISTRO DE ENTRADA DE MATERIAL
-- (equivalente a `material_planta_entrada` en v4), NO un catálogo de trucks.
--
-- Para poblar Volqueta_Vehiculo se necesita, por cada camión activo:
--   · placa            VARCHAR(15) UNIQUE NOT NULL — OBLIGATORIO
--   · id_dueno_volqueta INT NOT NULL (referencia a Dueno_Volqueta)
--   · tipo_vehiculo    Ej: 'Doble troque', 'Sencillo', 'Tracto-camión'
--   · conductor        Nombre del conductor habitual
--   · conductor_cc     Cédula del conductor
--   · capacidad_ton    Toneladas de carga
--
-- Se conocen los DUEÑOS (Bloque 12) pero NO las placas.
-- Recopilar físicamente esta información y ejecutar:
--
-- INSERT INTO Volqueta_Vehiculo
--     (id_dueno_volqueta, placa, tipo_vehiculo, conductor, conductor_cc, capacidad_ton, activo)
-- VALUES
--     (5,  'XYZ-123', 'Doble troque', 'Carlos Acuña', '12401398',  30.00, 1),  -- Carlos
--     (8,  'ABC-456', 'Doble troque', 'Nombre conductor', 'CC',   30.00, 1),  -- Manuel (truck 1)
--     (8,  'DEF-789', 'Sencillo',     'Nombre conductor', 'CC',   18.00, 1),  -- Manuel (Volqueta Amarilla)
--     ...;


-- ====================================================================

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES   = 1;


-- ====================================================================
--  RESUMEN EJECUTIVO DE ALERTAS Y PENDIENTES POST-MIGRACIÓN
-- ====================================================================
--
--  ❌ SIN DATOS / BLOQUEAN OPERACIÓN:
--  [01] Volqueta_Vehiculo: VACÍA. Sin placas no se pueden registrar entradas.
--  [02] Usuarios.password_hash: '123' en texto plano — riesgo de seguridad.
--
--  ⚠️  DATOS INCOMPLETOS / COMPLETAR PRONTO:
--  [03] Empleados: 26 cédulas son placeholders ('0000000001'...).
--  [04] Dueno_Volqueta GEIBER (id=2): sin datos bancarios.
--  [05] Dueno_Volqueta NELSON (id=9): sin datos bancarios.
--  [06] Dueno_Volqueta CLIXMAN (id=7): CC faltante.
--  [07] Dueno_Volqueta JOEL (id=10): todos los datos por definir.
--  [08] Dueno_Volqueta JARAMILLO (id=11): todos los datos por definir.
--  [09] Minero: CC y datos bancarios de los 9 registros son NULL.
--  [10] Minero id=9 (JOSE): apellido, CC y datos de pago desconocidos.
--  [11] Minero id=4 (JEFERSON): confirmar mina asociada.
--  [12] Minero id=8 (ALEX): confirmar asociación con MINA ALEX (id=9).
--
--  📋 CONFIGURACIÓN PENDIENTE:
--  [13] Zona: definir zonas geográficas reales → luego Tarifa_Zona.
--  [14] Mina id=2 (MINA 30): confirmar si NAUM es el minero habitual o es OMAR.
--  [15] Minas 3,8,10 (CACHETE, JAINER, AZUL): sin propietario identificado.
--  [16] Permisos: tabla vacía — definir permisos del sistema con el equipo técnico.
--  [17] Materiales: tabla vacía — insertar si se usará el módulo de cotizaciones.
--
--  🔁 CAMBIOS ARQUITECTURALES v1→v4 (para referencia del equipo):
--  • `excedente_ton_seca` en Tarifas_Calculo ELIMINADA en v4.
--    El excedente ahora se registra automáticamente en tabla Excedente (trigger).
--  • Old `proveedores` cat=4 (Transportador) DIVIDIDOS en:
--    → Minero (quienes proveen material de minas)
--    → Dueno_Volqueta (quienes poseen los camiones)
--  • Old `volqueta` (la tabla) renombrada/restructurada en v4 como
--    `material_planta_entrada`. Los vehículos son ahora `Volqueta_Vehiculo`.
--  • CAMILO tiene ROL DUAL: Minero id=7 Y Dueno_Volqueta id=6.
--  • Mina.id_tipo_material ELIMINADO en v4 (el tipo va en cada entrada).
--
-- ====================================================================
--  FIN DEL SEED SCRIPT
-- ====================================================================