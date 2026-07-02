-- ====================================================================
--  MOLINOS ERP v4 — SELECTS Y CRUD COMPLETO
--  Referencia para el agente de backend 
--  Cubre el flujo completo de material_planta_entrada + análisis
-- --------------------------------------------------------------------
--  CONVENCIONES DE PARÁMETROS:
--    ? = parámetro posicional (driver Go: database/sql)
--    Los comentarios indican el nombre de la variable Go sugerida
-- ====================================================================


-- ====================================================================
-- SECCIÓN 1 · CATÁLOGOS (lectura al arrancar / caché del agente)
-- ====================================================================

-- 1.1 Todos los mineros activos (para dropdowns y validaciones)
SELECT
    id,
    nombre,
    alias,
    metodo_calculo,      -- 'por_gramo' | 'por_tonelada'
    banco,
    numero_cuenta,
    nequi,
    estado
FROM minero
WHERE estado = 'activo'
ORDER BY nombre;

-- 1.2 Todas las minas activas con su minero habitual y zona
SELECT
    mi.id,
    mi.nombre,
    mi.id_minero,
    mn.nombre           AS minero_nombre,
    mn.alias            AS minero_alias,
    mn.metodo_calculo,
    mi.id_zona,
    z.nombre            AS zona_nombre,
    mi.estado
FROM mina mi
LEFT JOIN minero mn ON mn.id = mi.id_minero
LEFT JOIN zona   z  ON z.id  = mi.id_zona
WHERE mi.estado = 'activa'
ORDER BY mi.nombre;

-- 1.3 Una mina específica (para derivar minero y zona de una entrada)
-- Parámetro: id_mina (int)
SELECT
    mi.id,
    mi.nombre,
    mi.id_minero,
    mn.nombre           AS minero_nombre,
    mn.metodo_calculo,
    mi.id_zona,
    z.nombre            AS zona_nombre
FROM mina mi
LEFT JOIN minero mn ON mn.id = mi.id_minero
LEFT JOIN zona   z  ON z.id  = mi.id_zona
WHERE mi.id = ?;        -- :id_mina

-- 1.4 Todos los dueños de volqueta activos con sus vehículos
SELECT
    dv.id,
    dv.nombre,
    dv.alias,
    dv.banco,
    dv.numero_cuenta,
    dv.nequi,
    vv.id               AS vehiculo_id,
    vv.placa,
    vv.tipo_vehiculo,
    vv.conductor,
    vv.estado_pago
FROM dueno_volqueta dv
LEFT JOIN volqueta_vehiculo vv ON vv.id_dueno_volqueta = dv.id AND vv.activo = 1
WHERE dv.estado = 'activo'
ORDER BY dv.nombre;

-- 1.5 Tipos de material
SELECT id, nombre, descripcion FROM tipos_material ORDER BY id;

-- 1.6 Zonas con su tarifa vigente
SELECT
    z.id,
    z.nombre,
    tz.valor_tonelada   AS tarifa_flete,
    tz.vigente_desde,
    COALESCE(tz.valor_tonelada,
        (SELECT valor FROM tarifas_calculo WHERE codigo = 'flete_ton_seca')
    )                   AS tarifa_efectiva  -- fallback si la zona no tiene tarifa
FROM zona z
LEFT JOIN tarifa_zona tz ON tz.id_zona = z.id AND tz.activo = 1
ORDER BY z.nombre;


-- ====================================================================
-- SECCIÓN 2 · LOOKUP DE PRECIO (el más importante del flujo)
-- ====================================================================

-- 2.1 Buscar precio aplicable dado un tenor, una mina y el método del minero
--
--  PRIORIDAD: tarifa específica del minero > tarifa por zona > tarifa global
--  La query ya implementa esa prioridad con ORDER BY id_minero DESC, id_zona DESC
--
--  Parámetros:
--    ? (1) = id_minero     (int)  → derivado de mina.id_minero
--    ? (2) = id_zona       (int)  → derivado de mina.id_zona
--    ? (3) = metodo        (str)  → minero.metodo_calculo
--    ? (4) = tenor_falso   (decimal) → analisis.au_gr_x_ton_falso
--    ? (5) = fecha_entrada (date) → para respetar vigencias
SELECT
    pm.id,
    pm.metodo,
    pm.precio_por_gramo,
    pm.precio_por_tonelada,
    pm.intervalo_tenor_min,
    pm.intervalo_tenor_max,
    CASE
        WHEN pm.id_minero IS NOT NULL THEN 'especifica_minero'
        WHEN pm.id_zona   IS NOT NULL THEN 'especifica_zona'
        ELSE 'global'
    END AS tipo_tarifa
FROM precio_material pm
WHERE pm.activo = 1
  AND pm.metodo              = ?                -- :metodo_calculo del minero
  AND (pm.id_minero = ? OR pm.id_minero IS NULL)  -- :id_minero
  AND (pm.id_zona   = ? OR pm.id_zona   IS NULL)  -- :id_zona
  AND ? BETWEEN pm.intervalo_tenor_min AND pm.intervalo_tenor_max  -- :tenor_falso
  AND pm.fecha_inicio <= ?                      -- :fecha_entrada
  AND (pm.fecha_fin IS NULL OR pm.fecha_fin >= ?)  -- :fecha_entrada
ORDER BY
    pm.id_minero DESC,   -- tarifa específica del minero primero
    pm.id_zona   DESC,   -- luego por zona
    pm.fecha_inicio DESC -- luego la más reciente
LIMIT 1;

-- 2.2 Verificar si hay tarifa de zona vigente para calcular costo_volqueta
-- Parámetros:
--    ? = id_zona (int) → de mina.id_zona
SELECT
    tz.id,
    tz.valor_tonelada,
    tz.vigente_desde,
    z.nombre AS zona
FROM tarifa_zona tz
JOIN zona z ON z.id = tz.id_zona
WHERE tz.id_zona = ?        -- :id_zona
  AND tz.activo = 1
  AND tz.vigente_desde <= CURRENT_DATE
  AND (tz.vigente_hasta IS NULL OR tz.vigente_hasta >= CURRENT_DATE)
ORDER BY tz.vigente_desde DESC
LIMIT 1;

-- 2.3 Fallback: tarifa global si la zona no tiene fila en tarifa_zona
SELECT valor AS tarifa_flete
FROM tarifas_calculo
WHERE codigo = 'flete_ton_seca';


-- ====================================================================
-- SECCIÓN 3 · material_planta_entrada — CRUD COMPLETO
-- ====================================================================

-- ── CREATE ──────────────────────────────────────────────────────────

-- 3.1 INSERT fase 1: el operador registra la llegada de la volqueta
--  Parámetros en orden:
--    numero_volqueta, id_mina, id_vehiculo, id_tipo_material,
--    fecha_llegada, peso_llegada_planta, comentarios
INSERT INTO material_planta_entrada (
    numero_volqueta,
    id_mina,
    id_vehiculo,
    id_tipo_material,
    fecha_llegada,
    peso_llegada_planta,
    porcentaje_humedad,    -- 0 como placeholder (NOT NULL sin default)
    comentarios
) VALUES (?, ?, ?, ?, ?, ?, 0.0000, ?);

-- ── READ ─────────────────────────────────────────────────────────────

-- 3.2 Leer una entrada completa con todos sus joins (vista detalle)
-- Parámetro: id (int)
SELECT
    mpe.id,
    mpe.numero_volqueta,
    mpe.fecha_llegada,
    mpe.estado,
    mpe.estado_pago_flete,

    -- Mina y minero (derivados)
    mi.id                   AS mina_id,
    mi.nombre               AS mina,
    mn.id                   AS minero_id,
    mn.nombre               AS minero,
    mn.alias                AS minero_alias,
    mn.metodo_calculo,
    mn.banco                AS minero_banco,
    mn.numero_cuenta        AS minero_cuenta,
    mn.nequi                AS minero_nequi,

    -- Vehículo y dueño
    vv.id                   AS vehiculo_id,
    vv.placa,
    dv.id                   AS dueno_id,
    dv.nombre               AS dueno,
    dv.alias                AS dueno_alias,

    -- Tipo de material
    tm.nombre               AS tipo_material,

    -- Campos físicos
    mpe.peso_llegada_planta,
    mpe.porcentaje_humedad,
    mpe.gramos_humedad,
    mpe.total_material_seco,
    mpe.tenor,

    -- Gramos y precio
    mpe.total_gramos,
    mpe.id_precio,
    mpe.precio_por_gramo,
    mpe.precio_por_tonelada,
    mpe.precio_total,

    -- Costos
    mpe.excedente_calculado,
    mpe.costo_cargue,
    mpe.costo_bascula,
    mpe.costo_maquila,
    mpe.costo_adicional,
    mpe.costo_volqueta,
    mpe.total_costos_operativos,
    mpe.total_material,

    mpe.comentarios,
    mpe.created_at,
    mpe.updated_at

FROM material_planta_entrada mpe
JOIN  mina              mi  ON mi.id  = mpe.id_mina
LEFT JOIN minero        mn  ON mn.id  = mi.id_minero
LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
LEFT JOIN dueno_volqueta    dv ON dv.id = vv.id_dueno_volqueta
JOIN  tipos_material    tm  ON tm.id  = mpe.id_tipo_material
WHERE mpe.id = ?;       -- :id_entrada

-- 3.3 Listar entradas (tabla principal / dashboard)
-- Parámetros: fecha_desde, fecha_hasta, estado ('' = todos), limit, offset
SELECT
    mpe.id,
    mpe.numero_volqueta,
    mpe.fecha_llegada,
    mi.nombre               AS mina,
    mn.nombre               AS minero,
    mn.alias                AS minero_alias,
    vv.placa,
    dv.nombre               AS dueno_volqueta,
    tm.nombre               AS tipo_material,
    mpe.peso_llegada_planta,
    mpe.total_material_seco,
    mpe.tenor,
    mpe.precio_total,
    mpe.total_material,
    mpe.estado,
    mpe.estado_pago_flete,
    -- indica si ya tiene análisis
    EXISTS (
        SELECT 1 FROM analisis a
        WHERE a.id_entrada = mpe.id AND a.id_tipo_analisis = 1
    )                       AS tiene_analisis_cabeza
FROM material_planta_entrada mpe
JOIN  mina              mi  ON mi.id  = mpe.id_mina
LEFT JOIN minero        mn  ON mn.id  = mi.id_minero
LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
LEFT JOIN dueno_volqueta    dv ON dv.id = vv.id_dueno_volqueta
JOIN  tipos_material    tm  ON tm.id  = mpe.id_tipo_material
WHERE mpe.fecha_llegada BETWEEN ? AND ?  -- :fecha_desde, :fecha_hasta
  AND (mpe.estado = ? OR ? = '')         -- :estado, :estado ('' = sin filtro)
ORDER BY mpe.fecha_llegada DESC, mpe.id DESC
LIMIT ? OFFSET ?;           -- :limit, :offset

-- 3.4 Entradas pendientes de análisis (para la pantalla "esperando lab")
SELECT
    mpe.id,
    mpe.numero_volqueta,
    mpe.fecha_llegada,
    mi.nombre   AS mina,
    mn.nombre   AS minero,
    vv.placa,
    mpe.peso_llegada_planta,
    mpe.tipo_material_id,
    tm.nombre   AS tipo_material,
    DATEDIFF(CURRENT_DATE, mpe.fecha_llegada) AS dias_sin_analisis
FROM material_planta_entrada mpe
JOIN  mina              mi  ON mi.id  = mpe.id_mina
LEFT JOIN minero        mn  ON mn.id  = mi.id_minero
LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
JOIN  tipos_material    tm  ON tm.id  = mpe.id_tipo_material
WHERE mpe.porcentaje_humedad = 0
   OR mpe.tenor IS NULL
ORDER BY mpe.fecha_llegada;

-- ── UPDATE ───────────────────────────────────────────────────────────

-- 3.5 UPDATE fase 3: backend aplica los datos del análisis Cabeza
--  Se llama desde VincularAnalisisAEntrada() después del INSERT analisis
--  Parámetros:
--    porcentaje_humedad, gramos_humedad, total_material_seco,
--    tenor (falso), total_gramos, id_entrada
UPDATE material_planta_entrada SET
    porcentaje_humedad   = ?,
    gramos_humedad       = ?,
    total_material_seco  = ?,
    tenor                = ?,
    total_gramos         = ?
WHERE id = ?;

-- 3.6 UPDATE fase 4: precio encontrado en Precio_Material
--  Parámetros:
--    id_precio, precio_por_gramo, precio_por_tonelada, precio_total, id_entrada
UPDATE material_planta_entrada SET
    id_precio           = ?,
    precio_por_gramo    = ?,
    precio_por_tonelada = ?,
    precio_total        = ?
WHERE id = ?;

-- 3.7 UPDATE fase 5: costos y totales
--  Parámetros:
--    excedente_calculado, costo_cargue, costo_bascula, costo_maquila,
--    costo_adicional, costo_volqueta, total_costos_operativos,
--    total_material, id_entrada
UPDATE material_planta_entrada SET
    excedente_calculado     = ?,
    costo_cargue            = ?,
    costo_bascula           = ?,
    costo_maquila           = ?,
    costo_adicional         = ?,
    costo_volqueta          = ?,
    total_costos_operativos = ?,
    total_material          = ?
WHERE id = ?;

-- 3.8 UPDATE fases 3+4+5 en un solo query (alternativa al backend en 3 pasos)
--  Úsalo si el agente calcula todo en memoria y hace una sola escritura
--  Parámetros: ver orden en VALUES
UPDATE material_planta_entrada SET
    -- FASE 3
    porcentaje_humedad      = ?,
    gramos_humedad          = ?,
    total_material_seco     = ?,
    tenor                   = ?,
    total_gramos            = ?,
    -- FASE 4
    id_precio               = ?,
    precio_por_gramo        = ?,
    precio_por_tonelada     = ?,
    precio_total            = ?,
    -- FASE 5
    excedente_calculado     = ?,
    costo_cargue            = ?,
    costo_bascula           = ?,
    costo_maquila           = ?,
    costo_adicional         = ?,
    costo_volqueta          = ?,
    total_costos_operativos = ?,
    total_material          = ?
WHERE id = ?;               -- :id_entrada

-- 3.9 UPDATE estado de la entrada (cambio manual de estado)
-- Parámetros: estado, id
-- estados: 'pendiente' | 'en_proceso' | 'pagada' | 'incluida_viaje' | 'cancelada'
UPDATE material_planta_entrada
SET estado = ?
WHERE id = ?;

-- 3.10 UPDATE estado_pago_flete (cuando se registra un abono de flete)
-- Parámetros: estado_pago_flete, id
UPDATE material_planta_entrada
SET estado_pago_flete = ?
WHERE id = ?;

-- ── DELETE ───────────────────────────────────────────────────────────

-- 3.11 "Borrado" lógico: cancelar una entrada (no se borra físicamente)
-- Parámetro: id
UPDATE material_planta_entrada
SET estado = 'cancelada',
    comentarios = CONCAT(IFNULL(comentarios,''), ' | CANCELADA: ', ?)
WHERE id = ?;   -- :motivo, :id_entrada


-- ====================================================================
-- SECCIÓN 4 · analisis — CRUD COMPLETO
-- ====================================================================

-- ── CREATE ──────────────────────────────────────────────────────────

-- 4.1 INSERT análisis Cabeza vinculado a una entrada
--  Parámetros en orden:
--    id_entrada, id_tipo_analisis (=1 para Cabeza), id_laboratorio,
--    numero_analisis, au_concentrado, ton,
--    porcentaje_humedad, toneladas_humedas, toneladas_secas,
--    au_gr_x_ton (real), au_gr_x_ton_falso (el que ve el minero),
--    ag_gr_x_ton, valor_analisis, comentarios
INSERT INTO analisis (
    id_entrada,
    id_tipo_analisis,
    id_laboratorio,
    numero_analisis,
    au_concentrado,
    ton,
    porcentaje_humedad,
    toneladas_humedas,
    toneladas_secas,
    au_gr_x_ton,
    au_gr_x_ton_falso,
    ag_gr_x_ton,
    valor_analisis,
    estado_pago,
    comentarios
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'no_aplica', ?);

-- ── READ ─────────────────────────────────────────────────────────────

-- 4.2 Obtener el análisis Cabeza de una entrada
-- Parámetro: id_entrada (int)
SELECT
    a.id,
    a.id_entrada,
    ta.nombre               AS tipo_analisis,
    a.numero_analisis,
    a.porcentaje_humedad,
    a.toneladas_humedas,
    a.toneladas_secas,
    a.au_gr_x_ton           AS tenor_real,
    a.au_gr_x_ton_falso     AS tenor_falso,
    a.au_concentrado,
    a.ag_gr_x_ton,
    a.valor_analisis,
    a.estado_pago,
    a.fecha_salida,
    a.comentarios,
    a.created_at
FROM analisis a
JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
WHERE a.id_entrada       = ?    -- :id_entrada
  AND a.id_tipo_analisis = 1    -- Cabeza
LIMIT 1;

-- 4.3 Todos los análisis de una entrada (Cabeza + Concentrado + Colas)
-- Parámetro: id_entrada (int)
SELECT
    a.id,
    ta.nombre               AS tipo_analisis,
    a.numero_analisis,
    a.porcentaje_humedad,
    a.toneladas_secas,
    a.au_gr_x_ton           AS tenor_real,
    a.au_gr_x_ton_falso     AS tenor_falso,
    a.au_concentrado,
    a.estado_pago,
    a.created_at
FROM analisis a
JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
WHERE a.id_entrada = ?          -- :id_entrada
ORDER BY a.id_tipo_analisis, a.created_at;

-- ── UPDATE ───────────────────────────────────────────────────────────

-- 4.4 Corregir un análisis (raro, pero ocurre si el lab envía resultado revisado)
--  Después de este UPDATE el backend debe volver a llamar VincularAnalisisAEntrada()
--  para re-calcular todos los campos derivados en material_planta_entrada
-- Parámetros: porcentaje_humedad, toneladas_secas, au_gr_x_ton,
--             au_gr_x_ton_falso, ag_gr_x_ton, au_concentrado, id
UPDATE analisis SET
    porcentaje_humedad  = ?,
    toneladas_humedas   = ?,
    toneladas_secas     = ?,
    au_gr_x_ton         = ?,    -- tenor real (del lab)
    au_gr_x_ton_falso   = ?,    -- tenor falso (el que ve el minero)
    ag_gr_x_ton         = ?,
    au_concentrado      = ?
WHERE id = ?;                   -- :id_analisis

-- 4.5 Marcar análisis como pagado al laboratorio
UPDATE analisis
SET estado_pago = ?             -- 'pagado' | 'parcial'
WHERE id = ?;


-- ====================================================================
-- SECCIÓN 5 · agua_planta — CRUD COMPLETO
-- ====================================================================

-- 5.1 INSERT agua_planta
-- Parámetros: id_dueno_volqueta, fecha, valor_viaje, cantidad_viajes, acpm, comprobante_url
INSERT INTO agua_planta (id_dueno_volqueta, fecha, valor_viaje, cantidad_viajes, acpm, comprobante_url)
VALUES (?, ?, ?, ?, ?, ?);

-- 5.2 Listar viajes de agua con dueño
-- Parámetros: fecha_desde, fecha_hasta
SELECT
    ap.id,
    ap.fecha,
    dv.nombre               AS dueno,
    dv.alias,
    ap.valor_viaje,
    ap.cantidad_viajes,
    ap.acpm,
    ap.valor_total,         -- columna calculada (stored)
    ap.comprobante_url,
    ap.created_at
FROM agua_planta ap
JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
WHERE ap.fecha BETWEEN ? AND ?
ORDER BY ap.fecha DESC;

-- 5.3 Total de agua por dueño en un rango de fechas (para liquidación)
-- Parámetros: fecha_desde, fecha_hasta
SELECT
    dv.id,
    dv.nombre,
    COUNT(ap.id)            AS num_viajes,
    SUM(ap.cantidad_viajes) AS total_viajes,
    SUM(ap.valor_total)     AS total_a_pagar
FROM agua_planta ap
JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
WHERE ap.fecha BETWEEN ? AND ?
GROUP BY dv.id, dv.nombre
ORDER BY dv.nombre;


-- ====================================================================
-- SECCIÓN 6 · CONSULTAS DE RESUMEN Y REPORTES
-- ====================================================================

-- 6.1 Resumen de entradas por minero en un período (para liquidar pagos)
-- Parámetros: fecha_desde, fecha_hasta
SELECT
    mn.id,
    mn.nombre               AS minero,
    mn.alias,
    mn.metodo_calculo,
    COUNT(mpe.id)           AS num_entradas,
    SUM(mpe.peso_llegada_planta) AS total_bruto_ton,
    SUM(mpe.total_material_seco) AS total_seco_ton,
    SUM(mpe.total_gramos)        AS total_gramos_au,
    SUM(mpe.precio_total)        AS total_a_pagar,
    SUM(CASE WHEN mpe.estado = 'pagada' THEN mpe.precio_total ELSE 0 END) AS pagado,
    SUM(CASE WHEN mpe.estado != 'pagada' THEN mpe.precio_total ELSE 0 END) AS pendiente
FROM material_planta_entrada mpe
JOIN mina   mi ON mi.id = mpe.id_mina
JOIN minero mn ON mn.id = mi.id_minero
WHERE mpe.fecha_llegada BETWEEN ? AND ?
  AND mpe.estado != 'cancelada'
GROUP BY mn.id, mn.nombre, mn.alias, mn.metodo_calculo
ORDER BY mn.nombre;

-- 6.2 Resumen de entradas por dueño de volqueta (para liquidar fletes)
-- Parámetros: fecha_desde, fecha_hasta
SELECT
    dv.id,
    dv.nombre               AS dueno,
    dv.alias,
    COUNT(mpe.id)           AS num_viajes,
    SUM(mpe.total_material_seco)  AS total_seco_ton,
    SUM(mpe.costo_volqueta)       AS total_flete,
    SUM(CASE WHEN mpe.estado_pago_flete = 'pagado'
             THEN mpe.costo_volqueta ELSE 0 END) AS flete_pagado,
    SUM(CASE WHEN mpe.estado_pago_flete != 'pagado'
             THEN mpe.costo_volqueta ELSE 0 END) AS flete_pendiente
FROM material_planta_entrada mpe
JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
JOIN dueno_volqueta    dv ON dv.id = vv.id_dueno_volqueta
WHERE mpe.fecha_llegada BETWEEN ? AND ?
  AND mpe.estado != 'cancelada'
GROUP BY dv.id, dv.nombre, dv.alias
ORDER BY dv.nombre;

-- 6.3 Tenor promedio y resumen por mina en un período
-- Parámetros: fecha_desde, fecha_hasta
SELECT
    mi.nombre               AS mina,
    mn.nombre               AS minero,
    COUNT(mpe.id)           AS num_entradas,
    ROUND(AVG(mpe.tenor), 4)          AS tenor_promedio,
    ROUND(AVG(mpe.porcentaje_humedad)*100, 2) AS humedad_promedio_pct,
    SUM(mpe.total_material_seco)      AS total_seco_ton,
    SUM(mpe.total_gramos)             AS total_gramos_au,
    SUM(mpe.precio_total)             AS valor_total_pagado
FROM material_planta_entrada mpe
JOIN mina   mi ON mi.id = mpe.id_mina
LEFT JOIN minero mn ON mn.id = mi.id_minero
WHERE mpe.fecha_llegada BETWEEN ? AND ?
  AND mpe.estado != 'cancelada'
  AND mpe.tenor IS NOT NULL
GROUP BY mi.id, mi.nombre, mn.nombre
ORDER BY mi.nombre;

-- 6.4 Dashboard: estado actual de entradas (conteo por estado)
SELECT
    estado,
    COUNT(*)                AS total,
    SUM(peso_llegada_planta) AS toneladas_brutas,
    SUM(total_material_seco) AS toneladas_secas,
    SUM(precio_total)        AS valor_total
FROM material_planta_entrada
WHERE fecha_llegada >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY estado;

-- 6.5 Entradas sin precio calculado (útil para detectar tenores fuera de tabla)
SELECT
    mpe.id,
    mpe.fecha_llegada,
    mi.nombre   AS mina,
    mn.nombre   AS minero,
    mn.metodo_calculo,
    mpe.tenor,
    mpe.total_material_seco,
    mpe.comentarios
FROM material_planta_entrada mpe
JOIN mina   mi ON mi.id = mpe.id_mina
LEFT JOIN minero mn ON mn.id = mi.id_minero
WHERE mpe.tenor IS NOT NULL
  AND mpe.precio_total IS NULL
  AND mpe.estado != 'cancelada'
ORDER BY mpe.fecha_llegada;

-- 6.6 Tabla de precios vigentes (para mostrar en frontend al operador)
SELECT
    pm.id,
    pm.metodo,
    pm.intervalo_tenor_min,
    pm.intervalo_tenor_max,
    pm.precio_por_gramo,
    pm.precio_por_tonelada,
    mn.nombre   AS minero_especifico,  -- NULL = aplica a todos
    z.nombre    AS zona_especifica,     -- NULL = aplica a todas
    pm.fecha_inicio,
    CASE
        WHEN pm.id_minero IS NOT NULL THEN 'especifica_minero'
        WHEN pm.id_zona   IS NOT NULL THEN 'especifica_zona'
        ELSE 'global'
    END AS tipo
FROM precio_material pm
LEFT JOIN minero mn ON mn.id = pm.id_minero
LEFT JOIN zona   z  ON z.id  = pm.id_zona
WHERE pm.activo = 1
ORDER BY pm.metodo, pm.intervalo_tenor_min, tipo;


-- ====================================================================
-- SECCIÓN 7 · VALIDACIONES (queries de chequeo de integridad)
-- ====================================================================

-- 7.1 Entradas con tenor pero sin precio_material aplicado
--  (indica que el tenor está fuera de todos los rangos de la tabla)
SELECT
    mpe.id,
    mpe.fecha_llegada,
    mn.metodo_calculo,
    mpe.tenor,
    mi.nombre AS mina,
    mi.id_zona
FROM material_planta_entrada mpe
JOIN mina   mi ON mi.id = mpe.id_mina
LEFT JOIN minero mn ON mn.id = mi.id_minero
WHERE mpe.tenor IS NOT NULL
  AND mpe.id_precio IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM precio_material pm
    WHERE pm.activo = 1
      AND pm.metodo = mn.metodo_calculo
      AND mpe.tenor BETWEEN pm.intervalo_tenor_min AND pm.intervalo_tenor_max
  );

-- 7.2 Minas sin zona asignada (usarán fallback de tarifas_calculo)
SELECT id, nombre, id_minero
FROM mina
WHERE id_zona IS NULL AND estado = 'activa';

-- 7.3 Entradas con análisis donde el tenor falso difiere del calculado
--  (puede indicar que au_gr_x_ton_falso fue ajustado manualmente)
SELECT
    a.id_entrada,
    a.au_gr_x_ton        AS tenor_real,
    a.au_gr_x_ton_falso  AS tenor_falso,
    (a.au_gr_x_ton - a.au_gr_x_ton_falso) AS diferencia,
    mpe.tenor            AS tenor_en_mpe
FROM analisis a
JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
WHERE a.id_tipo_analisis = 1
  AND a.au_gr_x_ton_falso IS NOT NULL
  AND ABS(a.au_gr_x_ton - a.au_gr_x_ton_falso) > 2.5;  -- diferencia anormal (>2.5 gr/ton)

-- ====================================================================
-- FIN DEL ARCHIVO
-- Orden de uso en el agente Go:
--   1. Al arrancar → cargar catálogos  cuandos e necesiten se usan se buscan.
--   2. Al registrar llegada → query 3.1 (INSERT)
--   3. Al insertar análisis → query 4.1 (INSERT)
--      └→ luego en la misma transacción:
--         a) query 2.1 (buscar precio)
--         b) query 2.2 (buscar tarifa zona)
--         c) query 3.8 (UPDATE mpe con todo)
--   4. Reportes → sección 6
--   5. Validaciones → sección 7 (correr periódicamente o en cron)
-- ====================================================================