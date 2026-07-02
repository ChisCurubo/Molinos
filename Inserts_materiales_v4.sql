-- ====================================================================
--  MIGRACIÓN DATOS REALES 2026 — ARCHIVO ÚNICO DEFINITIVO
--  Fuentes: Volquetas_2026.xlsx + RESUMEN_MATERIALES_COSTEO_2026.xlsx
--
--  PROCESO SIMULADO EN 6 FASES (refleja el flujo real del sistema):
--
--  FASE 0 · Maestros nuevos (mineros, minas, vehículos)
--  FASE 1 · Operador registra la llegada de la volqueta
--            → INSERT material_planta_entrada (solo campos físicos):
--              id, numero_volqueta, id_mina, id_vehiculo, id_tipo_material,
--              fecha_llegada, peso_llegada_planta
--              porcentaje_humedad=0 PLACEHOLDER (campo NOT NULL sin default)
--              Todos los campos derivados: NULL hasta que llega el análisis
--  FASE 2 · Lab devuelve la muestra (Analisis tipo Cabeza, 89 entradas)
--            → INSERT analisis:
--              · au_gr_x_ton      = tenor REAL (lo que el lab midió)
--              · au_gr_x_ton_falso = tenor que se le muestra al minero
--                                   (normalmente tenor_real − 2, o manual)
--              · toneladas_humedas / toneladas_secas
--              · porcentaje_humedad real
--  FASE 3 · Backend/BD actualiza material_planta_entrada desde el análisis
--            → UPDATE (89 filas):
--              porcentaje_humedad ← analisis.porcentaje_humedad
--              gramos_humedad     ← peso_bruto × porcentaje_humedad
--              total_material_seco← analisis.toneladas_secas
--              tenor              ← analisis.au_gr_x_ton_falso (el que ve el minero)
--              total_gramos       ← total_material_seco × tenor
--  FASE 4 · Precio: lookup en Precio_Material por tenor + método minero
--            → UPDATE (89 filas):
--              id_precio, precio_por_gramo, precio_por_tonelada
--              precio_total:
--               · por_gramo    → total_gramos × precio_por_gramo
--               · por_tonelada → total_material_seco × precio_por_tonelada
--            Nota: 15 entradas tienen precio histórico sin franja equivalente
--            en la tabla actual — id_precio=NULL, precio directo del costeo.
--  FASE 5 · Costos y totales
--            → UPDATE (89 filas):
--              excedente_calculado     = total_material_seco × $100,000
--              costo_cargue            = $300,000 (valor estándar, varía)
--              costo_bascula           = $0 (no aplica actualmente)
--              costo_volqueta          = peso_bruto × tarifa_zona
--                (tarifa_zona: Mina 80→$110k | Culo Alzado→$400k |
--                 Mina Cachete→$110k | General→$100k | Mina 30→$100k)
--              total_costos_operativos = cargue + bascula + maquila + adicional + volqueta
--              total_material          = precio_total + total_costos + excedente
--  FASE 6 · Agua_Planta (registros independientes)
--            → INSERT agua_planta (49 viajes, Deimer 4 + Nelson 45)
--
--  COBERTURA TOTAL:
--    · 178 entradas de material (ene-jun 2026, todo el ledger)
--      → 89 con análisis completo (fases 2-5 aplicadas)
--      → 89 pendientes (humedad=0 placeholder): buscar con
--          WHERE comentarios LIKE 'PENDIENTE_HUMEDAD_TENOR%'
--    · 89 Analisis tipo Cabeza (fuente real de humedad/tenor)
--    · 49 Agua_Planta (Deimer + Nelson)
-- ====================================================================

use molinos_erp_v4;
SET FOREIGN_KEY_CHECKS = 0;

-- ====================================================================
-- FASE 0 · MAESTROS
-- ====================================================================
INSERT INTO minero (id, nombre, alias, metodo_calculo, estado) VALUES
(11, 'CARLOS',      'Carlos (Mina Cachete)', 'por_tonelada', 'activo'),
(12, 'TATA CARLOS', 'Tata Carlos',           'por_tonelada', 'activo'),
(13, 'JARAMILLO',   'Jaramillo',             'por_gramo',    'activo');
-- cc/banco/numero_cuenta quedan NULL (no vienen en el Excel).
-- JARAMILLO: rol dual — ya es Dueno_Volqueta id=11.

UPDATE mina SET id_minero = 11 WHERE id = 3;  -- MINA CACHETE → Carlos

INSERT INTO mina (id, nombre, id_minero, id_zona, ubicacion, estado) VALUES
(15,'MINA 30 (CAMILO)',    7, 2,'Zona Mina 30 — entregas de Camilo (vía Rodrigo)','activa'),
(16,'SANTA ROSA',         12, 4,'Zona Santa Rosa — entregas de Tata Carlos',      'activa'),
(17,'MINA 30 (JARAMILLO)',13, 2,'Zona Mina 30 — entregas de Jaramillo',           'activa'),
(18,'MINA 30 (ALEX)',      8, 2,'Zona Mina 30 — entregas de Alex',                'activa');

INSERT INTO volqueta_vehiculo (id, id_dueno_volqueta, placa, tipo_vehiculo, activo) VALUES
(1,1,'PENDIENTE-01','Volqueta',1),(2,2,'PENDIENTE-02','Volqueta',1),
(3,3,'PENDIENTE-03','Volqueta',1),(4,4,'PENDIENTE-04','Volqueta',1),
(5,5,'PENDIENTE-05','Volqueta',1),(6,6,'PENDIENTE-06','Volqueta',1),
(7,7,'PENDIENTE-07','Volqueta',1),(8,8,'PENDIENTE-08','Volqueta',1),
(9,9,'PENDIENTE-09','Volqueta',1),(10,10,'PENDIENTE-10','Volqueta',1),
(11,11,'PENDIENTE-11','Volqueta',1);

-- ====================================================================
-- FASE 1 · OPERADOR REGISTRA LLEGADA DE LA VOLQUETA (178 entradas)
-- porcentaje_humedad=0.0000 es PLACEHOLDER (campo NOT NULL sin default).
-- Todos los campos de análisis/precio/costos: NULL (aún no calculados).
-- ====================================================================
INSERT INTO material_planta_entrada
  (id, numero_volqueta, id_mina, id_vehiculo, id_tipo_material, fecha_llegada,
   peso_llegada_planta, porcentaje_humedad, comentarios)
VALUES
(1, 1, 12, 1, 1, '2026-01-27', 6, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(2, 1, 15, 1, 1, '2026-01-30', 12.39, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(3, 2, 4, 1, 5, '2026-01-30', 10.03, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(4, 3, 4, 1, 5, '2026-01-30', 11.12, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(5, 2, 15, 1, 1, '2026-02-14', 13.89, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(6, 1, 14, 3, 1, '2026-02-04', 12.49, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(7, 4, 4, 2, 5, '2026-02-05', 8.86, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(8, 1, 6, 2, 1, '2026-02-09', 9.42, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(9, 2, 6, 4, 1, '2026-02-06', 8.95, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(10, 2, 14, 4, 1, '2026-02-12', 10.54, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(11, 1, 1, 4, 2, '2026-02-20', 10.7, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(12, 2, 1, 5, 2, '2026-02-20', 13.59, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(13, 3, 14, 1, 1, '2026-02-20', 11.7, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(14, 3, 1, 4, 2, '2026-02-21', 11.31, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(15, 4, 1, 1, 2, '2026-02-21', 12.09, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(16, 5, 4, 1, 5, '2026-02-23', 11.36, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(17, 5, 1, 4, 2, '2026-02-26', 10.89, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(18, 6, 1, 4, 2, '2026-02-27', 11.11, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(19, 7, 1, 4, 2, '2026-02-28', 10.89, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(20, 4, 14, 1, 1, '2026-03-01', 12.76, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(21, 8, 1, 1, 2, '2026-03-02', 10.56, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(22, 2, 12, 1, 1, '2026-03-03', 10.47, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(23, 5, 14, 1, 1, '2026-03-04', 12.42, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(24, 3, 12, 1, 1, '2026-03-05', 11.46, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(25, 6, 14, 4, 1, '2026-03-06', 11.18, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(26, 7, 14, 1, 1, '2026-03-06', 11.94, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(27, 1, 11, 1, 5, '2026-03-07', 8.82, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(28, 2, 11, 1, 5, '2026-03-09', 9.85, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(29, 3, 11, 5, 5, '2026-03-09', 8.94, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(30, 8, 14, 3, 1, '2026-03-09', 12.8, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(31, 1, 1, 5, 2, '2026-03-10', 13.09, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(32, 5, 12, 1, 1, '2026-03-11', 11.28, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(33, 10, 1, 5, 2, '2026-03-11', 12.89, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(34, 6, 12, 1, 1, '2026-03-11', 11.1, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(35, 11, 1, 5, 2, '2026-03-12', 12.97, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(36, 10, 14, 4, 1, '2026-03-14', 12.94, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(37, 2, 1, 5, 2, '2026-03-16', 13.15, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(38, 1, 6, 5, 1, '2026-03-16', 8.83, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(39, 2, 6, 1, 1, '2026-03-16', 9.75, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(40, 11, 14, 4, 1, '2026-03-17', 12.82, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(41, 12, 1, 1, 2, '2026-03-17', 11.62, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(42, 3, 1, 1, 2, '2026-03-17', 11.52, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(43, 12, 14, 4, 1, '2026-03-18', 12.41, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(44, 13, 1, 5, 2, '2026-03-18', 13.96, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(45, 14, 1, 1, 2, '2026-03-18', 11.64, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(46, 8, 12, 1, 1, '2026-03-19', 10.65, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(47, 1, 1, 1, 2, '2026-03-20', 11.36, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(48, 15, 1, 4, 2, '2026-03-18', 10.08, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(49, 16, 1, 1, 2, '2026-03-18', 10.64, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(50, 4, 1, 5, 2, '2026-03-21', 13.12, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(51, 13, 14, 6, 1, '2026-03-23', 25.79, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(52, 1, 4, 1, 1, '2026-03-23', 10.74, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(53, 6, 4, 1, 5, '2026-03-23', 9.44, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(54, 17, 1, 1, 1, '2026-03-24', 10.57, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(55, 18, 1, 5, 1, '2026-03-24', 12.529, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(56, 14, 14, 6, 1, '2026-03-23', 22.18, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(57, 9, 12, 1, 1, '2026-03-19', 10.62, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(58, 19, 1, 5, 2, '2026-03-24', 12.89, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(59, 15, 14, 6, 1, '2026-03-27', 26.79, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(60, 2, 4, 1, 1, '2026-03-27', 11.07, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(61, 3, 4, 1, 1, '2026-03-27', 11.1, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(62, 16, 14, 6, 1, '2026-03-28', 23.26, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(63, 5, 1, 5, 2, '2026-03-28', 12.49, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(64, 20, 1, 1, 2, '2026-03-28', 10.76, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(65, 1, 15, 6, 1, '2026-03-29', 25.1, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(66, 2, 1, 5, 1, '2026-04-01', 8.89, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(67, 1, 1, 5, 2, '2026-04-02', 12.42, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(68, 10, 12, 5, 1, '2026-04-09', 11.68, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(69, 3, 1, 4, 1, '2026-04-09', 8.86, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(70, 17, 14, 1, 1, '2026-04-09', 13.02, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(71, 6, 1, 5, 2, '2026-04-10', 12.76, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(72, 11, 12, 4, 1, '2026-04-10', 9.04, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(73, 21, 1, 1, 2, '2026-04-11', 11.71, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(74, 7, 1, 5, 2, '2026-04-11', 12.7, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(75, 22, 1, 1, 2, '2026-04-13', 11.71, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(76, 18, 14, 5, 1, '2026-04-14', 13.02, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(77, 19, 14, 7, 1, '2026-04-19', 12.47, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(78, 12, 12, 2, 1, '2026-04-24', 13.62, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(79, 23, 1, 4, 2, '2026-04-27', 8.59, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(80, 24, 1, 8, 2, '2026-04-28', 12.42, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(81, 25, 1, 7, 2, '2026-04-28', 7.85, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(82, 26, 1, 8, 2, '2026-04-29', 10.97, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(83, 13, 12, 8, 1, '2026-04-30', 10.54, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(84, 27, 1, 5, 2, '2026-04-30', 12.1, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(85, 28, 1, 8, 2, '2026-05-01', 12.44, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(86, 14, 12, 4, 2, '2026-05-01', 9.88, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(87, 9, 1, 1, 2, '2026-03-10', 12.27, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(88, 1, 4, 1, 2, '2026-01-29', 2.843, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(89, 1, 4, 1, 2, '2026-01-29', 4, 0.0000, 'Entrada registrada — análisis disponible, campos actualizados en FASES 3-5.'),
(90, 86, 12, 1, 2, '2025-12-31', 11.31, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(91, 26, 6, 5, 2, '2026-01-02', 18.656, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(92, 4, 12, 1, 2, '2026-03-08', 11.99, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(93, 9, 14, 4, 2, '2026-03-12', 11.94, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(94, 7, 12, 1, 2, '2026-03-16', 12.21, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(95, 1, 4, 5, 2, '2026-03-12', 4, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(96, 2, 15, 6, 2, '2026-04-18', 18.82, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(97, 4, 4, 7, 2, '2026-04-24', 15.9, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(98, 5, 4, 7, 2, '2026-04-24', 17.53, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(99, 20, 14, 4, 2, '2026-04-24', 9.14, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(100, 1, 4, 4, 2, '2026-04-25', 14.463999999999999, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(101, 6, 4, 7, 2, '2026-04-25', 10.35, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(102, 21, 14, 4, 2, '2026-04-27', 11.6, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(103, 29, 1, 5, 2, '2026-05-01', 10.84, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(104, 1, 12, 5, 2, '2026-02-27', 11.2, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(105, 30, 1, 8, 2, '2026-05-04', 13.21, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(106, 1, 3, 5, 2, '2026-05-05', 10.58, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(107, 31, 1, 8, 2, '2026-05-05', 12.64, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(108, 32, 1, 8, 2, '2026-05-06', 12.77, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(109, 33, 1, 7, 2, '2026-05-06', 8.93, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(110, 2, 3, 5, 2, '2026-05-06', 12.09, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(111, 34, 1, 8, 2, '2026-05-07', 12.39, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(112, 22, 14, 4, 2, '2026-05-07', 11.57, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(113, 15, 12, 3, 2, '2026-05-07', 12.49, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(114, 16, 12, 4, 2, '2026-05-09', 10.96, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(115, 1, 16, 7, 2, '2026-05-10', 14.44, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(116, 2, 16, 7, 2, '2026-05-10', 13.13, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(117, 35, 1, 8, 2, '2026-05-11', 11.74, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(118, 36, 1, 2, 2, '2026-05-11', 12.4, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(119, 17, 12, 1, 2, '2026-05-11', 12.21, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(120, 37, 1, 7, 2, '2026-05-12', 9.49, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(121, 9, 1, 2, 2, '2026-05-12', 10.35, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(122, 38, 1, 9, 2, '2026-05-12', 8.89, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(123, 39, 1, 7, 2, '2026-05-12', 10.73, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(124, 18, 12, 1, 2, '2026-05-12', 12.11, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(125, 8, 1, 8, 2, '2026-05-13', 10.35, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(126, 1, 1, 8, 2, '2026-05-13', 13.45, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(127, 19, 12, 1, 2, '2026-05-13', 11.4, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(128, 40, 1, 2, 2, '2026-05-13', 10.72, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(129, 20, 12, 1, 2, '2026-05-14', 10.84, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(130, 21, 12, 2, 2, '2026-05-14', 13.08, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(131, 3, 15, 6, 2, '2026-05-14', 17.01, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(132, 23, 14, 8, 2, '2026-05-15', 15.95, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(133, 4, 15, 6, 2, '2026-05-16', 24.4, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(134, 10, 1, 1, 2, '2026-05-16', 8.91, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(135, 5, 15, 1, 2, '2026-05-17', 8.5, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(136, 22, 12, 2, 2, '2026-05-18', 11.39, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(137, 6, 15, 6, 2, '2026-05-18', 24.08, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(138, 1, 18, 1, 2, '2026-05-19', 9.3, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(139, 24, 14, 2, 2, '2026-05-19', 13.34, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(140, 11, 1, 1, 2, '2026-05-22', 9.95, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(141, 23, 14, 2, 2, '2026-05-23', 12.53, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(142, 41, 1, 4, 2, '2026-05-23', 9.22, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(143, 12, 1, 8, 2, '2026-05-23', 14, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(144, 1, 17, 4, 2, '2026-05-25', 11.57, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(145, 2, 18, 8, 2, '2026-05-26', 15.6, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(146, 4, 12, 4, 2, '2026-05-26', 11.309, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(147, 13, 1, 8, 2, '2026-05-26', 13.5, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(148, 42, 1, 2, 2, '2026-05-26', 11.7, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(149, 26, 14, 2, 2, '2026-05-27', 11.4, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(150, 23, 12, 4, 2, '2026-05-27', 9.3, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(151, 27, 14, 2, 2, '2026-05-28', 13.3, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(152, 2, 17, 7, 2, '2026-05-28', 12.255, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(153, 3, 17, 8, 2, '2026-05-28', 15, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(154, 24, 12, 4, 2, '2026-05-28', 12.2, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(155, 4, 17, 6, 2, '2026-05-29', 24.52, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(156, 28, 14, 8, 2, '2026-05-30', 12.96, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(157, 2, 12, 2, 2, '2026-05-30', 12.72, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(158, 3, 16, 7, 2, '2026-05-30', 25.6, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(159, 5, 17, 8, 2, '2026-06-02', 12.61, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(160, 25, 12, 2, 2, '2026-06-02', 12.04, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(161, 4, 1, 5, 2, '2026-06-02', 13.52, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(162, 29, 14, 7, 2, '2026-06-03', 13.77, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(163, 14, 1, 5, 2, '2026-06-03', 12.83, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(164, 43, 1, 4, 2, '2026-06-03', 10.12, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(165, 26, 12, 7, 2, '2026-06-03', 7.3, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(166, 6, 17, 6, 2, '2026-06-04', 21.05, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(167, 15, 1, 4, 2, '2026-06-04', 10.98, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(168, 3, 18, 8, 2, '2026-06-04', 11.53, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(169, 27, 12, 2, 2, '2026-06-04', 14.34, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(170, 44, 1, 7, 2, '2026-06-04', 12.08, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(171, 45, 1, 7, 2, '2026-06-05', 10.79, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(172, 46, 1, 4, 2, '2026-06-05', 9.71, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(173, 7, 17, 2, 2, '2026-06-05', 14.98, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(174, 7, 6, 6, 2, '2026-06-05', 21.98, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(175, 3, 12, 5, 2, '2026-06-05', 12.45, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(176, 30, 14, 7, 2, '2026-06-07', 13.33, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(177, 8, 17, 4, 2, '2026-06-07', 12.05, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.'),
(178, 28, 12, 2, 2, '2026-06-07', 12.36, 0.0000, 'PENDIENTE_HUMEDAD_TENOR — ingresar Analisis para completar campos derivados.');

-- ====================================================================
-- FASE 2 · LAB DEVUELVE LA MUESTRA — INSERT analisis (89 entradas)
-- ====================================================================
INSERT INTO analisis
  (id_entrada, id_tipo_analisis, id_mina, id_minero, id_tipo_material, id_laboratorio,
   numero_analisis, au_concentrado, ag_concentrado, ton, porcentaje_humedad,
   toneladas_humedas, toneladas_secas, au_gr_x_ton, au_gr_x_ton_falso, ag_gr_x_ton,
   valor_analisis, estado_pago, fecha_salida, comentarios)
VALUES
(1, 1, NULL, NULL, NULL, NULL, NULL, 61.3008, NULL, 6.0, 0.054, 6.0, 5.676, 12.8, 10.8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(2, 1, NULL, NULL, NULL, NULL, NULL, 81.17928, NULL, 12.39, 0.064, 12.39, 11.59704, 9.0, 7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Rodrigo'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(3, 1, NULL, NULL, NULL, NULL, NULL, 31.173240000000003, NULL, 10.03, 0.16, 10.03, 8.4252, 5.7, 3.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(4, 1, NULL, NULL, NULL, NULL, NULL, 28.95648, NULL, 11.12, 0.16, 11.12, 9.3408, 5.1, 3.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°3 (COSTOS TOTALES DE ENE-MAR)'),
(5, 1, NULL, NULL, NULL, NULL, NULL, 93.607488, NULL, 13.89, 0.064, 13.89, 13.00104, 9.2, 7.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Rodrigo'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(6, 1, NULL, NULL, NULL, NULL, NULL, 84.3075, NULL, 12.49, 0.1, 12.49, 11.241, 9.5, 7.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(7, 1, NULL, NULL, NULL, NULL, NULL, 15.242744, NULL, 8.86, 0.218, 8.86, 6.92852, 4.2, 2.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°4 (COSTOS TOTALES DE ENE-MAR)'),
(8, 1, NULL, NULL, NULL, NULL, NULL, 43.331999999999994, NULL, 9.42, 0.08, 9.42, 8.6664, 7.0, 5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Jose'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(9, 1, NULL, NULL, NULL, NULL, NULL, 38.6998, NULL, 8.95, 0.08, 8.95, 8.234, 6.7, 4.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Jose'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(10, 1, NULL, NULL, NULL, NULL, NULL, 62.713, NULL, 10.54, 0.125, 10.54, 9.2225, 8.8, 6.8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(11, 1, NULL, NULL, NULL, NULL, NULL, 85.58395, NULL, 10.7, 0.059, 10.7, 10.0687, 10.5, 8.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(12, 1, NULL, NULL, NULL, NULL, NULL, 108.699615, NULL, 13.59, 0.059, 13.59, 12.78819, 10.5, 8.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(13, 1, NULL, NULL, NULL, NULL, NULL, 70.19415, NULL, 11.7, 0.077, 11.7, 10.7991, 8.5, 6.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°3 (COSTOS TOTALES DE ENE-MAR)'),
(14, 1, NULL, NULL, NULL, NULL, NULL, 95.78439, NULL, 11.31, 0.059, 11.31, 10.642710000000001, 11.0, 9, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°3 (COSTOS TOTALES DE ENE-MAR)'),
(15, 1, NULL, NULL, NULL, NULL, NULL, 102.39021, NULL, 12.09, 0.059, 12.09, 11.37669, 11.0, 9, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°4 (COSTOS TOTALES DE ENE-MAR)'),
(16, 1, NULL, NULL, NULL, NULL, NULL, 25.45776, NULL, 11.36, 0.17, 11.36, 9.428799999999999, 4.7, 2.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°5 (COSTOS TOTALES DE ENE-MAR)'),
(17, 1, NULL, NULL, NULL, NULL, NULL, 82.50264, NULL, 10.89, 0.053, 10.89, 10.31283, 10.0, 8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°5 (COSTOS TOTALES DE ENE-MAR)'),
(18, 1, NULL, NULL, NULL, NULL, NULL, 76.804541, NULL, 11.11, 0.053, 11.11, 10.52117, 9.3, 7.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°6 (COSTOS TOTALES DE ENE-MAR)'),
(19, 1, NULL, NULL, NULL, NULL, NULL, 83.533923, NULL, 10.89, 0.053, 10.89, 10.31283, 10.1, 8.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°7 (COSTOS TOTALES DE ENE-MAR)'),
(20, 1, NULL, NULL, NULL, NULL, NULL, 93.9136, NULL, 12.76, 0.08, 12.76, 11.7392, 10.0, 8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°4 (COSTOS TOTALES DE ENE-MAR)'),
(21, 1, NULL, NULL, NULL, NULL, NULL, 84.2688, NULL, 10.56, 0.05, 10.56, 10.032, 10.4, 8.4, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°8 (COSTOS TOTALES DE ENE-MAR)'),
(22, 1, NULL, NULL, NULL, NULL, NULL, 71.850375, NULL, 10.47, 0.085, 10.47, 9.58005, 9.5, 7.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(23, 1, NULL, NULL, NULL, NULL, NULL, 95.54085, NULL, 12.42, 0.095, 12.42, 11.2401, 10.5, 8.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°5 (COSTOS TOTALES DE ENE-MAR)'),
(24, 1, NULL, NULL, NULL, NULL, NULL, 80.74143000000001, NULL, 11.46, 0.085, 11.46, 10.4859, 9.7, 7.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°3 (COSTOS TOTALES DE ENE-MAR)'),
(25, 1, NULL, NULL, NULL, NULL, NULL, 81.95498999999998, NULL, 11.18, 0.095, 11.18, 10.117899999999999, 10.1, 8.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°6 (COSTOS TOTALES DE ENE-MAR)'),
(26, 1, NULL, NULL, NULL, NULL, NULL, 83.20389, NULL, 11.94, 0.095, 11.94, 10.8057, 9.7, 7.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°7 (COSTOS TOTALES DE ENE-MAR)'),
(27, 1, NULL, NULL, NULL, NULL, NULL, 0.0, NULL, 8.82, 0.035, 8.82, 8.5113, NULL, NULL, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°1 (COSTOS TOTALES DE ENE-MAR) | Sin precio de mineral (transporte de agua, 0 pesos de material).'),
(28, 1, NULL, NULL, NULL, NULL, NULL, 0.0, NULL, 9.85, 0.035, 9.85, 9.50525, NULL, NULL, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°2 (COSTOS TOTALES DE ENE-MAR) | Sin precio de mineral (transporte de agua, 0 pesos de material).'),
(29, 1, NULL, NULL, NULL, NULL, NULL, 0.0, NULL, 8.94, 0.035, 8.94, 8.627099999999999, NULL, NULL, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°3 (COSTOS TOTALES DE ENE-MAR) | Sin precio de mineral (transporte de agua, 0 pesos de material).'),
(30, 1, NULL, NULL, NULL, NULL, NULL, 81.53600000000002, NULL, 12.8, 0.09, 12.8, 11.648000000000001, 9.0, 7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°8 (COSTOS TOTALES DE ENE-MAR)'),
(31, 1, NULL, NULL, NULL, NULL, NULL, 126.973, NULL, 13.09, 0.03, 13.09, 12.6973, 12.0, 10, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(32, 1, NULL, NULL, NULL, NULL, NULL, 76.57991999999999, NULL, 11.28, 0.07, 11.28, 10.4904, 9.3, 7.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°5 (COSTOS TOTALES DE ENE-MAR)'),
(33, 1, NULL, NULL, NULL, NULL, NULL, 97.55152000000001, NULL, 12.89, 0.054, 12.89, 12.193940000000001, 10.0, 8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°10 (COSTOS TOTALES DE ENE-MAR)'),
(34, 1, NULL, NULL, NULL, NULL, NULL, 72.1833, NULL, 11.1, 0.071, 11.1, 10.3119, 9.0, 7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°6 (COSTOS TOTALES DE ENE-MAR)'),
(35, 1, NULL, NULL, NULL, NULL, NULL, 95.703036, NULL, 12.97, 0.054, 12.97, 12.26962, 9.8, 7.8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°11 (COSTOS TOTALES DE ENE-MAR)'),
(36, 1, NULL, NULL, NULL, NULL, NULL, 96.2736, NULL, 12.94, 0.07, 12.94, 12.0342, 10.0, 8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°10 (COSTOS TOTALES DE ENE-MAR)'),
(37, 1, NULL, NULL, NULL, NULL, NULL, 165.65055, NULL, 13.15, 0.031, 13.15, 12.74235, 15.0, 13, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°2 (COSTOS TOTALES DE ENE-MAR) | PRECIO HISTÓRICO sin equivalente en tabla actual (franja de precio fuera de rango).'),
(38, 1, NULL, NULL, NULL, NULL, NULL, 49.161908, NULL, 8.83, 0.102, 8.83, 7.92934, 8.2, 6.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Alex'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(39, 1, NULL, NULL, NULL, NULL, NULL, 54.2841, NULL, 9.75, 0.102, 9.75, 8.7555, 8.2, 6.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Alex'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(40, 1, NULL, NULL, NULL, NULL, NULL, 98.10633200000001, NULL, 12.82, 0.078, 12.82, 11.82004, 10.3, 8.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°11 (COSTOS TOTALES DE ENE-MAR)'),
(41, 1, NULL, NULL, NULL, NULL, NULL, 81.0495, NULL, 11.62, 0.07, 11.62, 10.8066, 9.5, 7.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°12 (COSTOS TOTALES DE ENE-MAR)'),
(42, 1, NULL, NULL, NULL, NULL, NULL, 0.0, NULL, 11.52, 0.03, 11.52, 11.1744, NULL, NULL, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°3 (COSTOS TOTALES DE ENE-MAR) | PRECIO HISTÓRICO sin equivalente en tabla actual (franja de precio fuera de rango).'),
(43, 1, NULL, NULL, NULL, NULL, NULL, 100.10526499999999, NULL, 12.41, 0.051, 12.41, 11.77709, 10.5, 8.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°12 (COSTOS TOTALES DE ENE-MAR)'),
(44, 1, NULL, NULL, NULL, NULL, NULL, 117.41058000000002, NULL, 13.96, 0.055, 13.96, 13.192200000000001, 10.9, 8.9, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°13 (COSTOS TOTALES DE ENE-MAR)'),
(45, 1, NULL, NULL, NULL, NULL, NULL, 99.56856, NULL, 11.64, 0.06, 11.64, 10.941600000000001, 11.1, 9.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°14 (COSTOS TOTALES DE ENE-MAR)'),
(46, 1, NULL, NULL, NULL, NULL, NULL, 58.6602, NULL, 10.65, 0.082, 10.65, 9.7767, 8.0, 6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°8 (COSTOS TOTALES DE ENE-MAR)'),
(47, 1, NULL, NULL, NULL, NULL, NULL, 68.037312, NULL, 11.36, 0.034, 11.36, 10.973759999999999, 8.2, 6.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Jeferson Bautista'' N°1 (COSTOS TOTALES DE ENE-MAR) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(48, 1, NULL, NULL, NULL, NULL, NULL, 86.22432, NULL, 10.08, 0.06, 10.08, 9.475200000000001, 11.1, 9.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°15 (COSTOS TOTALES DE ENE-MAR)'),
(49, 1, NULL, NULL, NULL, NULL, NULL, 91.01455999999999, NULL, 10.64, 0.06, 10.64, 10.0016, 11.1, 9.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°16 (COSTOS TOTALES DE ENE-MAR)'),
(50, 1, NULL, NULL, NULL, NULL, NULL, 115.7184, NULL, 13.12, 0.02, 13.12, 12.8576, 11.0, 9, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°4 (COSTOS TOTALES DE ENE-MAR)'),
(51, 1, NULL, NULL, NULL, NULL, NULL, 157.277736, NULL, 25.79, 0.076, 25.79, 23.82996, 8.6, 6.6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°13 (COSTOS TOTALES DE ENE-MAR)'),
(52, 1, NULL, NULL, NULL, NULL, NULL, 45.056448, NULL, 10.74, 0.088, 10.74, 9.794880000000001, 6.6, 4.6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Marlon'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(53, 1, NULL, NULL, NULL, NULL, NULL, 23.820895999999998, NULL, 9.44, 0.186, 9.44, 7.684159999999999, 5.1, 3.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°6 (COSTOS TOTALES DE ENE-MAR)'),
(54, 1, NULL, NULL, NULL, NULL, NULL, 73.2501, NULL, 10.57, 0.076, 10.57, 9.766680000000001, 9.5, 7.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°17 (COSTOS TOTALES DE ENE-MAR)'),
(55, 1, NULL, NULL, NULL, NULL, NULL, 83.71376640000001, NULL, 12.529, 0.072, 12.529, 11.626912, 9.2, 7.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°18 (COSTOS TOTALES DE ENE-MAR)'),
(56, 1, NULL, NULL, NULL, NULL, NULL, 130.092354, NULL, 22.18, 0.069, 22.18, 20.64958, 8.3, 6.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°14 (COSTOS TOTALES DE ENE-MAR)'),
(57, 1, NULL, NULL, NULL, NULL, NULL, 54.952127999999995, NULL, 10.62, 0.076, 10.62, 9.81288, 7.6, 5.6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°9 (COSTOS TOTALES DE ENE-MAR)'),
(58, 1, NULL, NULL, NULL, NULL, NULL, 89.42437500000001, NULL, 12.89, 0.075, 12.89, 11.923250000000001, 9.5, 7.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°19 (COSTOS TOTALES DE ENE-MAR)'),
(59, 1, NULL, NULL, NULL, NULL, NULL, 164.55757499999999, NULL, 26.79, 0.055, 26.79, 25.31655, 8.5, 6.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°15 (COSTOS TOTALES DE ENE-MAR)'),
(60, 1, NULL, NULL, NULL, NULL, NULL, 44.047529999999995, NULL, 11.07, 0.135, 11.07, 9.57555, 6.6, 4.6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Marlon'' N°2 (COSTOS TOTALES DE ENE-MAR)'),
(61, 1, NULL, NULL, NULL, NULL, NULL, 41.286449999999995, NULL, 11.1, 0.135, 11.1, 9.6015, 6.3, 4.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Marlon'' N°3 (COSTOS TOTALES DE ENE-MAR)'),
(62, 1, NULL, NULL, NULL, NULL, NULL, 146.77990400000002, NULL, 23.26, 0.072, 23.26, 21.58528, 8.8, 6.8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°16 (COSTOS TOTALES DE ENE-MAR)'),
(63, 1, NULL, NULL, NULL, NULL, NULL, 104.31648000000001, NULL, 12.49, 0.072, 12.49, 11.590720000000001, 11.0, 9, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°5 (COSTOS TOTALES DE ENE-MAR)'),
(64, 1, NULL, NULL, NULL, NULL, NULL, 66.95948, NULL, 10.76, 0.111, 10.76, 9.56564, 9.0, 7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°20 (COSTOS TOTALES DE ENE-MAR)'),
(65, 1, NULL, NULL, NULL, NULL, NULL, 116.715, NULL, 25.1, 0.07, 25.1, 23.343, 7.0, 5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Camilo'' N°1 (COSTOS TOTALES DE ENE-MAR)'),
(66, 1, NULL, NULL, NULL, NULL, NULL, 51.700684, NULL, 8.89, 0.062, 8.89, 8.33882, 8.2, 6.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Jeferson Bautista'' N°2 (COSTOS TOTALES DE ABRIL)'),
(67, 1, NULL, NULL, NULL, NULL, NULL, 48.76199999999999, NULL, 12.42, 0.0, 12.42, 6.02, 10.1, 8.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Terraje omar'' N°1 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(68, 1, NULL, NULL, NULL, NULL, NULL, 59.19423999999999, NULL, 11.68, 0.095, 11.68, 10.5704, 7.6, 5.6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°10 (COSTOS TOTALES DE ABRIL)'),
(69, 1, NULL, NULL, NULL, NULL, NULL, 49.9704, NULL, 8.86, 0.06, 8.86, 8.3284, 8.0, 6, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Jeferson Bautista'' N°3 (COSTOS TOTALES DE ABRIL)'),
(70, 1, NULL, NULL, NULL, NULL, NULL, 77.18256, NULL, 13.02, 0.088, 13.02, 11.87424, 8.5, 6.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°17 (COSTOS TOTALES DE ABRIL)'),
(71, 1, NULL, NULL, NULL, NULL, NULL, 58.696, NULL, 12.76, 0.08, 12.76, 11.7392, 7.0, 5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°6 (COSTOS TOTALES DE ABRIL)'),
(72, 1, NULL, NULL, NULL, NULL, NULL, 41.355287999999994, NULL, 9.04, 0.103, 9.04, 8.10888, 7.1, 5.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°11 (COSTOS TOTALES DE ABRIL)'),
(73, 1, NULL, NULL, NULL, NULL, NULL, 45.562439, NULL, 11.71, 0.051, 11.71, 11.11279, 6.1, 4.1, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°21 (COSTOS TOTALES DE ABRIL)'),
(74, 1, NULL, NULL, NULL, NULL, NULL, 54.79542, NULL, 12.7, 0.082, 12.7, 11.6586, 6.7, 4.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Roca Omar'' N°7 (COSTOS TOTALES DE ABRIL)'),
(75, 1, NULL, NULL, NULL, NULL, NULL, 46.231080000000006, NULL, 11.71, 0.06, 11.71, 11.0074, 6.2, 4.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°22 (COSTOS TOTALES DE ABRIL)'),
(76, 1, NULL, NULL, NULL, NULL, NULL, 63.74592, NULL, 13.02, 0.28, 13.02, 9.3744, 8.8, 6.8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°18 (COSTOS TOTALES DE ABRIL)'),
(77, 1, NULL, NULL, NULL, NULL, NULL, 54.89294, NULL, 12.47, 0.29, 12.47, 8.8537, 8.2, 6.2, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Naum'' N°19 (COSTOS TOTALES DE ABRIL)'),
(78, 1, NULL, NULL, NULL, NULL, NULL, 57.885, NULL, 13.62, 0.15, 13.62, 11.577, 7.0, 5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°12 (COSTOS TOTALES DE ABRIL)'),
(79, 1, NULL, NULL, NULL, NULL, NULL, 32.26404, NULL, 8.59, 0.061, 8.59, 8.06601, 6.0, 4, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°23 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(80, 1, NULL, NULL, NULL, NULL, NULL, 45.7056, NULL, 12.42, 0.08, 12.42, 11.4264, 6.0, 4, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°24 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(81, 1, NULL, NULL, NULL, NULL, NULL, 31.020844999999998, NULL, 7.85, 0.081, 7.85, 7.21415, 6.3, 4.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°25 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(82, 1, NULL, NULL, NULL, NULL, NULL, 24.7922, NULL, 10.97, 0.096, 10.97, 9.91688, 4.5, 2.5, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°26 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(83, 1, NULL, NULL, NULL, NULL, NULL, 71.402176, NULL, 10.54, 0.072, 10.54, 9.78112, 9.3, 7.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°13 (COSTOS TOTALES DE ABRIL)'),
(84, 1, NULL, NULL, NULL, NULL, NULL, 33.0693, NULL, 12.1, 0.089, 12.1, 11.0231, 5.0, 3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°27 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(85, 1, NULL, NULL, NULL, NULL, NULL, 37.193112, NULL, 12.44, 0.094, 12.44, 11.27064, 5.3, 3.3, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°28 (COSTOS TOTALES DE ABRIL) | Sin precio de material definido en costeo (terraje / negociación especial).'),
(86, 1, NULL, NULL, NULL, NULL, NULL, 70.14207200000001, NULL, 9.88, 0.078, 9.88, 9.10936, 9.7, 7.7, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Leonel'' N°14 (COSTOS MAYO) | precio_total calculado desde ton_secas × precio_por_gramo (faltaba en hoja Mayo).'),
(87, 1, NULL, NULL, NULL, NULL, NULL, 87.47528399999999, NULL, 12.27, 0.086, 12.27, 11.21478, 9.8, 7.8, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Omar'' N°9 (COSTOS TOTALES DE ENE-MAR)'),
(88, 1, NULL, NULL, NULL, NULL, NULL, 39.48927, NULL, 2.843, 0.074, 2.843, 2.632618, 17.0, 15, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°1 (COSTOS TOTALES DE ENE-MAR) | PRECIO HISTÓRICO sin equivalente en tabla actual (franja de precio fuera de rango). | Carga partida Mesa (sluice).'),
(89, 1, NULL, NULL, NULL, NULL, NULL, 46.028800000000004, NULL, 4.0, 0.072, 4.0, 3.712, 14.4, 12.4, NULL, NULL, 'no_aplica', NULL, 'Migración: origen=''Ricardo Poveda'' N°1 (COSTOS TOTALES DE ENE-MAR) | PRECIO HISTÓRICO sin equivalente en tabla actual (franja de precio fuera de rango). | Carga partida Mesa (sluice).');

-- ====================================================================
-- ====================================================================
-- FASE 3 · BACKEND ACTUALIZA material_planta_entrada DESDE EL ANÁLISIS
-- ====================================================================
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.054,
    gramos_humedad      = 0.324,
    total_material_seco = 5.676,
    tenor               = 10.8,
    total_gramos        = 61.3008
  WHERE id = 1;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.064,
    gramos_humedad      = 0.793,
    total_material_seco = 11.59704,
    tenor               = 7,
    total_gramos        = 81.1793
  WHERE id = 2;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.16,
    gramos_humedad      = 1.6048,
    total_material_seco = 8.4252,
    tenor               = 3.7,
    total_gramos        = 31.1732
  WHERE id = 3;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.16,
    gramos_humedad      = 1.7792,
    total_material_seco = 9.3408,
    tenor               = 3.1,
    total_gramos        = 28.9565
  WHERE id = 4;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.064,
    gramos_humedad      = 0.889,
    total_material_seco = 13.00104,
    tenor               = 7.2,
    total_gramos        = 93.6075
  WHERE id = 5;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.1,
    gramos_humedad      = 1.249,
    total_material_seco = 11.241,
    tenor               = 7.5,
    total_gramos        = 84.3075
  WHERE id = 6;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.218,
    gramos_humedad      = 1.9315,
    total_material_seco = 6.92852,
    tenor               = 2.2,
    total_gramos        = 15.2427
  WHERE id = 7;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.08,
    gramos_humedad      = 0.7536,
    total_material_seco = 8.6664,
    tenor               = 5,
    total_gramos        = 43.332
  WHERE id = 8;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.08,
    gramos_humedad      = 0.716,
    total_material_seco = 8.234,
    tenor               = 4.7,
    total_gramos        = 38.6998
  WHERE id = 9;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.125,
    gramos_humedad      = 1.3175,
    total_material_seco = 9.2225,
    tenor               = 6.8,
    total_gramos        = 62.713
  WHERE id = 10;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.059,
    gramos_humedad      = 0.6313,
    total_material_seco = 10.0687,
    tenor               = 8.5,
    total_gramos        = 85.584
  WHERE id = 11;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.059,
    gramos_humedad      = 0.8018,
    total_material_seco = 12.78819,
    tenor               = 8.5,
    total_gramos        = 108.6996
  WHERE id = 12;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.077,
    gramos_humedad      = 0.9009,
    total_material_seco = 10.7991,
    tenor               = 6.5,
    total_gramos        = 70.1941
  WHERE id = 13;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.059,
    gramos_humedad      = 0.6673,
    total_material_seco = 10.642710000000001,
    tenor               = 9,
    total_gramos        = 95.7844
  WHERE id = 14;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.059,
    gramos_humedad      = 0.7133,
    total_material_seco = 11.37669,
    tenor               = 9,
    total_gramos        = 102.3902
  WHERE id = 15;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.17,
    gramos_humedad      = 1.9312,
    total_material_seco = 9.428799999999999,
    tenor               = 2.7,
    total_gramos        = 25.4578
  WHERE id = 16;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.053,
    gramos_humedad      = 0.5772,
    total_material_seco = 10.31283,
    tenor               = 8,
    total_gramos        = 82.5026
  WHERE id = 17;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.053,
    gramos_humedad      = 0.5888,
    total_material_seco = 10.52117,
    tenor               = 7.3,
    total_gramos        = 76.8045
  WHERE id = 18;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.053,
    gramos_humedad      = 0.5772,
    total_material_seco = 10.31283,
    tenor               = 8.1,
    total_gramos        = 83.5339
  WHERE id = 19;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.08,
    gramos_humedad      = 1.0208,
    total_material_seco = 11.7392,
    tenor               = 8,
    total_gramos        = 93.9136
  WHERE id = 20;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.05,
    gramos_humedad      = 0.528,
    total_material_seco = 10.032,
    tenor               = 8.4,
    total_gramos        = 84.2688
  WHERE id = 21;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.085,
    gramos_humedad      = 0.89,
    total_material_seco = 9.58005,
    tenor               = 7.5,
    total_gramos        = 71.8504
  WHERE id = 22;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.095,
    gramos_humedad      = 1.1799,
    total_material_seco = 11.2401,
    tenor               = 8.5,
    total_gramos        = 95.5409
  WHERE id = 23;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.085,
    gramos_humedad      = 0.9741,
    total_material_seco = 10.4859,
    tenor               = 7.7,
    total_gramos        = 80.7414
  WHERE id = 24;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.095,
    gramos_humedad      = 1.0621,
    total_material_seco = 10.117899999999999,
    tenor               = 8.1,
    total_gramos        = 81.955
  WHERE id = 25;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.095,
    gramos_humedad      = 1.1343,
    total_material_seco = 10.8057,
    tenor               = 7.7,
    total_gramos        = 83.2039
  WHERE id = 26;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.035,
    gramos_humedad      = 0.3087,
    total_material_seco = 8.5113,
    tenor               = NULL,
    total_gramos        = NULL
  WHERE id = 27;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.035,
    gramos_humedad      = 0.3448,
    total_material_seco = 9.50525,
    tenor               = NULL,
    total_gramos        = NULL
  WHERE id = 28;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.035,
    gramos_humedad      = 0.3129,
    total_material_seco = 8.627099999999999,
    tenor               = NULL,
    total_gramos        = NULL
  WHERE id = 29;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.09,
    gramos_humedad      = 1.152,
    total_material_seco = 11.648000000000001,
    tenor               = 7,
    total_gramos        = 81.536
  WHERE id = 30;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.03,
    gramos_humedad      = 0.3927,
    total_material_seco = 12.6973,
    tenor               = 10,
    total_gramos        = 126.973
  WHERE id = 31;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.07,
    gramos_humedad      = 0.7896,
    total_material_seco = 10.4904,
    tenor               = 7.3,
    total_gramos        = 76.5799
  WHERE id = 32;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.054,
    gramos_humedad      = 0.6961,
    total_material_seco = 12.193940000000001,
    tenor               = 8,
    total_gramos        = 97.5515
  WHERE id = 33;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.071,
    gramos_humedad      = 0.7881,
    total_material_seco = 10.3119,
    tenor               = 7,
    total_gramos        = 72.1833
  WHERE id = 34;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.054,
    gramos_humedad      = 0.7004,
    total_material_seco = 12.26962,
    tenor               = 7.8,
    total_gramos        = 95.703
  WHERE id = 35;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.07,
    gramos_humedad      = 0.9058,
    total_material_seco = 12.0342,
    tenor               = 8,
    total_gramos        = 96.2736
  WHERE id = 36;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.031,
    gramos_humedad      = 0.4077,
    total_material_seco = 12.74235,
    tenor               = 13,
    total_gramos        = 165.6506
  WHERE id = 37;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.102,
    gramos_humedad      = 0.9007,
    total_material_seco = 7.92934,
    tenor               = 6.2,
    total_gramos        = 49.1619
  WHERE id = 38;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.102,
    gramos_humedad      = 0.9945,
    total_material_seco = 8.7555,
    tenor               = 6.2,
    total_gramos        = 54.2841
  WHERE id = 39;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.078,
    gramos_humedad      = 1.0,
    total_material_seco = 11.82004,
    tenor               = 8.3,
    total_gramos        = 98.1063
  WHERE id = 40;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.07,
    gramos_humedad      = 0.8134,
    total_material_seco = 10.8066,
    tenor               = 7.5,
    total_gramos        = 81.0495
  WHERE id = 41;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.03,
    gramos_humedad      = 0.3456,
    total_material_seco = 11.1744,
    tenor               = NULL,
    total_gramos        = NULL
  WHERE id = 42;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.051,
    gramos_humedad      = 0.6329,
    total_material_seco = 11.77709,
    tenor               = 8.5,
    total_gramos        = 100.1053
  WHERE id = 43;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.055,
    gramos_humedad      = 0.7678,
    total_material_seco = 13.192200000000001,
    tenor               = 8.9,
    total_gramos        = 117.4106
  WHERE id = 44;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.06,
    gramos_humedad      = 0.6984,
    total_material_seco = 10.941600000000001,
    tenor               = 9.1,
    total_gramos        = 99.5686
  WHERE id = 45;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.082,
    gramos_humedad      = 0.8733,
    total_material_seco = 9.7767,
    tenor               = 6,
    total_gramos        = 58.6602
  WHERE id = 46;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.034,
    gramos_humedad      = 0.3862,
    total_material_seco = 10.973759999999999,
    tenor               = 6.2,
    total_gramos        = 68.0373
  WHERE id = 47;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.06,
    gramos_humedad      = 0.6048,
    total_material_seco = 9.475200000000001,
    tenor               = 9.1,
    total_gramos        = 86.2243
  WHERE id = 48;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.06,
    gramos_humedad      = 0.6384,
    total_material_seco = 10.0016,
    tenor               = 9.1,
    total_gramos        = 91.0146
  WHERE id = 49;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.02,
    gramos_humedad      = 0.2624,
    total_material_seco = 12.8576,
    tenor               = 9,
    total_gramos        = 115.7184
  WHERE id = 50;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.076,
    gramos_humedad      = 1.96,
    total_material_seco = 23.82996,
    tenor               = 6.6,
    total_gramos        = 157.2777
  WHERE id = 51;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.088,
    gramos_humedad      = 0.9451,
    total_material_seco = 9.794880000000001,
    tenor               = 4.6,
    total_gramos        = 45.0564
  WHERE id = 52;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.186,
    gramos_humedad      = 1.7558,
    total_material_seco = 7.684159999999999,
    tenor               = 3.1,
    total_gramos        = 23.8209
  WHERE id = 53;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.076,
    gramos_humedad      = 0.8033,
    total_material_seco = 9.766680000000001,
    tenor               = 7.5,
    total_gramos        = 73.2501
  WHERE id = 54;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.072,
    gramos_humedad      = 0.9021,
    total_material_seco = 11.626912,
    tenor               = 7.2,
    total_gramos        = 83.7138
  WHERE id = 55;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.069,
    gramos_humedad      = 1.5304,
    total_material_seco = 20.64958,
    tenor               = 6.3,
    total_gramos        = 130.0924
  WHERE id = 56;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.076,
    gramos_humedad      = 0.8071,
    total_material_seco = 9.81288,
    tenor               = 5.6,
    total_gramos        = 54.9521
  WHERE id = 57;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.075,
    gramos_humedad      = 0.9667,
    total_material_seco = 11.923250000000001,
    tenor               = 7.5,
    total_gramos        = 89.4244
  WHERE id = 58;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.055,
    gramos_humedad      = 1.4734,
    total_material_seco = 25.31655,
    tenor               = 6.5,
    total_gramos        = 164.5576
  WHERE id = 59;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.135,
    gramos_humedad      = 1.4945,
    total_material_seco = 9.57555,
    tenor               = 4.6,
    total_gramos        = 44.0475
  WHERE id = 60;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.135,
    gramos_humedad      = 1.4985,
    total_material_seco = 9.6015,
    tenor               = 4.3,
    total_gramos        = 41.2864
  WHERE id = 61;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.072,
    gramos_humedad      = 1.6747,
    total_material_seco = 21.58528,
    tenor               = 6.8,
    total_gramos        = 146.7799
  WHERE id = 62;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.072,
    gramos_humedad      = 0.8993,
    total_material_seco = 11.590720000000001,
    tenor               = 9,
    total_gramos        = 104.3165
  WHERE id = 63;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.111,
    gramos_humedad      = 1.1944,
    total_material_seco = 9.56564,
    tenor               = 7,
    total_gramos        = 66.9595
  WHERE id = 64;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.07,
    gramos_humedad      = 1.757,
    total_material_seco = 23.343,
    tenor               = 5,
    total_gramos        = 116.715
  WHERE id = 65;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.062,
    gramos_humedad      = 0.5512,
    total_material_seco = 8.33882,
    tenor               = 6.2,
    total_gramos        = 51.7007
  WHERE id = 66;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.5153,
    gramos_humedad      = 6.4,
    total_material_seco = 6.02,
    tenor               = 8.1,
    total_gramos        = 48.762
  WHERE id = 67;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.095,
    gramos_humedad      = 1.1096,
    total_material_seco = 10.5704,
    tenor               = 5.6,
    total_gramos        = 59.1942
  WHERE id = 68;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.06,
    gramos_humedad      = 0.5316,
    total_material_seco = 8.3284,
    tenor               = 6,
    total_gramos        = 49.9704
  WHERE id = 69;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.088,
    gramos_humedad      = 1.1458,
    total_material_seco = 11.87424,
    tenor               = 6.5,
    total_gramos        = 77.1826
  WHERE id = 70;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.08,
    gramos_humedad      = 1.0208,
    total_material_seco = 11.7392,
    tenor               = 5,
    total_gramos        = 58.696
  WHERE id = 71;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.103,
    gramos_humedad      = 0.9311,
    total_material_seco = 8.10888,
    tenor               = 5.1,
    total_gramos        = 41.3553
  WHERE id = 72;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.051,
    gramos_humedad      = 0.5972,
    total_material_seco = 11.11279,
    tenor               = 4.1,
    total_gramos        = 45.5624
  WHERE id = 73;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.082,
    gramos_humedad      = 1.0414,
    total_material_seco = 11.6586,
    tenor               = 4.7,
    total_gramos        = 54.7954
  WHERE id = 74;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.06,
    gramos_humedad      = 0.7026,
    total_material_seco = 11.0074,
    tenor               = 4.2,
    total_gramos        = 46.2311
  WHERE id = 75;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.28,
    gramos_humedad      = 3.6456,
    total_material_seco = 9.3744,
    tenor               = 6.8,
    total_gramos        = 63.7459
  WHERE id = 76;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.29,
    gramos_humedad      = 3.6163,
    total_material_seco = 8.8537,
    tenor               = 6.2,
    total_gramos        = 54.8929
  WHERE id = 77;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.15,
    gramos_humedad      = 2.043,
    total_material_seco = 11.577,
    tenor               = 5,
    total_gramos        = 57.885
  WHERE id = 78;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.061,
    gramos_humedad      = 0.524,
    total_material_seco = 8.06601,
    tenor               = 4,
    total_gramos        = 32.264
  WHERE id = 79;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.08,
    gramos_humedad      = 0.9936,
    total_material_seco = 11.4264,
    tenor               = 4,
    total_gramos        = 45.7056
  WHERE id = 80;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.081,
    gramos_humedad      = 0.6359,
    total_material_seco = 7.21415,
    tenor               = 4.3,
    total_gramos        = 31.0208
  WHERE id = 81;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.096,
    gramos_humedad      = 1.0531,
    total_material_seco = 9.91688,
    tenor               = 2.5,
    total_gramos        = 24.7922
  WHERE id = 82;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.072,
    gramos_humedad      = 0.7589,
    total_material_seco = 9.78112,
    tenor               = 7.3,
    total_gramos        = 71.4022
  WHERE id = 83;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.089,
    gramos_humedad      = 1.0769,
    total_material_seco = 11.0231,
    tenor               = 3,
    total_gramos        = 33.0693
  WHERE id = 84;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.094,
    gramos_humedad      = 1.1694,
    total_material_seco = 11.27064,
    tenor               = 3.3,
    total_gramos        = 37.1931
  WHERE id = 85;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.078,
    gramos_humedad      = 0.7706,
    total_material_seco = 9.10936,
    tenor               = 7.7,
    total_gramos        = 70.1421
  WHERE id = 86;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.086,
    gramos_humedad      = 1.0552,
    total_material_seco = 11.21478,
    tenor               = 7.8,
    total_gramos        = 87.4753
  WHERE id = 87;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.074,
    gramos_humedad      = 0.2104,
    total_material_seco = 2.632618,
    tenor               = 15,
    total_gramos        = 39.4893
  WHERE id = 88;
  UPDATE material_planta_entrada SET
    porcentaje_humedad  = 0.072,
    gramos_humedad      = 0.288,
    total_material_seco = 3.712,
    tenor               = 12.4,
    total_gramos        = 46.0288
  WHERE id = 89;

-- FASE 4 · PRECIO: LOOKUP EN Precio_Material + precio_total
-- ====================================================================
  UPDATE material_planta_entrada SET
    id_precio          = 11,
    precio_por_gramo   = 100000,
    precio_por_tonelada= NULL,
    precio_total       = 6130080
  WHERE id = 1;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5844908.16
  WHERE id = 2;
  UPDATE material_planta_entrada SET
    id_precio          = 2,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 120000,
    precio_total       = 1011024
  WHERE id = 3;
  UPDATE material_planta_entrada SET
    id_precio          = 2,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 120000,
    precio_total       = 1120896
  WHERE id = 4;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 6739739.136
  WHERE id = 5;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 6070140
  WHERE id = 6;
  UPDATE material_planta_entrada SET
    id_precio          = 1,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 120000,
    precio_total       = 831422.4
  WHERE id = 7;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 58000,
    precio_por_tonelada= NULL,
    precio_total       = 2513255.9999999995
  WHERE id = 8;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 58000,
    precio_por_tonelada= NULL,
    precio_total       = 2244588.4000000004
  WHERE id = 9;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 4515336
  WHERE id = 10;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 8054960
  WHERE id = 11;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 10230552
  WHERE id = 12;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5053978.8
  WHERE id = 13;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 8514168
  WHERE id = 14;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 9101352
  WHERE id = 15;
  UPDATE material_planta_entrada SET
    id_precio          = 1,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 120000,
    precio_total       = 1131455.9999999998
  WHERE id = 16;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 8250264
  WHERE id = 17;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 700000,
    precio_total       = 7364819
  WHERE id = 18;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 8250264
  WHERE id = 19;
  UPDATE material_planta_entrada SET
    id_precio          = 10,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 6761779.2
  WHERE id = 20;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 8025600
  WHERE id = 21;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5173227
  WHERE id = 22;
  UPDATE material_planta_entrada SET
    id_precio          = 10,
    precio_por_gramo   = 85000,
    precio_por_tonelada= NULL,
    precio_total       = 8120972.250000001
  WHERE id = 23;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5813382.960000001
  WHERE id = 24;
  UPDATE material_planta_entrada SET
    id_precio          = 10,
    precio_por_gramo   = 85000,
    precio_por_tonelada= NULL,
    precio_total       = 6966174.1499999985
  WHERE id = 25;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5990680.08
  WHERE id = 26;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = 0
  WHERE id = 27;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = 0
  WHERE id = 28;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = 0
  WHERE id = 29;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5870592.000000001
  WHERE id = 30;
  UPDATE material_planta_entrada SET
    id_precio          = 7,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 1000000,
    precio_total       = 12697300
  WHERE id = 31;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5513754.239999999
  WHERE id = 32;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 800000,
    precio_total       = 9755152.000000002
  WHERE id = 33;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5197197.600000001
  WHERE id = 34;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 8834126.4
  WHERE id = 35;
  UPDATE material_planta_entrada SET
    id_precio          = 10,
    precio_por_gramo   = 85000,
    precio_por_tonelada= NULL,
    precio_total       = 8183256
  WHERE id = 36;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 1500000,
    precio_total       = 19113525
  WHERE id = 37;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 3539657.3759999997
  WHERE id = 38;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 3908455.2
  WHERE id = 39;
  UPDATE material_planta_entrada SET
    id_precio          = 10,
    precio_por_gramo   = 85000,
    precio_por_tonelada= NULL,
    precio_total       = 8339038.220000001
  WHERE id = 40;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 7780752
  WHERE id = 41;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 1000000,
    precio_total       = 11174400
  WHERE id = 42;
  UPDATE material_planta_entrada SET
    id_precio          = 10,
    precio_por_gramo   = 85000,
    precio_por_tonelada= NULL,
    precio_total       = 8508947.524999999
  WHERE id = 43;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 850000,
    precio_total       = 11213370.000000002
  WHERE id = 44;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 850000,
    precio_total       = 9300360.000000002
  WHERE id = 45;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 3812913
  WHERE id = 46;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 47;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 6822144.000000001
  WHERE id = 48;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 7201152
  WHERE id = 49;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 1000000,
    precio_total       = 12857600
  WHERE id = 50;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 10223052.84
  WHERE id = 51;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 2928669.12
  WHERE id = 52;
  UPDATE material_planta_entrada SET
    id_precio          = 2,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 120000,
    precio_total       = 922099.2
  WHERE id = 53;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5274007.2
  WHERE id = 54;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 6027391.180800001
  WHERE id = 55;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 8456003.01
  WHERE id = 56;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 3571888.32
  WHERE id = 57;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 8584740
  WHERE id = 58;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 11848145.399999999
  WHERE id = 59;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 2863089.4499999997
  WHERE id = 60;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 2683619.2499999995
  WHERE id = 61;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 10568153.088000001
  WHERE id = 62;
  UPDATE material_planta_entrada SET
    id_precio          = 6,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 900000,
    precio_total       = 10431648
  WHERE id = 63;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 6887260.8
  WHERE id = 64;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 7586475
  WHERE id = 65;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 3722449.248
  WHERE id = 66;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 67;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 3847625.5999999996
  WHERE id = 68;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 3597868.8
  WHERE id = 69;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5557144.319999999
  WHERE id = 70;
  UPDATE material_planta_entrada SET
    id_precio          = 4,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 650000,
    precio_total       = 7630480
  WHERE id = 71;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 2688093.7199999997
  WHERE id = 72;
  UPDATE material_planta_entrada SET
    id_precio          = 3,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 650000,
    precio_total       = 7223313.5
  WHERE id = 73;
  UPDATE material_planta_entrada SET
    id_precio          = 3,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 650000,
    precio_total       = 7578090
  WHERE id = 74;
  UPDATE material_planta_entrada SET
    id_precio          = 3,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 650000,
    precio_total       = 7154810
  WHERE id = 75;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 4589706.24
  WHERE id = 76;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 3952291.68
  WHERE id = 77;
  UPDATE material_planta_entrada SET
    id_precio          = 8,
    precio_por_gramo   = 65000,
    precio_por_tonelada= NULL,
    precio_total       = 3762525
  WHERE id = 78;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 79;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 80;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 81;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 82;
  UPDATE material_planta_entrada SET
    id_precio          = 9,
    precio_por_gramo   = 72000,
    precio_por_tonelada= NULL,
    precio_total       = 5140956.672
  WHERE id = 83;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 84;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= NULL,
    precio_total       = NULL
  WHERE id = 85;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 72000,
    precio_total       = 655873.92
  WHERE id = 86;
  UPDATE material_planta_entrada SET
    id_precio          = 5,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 720000,
    precio_total       = 8074641.6
  WHERE id = 87;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 1650000,
    precio_total       = 4343819.7
  WHERE id = 88;
  UPDATE material_planta_entrada SET
    id_precio          = NULL,
    precio_por_gramo   = NULL,
    precio_por_tonelada= 1650000,
    precio_total       = 6124800
  WHERE id = 89;

-- ====================================================================
-- FASE 5 · COSTOS Y TOTALES
-- ====================================================================
  UPDATE material_planta_entrada SET
    excedente_calculado     = 567600.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 600000.0,      -- 6.0t × 100,000/ton (zona)
    total_costos_operativos = 900000.0,
    total_material          = 7597680.0,
    estado                  = 'pendiente'
  WHERE id = 1;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1159704.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1239000.0,      -- 12.39t × 100,000/ton (zona)
    total_costos_operativos = 1539000.0,
    total_material          = 8543612.16,
    estado                  = 'pendiente'
  WHERE id = 2;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 842520.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 4012000.0,      -- 10.03t × 400,000/ton (zona)
    total_costos_operativos = 4312000.0,
    total_material          = 6165544.0,
    estado                  = 'pendiente'
  WHERE id = 3;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 934080.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 4448000.0,      -- 11.12t × 400,000/ton (zona)
    total_costos_operativos = 4748000.0,
    total_material          = 6802976.0,
    estado                  = 'pendiente'
  WHERE id = 4;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1300104.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1389000.0,      -- 13.89t × 100,000/ton (zona)
    total_costos_operativos = 1689000.0,
    total_material          = 9728843.14,
    estado                  = 'pendiente'
  WHERE id = 5;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1124100.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1249000.0,      -- 12.49t × 100,000/ton (zona)
    total_costos_operativos = 1549000.0,
    total_material          = 8743240.0,
    estado                  = 'pendiente'
  WHERE id = 6;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 692852.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 3544000.0,      -- 8.86t × 400,000/ton (zona)
    total_costos_operativos = 3844000.0,
    total_material          = 5368274.4,
    estado                  = 'pendiente'
  WHERE id = 7;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 866640.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 942000.0,      -- 9.42t × 100,000/ton (zona)
    total_costos_operativos = 1242000.0,
    total_material          = 4621896.0,
    estado                  = 'pendiente'
  WHERE id = 8;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 823400.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 895000.0,      -- 8.95t × 100,000/ton (zona)
    total_costos_operativos = 1195000.0,
    total_material          = 4262988.4,
    estado                  = 'pendiente'
  WHERE id = 9;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 922250.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1054000.0,      -- 10.54t × 100,000/ton (zona)
    total_costos_operativos = 1354000.0,
    total_material          = 6791586.0,
    estado                  = 'pendiente'
  WHERE id = 10;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1006870.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1177000.0,      -- 10.7t × 110,000/ton (zona)
    total_costos_operativos = 1477000.0,
    total_material          = 10538830.0,
    estado                  = 'pendiente'
  WHERE id = 11;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1278819.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1494900.0,      -- 13.59t × 110,000/ton (zona)
    total_costos_operativos = 1794900.0,
    total_material          = 13304271.0,
    estado                  = 'pendiente'
  WHERE id = 12;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1079910.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1170000.0,      -- 11.7t × 100,000/ton (zona)
    total_costos_operativos = 1470000.0,
    total_material          = 7603888.8,
    estado                  = 'pendiente'
  WHERE id = 13;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1064271.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1244100.0,      -- 11.31t × 110,000/ton (zona)
    total_costos_operativos = 1544100.0,
    total_material          = 11122539.0,
    estado                  = 'pendiente'
  WHERE id = 14;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1137669.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1329900.0,      -- 12.09t × 110,000/ton (zona)
    total_costos_operativos = 1629900.0,
    total_material          = 11868921.0,
    estado                  = 'pendiente'
  WHERE id = 15;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 942880.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 4544000.0,      -- 11.36t × 400,000/ton (zona)
    total_costos_operativos = 4844000.0,
    total_material          = 6918336.0,
    estado                  = 'pendiente'
  WHERE id = 16;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1031283.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1197900.0,      -- 10.89t × 110,000/ton (zona)
    total_costos_operativos = 1497900.0,
    total_material          = 10779447.0,
    estado                  = 'pendiente'
  WHERE id = 17;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1052117.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1222100.0,      -- 11.11t × 110,000/ton (zona)
    total_costos_operativos = 1522100.0,
    total_material          = 9939036.0,
    estado                  = 'pendiente'
  WHERE id = 18;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1031283.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1197900.0,      -- 10.89t × 110,000/ton (zona)
    total_costos_operativos = 1497900.0,
    total_material          = 10779447.0,
    estado                  = 'pendiente'
  WHERE id = 19;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1173920.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1276000.0,      -- 12.76t × 100,000/ton (zona)
    total_costos_operativos = 1576000.0,
    total_material          = 9511699.2,
    estado                  = 'pendiente'
  WHERE id = 20;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1003200.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1161600.0,      -- 10.56t × 110,000/ton (zona)
    total_costos_operativos = 1461600.0,
    total_material          = 10490400.0,
    estado                  = 'pendiente'
  WHERE id = 21;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 958005.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1047000.0,      -- 10.47t × 100,000/ton (zona)
    total_costos_operativos = 1347000.0,
    total_material          = 7478232.0,
    estado                  = 'pendiente'
  WHERE id = 22;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1124010.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1242000.0,      -- 12.42t × 100,000/ton (zona)
    total_costos_operativos = 1542000.0,
    total_material          = 10786982.25,
    estado                  = 'pendiente'
  WHERE id = 23;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1048590.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1146000.0,      -- 11.46t × 100,000/ton (zona)
    total_costos_operativos = 1446000.0,
    total_material          = 8307972.96,
    estado                  = 'pendiente'
  WHERE id = 24;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1011790.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1118000.0,      -- 11.18t × 100,000/ton (zona)
    total_costos_operativos = 1418000.0,
    total_material          = 9395964.15,
    estado                  = 'pendiente'
  WHERE id = 25;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1080570.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1194000.0,      -- 11.94t × 100,000/ton (zona)
    total_costos_operativos = 1494000.0,
    total_material          = 8565250.08,
    estado                  = 'pendiente'
  WHERE id = 26;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 851130.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 882000.0,      -- 8.82t × 100,000/ton (zona)
    total_costos_operativos = 1182000.0,
    total_material          = 2033130.0,
    estado                  = 'pendiente'
  WHERE id = 27;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 950525.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 985000.0,      -- 9.85t × 100,000/ton (zona)
    total_costos_operativos = 1285000.0,
    total_material          = 2235525.0,
    estado                  = 'pendiente'
  WHERE id = 28;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 862710.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 894000.0,      -- 8.94t × 100,000/ton (zona)
    total_costos_operativos = 1194000.0,
    total_material          = 2056710.0,
    estado                  = 'pendiente'
  WHERE id = 29;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1164800.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1280000.0,      -- 12.8t × 100,000/ton (zona)
    total_costos_operativos = 1580000.0,
    total_material          = 8615392.0,
    estado                  = 'pendiente'
  WHERE id = 30;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1269730.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1439900.0,      -- 13.09t × 110,000/ton (zona)
    total_costos_operativos = 1739900.0,
    total_material          = 15706930.0,
    estado                  = 'pendiente'
  WHERE id = 31;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1049040.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1128000.0,      -- 11.28t × 100,000/ton (zona)
    total_costos_operativos = 1428000.0,
    total_material          = 7990794.24,
    estado                  = 'pendiente'
  WHERE id = 32;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1219394.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1417900.0,      -- 12.89t × 110,000/ton (zona)
    total_costos_operativos = 1717900.0,
    total_material          = 12692446.0,
    estado                  = 'pendiente'
  WHERE id = 33;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1031190.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1110000.0,      -- 11.1t × 100,000/ton (zona)
    total_costos_operativos = 1410000.0,
    total_material          = 7638387.6,
    estado                  = 'pendiente'
  WHERE id = 34;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1226962.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1426700.0,      -- 12.97t × 110,000/ton (zona)
    total_costos_operativos = 1726700.0,
    total_material          = 11787788.4,
    estado                  = 'pendiente'
  WHERE id = 35;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1203420.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1294000.0,      -- 12.94t × 100,000/ton (zona)
    total_costos_operativos = 1594000.0,
    total_material          = 10980676.0,
    estado                  = 'pendiente'
  WHERE id = 36;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1274235.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1446500.0,      -- 13.15t × 110,000/ton (zona)
    total_costos_operativos = 1746500.0,
    total_material          = 22134260.0,
    estado                  = 'pendiente'
  WHERE id = 37;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 792934.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 883000.0,      -- 8.83t × 100,000/ton (zona)
    total_costos_operativos = 1183000.0,
    total_material          = 5515591.38,
    estado                  = 'pendiente'
  WHERE id = 38;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 875550.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 975000.0,      -- 9.75t × 100,000/ton (zona)
    total_costos_operativos = 1275000.0,
    total_material          = 6059005.2,
    estado                  = 'pendiente'
  WHERE id = 39;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1182004.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1282000.0,      -- 12.82t × 100,000/ton (zona)
    total_costos_operativos = 1582000.0,
    total_material          = 11103042.22,
    estado                  = 'pendiente'
  WHERE id = 40;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1080660.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1278200.0,      -- 11.62t × 110,000/ton (zona)
    total_costos_operativos = 1578200.0,
    total_material          = 10439612.0,
    estado                  = 'pendiente'
  WHERE id = 41;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1117440.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1267200.0,      -- 11.52t × 110,000/ton (zona)
    total_costos_operativos = 1567200.0,
    total_material          = 13859040.0,
    estado                  = 'pendiente'
  WHERE id = 42;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1177709.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1241000.0,      -- 12.41t × 100,000/ton (zona)
    total_costos_operativos = 1541000.0,
    total_material          = 11227656.52,
    estado                  = 'pendiente'
  WHERE id = 43;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1319220.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1535600.0,      -- 13.96t × 110,000/ton (zona)
    total_costos_operativos = 1835600.0,
    total_material          = 14368190.0,
    estado                  = 'pendiente'
  WHERE id = 44;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1094160.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1280400.0,      -- 11.64t × 110,000/ton (zona)
    total_costos_operativos = 1580400.0,
    total_material          = 11974920.0,
    estado                  = 'pendiente'
  WHERE id = 45;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 977670.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1065000.0,      -- 10.65t × 100,000/ton (zona)
    total_costos_operativos = 1365000.0,
    total_material          = 6155583.0,
    estado                  = 'pendiente'
  WHERE id = 46;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1097376.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1249600.0,      -- 11.36t × 110,000/ton (zona)
    total_costos_operativos = 1549600.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 47;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 947520.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1108800.0,      -- 10.08t × 110,000/ton (zona)
    total_costos_operativos = 1408800.0,
    total_material          = 9178464.0,
    estado                  = 'pendiente'
  WHERE id = 48;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1000160.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1170400.0,      -- 10.64t × 110,000/ton (zona)
    total_costos_operativos = 1470400.0,
    total_material          = 9671712.0,
    estado                  = 'pendiente'
  WHERE id = 49;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1285760.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1443200.0,      -- 13.12t × 110,000/ton (zona)
    total_costos_operativos = 1743200.0,
    total_material          = 15886560.0,
    estado                  = 'pendiente'
  WHERE id = 50;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 2382996.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 2579000.0,      -- 25.79t × 100,000/ton (zona)
    total_costos_operativos = 2879000.0,
    total_material          = 15485048.84,
    estado                  = 'pendiente'
  WHERE id = 51;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 979488.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 4296000.0,      -- 10.74t × 400,000/ton (zona)
    total_costos_operativos = 4596000.0,
    total_material          = 8504157.12,
    estado                  = 'pendiente'
  WHERE id = 52;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 768416.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 3776000.0,      -- 9.44t × 400,000/ton (zona)
    total_costos_operativos = 4076000.0,
    total_material          = 5766515.2,
    estado                  = 'pendiente'
  WHERE id = 53;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 976668.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1162700.0,      -- 10.57t × 110,000/ton (zona)
    total_costos_operativos = 1462700.0,
    total_material          = 7713375.2,
    estado                  = 'pendiente'
  WHERE id = 54;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1162691.2,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1378190.0,      -- 12.529t × 110,000/ton (zona)
    total_costos_operativos = 1678190.0,
    total_material          = 8868272.38,
    estado                  = 'pendiente'
  WHERE id = 55;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 2064958.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 2218000.0,      -- 22.18t × 100,000/ton (zona)
    total_costos_operativos = 2518000.0,
    total_material          = 13038961.01,
    estado                  = 'pendiente'
  WHERE id = 56;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 981288.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1062000.0,      -- 10.62t × 100,000/ton (zona)
    total_costos_operativos = 1362000.0,
    total_material          = 5915176.32,
    estado                  = 'pendiente'
  WHERE id = 57;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1192325.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1417900.0,      -- 12.89t × 110,000/ton (zona)
    total_costos_operativos = 1717900.0,
    total_material          = 11494965.0,
    estado                  = 'pendiente'
  WHERE id = 58;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 2531655.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 2679000.0,      -- 26.79t × 100,000/ton (zona)
    total_costos_operativos = 2979000.0,
    total_material          = 17358800.4,
    estado                  = 'pendiente'
  WHERE id = 59;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 957555.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 4428000.0,      -- 11.07t × 400,000/ton (zona)
    total_costos_operativos = 4728000.0,
    total_material          = 8548644.45,
    estado                  = 'pendiente'
  WHERE id = 60;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 960150.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 4440000.0,      -- 11.1t × 400,000/ton (zona)
    total_costos_operativos = 4740000.0,
    total_material          = 8383769.25,
    estado                  = 'pendiente'
  WHERE id = 61;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 2158528.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 2326000.0,      -- 23.26t × 100,000/ton (zona)
    total_costos_operativos = 2626000.0,
    total_material          = 15352681.09,
    estado                  = 'pendiente'
  WHERE id = 62;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1159072.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1373900.0,      -- 12.49t × 110,000/ton (zona)
    total_costos_operativos = 1673900.0,
    total_material          = 13264620.0,
    estado                  = 'pendiente'
  WHERE id = 63;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 956564.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1183600.0,      -- 10.76t × 110,000/ton (zona)
    total_costos_operativos = 1483600.0,
    total_material          = 9327424.8,
    estado                  = 'pendiente'
  WHERE id = 64;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 2334300.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 2510000.0,      -- 25.1t × 100,000/ton (zona)
    total_costos_operativos = 2810000.0,
    total_material          = 12730775.0,
    estado                  = 'pendiente'
  WHERE id = 65;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 833882.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 977900.0,      -- 8.89t × 110,000/ton (zona)
    total_costos_operativos = 1277900.0,
    total_material          = 5834231.25,
    estado                  = 'pendiente'
  WHERE id = 66;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 602000.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1366200.0,      -- 12.42t × 110,000/ton (zona)
    total_costos_operativos = 1666200.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 67;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1057040.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1168000.0,      -- 11.68t × 100,000/ton (zona)
    total_costos_operativos = 1468000.0,
    total_material          = 6372665.6,
    estado                  = 'pendiente'
  WHERE id = 68;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 832840.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 974600.0,      -- 8.86t × 110,000/ton (zona)
    total_costos_operativos = 1274600.0,
    total_material          = 5705308.8,
    estado                  = 'pendiente'
  WHERE id = 69;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1187424.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1302000.0,      -- 13.02t × 100,000/ton (zona)
    total_costos_operativos = 1602000.0,
    total_material          = 8346568.32,
    estado                  = 'pendiente'
  WHERE id = 70;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1173920.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1403600.0,      -- 12.76t × 110,000/ton (zona)
    total_costos_operativos = 1703600.0,
    total_material          = 10508000.0,
    estado                  = 'pendiente'
  WHERE id = 71;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 810888.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 904000.0,      -- 9.04t × 100,000/ton (zona)
    total_costos_operativos = 1204000.0,
    total_material          = 4702981.72,
    estado                  = 'pendiente'
  WHERE id = 72;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1111279.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1288100.0,      -- 11.71t × 110,000/ton (zona)
    total_costos_operativos = 1588100.0,
    total_material          = 9922692.5,
    estado                  = 'pendiente'
  WHERE id = 73;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1165860.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1397000.0,      -- 12.7t × 110,000/ton (zona)
    total_costos_operativos = 1697000.0,
    total_material          = 10440950.0,
    estado                  = 'pendiente'
  WHERE id = 74;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1100740.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1288100.0,      -- 11.71t × 110,000/ton (zona)
    total_costos_operativos = 1588100.0,
    total_material          = 9843650.0,
    estado                  = 'pendiente'
  WHERE id = 75;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 937440.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1302000.0,      -- 13.02t × 100,000/ton (zona)
    total_costos_operativos = 1602000.0,
    total_material          = 7129146.24,
    estado                  = 'pendiente'
  WHERE id = 76;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 885370.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1247000.0,      -- 12.47t × 100,000/ton (zona)
    total_costos_operativos = 1547000.0,
    total_material          = 6384661.68,
    estado                  = 'pendiente'
  WHERE id = 77;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1157700.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1362000.0,      -- 13.62t × 100,000/ton (zona)
    total_costos_operativos = 1662000.0,
    total_material          = 6582225.0,
    estado                  = 'pendiente'
  WHERE id = 78;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 806601.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 944900.0,      -- 8.59t × 110,000/ton (zona)
    total_costos_operativos = 1244900.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 79;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1142640.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1366200.0,      -- 12.42t × 110,000/ton (zona)
    total_costos_operativos = 1666200.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 80;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 721415.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 863500.0,      -- 7.85t × 110,000/ton (zona)
    total_costos_operativos = 1163500.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 81;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 991688.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1206700.0,      -- 10.97t × 110,000/ton (zona)
    total_costos_operativos = 1506700.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 82;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 978112.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1054000.0,      -- 10.54t × 100,000/ton (zona)
    total_costos_operativos = 1354000.0,
    total_material          = 7473068.67,
    estado                  = 'pendiente'
  WHERE id = 83;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1102310.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1331000.0,      -- 12.1t × 110,000/ton (zona)
    total_costos_operativos = 1631000.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 84;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1127064.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1368400.0,      -- 12.44t × 110,000/ton (zona)
    total_costos_operativos = 1668400.0,
    total_material          = NULL,
    estado                  = 'pendiente'
  WHERE id = 85;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 910936.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 988000.0,      -- 9.88t × 100,000/ton (zona)
    total_costos_operativos = 1288000.0,
    total_material          = 2854809.92,
    estado                  = 'pendiente'
  WHERE id = 86;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 1121478.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1349700.0,      -- 12.27t × 110,000/ton (zona)
    total_costos_operativos = 1649700.0,
    total_material          = 10845819.6,
    estado                  = 'pendiente'
  WHERE id = 87;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 263261.8,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1137200.0,      -- 2.843t × 400,000/ton (zona)
    total_costos_operativos = 1437200.0,
    total_material          = 6044281.5,
    estado                  = 'pendiente'
  WHERE id = 88;
  UPDATE material_planta_entrada SET
    excedente_calculado     = 371200.0,
    costo_cargue            = 300000,
    costo_bascula           = 0,
    costo_volqueta          = 1600000.0,      -- 4.0t × 400,000/ton (zona)
    total_costos_operativos = 1900000.0,
    total_material          = 8396000.0,
    estado                  = 'pendiente'
  WHERE id = 89;

-- ====================================================================
-- FASE 6 · AGUA_PLANTA
-- ====================================================================
INSERT INTO Agua_Planta (id_dueno_volqueta, fecha, valor_viaje, cantidad_viajes, acpm, comprobante_url) VALUES

-- ==========================================
-- BLOQUE 1: NELSON (id=9) - Imágenes 1, 2 y 3 (11 registros)
-- ==========================================
(9, '2026-04-30', 200000, 6, 0, 'Migración Excel - hoja Agua (Nelson bloque 1)'),
(9, '2026-05-01', 200000, 5, 0, 'Migración Excel - hoja Agua (Nelson bloque 1)'),
(9, '2026-05-05', 200000, 8, 0, 'Migración Excel - hoja Agua (Nelson bloque 1)'),
(9, '2026-05-06', 200000, 8, 0, 'Migración Excel - hoja Agua (Nelson bloque 1)'),
(9, '2026-05-07', 200000, 6, 0, 'Migración Excel - hoja Agua (Nelson bloque 2)'),
(9, '2026-05-08', 200000, 9, 0, 'Migración Excel - hoja Agua (Nelson bloque 2)'),
(9, '2026-05-09', 200000, 6, 0, 'Migración Excel - hoja Agua (Nelson bloque 2)'),
(9, '2026-05-11', 130000, 6, 0, 'Migración Excel - hoja Agua (Nelson bloque 3)'),
(9, '2026-05-12', 180000, 7, 0, 'Migración Excel - hoja Agua (Nelson bloque 3)'),
(9, '2026-05-13', 180000, 7, 0, 'Migración Excel - hoja Agua (Nelson bloque 3)'),
(9, '2026-05-14', 180000, 7, 0, 'Migración Excel - hoja Agua (Nelson bloque 3)'),

-- ==========================================
-- BLOQUE 2: DEIMER (id=4) - Imagen 4 (4 registros)
-- ==========================================
(4, '2026-05-15', 180000, 7, 0, 'Migración Excel - hoja Agua (Deimer)'),
(4, '2026-05-16', 180000, 5, 0, 'Migración Excel - hoja Agua (Deimer)'),
(4, '2026-05-17', 180000, 5, 0, 'Migración Excel - hoja Agua (Deimer)'),
(4, '2026-05-18', 180000, 6, 0, 'Migración Excel - hoja Agua (Deimer)'),

-- ==========================================
-- BLOQUE 3: ANIBAL (id=1) - Imagen 5 (1 registro sin fecha en Excel)
-- ==========================================
-- Nota: En la imagen no tenía fecha. Le asigne '2026-05-10' para mantener el orden.
(1, '2026-05-10', 180000, 3, 0, 'Migración Excel - hoja Agua (Anibal - Fecha ajustada)'),

-- ==========================================
-- BLOQUE 4: NELSON (id=9) - Imagen 6 con descuentos ACPM (16 registros)
-- ==========================================
(9, '2026-05-19', 130000, 1, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-20', 130000, 4, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-21', 130000, 4, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-22', 130000, 6, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-23', 130000, 7, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-25', 130000, 8, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-26', 130000, 8, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-27', 130000, 8, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-28', 130000, 3, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-29', 130000, 3, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-05-30', 130000, 9, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-06-02', 130000, 5, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-06-03', 130000, 3, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-06-04', 130000, 3, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-06-05', 130000, 4, 126000, 'Migración Excel - hoja Agua (Nelson con ACPM)'),
(9, '2026-06-06', 130000, 7, 0,      'Migración Excel - hoja Agua (Nelson con ACPM)');
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- RESUMEN
--   FASE 0: 3 Minero | UPDATE Mina | 4 Mina nuevas | 11 Volqueta_Vehiculo
--   FASE 1: 178 INSERT material_planta_entrada (llegada básica)
--   FASE 2:  89 INSERT analisis (Cabeza — humedad/tenor reales del lab)
--   FASE 3:  89 UPDATE material_planta_entrada (campos derivados del análisis)
--   FASE 4:  89 UPDATE material_planta_entrada (precio por tenor+método)
--   FASE 5:  89 UPDATE material_planta_entrada (excedente, flete, totales)
--   FASE 6:  49 INSERT agua_planta
-- ====================================================================