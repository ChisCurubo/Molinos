DELIMITER $$

-- ====================================================================
-- 1. ENTRADA DE MATERIA PRIMA (sin cambios)
-- ====================================================================
-- 1. INSERTAR MPE: Guardar siempre el inventario en peso HÚMEDO
DROP TRIGGER IF EXISTS trg_after_insert_mpe$$
CREATE TRIGGER trg_after_insert_mpe
AFTER INSERT ON material_planta_entrada
FOR EACH ROW
BEGIN
    DECLARE v_id_lote   INT           DEFAULT NULL;
    DECLARE v_condicion VARCHAR(10)   DEFAULT 'Humedo';

    -- Determinamos si llega con humedad o no
    SET v_condicion = CASE WHEN NEW.porcentaje_humedad > 0 THEN 'Humedo' ELSE 'Seco' END;

    -- Validamos que venga con datos base y que el peso HÚMEDO sea mayor a 0
    IF NEW.id_mina IS NOT NULL AND NEW.id_tipo_material IS NOT NULL AND NEW.peso_llegada_planta > 0 THEN
        INSERT INTO Inventario_Lotes (
            id_entrada, id_mina, id_tipo_material,
            condicion_material, porcentaje_humedad,
            toneladas_iniciales, toneladas_disponibles,
            estado, fecha_ingreso
        ) VALUES (
            NEW.id, NEW.id_mina, NEW.id_tipo_material,
            v_condicion, NEW.porcentaje_humedad,
            NEW.peso_llegada_planta, NEW.peso_llegada_planta, -- Siempre usamos el húmedo
            'almacenado', NOW()
        );

        SET v_id_lote = LAST_INSERT_ID();

        -- Registramos en el Kardex
        INSERT INTO Kardex_Movimientos (
            id_lote, fecha, tipo_movimiento,
            toneladas_movidas, destino_referencia
        ) VALUES (
            v_id_lote, NOW(), 'ENTRADA_PLANTA',
            NEW.peso_llegada_planta,
            CONCAT('Entrada MPE #', NEW.id, ' | Vol:', NEW.numero_volqueta, ' | ', NEW.fecha_llegada)
        );
    END IF;

    -- Excedentes (Se mantiene igual)
    IF NEW.excedente_calculado IS NOT NULL AND NEW.excedente_calculado > 0 THEN
        INSERT INTO Excedente (id_entrada, valor_excedente, monto_distribuido, fecha_calculo, concepto, estado_distribucion)
        VALUES (NEW.id, NEW.excedente_calculado, 0, NEW.fecha_llegada, CONCAT('Auto-generado — MPE #', NEW.id), 'pendiente');
    END IF;
END$$

-- ====================================================================
-- 2. ACTUALIZACIÓN DE MATERIA PRIMA (sin cambios)
-- ====================================================================

DROP TRIGGER IF EXISTS trg_after_update_mpe$$
CREATE TRIGGER trg_after_update_mpe
AFTER UPDATE ON material_planta_entrada
FOR EACH ROW
BEGIN
    -- Si llegó el análisis (total_material_seco pasa de 0 a un valor real)
    IF COALESCE(OLD.total_material_seco, 0) = 0 
       AND COALESCE(NEW.total_material_seco, 0) > 0 THEN
       
        -- ACTUALIZAMOS SOLO LA METADATA (Humedad), NUNCA LAS TONELADAS FÍSICAS
        UPDATE Inventario_Lotes
        SET
            porcentaje_humedad    = NEW.porcentaje_humedad,
            condicion_material    = CASE 
                WHEN NEW.porcentaje_humedad > 0 THEN 'Humedo' ELSE 'Seco' 
            END
        WHERE id_entrada = NEW.id;
        
    END IF;
END$$

-- ====================================================================
-- 3. PROCESAMIENTO (sin cambios)
-- ====================================================================
DELIMITER $$

-- ====================================================================
-- CORRECCIÓN 1: TRIGGER DE PROCESAMIENTO (Libre del Error 1442)
-- ====================================================================
-- 3. PROCESAMIENTO: Restar correctamente el material (Ej: Procesar 51t de 100t)
DROP TRIGGER IF EXISTS trg_after_insert_procesamiento_material$$
CREATE TRIGGER trg_after_insert_procesamiento_material
AFTER INSERT ON procesamiento_material
FOR EACH ROW
BEGIN
    DECLARE v_id_lote INT DEFAULT NULL;
    DECLARE v_disp DECIMAL(10,4) DEFAULT 0;

    -- Buscamos el lote de inventario asociado a la entrada
    SELECT id, toneladas_disponibles INTO v_id_lote, v_disp
    FROM Inventario_Lotes
    WHERE id_entrada = NEW.id_entrada AND estado IN ('almacenado', 'en_proceso')
    ORDER BY id DESC LIMIT 1;

    IF v_id_lote IS NOT NULL THEN
        -- Descontamos el material que se fue al molino (nunca menor a 0)
        SET v_disp = GREATEST(v_disp - NEW.toneladas_aportadas, 0);

        -- Actualizamos las toneladas disponibles y cambiamos a 'agotado' si llegó a 0
        UPDATE Inventario_Lotes
        SET toneladas_disponibles = v_disp,
            estado = CASE WHEN v_disp <= 0 THEN 'agotado' ELSE 'en_proceso' END
        WHERE id = v_id_lote;

        -- Registramos la salida hacia el proceso en el kardex
        INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
        VALUES (v_id_lote, NOW(), 'SALIDA_PROCESO', NEW.toneladas_aportadas, CONCAT('Concentrado #', NEW.id_material_concentrado));
    END IF;
END$$

-- ====================================================================
-- CORRECCIÓN 2: TRIGGER DE MAQUILA (Sintaxis Correcta)
-- ====================================================================

DROP TRIGGER IF EXISTS trg_before_update_material_concentrado$$

CREATE TRIGGER trg_before_update_material_concentrado
BEFORE UPDATE ON material_concentrado
FOR EACH ROW
BEGIN
    DECLARE v_fecha DATE;
    DECLARE v_pn     DECIMAL(14,2) DEFAULT 0;
    DECLARE v_pr     DECIMAL(14,2) DEFAULT 0;
    DECLARE v_ps     DECIMAL(14,2) DEFAULT 0;
    DECLARE v_precio DECIMAL(14,2) DEFAULT 0;

    IF OLD.estado = 'en_proceso' AND NEW.estado = 'en_canoa'
       AND NEW.toneladas_humedo IS NOT NULL AND NEW.toneladas_humedo > 0
    THEN
        -- Calcular secas si no vienen
        IF NEW.toneladas_seco IS NULL OR NEW.toneladas_seco = 0 THEN
            SET NEW.toneladas_seco = NEW.toneladas_humedo * (1 - COALESCE(NEW.porcentaje_humedad, 0));
        END IF;

        -- Material seco procesado total (materia prima que entró al molino)
        SET NEW.material_seco_procesado = (
            SELECT COALESCE(SUM(toneladas_seco_aportadas), 0)
            FROM procesamiento_material
            WHERE id_material_concentrado = NEW.id
        );

        -- Disponible inicial = húmedas
        SET NEW.toneladas_disponibles = NEW.toneladas_humedo;

        SET v_fecha = COALESCE(NEW.fecha_fin, CURDATE());

        SELECT valor INTO v_pn FROM tarifas_proceso
        WHERE codigo = 'PROCESO_NORMAL'
          AND fecha_desde <= v_fecha
          AND (fecha_hasta IS NULL OR fecha_hasta >= v_fecha)
        ORDER BY fecha_desde DESC LIMIT 1;

        SELECT valor INTO v_pr FROM tarifas_proceso
        WHERE codigo = 'PROCESO_RELAVE'
          AND fecha_desde <= v_fecha
          AND (fecha_hasta IS NULL OR fecha_hasta >= v_fecha)
        ORDER BY fecha_desde DESC LIMIT 1;

        SELECT valor INTO v_ps FROM tarifas_proceso
        WHERE codigo = 'SOLO_FILTROPRENSA'
          AND fecha_desde <= v_fecha
          AND (fecha_hasta IS NULL OR fecha_hasta >= v_fecha)
        ORDER BY fecha_desde DESC LIMIT 1;

        SET v_precio = CASE
            WHEN NEW.hizo_relave = 1 AND NEW.hizo_filtroprensa = 1 THEN v_pr
            WHEN (NEW.hizo_molienda = 1 OR NEW.hizo_flotacion = 1)
                 AND NEW.hizo_filtroprensa = 1 THEN v_pn
            WHEN NEW.hizo_filtroprensa = 1 THEN v_ps
            ELSE 0
        END;

        SET NEW.precio_maquila_por_ton = v_precio;
        -- *** AQUÍ EL CAMBIO: usar material_seco_procesado en lugar de toneladas_seco ***
        SET NEW.maquila_total = v_precio * NEW.material_seco_procesado;
    END IF;
END$$




-- ====================================================================
-- 5. DESPUÉS DEL CIERRE – INVENTARIO DE CONCENTRADO (EN HÚMEDO)
-- ====================================================================
DROP TRIGGER IF EXISTS trg_after_update_material_concentrado$$
CREATE TRIGGER trg_after_update_material_concentrado
AFTER UPDATE ON material_concentrado
FOR EACH ROW
BEGIN
    DECLARE v_id_lote_conc INT DEFAULT NULL;
    DECLARE v_total_seco   DECIMAL(10,4) DEFAULT 0;

    IF OLD.estado = 'en_proceso' AND NEW.estado = 'en_canoa'
       AND NEW.toneladas_humedo IS NOT NULL AND NEW.toneladas_humedo > 0
    THEN
        -- El inventario de concentrado se crea con las toneladas húmedas reales
        INSERT INTO Inventario_Lotes (
            id_entrada, id_material_concentrado, id_mina, id_tipo_material,
            condicion_material, porcentaje_humedad,
            toneladas_iniciales, toneladas_disponibles, estado, ubicacion, fecha_ingreso
        ) VALUES (
            NULL, NEW.id, NULL, 1,
            CASE WHEN COALESCE(NEW.porcentaje_humedad,0)>0 THEN 'Humedo' ELSE 'Seco' END,
            COALESCE(NEW.porcentaje_humedad,0),
            NEW.toneladas_humedo,          -- húmedas
            NEW.toneladas_humedo,          -- disponibles iniciales = húmedas
            'almacenado', COALESCE(NEW.ubicacion_canoa,'Canoa principal'), NOW()
        );
        SET v_id_lote_conc = LAST_INSERT_ID();

        INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
        VALUES (v_id_lote_conc, NOW(), 'ENTRADA_CONCENTRADO', NEW.toneladas_humedo, CONCAT('Lote ', NEW.codigo));

        -- Marcar la materia prima como agotada
        UPDATE Inventario_Lotes il
        INNER JOIN procesamiento_material pm ON pm.id_entrada = il.id_entrada
        SET il.estado = 'agotado'
        WHERE pm.id_material_concentrado = NEW.id AND il.id_entrada IS NOT NULL;

        -- Distribuir maquila a cada entrada (en seco)
        IF COALESCE(NEW.maquila_total, 0) > 0 THEN
            SELECT COALESCE(SUM(toneladas_seco_aportadas), 0) INTO v_total_seco
            FROM procesamiento_material WHERE id_material_concentrado = NEW.id;

            IF v_total_seco > 0 THEN
                UPDATE procesamiento_material
                SET
                    concentrado_proporcional = ROUND((toneladas_seco_aportadas / v_total_seco) * NEW.toneladas_seco, 4),
                    maquila_proporcional     = ROUND((toneladas_seco_aportadas / v_total_seco) * NEW.maquila_total, 2)
                WHERE id_material_concentrado = NEW.id;

                UPDATE material_planta_entrada mpe
                INNER JOIN procesamiento_material pm ON pm.id_entrada = mpe.id
                SET mpe.costo_maquila = pm.maquila_proporcional
                WHERE pm.id_material_concentrado = NEW.id;
            END IF;
        END IF;
    END IF;
END$$

-- ====================================================================
-- 6. ANTES DE INSERTAR EN VIAJE – CÁLCULO PROPORCIONAL DE MAQUILA
-- ====================================================================

DROP TRIGGER IF EXISTS trg_before_insert_viaje_material$$

CREATE TRIGGER trg_before_insert_viaje_material
BEFORE INSERT ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_maquila_total  DECIMAL(14,2) DEFAULT 0;
    DECLARE v_estado_lote    VARCHAR(40)   DEFAULT NULL;

    IF NEW.es_remanente = 1 THEN
        SET NEW.costo_maquila = 0;

    ELSEIF NEW.id_material_concentrado IS NOT NULL THEN
        SELECT maquila_total, estado
        INTO   v_maquila_total, v_estado_lote
        FROM   material_concentrado
        WHERE  id = NEW.id_material_concentrado;

        -- 'en_canoa' = nunca se ha enviado nada → cobra maquila completa
        -- cualquier otro estado (parcialmente_enviado) → ya pagó maquila → 0
        IF v_estado_lote = 'en_canoa' THEN
            SET NEW.costo_maquila = COALESCE(v_maquila_total, 0);
        ELSE
            SET NEW.costo_maquila = 0;
        END IF;

    END IF;
END$$



-- ====================================================================
-- 7. DESPUÉS DE INSERTAR EN VIAJE – DESCONTAR CONCENTRADO (HÚMEDO)
-- ====================================================================
DROP TRIGGER IF EXISTS trg_after_insert_viaje_material$$
CREATE TRIGGER trg_after_insert_viaje_material
AFTER INSERT ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_id_lote_conc INT           DEFAULT NULL;
    DECLARE v_disp         DECIMAL(10,4) DEFAULT 0;
    DECLARE v_humedo       DECIMAL(10,4) DEFAULT 0;

    SET v_humedo = COALESCE(NEW.total_concentrado_humedo, 0);

    IF NEW.id_material_concentrado IS NOT NULL AND v_humedo > 0 AND NEW.es_remanente = 0 THEN
        -- Descontar del lote de concentrado (usa toneladas húmedas)
        SELECT GREATEST(toneladas_disponibles - v_humedo, 0) INTO v_disp
        FROM material_concentrado WHERE id = NEW.id_material_concentrado;

        UPDATE material_concentrado
        SET
            toneladas_disponibles = v_disp,
            estado = CASE WHEN v_disp <= 0 THEN 'enviado_completo' ELSE 'parcialmente_enviado' END
        WHERE id = NEW.id_material_concentrado;

        -- Inventario de concentrado y kardex (húmedo)
        SELECT id INTO v_id_lote_conc
        FROM Inventario_Lotes
        WHERE id_material_concentrado = NEW.id_material_concentrado AND estado != 'agotado'
        ORDER BY id DESC LIMIT 1;

        IF v_id_lote_conc IS NOT NULL THEN
            UPDATE Inventario_Lotes
            SET
                toneladas_disponibles = v_disp,
                estado = CASE WHEN v_disp <= 0 THEN 'agotado' ELSE estado END
            WHERE id = v_id_lote_conc;

            INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
            VALUES (v_id_lote_conc, NOW(), 'SALIDA_VIAJE', v_humedo, CONCAT('Viaje #', NEW.id_viaje));
        END IF;

        -- Si se agotó, marcar entradas originales como incluidas en viaje
        IF v_disp <= 0 THEN
            UPDATE material_planta_entrada mpe
            INNER JOIN procesamiento_material pm ON pm.id_entrada = mpe.id
            SET mpe.estado = 'incluida_viaje'
            WHERE pm.id_material_concentrado = NEW.id_material_concentrado
              AND mpe.estado NOT IN ('cancelada');
        END IF;
    END IF;

    -- Actualizar totales del viaje
    UPDATE Viaje SET
        maquila = (SELECT COALESCE(SUM(vm2.costo_maquila), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = NEW.id_viaje),
        total_costo_material = (SELECT COALESCE(SUM(vm2.valor_total_con_gastos), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = NEW.id_viaje)
    WHERE id = NEW.id_viaje;
END$$

-- ====================================================================
-- 8. DESPUÉS DE BORRAR DE VIAJE – DEVOLVER CONCENTRADO (HÚMEDO)
-- ====================================================================
DROP TRIGGER IF EXISTS trg_after_delete_viaje_material$$
CREATE TRIGGER trg_after_delete_viaje_material
AFTER DELETE ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_id_lote_conc INT           DEFAULT NULL;
    DECLARE v_ton_ini      DECIMAL(10,4) DEFAULT 0;
    DECLARE v_humedo       DECIMAL(10,4) DEFAULT 0;
    DECLARE v_en_otro      INT           DEFAULT 0;

    SET v_humedo = COALESCE(OLD.total_concentrado_humedo, 0);

    IF OLD.id_material_concentrado IS NOT NULL AND v_humedo > 0 THEN
        -- Recuperar el lote de inventario del concentrado
        SELECT id, toneladas_iniciales INTO v_id_lote_conc, v_ton_ini
        FROM Inventario_Lotes
        WHERE id_material_concentrado = OLD.id_material_concentrado
        ORDER BY id DESC LIMIT 1;

        IF v_id_lote_conc IS NOT NULL THEN
            UPDATE Inventario_Lotes
            SET
                toneladas_disponibles = LEAST(toneladas_disponibles + v_humedo, v_ton_ini),
                estado = 'almacenado'
            WHERE id = v_id_lote_conc;

            INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
            VALUES (v_id_lote_conc, NOW(), 'AJUSTE_MERMA', v_humedo, CONCAT('Devolucion Viaje #', OLD.id_viaje));
        END IF;

        UPDATE material_concentrado
        SET
            toneladas_disponibles = toneladas_disponibles + v_humedo,
            estado = 'parcialmente_enviado'
        WHERE id = OLD.id_material_concentrado;

        SELECT COUNT(*) INTO v_en_otro FROM viaje_material
        WHERE id_material_concentrado = OLD.id_material_concentrado;

        IF v_en_otro = 0 THEN
            UPDATE material_concentrado SET estado = 'en_canoa' WHERE id = OLD.id_material_concentrado;
        END IF;
    END IF;

    -- Recalcular totales del viaje
    UPDATE Viaje SET
        maquila = (SELECT COALESCE(SUM(vm2.costo_maquila), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = OLD.id_viaje),
        total_costo_material = (SELECT COALESCE(SUM(vm2.valor_total_con_gastos), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = OLD.id_viaje)
    WHERE id = OLD.id_viaje;
END$$

-- ====================================================================
-- 9. BEFORE UPDATE viaje_material – HEREDA DATOS DEL LOTE AL ASIGNARLO
-- ====================================================================
DROP TRIGGER IF EXISTS trg_before_update_viaje_material_lote$$
CREATE TRIGGER trg_before_update_viaje_material_lote
BEFORE UPDATE ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_ton_humedo DECIMAL(10,4);
    DECLARE v_hum_pct    DECIMAL(6,4);
    DECLARE v_peso_hum   DECIMAL(10,4);
    DECLARE v_ton_seco   DECIMAL(10,4);
    DECLARE v_tenor_au   DECIMAL(10,2);
    DECLARE v_gr_au      DECIMAL(12,2);
    DECLARE v_tenor_ag   DECIMAL(10,2);
    DECLARE v_gr_ag      DECIMAL(12,2);

    IF NEW.id_material_concentrado IS NOT NULL
       AND (OLD.id_material_concentrado IS NULL OR OLD.id_material_concentrado != NEW.id_material_concentrado)
       AND COALESCE(NEW.total_concentrado_humedo, 0) = 0
    THEN
        SELECT toneladas_humedo, porcentaje_humedad,
               toneladas_humedo - toneladas_seco,
               toneladas_seco
        INTO v_ton_humedo, v_hum_pct, v_peso_hum, v_ton_seco
        FROM material_concentrado WHERE id = NEW.id_material_concentrado;

        SELECT au_concentrado / NULLIF(v_ton_seco, 0), au_concentrado,
               ag_concentrado / NULLIF(v_ton_seco, 0), ag_concentrado
        INTO v_tenor_au, v_gr_au, v_tenor_ag, v_gr_ag
        FROM Analisis
        WHERE id_material_concentrado = NEW.id_material_concentrado
          AND id_tipo_analisis = 2
        ORDER BY fecha_salida DESC LIMIT 1;

        SET NEW.total_concentrado_humedo = v_ton_humedo;
        SET NEW.porcentaje_humedad       = v_hum_pct;
        SET NEW.peso_humedad             = v_peso_hum;
        SET NEW.concentrado_seco         = v_ton_seco;
        SET NEW.tenor_au_venta           = v_tenor_au;
        SET NEW.total_grs_au_venta       = v_gr_au;
        SET NEW.tenor_ag                 = v_tenor_ag;
        SET NEW.total_grs_ag_venta       = v_gr_ag;
    END IF;
END$$

DELIMITER ;

SHOW TRIGGERS;