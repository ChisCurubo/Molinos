-- ====================================================================
--  vistas_v4.sql — Vistas de INVENTARIO que faltaban en la BD
-- --------------------------------------------------------------------
--  El backend (src/repositories/material/inventario.repository.ts) ya
--  consulta estas 3 vistas, pero nunca fueron creadas. Este archivo las
--  define. Ejecutar sobre la BD de Molinos (idempotente: CREATE OR REPLACE).
--
--    GET /material/inventario/crudo       -> v_inventario_material_crudo (ORDER BY fecha_llegada)
--    GET /material/inventario/concentrado -> v_inventario_concentrado    (ORDER BY fecha_fin)
--    GET /material/inventario/lote/:id    -> v_resumen_lote              (WHERE id = ?)
-- ====================================================================


-- --------------------------------------------------------------------
-- 1. MATERIAL CRUDO (materia prima aún disponible para procesar)
--    Entradas pendiente/pagada que NO están completamente procesadas.
--    disponible_seco = total_material_seco - lo ya enviado al molino.
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventario_material_crudo AS
SELECT
    mpe.id                          AS id,
    mpe.numero_volqueta             AS numero_volqueta,
    mpe.id_mina                     AS id_mina,
    m.nombre                        AS mina,
    mpe.id_tipo_material            AS id_tipo_material,
    tm.nombre                       AS tipo_material,
    mpe.fecha_llegada               AS fecha_llegada,
    mpe.peso_llegada_planta         AS toneladas_humedo,
    mpe.total_material_seco         AS total_material_seco,
    mpe.porcentaje_humedad          AS porcentaje_humedad,
    mpe.tenor                       AS tenor,
    mpe.estado                      AS estado,
    COALESCE((SELECT SUM(pm.toneladas_seco_aportadas) FROM procesamiento_material pm
               WHERE pm.id_entrada = mpe.id), 0)                     AS ya_procesado_seco,
    (COALESCE(mpe.total_material_seco, 0)
     - COALESCE((SELECT SUM(pm.toneladas_seco_aportadas) FROM procesamiento_material pm
                  WHERE pm.id_entrada = mpe.id), 0))                 AS disponible_seco
FROM material_planta_entrada mpe
JOIN Mina m                 ON m.id  = mpe.id_mina
LEFT JOIN Tipos_Material tm ON tm.id = mpe.id_tipo_material
WHERE mpe.estado IN ('pendiente', 'pagada')
  -- Excluir solo las que ya se procesaron por completo
  AND NOT (COALESCE(mpe.total_material_seco, 0) > 0
           AND COALESCE((SELECT SUM(pm.toneladas_seco_aportadas) FROM procesamiento_material pm
                          WHERE pm.id_entrada = mpe.id), 0) >= mpe.total_material_seco);


-- --------------------------------------------------------------------
-- 2. CONCENTRADO DISPONIBLE (lotes cerrados con stock para despachar)
--    Lote en canoa / parcialmente enviado con toneladas_disponibles > 0.
--    tenor_* del análisis de concentrado (tipo 2) más reciente del lote.
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventario_concentrado AS
SELECT
    mc.id                     AS id,
    mc.codigo                 AS codigo,
    mc.estado                 AS estado,
    mc.ubicacion_canoa        AS ubicacion_canoa,
    mc.fecha_inicio           AS fecha_inicio,
    mc.fecha_fin              AS fecha_fin,
    mc.porcentaje_humedad     AS porcentaje_humedad,
    mc.toneladas_humedo       AS toneladas_humedo,
    mc.toneladas_seco         AS toneladas_seco,
    mc.toneladas_disponibles  AS toneladas_disponibles,
    mc.material_seco_procesado AS material_seco_procesado,
    mc.maquila_total          AS maquila_total,
    mc.precio_maquila_por_ton AS precio_maquila_por_ton,
    (SELECT a.au_gr_x_ton FROM Analisis a
      WHERE a.id_material_concentrado = mc.id AND a.id_tipo_analisis = 2
      ORDER BY a.fecha_salida DESC, a.id DESC LIMIT 1)               AS tenor_au,
    (SELECT a.ag_gr_x_ton FROM Analisis a
      WHERE a.id_material_concentrado = mc.id AND a.id_tipo_analisis = 2
      ORDER BY a.fecha_salida DESC, a.id DESC LIMIT 1)               AS tenor_ag
FROM material_concentrado mc
WHERE mc.toneladas_disponibles > 0
  AND mc.estado IN ('en_canoa', 'parcialmente_enviado');


-- --------------------------------------------------------------------
-- 3. RESUMEN DE UN LOTE (una fila por lote de concentrado, con agregados)
--    Se consulta por id: SELECT * FROM v_resumen_lote WHERE id = ?
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW v_resumen_lote AS
SELECT
    mc.id                     AS id,
    mc.codigo                 AS codigo,
    mc.estado                 AS estado,
    mc.fecha_inicio           AS fecha_inicio,
    mc.fecha_fin              AS fecha_fin,
    mc.ubicacion_canoa        AS ubicacion_canoa,
    mc.porcentaje_humedad     AS porcentaje_humedad,
    mc.toneladas_humedo       AS toneladas_humedo,
    mc.toneladas_seco         AS toneladas_seco,
    mc.toneladas_disponibles  AS toneladas_disponibles,
    mc.material_seco_procesado AS material_seco_procesado,
    0.0000                    AS merma_seco,
    mc.maquila_total          AS maquila_total,
    mc.precio_maquila_por_ton AS precio_maquila_por_ton,
    mc.hizo_molienda          AS hizo_molienda,
    mc.hizo_flotacion         AS hizo_flotacion,
    mc.hizo_relave            AS hizo_relave,
    mc.hizo_filtroprensa      AS hizo_filtroprensa,
    (SELECT COUNT(*) FROM procesamiento_material pm
       WHERE pm.id_material_concentrado = mc.id)                     AS num_materiales,
    (SELECT COALESCE(SUM(pm.toneladas_seco_aportadas), 0) FROM procesamiento_material pm
       WHERE pm.id_material_concentrado = mc.id)                     AS total_seco_procesado,
    (SELECT COALESCE(SUM(vm.total_concentrado_humedo), 0) FROM viaje_material vm
       WHERE vm.id_material_concentrado = mc.id)                     AS total_despachado_humedo,
    (SELECT a.au_gr_x_ton FROM Analisis a
       WHERE a.id_material_concentrado = mc.id AND a.id_tipo_analisis = 2
       ORDER BY a.fecha_salida DESC, a.id DESC LIMIT 1)             AS tenor_au,
    (SELECT a.ag_gr_x_ton FROM Analisis a
       WHERE a.id_material_concentrado = mc.id AND a.id_tipo_analisis = 2
       ORDER BY a.fecha_salida DESC, a.id DESC LIMIT 1)             AS tenor_ag
FROM material_concentrado mc;
