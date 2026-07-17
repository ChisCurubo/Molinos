-- =====================================================================
--  PROCESO_INSERT_V4 — CORREGIDO
--  PARTE 1: Correcciones inventario 12-x  (sin cambios, ya estaba bien)
--  PARTE 2: Viajes 13-1, 13-2, 13-3       (corregido)
-- =====================================================================
--
--  BUGS CORREGIDOS EN ESTA VERSIÓN:
--
--  [13-2] Faltaba crear LC-REMANENTE-13-2 (3.15t húmedas de lote I)
--         y cerrar lote I a enviado_completo después del viaje.
--
--  [13-3] Lote creado con código 'LC-12-3-F' → debe ser 'LC-13-3-K'
--  [13-3] procesamiento_material usaba volquetas 12027-12034 en vez de 13027-13034
--  [13-3] Viaje creado como '12-3' en vez de '13-3'
--  [13-3] Lote cerrado manualmente (toneladas_seco, maquila_total, precio...)
--         → solo poner fecha_fin, toneladas_humedo, humedad, canoa, estado
--         El trigger calcula el resto
--  [13-3] Remanente (LC-REMANENTE-13-2) insertado con es_remanente=1
--         → debe ser 0; con 1 el trigger no descuenta inventario
--  [13-3] id_viaje_origen no incluido en INSERT de viaje_material
--  [13-3] toneladas_disponibles del remanente = 2.74 (SECAS)
--         → debe ser 3.15 (HÚMEDAS)
--  [13-3] No se creaba el remanente de las 10t de lote K ni se cerraba K
--  [1.3/2.3] costo_bascula=0 en vez de 100000
-- =====================================================================

-- =====================================================================
--  PARTE 1 — CORRECCIONES INVENTARIO 12-x  (sin cambios)
-- =====================================================================

START TRANSACTION;

-- FIX 1: LC-12-1-A (mc=10) — kardex ya registró la salida, mc no se actualizó
UPDATE material_concentrado
SET toneladas_disponibles=0, estado='enviado_completo'
WHERE id=10 AND codigo='LC-12-1-A';

UPDATE inventario_lotes SET estado='agotado', toneladas_disponibles=0
WHERE id_material_concentrado=10 AND estado!='agotado';

-- FIX 2: LC-12-1-B (mc=11) — inventario_lotes con 2.2t que pasaron al remanente
UPDATE inventario_lotes SET estado='agotado', toneladas_disponibles=0
WHERE id_material_concentrado=11;

-- FIX 3: LC-REMANENTE-12-1 (mc=14) — salió con es_remanente=1, sin descuento
UPDATE material_concentrado
SET toneladas_disponibles=0, estado='enviado_completo'
WHERE id=14 AND codigo='LC-REMANENTE-12-1';

UPDATE inventario_lotes
SET toneladas_disponibles=0, estado='agotado'
WHERE id_material_concentrado=14 AND estado!='agotado';

INSERT INTO Kardex_Movimientos (id_lote,fecha,tipo_movimiento,toneladas_movidas,destino_referencia)
SELECT il.id,'2026-07-12 00:46:44','SALIDA_VIAJE',2.2000,
       'Viaje #12 (remanente LC-12-1-B, es_remanente=1 fue un bug)'
FROM inventario_lotes il WHERE il.id_material_concentrado=14 ORDER BY il.id DESC LIMIT 1;

-- FIX 4: Duplicado mc=15
UPDATE material_concentrado
SET toneladas_disponibles=0, estado='enviado_completo', comentarios='DUPLICADO ACCIDENTAL - ignorar'
WHERE id=15 AND codigo='LC-REMANENTE-12-1';

-- FIX 5: LC-12-2-C (mc=12) — viaje_material id=49 tenía id_mc=NULL
UPDATE viaje_material
SET id_material_concentrado=12
WHERE id=49 AND id_viaje=13 AND id_material_concentrado IS NULL;

UPDATE material_concentrado
SET toneladas_disponibles=0, estado='enviado_completo'
WHERE id=12 AND codigo='LC-12-2-C';

UPDATE inventario_lotes
SET toneladas_disponibles=0, estado='agotado'
WHERE id_material_concentrado=12 AND estado!='agotado';

INSERT INTO Kardex_Movimientos (id_lote,fecha,tipo_movimiento,toneladas_movidas,destino_referencia)
SELECT il.id,'2026-07-12 18:18:14','SALIDA_VIAJE',3.1500,
       'Viaje #13 (residuo 3.15t LC-12-2-C, id_mc era NULL - corregido)'
FROM inventario_lotes il WHERE il.id_material_concentrado=12 ORDER BY il.id DESC LIMIT 1;

-- Verificación
SELECT mc.id, mc.codigo, mc.toneladas_disponibles, mc.estado
FROM material_concentrado mc WHERE mc.id IN (10,11,12,13,14,15,16) ORDER BY mc.id;

SELECT il.id, il.id_material_concentrado, il.toneladas_disponibles, il.estado
FROM inventario_lotes il WHERE il.id_material_concentrado IN (10,11,12,13,14)
ORDER BY il.id_material_concentrado, il.id;

COMMIT;


-- =====================================================================
--  PARTE 2 — VIAJES 13-1, 13-2, 13-3
-- =====================================================================

START TRANSACTION;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================================
--  VIAJE 13-1
-- =====================================================================

-- 1.1 Báscula 13-1
INSERT INTO material_planta_entrada (
    numero_volqueta,id_mina,id_vehiculo,id_tipo_material,id_precio,
    fecha_llegada,peso_llegada_planta,porcentaje_humedad,gramos_humedad,
    tenor,total_material_seco,total_gramos,precio_por_gramo,precio_por_tonelada,precio_total,excedente_calculado,
    costo_cargue,costo_bascula,costo_maquila,costo_adicional,costo_volqueta,total_costos_operativos,estado,comentarios
) VALUES
(13006,1,(13006%11)+1,2,NULL,'2025-10-30',10.850,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Jeferson vol 6'),
(13007,1,(13007%11)+1,2,NULL,'2025-11-01',10.290,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Jeferson vol 7'),
(13008,1,(13008%11)+1,2,NULL,'2025-11-28',10.270,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Jeferson vol 8'),
(13009,1,(13009%11)+1,2,NULL,'2025-12-09', 9.270,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Jeferson vol 9'),
(13010,1,(13010%11)+1,2,NULL,'2025-12-11',10.860,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Jeferson vol 10'),
(13011,1,(13011%11)+1,2,NULL,'2025-12-20',10.280,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Jeferson vol 11'),
(13012,1,(13012%11)+1,2,NULL,'2025-11-03',10.760,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Abraham vol 2'),
(13013,1,(13013%11)+1,2,NULL,'2025-11-13', 9.500,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Abraham vol 3'),
(13014,1,(13014%11)+1,2,NULL,'2025-11-19',11.680,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Abraham vol 4'),
(13015,4,(13015%11)+1,2,NULL,'2025-10-06', 7.740,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Antonio vol 1'),
(13016,14,(13016%11)+1,1,NULL,'2026-02-20',11.700,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Naum vol 3'),
(13017,14,(13017%11)+1,1,NULL,'2026-03-01',12.760,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Naum vol 4'),
(13018,2,(13018%11)+1,2,NULL,'2026-02-20',13.590,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-1 Omar Mina30 vol 2');

-- 1.2 Análisis 13-1
INSERT INTO Analisis (id_entrada,id_tipo_analisis,numero_analisis,
    au_concentrado,ag_concentrado,ton,porcentaje_humedad,toneladas_humedas,toneladas_secas,
    au_gr_x_ton,au_falso,ag_gr_x_ton,valor_analisis,estado_pago,fecha_salida,comentarios) VALUES
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13006),1,'AN-13006',NULL,NULL,10.850,0.110,1.1935, 9.6565,7.5,7.5,NULL,NULL,'no_aplica',NULL,'Jeferson vol 6'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13007),1,'AN-13007',NULL,NULL,10.290,0.046,0.4733, 9.8167,7.5,7.5,NULL,NULL,'no_aplica',NULL,'Jeferson vol 7'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13008),1,'AN-13008',NULL,NULL,10.270,0.065,0.6676, 9.6024,5.7,5.7,NULL,NULL,'no_aplica',NULL,'Jeferson vol 8'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13009),1,'AN-13009',NULL,NULL, 9.270,0.051,0.4728, 8.7972,4.8,4.8,NULL,NULL,'no_aplica',NULL,'Jeferson vol 9'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13010),1,'AN-13010',NULL,NULL,10.860,0.050,0.5430,10.3170,4.8,4.8,NULL,NULL,'no_aplica',NULL,'Jeferson vol 10'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13011),1,'AN-13011',NULL,NULL,10.280,0.080,0.8224, 9.4576,5.6,5.6,NULL,NULL,'no_aplica',NULL,'Jeferson vol 11'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13012),1,'AN-13012',NULL,NULL,10.760,0.200,2.1520, 8.6080,6.3,6.3,NULL,NULL,'no_aplica',NULL,'Abraham vol 2'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13013),1,'AN-13013',NULL,NULL, 9.500,0.100,0.9500, 8.5500,3.7,3.7,NULL,NULL,'no_aplica',NULL,'Abraham vol 3'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13014),1,'AN-13014',NULL,NULL,11.680,0.054,0.6307,11.0493,7.2,7.2,NULL,NULL,'no_aplica',NULL,'Abraham vol 4'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13015),1,'AN-13015',NULL,NULL, 7.740,0.100,0.7740, 6.9660,4.7,4.7,NULL,NULL,'no_aplica',NULL,'Antonio vol 1'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13016),1,'AN-13016',NULL,NULL,11.700,0.077,0.9009,10.7991,6.5,6.5,NULL,NULL,'no_aplica',NULL,'Naum vol 3'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13017),1,'AN-13017',NULL,NULL,12.760,0.080,1.0208,11.7392,8.0,8.0,NULL,NULL,'no_aplica',NULL,'Naum vol 4'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13018),1,'AN-13018',NULL,NULL,13.590,0.059,0.8018,12.7882,8.5,8.5,NULL,NULL,'no_aplica',NULL,'Omar Mina30 vol 2');

-- 1.3 UPDATE precios 13-1
-- [FIX] costo_bascula=100000 (antes era 0)
UPDATE material_planta_entrada mpe SET
    porcentaje_humedad =(SELECT porcentaje_humedad FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    gramos_humedad     =(SELECT toneladas_humedas  FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    tenor              =(SELECT au_falso           FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    total_material_seco=(SELECT toneladas_secas    FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    total_gramos       =(SELECT toneladas_secas*au_gr_x_ton FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    id_precio=(SELECT pm.id FROM precio_material pm LEFT JOIN mina m ON m.id=mpe.id_mina
        WHERE (pm.id_minero=m.id_minero OR pm.id_minero IS NULL)
          AND (pm.id_zona=m.id_zona OR pm.id_zona IS NULL)
          AND pm.intervalo_tenor_min<=(SELECT au_falso FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
          AND pm.intervalo_tenor_max>=(SELECT au_falso FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
          AND pm.fecha_inicio<=mpe.fecha_llegada
          AND (pm.fecha_fin IS NULL OR pm.fecha_fin>=mpe.fecha_llegada)
          AND pm.activo=1
        ORDER BY pm.id_minero DESC, pm.id_zona DESC, pm.precio_por_tonelada DESC LIMIT 1),
    precio_por_gramo   =(SELECT precio_por_gramo    FROM precio_material WHERE id=mpe.id_precio),
    precio_por_tonelada=(SELECT precio_por_tonelada FROM precio_material WHERE id=mpe.id_precio),
    precio_total=CASE
        WHEN (SELECT metodo FROM precio_material WHERE id=mpe.id_precio)='por_gramo'
            THEN (SELECT precio_por_gramo FROM precio_material WHERE id=mpe.id_precio)
                 *(SELECT toneladas_secas*au_gr_x_ton FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
        ELSE (SELECT precio_por_tonelada FROM precio_material WHERE id=mpe.id_precio)
             *(SELECT toneladas_secas FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
    END,
    excedente_calculado=CASE mpe.numero_volqueta
        WHEN 13006 THEN 965650  WHEN 13007 THEN 981666  WHEN 13008 THEN 960245
        WHEN 13009 THEN 879723  WHEN 13010 THEN 1031700 WHEN 13011 THEN 945760
        WHEN 13012 THEN 860800  WHEN 13013 THEN 0       WHEN 13014 THEN 1104928
        WHEN 13015 THEN 696600  WHEN 13016 THEN 650000  WHEN 13017 THEN 800000
        WHEN 13018 THEN 1278819 END,
    costo_cargue=250000,
    costo_bascula=100000,   -- [FIX] era 0
    costo_maquila=0, costo_adicional=0, costo_volqueta=0,
    total_costos_operativos=350000, total_material=precio_total+350000,
    estado='pagada'
WHERE mpe.numero_volqueta BETWEEN 13006 AND 13018;

-- 1.4 Lotes 13-1
INSERT INTO material_concentrado (codigo,fecha_inicio,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,estado)
VALUES ('LC-13-1-G','2025-10-30',0,1,0,1,'en_proceso');
SET @lote_G = LAST_INSERT_ID();

INSERT INTO procesamiento_material (id_material_concentrado,id_entrada,toneladas_aportadas,toneladas_seco_aportadas)
SELECT @lote_G, mpe.id, mpe.peso_llegada_planta, mpe.total_material_seco
FROM material_planta_entrada mpe WHERE mpe.numero_volqueta BETWEEN 13006 AND 13015;

INSERT INTO material_concentrado (codigo,fecha_inicio,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,estado)
VALUES ('LC-13-1-H','2026-02-20',0,1,0,1,'en_proceso');
SET @lote_H = LAST_INSERT_ID();

INSERT INTO procesamiento_material (id_material_concentrado,id_entrada,toneladas_aportadas,toneladas_seco_aportadas)
SELECT @lote_H, mpe.id, mpe.peso_llegada_planta, mpe.total_material_seco
FROM material_planta_entrada mpe WHERE mpe.numero_volqueta IN (13016,13017,13018);

-- 1.5 Cerrar lotes (solo fecha_fin, humedo, humedad, canoa, estado → trigger hace el resto)
UPDATE material_concentrado SET
    fecha_fin='2026-02-10', toneladas_humedo=22.0, porcentaje_humedad=0.13,
    ubicacion_canoa='Canoa G', estado='en_canoa'
WHERE id=@lote_G;

UPDATE material_concentrado SET
    fecha_fin='2026-02-10', toneladas_humedo=7.0, porcentaje_humedad=0.15,
    ubicacion_canoa='Canoa H', estado='en_canoa'
WHERE id=@lote_H;

-- 1.6 Análisis concentrado tipo 2
INSERT INTO Analisis (id_material_concentrado,id_tipo_analisis,id_mina,id_tipo_material,
    numero_analisis,au_concentrado,ag_concentrado,ton,porcentaje_humedad,
    toneladas_humedas,toneladas_secas,au_gr_x_ton,au_falso,ag_gr_x_ton,fecha_salida,comentarios) VALUES
(@lote_G,2,1,1,'AN-LOTG',19.14*440,19.14*6929,22.0,0.13,2.86,19.14,440,440,6929,'2026-02-10','Conc Lote G 13-1'),
(@lote_H,2,1,1,'AN-LOTH', 5.95*141, 5.95*2678, 7.0,0.15,1.05, 5.95,141,141,2678,'2026-02-10','Conc Lote H 13-1');

-- 1.7 Viaje 13-1
INSERT INTO Viaje (numero_viaje,fecha,comentarios) VALUES ('13-1','2026-02-10','Viaje 13-1');
SET @viaje_13_1 = LAST_INSERT_ID();

INSERT INTO viaje_material (
    id_viaje,id_material_concentrado,es_remanente,id_viaje_origen,concepto,
    total_material,total_concentrado_humedo,porcentaje_humedad,peso_humedad,concentrado_seco,
    valor_total_con_gastos,au_promedio_compra,tenor_au_venta,total_grs_au_venta,tenor_ag,total_grs_ag_venta
) VALUES
(@viaje_13_1,@lote_G,0,NULL,'JEFERSON + ABRAHAM + ANTONIO',
 75.67,22.0,0.13,2.86,19.14, 14523772,5.98,440,19.14*440,6929,19.14*6929),
(@viaje_13_1,@lote_H,0,NULL,'NAUM + OMAR MINA 30',
 35.33,4.80,0.15,4.80*0.15,4.80*(1-0.15), 29357778,7.30,141,4.80*(1-0.15)*141,2678,4.80*(1-0.15)*2678);

-- 1.8 Remanente: 2.2t húmedas que sobraron del lote H
-- toneladas_disponibles = 2.20 HÚMEDAS (no las secas 1.914)
INSERT INTO material_concentrado (
    codigo,fecha_inicio,fecha_fin,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,
    toneladas_humedo,porcentaje_humedad,toneladas_seco,toneladas_disponibles,
    ubicacion_canoa,precio_maquila_por_ton,maquila_total,material_seco_procesado,estado
) VALUES (
    'LC-REMANENTE-13-1','2026-02-20','2026-02-20',0,1,0,1,
    2.20,0.13,2.20*(1-0.13),
    2.20,  -- HÚMEDAS
    'Canoa H-rem',0,0,0,'en_canoa');
SET @lote_REM_13 = LAST_INSERT_ID();

INSERT INTO Analisis (id_material_concentrado,id_tipo_analisis,numero_analisis,
    au_concentrado,ag_concentrado,ton,porcentaje_humedad,toneladas_humedas,toneladas_secas,
    au_gr_x_ton,au_falso,ag_gr_x_ton,fecha_salida,comentarios) VALUES
(@lote_REM_13,2,'AN-REM-13-1',2.20*(1-0.13)*23.5,2.20*(1-0.13)*449,
 2.20,0.13,2.20*0.13,2.20*(1-0.13),23.5,23.5,449,'2026-02-20','Remanente LC-13-1-H');

-- Cerrar lote H
UPDATE material_concentrado SET toneladas_disponibles=0, estado='enviado_completo' WHERE id=@lote_H;
UPDATE inventario_lotes SET estado='agotado', toneladas_disponibles=0 WHERE id_material_concentrado=@lote_H;

SELECT '=== VIAJE 13-1 ===' AS v;
SELECT v.numero_viaje, v.maquila FROM Viaje v WHERE v.id=@viaje_13_1;
SELECT mc.codigo, mc.toneladas_disponibles, mc.maquila_total, mc.estado
FROM material_concentrado mc WHERE mc.id IN (@lote_G,@lote_H,@lote_REM_13);


-- =====================================================================
--  VIAJE 13-2
-- =====================================================================

-- 2.1 Báscula 13-2
INSERT INTO material_planta_entrada (
    numero_volqueta,id_mina,id_vehiculo,id_tipo_material,id_precio,
    fecha_llegada,peso_llegada_planta,porcentaje_humedad,gramos_humedad,
    tenor,total_material_seco,total_gramos,precio_por_gramo,precio_por_tonelada,precio_total,excedente_calculado,
    costo_cargue,costo_bascula,costo_maquila,costo_adicional,costo_volqueta,total_costos_operativos,estado,comentarios
) VALUES
(13019,1,(13019%11)+1,2,NULL,'2026-02-20',10.700,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 1'),
(130192,1,(130192%11)+1,2,NULL,'2026-02-20',13.590,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 2 (nueva)'),
(13020,1,(13020%11)+1,2,NULL,'2026-02-21',11.310,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 3'),
(13021,1,(13021%11)+1,2,NULL,'2026-02-21',12.090,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 4'),
(13022,1,(13022%11)+1,2,NULL,'2026-02-26',10.890,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 5'),
(13023,1,(13023%11)+1,2,NULL,'2026-02-27',11.110,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 6'),
(13024,1,(13024%11)+1,2,NULL,'2026-02-28',10.890,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 7'),
(13025,1,(13025%11)+1,2,NULL,'2026-03-02',10.560,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Omar vol 8'),
(13026,7,(13026%11)+1,2,NULL,'2026-03-09', 2.000,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-2 Marlon');

-- 2.2 Análisis 13-2
INSERT INTO Analisis (id_entrada,id_tipo_analisis,numero_analisis,
    au_concentrado,ag_concentrado,ton,porcentaje_humedad,toneladas_humedas,toneladas_secas,
    au_gr_x_ton,au_falso,ag_gr_x_ton,valor_analisis,estado_pago,fecha_salida,comentarios) VALUES
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13019),1,'AN-13019',NULL,NULL,10.700,0.059,0.631,10.0687,8.5,8.5,NULL,NULL,'no_aplica',NULL,'Omar vol 1'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=130192),1,'AN-130192',NULL,NULL,13.590,0.059,0.802,12.7882,8.5,8.5,NULL,NULL,'no_aplica',NULL,'Omar vol 2'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13020),1,'AN-13020',NULL,NULL,11.310,0.059,0.667,10.6427,9.0,9.0,NULL,NULL,'no_aplica',NULL,'Omar vol 3'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13021),1,'AN-13021',NULL,NULL,12.090,0.059,0.713,11.3767,9.0,9.0,NULL,NULL,'no_aplica',NULL,'Omar vol 4'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13022),1,'AN-13022',NULL,NULL,10.890,0.053,0.577,10.3128,8.0,8.0,NULL,NULL,'no_aplica',NULL,'Omar vol 5'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13023),1,'AN-13023',NULL,NULL,11.110,0.053,0.589,10.5212,7.3,7.3,NULL,NULL,'no_aplica',NULL,'Omar vol 6'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13024),1,'AN-13024',NULL,NULL,10.890,0.053,0.577,10.3128,8.1,8.1,NULL,NULL,'no_aplica',NULL,'Omar vol 7'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13025),1,'AN-13025',NULL,NULL,10.560,0.050,0.528,10.0320,8.4,8.4,NULL,NULL,'no_aplica',NULL,'Omar vol 8'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13026),1,'AN-13026',NULL,NULL, 2.000,0.000,0.000, 2.0000,10.0,10.0,NULL,NULL,'no_aplica',NULL,'Marlon');

-- 2.3 UPDATE precios 13-2
-- [FIX] costo_bascula=100000 (antes era 0)
UPDATE material_planta_entrada mpe SET
    porcentaje_humedad =(SELECT porcentaje_humedad FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    gramos_humedad     =(SELECT toneladas_humedas  FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    tenor              =(SELECT au_falso           FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    total_material_seco=(SELECT toneladas_secas    FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    total_gramos       =(SELECT toneladas_secas*au_gr_x_ton FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    id_precio=(SELECT pm.id FROM precio_material pm LEFT JOIN mina m ON m.id=mpe.id_mina
        WHERE (pm.id_minero=m.id_minero OR pm.id_minero IS NULL)
          AND (pm.id_zona=m.id_zona OR pm.id_zona IS NULL)
          AND pm.intervalo_tenor_min<=(SELECT au_falso FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
          AND pm.intervalo_tenor_max>=(SELECT au_falso FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
          AND pm.fecha_inicio<=mpe.fecha_llegada
          AND (pm.fecha_fin IS NULL OR pm.fecha_fin>=mpe.fecha_llegada)
          AND pm.activo=1
        ORDER BY pm.id_minero DESC, pm.id_zona DESC, pm.precio_por_tonelada DESC LIMIT 1),
    precio_por_gramo   =(SELECT precio_por_gramo    FROM precio_material WHERE id=mpe.id_precio),
    precio_por_tonelada=(SELECT precio_por_tonelada FROM precio_material WHERE id=mpe.id_precio),
    precio_total=CASE
        WHEN (SELECT metodo FROM precio_material WHERE id=mpe.id_precio)='por_gramo'
            THEN (SELECT precio_por_gramo FROM precio_material WHERE id=mpe.id_precio)
                 *(SELECT toneladas_secas*au_gr_x_ton FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
        ELSE (SELECT precio_por_tonelada FROM precio_material WHERE id=mpe.id_precio)
             *(SELECT toneladas_secas FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
    END,
    excedente_calculado=CASE mpe.numero_volqueta
        WHEN 13019  THEN 1006870  WHEN 130192 THEN 1278819
        WHEN 13020  THEN 1064271  WHEN 13021  THEN 1137669
        WHEN 13022  THEN 1031283  WHEN 13023  THEN 1052117
        WHEN 13024  THEN 1031283  WHEN 13025  THEN 1003200
        WHEN 13026  THEN 1000000 END,
    costo_cargue=CASE WHEN mpe.numero_volqueta IN(13019,130192,13020,13021,13022,13023,13024,13025)
                      THEN 300000 ELSE 200000 END,
    costo_bascula=100000,   -- [FIX] era 0
    costo_maquila=0, costo_adicional=0, costo_volqueta=0,
    total_costos_operativos=costo_cargue+100000,
    total_material=precio_total+costo_cargue+100000,
    estado='pagada'
WHERE mpe.numero_volqueta IN(13019,130192,13020,13021,13022,13023,13024,13025,13026);

-- 2.4 Lotes 13-2
INSERT INTO material_concentrado (codigo,fecha_inicio,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,estado)
VALUES ('LC-13-2-I','2026-02-20',0,1,0,1,'en_proceso');
SET @lote_I = LAST_INSERT_ID();

INSERT INTO procesamiento_material (id_material_concentrado,id_entrada,toneladas_aportadas,toneladas_seco_aportadas)
SELECT @lote_I, mpe.id, mpe.peso_llegada_planta, mpe.total_material_seco
FROM material_planta_entrada mpe WHERE mpe.numero_volqueta IN(13019,130192,13020,13021,13022,13023,13024,13025);

INSERT INTO material_concentrado (codigo,fecha_inicio,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,estado)
VALUES ('LC-13-2-J','2026-03-09',0,0,0,0,'en_proceso');
SET @lote_J = LAST_INSERT_ID();

INSERT INTO procesamiento_material (id_material_concentrado,id_entrada,toneladas_aportadas,toneladas_seco_aportadas)
SELECT @lote_J, mpe.id, mpe.peso_llegada_planta, mpe.total_material_seco
FROM material_planta_entrada mpe WHERE mpe.numero_volqueta=13026;

-- 2.5 Cerrar lotes 13-2
UPDATE material_concentrado SET
    fecha_fin='2026-03-18', toneladas_humedo=27.95, porcentaje_humedad=0.13,
    ubicacion_canoa='Canoa I', estado='en_canoa'
WHERE id=@lote_I;

UPDATE material_concentrado SET
    fecha_fin='2026-03-18', toneladas_humedo=2.0, porcentaje_humedad=0.07,
    ubicacion_canoa='Canoa J', estado='en_canoa'
WHERE id=@lote_J;

-- 2.6 Análisis concentrado
INSERT INTO Analisis (id_material_concentrado,id_tipo_analisis,id_mina,id_tipo_material,
    numero_analisis,au_concentrado,ag_concentrado,ton,porcentaje_humedad,
    toneladas_humedas,toneladas_secas,au_gr_x_ton,au_falso,ag_gr_x_ton,fecha_salida,comentarios) VALUES
(@lote_I,2,1,1,'AN-LOTI',27.95*(1-0.13)*19.9,27.95*(1-0.13)*486,
 27.95,0.13,27.95*0.13,27.95*(1-0.13),19.9,19.9,486,'2026-03-18','Conc Lote I 13-2'),
(@lote_J,2,7,1,'AN-LOTJ',2.0*(1-0.07)*12,2.0*(1-0.07)*67,
 2.0,0.07,2.0*0.07,2.0*(1-0.07),12,12,67,'2026-03-18','Conc Lote J 13-2 Marlon');

-- 2.7 Viaje 13-2
INSERT INTO Viaje (numero_viaje,fecha,comentarios) VALUES ('13-2','2026-03-18','Viaje 13-2');
SET @viaje_13_2 = LAST_INSERT_ID();

INSERT INTO viaje_material (
    id_viaje,id_material_concentrado,es_remanente,id_viaje_origen,concepto,
    total_material,total_concentrado_humedo,porcentaje_humedad,peso_humedad,concentrado_seco,
    valor_total_con_gastos,au_promedio_compra,tenor_au_venta,total_grs_au_venta,tenor_ag,total_grs_ag_venta
) VALUES
(@viaje_13_2,@lote_I,0,NULL,'OMAR MINA 80 vol 1,2,3,4,5,6,7,8',
 86.06,24.80,0.13,24.80*0.13,24.80*(1-0.13),
 89622891,8.35,19.9,24.80*(1-0.13)*19.9,486,24.80*(1-0.13)*486),
(@viaje_13_2,@lote_J,0,NULL,'MARLON ARENAS - SIN MAQUILA',
 2.0,2.0,0.07,2.0*0.07,2.0*(1-0.07),
 4450000,10.00,12,2.0*(1-0.07)*12,67,2.0*(1-0.07)*67),
(@viaje_13_2,@lote_REM_13,0,@viaje_13_1,'REMANENTE LC-13-1-H - LIBRE DE COSTO',
 NULL,2.20,0.13,2.20*0.13,2.20*(1-0.13),
 NULL,7.90,23.5,2.20*(1-0.13)*23.5,449,2.20*(1-0.13)*449);

-- [FIX] Crear remanente para las 3.15t que sobraron del lote I
-- toneladas_disponibles = 3.15 HÚMEDAS (no las secas 2.74)
INSERT INTO material_concentrado (
    codigo,fecha_inicio,fecha_fin,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,
    toneladas_humedo,porcentaje_humedad,toneladas_seco,toneladas_disponibles,
    ubicacion_canoa,precio_maquila_por_ton,maquila_total,material_seco_procesado,estado
) VALUES (
    'LC-REMANENTE-13-2','2026-03-18','2026-03-18',0,1,0,1,
    3.15,0.13,3.15*(1-0.13),
    3.15,  -- HÚMEDAS
    'Canoa I-rem',0,0,0,'en_canoa');
SET @lote_REM_13_2 = LAST_INSERT_ID();

INSERT INTO Analisis (id_material_concentrado,id_tipo_analisis,numero_analisis,
    au_concentrado,ag_concentrado,ton,porcentaje_humedad,toneladas_humedas,toneladas_secas,
    au_gr_x_ton,au_falso,ag_gr_x_ton,fecha_salida,comentarios) VALUES
(@lote_REM_13_2,2,'AN-REM-13-2',3.15*(1-0.13)*19.9,3.15*(1-0.13)*486,
 3.15,0.13,3.15*0.13,3.15*(1-0.13),19.9,19.9,486,'2026-03-18','Remanente 3.15t de LC-13-2-I');

-- [FIX] Cerrar lote I: las 3.15t pasaron al remanente
UPDATE material_concentrado SET toneladas_disponibles=0, estado='enviado_completo' WHERE id=@lote_I;
UPDATE inventario_lotes SET toneladas_disponibles=0, estado='agotado'
    WHERE id_material_concentrado=@lote_I AND estado!='agotado';

SELECT '=== VIAJE 13-2 ===' AS v;
SELECT v.numero_viaje, v.maquila FROM Viaje v WHERE v.id=@viaje_13_2;
SELECT mc.codigo, mc.toneladas_disponibles, mc.maquila_total, mc.estado
FROM material_concentrado mc WHERE mc.id IN (@lote_I,@lote_J,@lote_REM_13,@lote_REM_13_2);
-- lote_I:       disp=0,    enviado_completo ✓
-- lote_J:       disp=0,    enviado_completo ✓
-- rem_13_1:     disp=0,    enviado_completo ✓
-- rem_13_2:     disp=3.15, en_canoa         ✓ (lista para viaje 13-3)


-- =====================================================================
--  VIAJE 13-3
--  [FIX TOTAL] La versión anterior tenía:
--    - Código 'LC-12-3-F' → correcto: 'LC-13-3-K'
--    - Volquetas 12027-12034 → correcto: 13027-13034
--    - Viaje '12-3' → correcto: '13-3'
--    - Cierre manual con maquila, toneladas_seco etc → correcto: solo trigger
--    - es_remanente=1 → correcto: 0
--    - toneladas_disponibles=2.74 (secas) → correcto: 3.15 (húmedas)
--    - No se creaba remanente de 10t ni se cerraba lote K
-- =====================================================================

-- 3.1 Báscula 13-3
INSERT INTO material_planta_entrada (
    numero_volqueta,id_mina,id_vehiculo,id_tipo_material,id_precio,
    fecha_llegada,peso_llegada_planta,porcentaje_humedad,gramos_humedad,
    tenor,total_material_seco,total_gramos,precio_por_gramo,precio_por_tonelada,precio_total,excedente_calculado,
    costo_cargue,costo_bascula,costo_maquila,costo_adicional,costo_volqueta,total_costos_operativos,estado,comentarios
) VALUES
(13027,1,(13027%11)+1,2,NULL,'2026-03-10',12.270,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 9'),
(13028,1,(13028%11)+1,2,NULL,'2026-03-11',12.890,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 10'),
(13029,1,(13029%11)+1,2,NULL,'2026-03-12',12.970,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 11'),
(13030,1,(13030%11)+1,2,NULL,'2026-03-17',11.620,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 12'),
(13031,1,(13031%11)+1,2,NULL,'2026-03-18',13.960,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 13'),
(13032,1,(13032%11)+1,2,NULL,'2026-03-18',11.640,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 14'),
(13033,1,(13033%11)+1,2,NULL,'2026-03-18',10.080,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 15'),
(13034,1,(13034%11)+1,2,NULL,'2026-03-18',10.640,0,0,0,0,0,NULL,NULL,0,0,0,0,0,0,0,0,'pendiente','13-3 Omar vol 16');

-- 3.2 Análisis 13-3
INSERT INTO Analisis (id_entrada,id_tipo_analisis,numero_analisis,
    au_concentrado,ag_concentrado,ton,porcentaje_humedad,toneladas_humedas,toneladas_secas,
    au_gr_x_ton,au_falso,ag_gr_x_ton,valor_analisis,estado_pago,fecha_salida,comentarios) VALUES
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13027),1,'AN-13027',NULL,NULL,12.270,0.086,12.270*0.086,12.270*(1-0.086),7.8,7.8,NULL,NULL,'no_aplica',NULL,'Omar vol 9'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13028),1,'AN-13028',NULL,NULL,12.890,0.054,12.890*0.054,12.890*(1-0.054),8.0,8.0,NULL,NULL,'no_aplica',NULL,'Omar vol 10'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13029),1,'AN-13029',NULL,NULL,12.970,0.054,12.970*0.054,12.970*(1-0.054),7.8,7.8,NULL,NULL,'no_aplica',NULL,'Omar vol 11'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13030),1,'AN-13030',NULL,NULL,11.620,0.070,11.620*0.070,11.620*(1-0.070),7.5,7.5,NULL,NULL,'no_aplica',NULL,'Omar vol 12'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13031),1,'AN-13031',NULL,NULL,13.960,0.055,13.960*0.055,13.960*(1-0.055),8.9,8.9,NULL,NULL,'no_aplica',NULL,'Omar vol 13'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13032),1,'AN-13032',NULL,NULL,11.640,0.060,11.640*0.060,11.640*(1-0.060),9.1,9.1,NULL,NULL,'no_aplica',NULL,'Omar vol 14'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13033),1,'AN-13033',NULL,NULL,10.080,0.060,10.080*0.060,10.080*(1-0.060),9.1,9.1,NULL,NULL,'no_aplica',NULL,'Omar vol 15'),
((SELECT id FROM material_planta_entrada WHERE numero_volqueta=13034),1,'AN-13034',NULL,NULL,10.640,0.060,10.640*0.060,10.640*(1-0.060),9.1,9.1,NULL,NULL,'no_aplica',NULL,'Omar vol 16');

-- 3.3 UPDATE precios 13-3
-- [FIX] Agrega estado='pagada' que faltaba
UPDATE material_planta_entrada mpe SET
    porcentaje_humedad =(SELECT porcentaje_humedad FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    gramos_humedad     =(SELECT toneladas_humedas  FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    tenor              =(SELECT au_falso           FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    total_material_seco=(SELECT toneladas_secas    FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    total_gramos       =(SELECT toneladas_secas*au_gr_x_ton FROM Analisis WHERE id_entrada=mpe.id LIMIT 1),
    id_precio=(SELECT pm.id FROM precio_material pm LEFT JOIN mina m ON m.id=mpe.id_mina
        WHERE (pm.id_minero=m.id_minero OR pm.id_minero IS NULL)
          AND (pm.id_zona=m.id_zona OR pm.id_zona IS NULL)
          AND pm.intervalo_tenor_min<=(SELECT au_falso FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
          AND pm.intervalo_tenor_max>=(SELECT au_falso FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
          AND pm.fecha_inicio<=mpe.fecha_llegada
          AND (pm.fecha_fin IS NULL OR pm.fecha_fin>=mpe.fecha_llegada)
          AND pm.activo=1
        ORDER BY pm.id_minero DESC, pm.id_zona DESC, pm.precio_por_tonelada DESC LIMIT 1),
    precio_por_gramo   =(SELECT precio_por_gramo    FROM precio_material WHERE id=mpe.id_precio),
    precio_por_tonelada=(SELECT precio_por_tonelada FROM precio_material WHERE id=mpe.id_precio),
    precio_total=CASE
        WHEN (SELECT metodo FROM precio_material WHERE id=mpe.id_precio)='por_gramo'
            THEN (SELECT precio_por_gramo FROM precio_material WHERE id=mpe.id_precio)
                 *(SELECT toneladas_secas*au_gr_x_ton FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
        ELSE (SELECT precio_por_tonelada FROM precio_material WHERE id=mpe.id_precio)
             *(SELECT toneladas_secas FROM Analisis WHERE id_entrada=mpe.id LIMIT 1)
    END,
    excedente_calculado=CASE mpe.numero_volqueta
        WHEN 13027 THEN 1121478 WHEN 13028 THEN 1219394 WHEN 13029 THEN 1226962
        WHEN 13030 THEN 1080660 WHEN 13031 THEN 1319220 WHEN 13032 THEN 1094160
        WHEN 13033 THEN 947520  WHEN 13034 THEN 1000160 END,
    costo_cargue=300000, costo_bascula=100000, costo_maquila=0,
    costo_adicional=CASE WHEN mpe.numero_volqueta=13032 THEN 200000 ELSE 0 END,
    costo_volqueta=0,
    total_costos_operativos=costo_cargue+100000+costo_adicional,
    total_material=precio_total+total_costos_operativos,
    estado='pagada'   -- [FIX] faltaba en el original
WHERE mpe.numero_volqueta BETWEEN 13027 AND 13034;

-- 3.4 Lote K  [FIX] código y procesamiento corregidos
-- [FIX] código: 'LC-12-3-F' → 'LC-13-3-K'
INSERT INTO material_concentrado (codigo,fecha_inicio,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,estado)
VALUES ('LC-13-3-K','2026-03-10',0,1,0,1,'en_proceso');  -- [FIX]
SET @lote_K = LAST_INSERT_ID();

-- [FIX] volquetas: 12027-12034 → 13027-13034
INSERT INTO procesamiento_material (id_material_concentrado,id_entrada,toneladas_aportadas,toneladas_seco_aportadas)
SELECT @lote_K, mpe.id, mpe.peso_llegada_planta, mpe.total_material_seco
FROM material_planta_entrada mpe WHERE mpe.numero_volqueta BETWEEN 13027 AND 13034;  -- [FIX]

-- 3.5 Cerrar lote K  [FIX] SOLO campos del trigger, sin maquila_total ni toneladas_seco manual
UPDATE material_concentrado SET
    fecha_fin='2026-03-25',
    toneladas_humedo=35.85,      -- 25.85 salen + ~10 quedan
    porcentaje_humedad=0.13,
    ubicacion_canoa='Canoa K',
    estado='en_canoa'
    -- El trigger calcula: mat_seco=90.09, maquila=27,027,000, disponibles=35.85 (HÚMEDAS)
WHERE id=@lote_K;
-- Si la planta procesó menos, corregir DESPUÉS:
-- UPDATE material_concentrado SET material_seco_procesado=51.85, maquila_total=51.85*precio_maquila_por_ton WHERE id=@lote_K;

-- 3.6 Análisis concentrado lote K
INSERT INTO Analisis (id_material_concentrado,id_tipo_analisis,id_mina,id_tipo_material,
    numero_analisis,au_concentrado,ag_concentrado,ton,porcentaje_humedad,
    toneladas_humedas,toneladas_secas,au_gr_x_ton,au_falso,ag_gr_x_ton,fecha_salida,comentarios) VALUES
(@lote_K,2,1,1,'AN-LOTK',
 25.85*(1-0.13)*18.2,25.85*(1-0.13)*434,
 25.85,0.13,25.85*0.13,25.85*(1-0.13),18.2,18.2,434,'2026-03-25','Conc Lote K 13-3 vol 9-16');

-- 3.7 Viaje 13-3  [FIX] nombre '12-3' → '13-3'
INSERT INTO Viaje (numero_viaje,fecha,comentarios) VALUES ('13-3','2026-03-26','Viaje 13-3');  -- [FIX]
SET @viaje_13_3 = LAST_INSERT_ID();

-- [FIX] viaje_material completo:
--   - lote K con id_viaje_origen=NULL (primer envío)
--   - LC-REMANENTE-13-2 con es_remanente=0 (no 1) e id_viaje_origen=@viaje_13_2
INSERT INTO viaje_material (
    id_viaje,id_material_concentrado,es_remanente,id_viaje_origen,concepto,
    total_material,total_concentrado_humedo,porcentaje_humedad,peso_humedad,concentrado_seco,
    valor_total_con_gastos,au_promedio_compra,tenor_au_venta,total_grs_au_venta,tenor_ag,total_grs_ag_venta
) VALUES
-- Lote K: 25.85t, trigger → costo_maquila = 27,027,000
(@viaje_13_3,@lote_K,0,NULL,'OMAR MINA 80 vol 9,10,11,12,13,14,15,16',
 90.09,25.85,0.13,25.85*0.13,25.85*(1-0.13),
 73186021,8.50,18.2,25.85*(1-0.13)*18.2,434,25.85*(1-0.13)*434),
-- [FIX] Remanente 13-2: es_remanente=0 (no 1), id_viaje_origen=@viaje_13_2
-- trigger → costo_maquila=0 (maquila_total=0)
-- after  → disponibles 3.15-3.15=0 → enviado_completo
(@viaje_13_3,@lote_REM_13_2,0,@viaje_13_2,'LC-REMANENTE-13-2 — LIBRE DE COSTO',  -- [FIX]
 NULL,3.15,0.13,3.15*0.13,3.15*(1-0.13),
 NULL,8.35,19.9,3.15*(1-0.13)*19.9,486,3.15*(1-0.13)*486);

-- [FIX] Crear remanente para las ~10t que quedan del lote K
-- toneladas_disponibles = 10.0 HÚMEDAS
INSERT INTO material_concentrado (
    codigo,fecha_inicio,fecha_fin,hizo_molienda,hizo_flotacion,hizo_relave,hizo_filtroprensa,
    toneladas_humedo,porcentaje_humedad,toneladas_seco,toneladas_disponibles,
    ubicacion_canoa,precio_maquila_por_ton,maquila_total,material_seco_procesado,estado
) VALUES (
    'LC-REMANENTE-13-3','2026-03-25','2026-03-25',0,1,0,1,
    10.0,0.13,10.0*(1-0.13),
    10.0,  -- HÚMEDAS
    'Canoa K-rem',0,0,0,'en_canoa');
SET @lote_REM_13_3 = LAST_INSERT_ID();

INSERT INTO Analisis (id_material_concentrado,id_tipo_analisis,numero_analisis,
    au_concentrado,ag_concentrado,ton,porcentaje_humedad,toneladas_humedas,toneladas_secas,
    au_gr_x_ton,au_falso,ag_gr_x_ton,fecha_salida,comentarios) VALUES
(@lote_REM_13_3,2,'AN-REM-13-3',10.0*(1-0.13)*18.2,10.0*(1-0.13)*434,
 10.0,0.13,10.0*0.13,10.0*(1-0.13),18.2,18.2,434,'2026-03-25','Remanente ~10t de LC-13-3-K');

-- [FIX] Cerrar lote K
UPDATE material_concentrado SET toneladas_disponibles=0, estado='enviado_completo' WHERE id=@lote_K;
UPDATE inventario_lotes SET toneladas_disponibles=0, estado='agotado'
    WHERE id_material_concentrado=@lote_K AND estado!='agotado';

-- =====================================================================
--  VERIFICACIÓN GLOBAL
-- =====================================================================
SELECT '=== TODOS LOS VIAJES 13-x ===' AS v;
SELECT v.id, v.numero_viaje, v.maquila, v.total_costo_material
FROM Viaje v WHERE v.numero_viaje IN ('13-1','13-2','13-3') ORDER BY v.id;

SELECT '=== TODOS LOS LOTES 13-x ===' AS v;
SELECT mc.codigo,
       ROUND(mc.material_seco_procesado,2) AS mat_prima,
       ROUND(mc.maquila_total,0)           AS maquila,
       mc.toneladas_humedo                 AS prod,
       mc.toneladas_disponibles            AS disp,
       mc.estado
FROM material_concentrado mc WHERE mc.codigo LIKE 'LC-13%' ORDER BY mc.id;
/*
  LC-13-1-G:         mat=92.82,  maq=27,846,210, prod=22.0,  disp=0,    enviado_completo ✓
  LC-13-1-H:         mat=35.33,  maq=10,597,950, prod=7.0,   disp=0,    enviado_completo ✓
  LC-REMANENTE-13-1: mat=0,      maq=0,          prod=2.2,   disp=0,    enviado_completo ✓
  LC-13-2-I:         mat=86.06,  maq=25,818,000, prod=27.95, disp=0,    enviado_completo ✓
  LC-13-2-J:         mat=2.0,    maq=0,          prod=2.0,   disp=0,    enviado_completo ✓
  LC-REMANENTE-13-2: mat=0,      maq=0,          prod=3.15,  disp=0,    enviado_completo ✓
  LC-13-3-K:         mat=90.09,  maq=27,027,000, prod=35.85, disp=0,    enviado_completo ✓
  LC-REMANENTE-13-3: mat=0,      maq=0,          prod=10.0,  disp=10.0, en_canoa ✓
*/

SELECT '=== MAQUILA: diff debe ser 0 ===' AS v;
SELECT v.numero_viaje, v.maquila AS header, SUM(vm.costo_maquila) AS suma,
       v.maquila-SUM(vm.costo_maquila) AS diff
FROM Viaje v JOIN viaje_material vm ON vm.id_viaje=v.id
WHERE v.numero_viaje IN ('13-1','13-2','13-3')
GROUP BY v.id, v.numero_viaje, v.maquila;

COMMIT;