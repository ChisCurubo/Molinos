import { PoolConnection, ResultSetHeader, Pool } from 'mysql2/promise';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';

export class TriggerLogicRepositoryImpl implements TriggerLogicRepository {

  constructor(private db: Pool) {}

  private getConn(tx?: PoolConnection): PoolConnection | Pool {
    return tx || this.db;
  }

  async afterInsertMPE(newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    const v_condicion = newRow.porcentaje_humedad > 0 ? 'Humedo' : 'Seco';

    if (newRow.id_mina !== null && newRow.id_tipo_material !== null && newRow.peso_llegada_planta > 0) {
      const [resLote] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Inventario_Lotes (
          id_entrada, id_mina, id_tipo_material,
          condicion_material, porcentaje_humedad,
          toneladas_iniciales, toneladas_disponibles,
          estado, fecha_ingreso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'almacenado', NOW())`,
        [
          newRow.id, newRow.id_mina, newRow.id_tipo_material,
          v_condicion, newRow.porcentaje_humedad || 0,
          newRow.peso_llegada_planta, newRow.peso_llegada_planta // Siempre WET (Húmedo)
        ]
      );
      
      const v_id_lote = resLote.insertId;

      await conn.execute(
        `INSERT INTO Kardex_Movimientos (
          id_lote, fecha, tipo_movimiento,
          toneladas_movidas, destino_referencia
        ) VALUES (?, NOW(), 'ENTRADA_PLANTA', ?, ?)`,
        [
          v_id_lote,
          newRow.peso_llegada_planta,
          `Entrada MPE #${newRow.id} | Vol:${newRow.numero_volqueta} | ${newRow.fecha_llegada}`
        ]
      );
    }

    if (newRow.excedente_calculado !== null && newRow.excedente_calculado > 0) {
      await conn.execute(
        `INSERT INTO Excedente (id_entrada, valor_excedente, monto_distribuido, fecha_calculo, concepto, estado_distribucion)
         VALUES (?, ?, 0, ?, ?, 'pendiente')`,
        [
          newRow.id,
          newRow.excedente_calculado,
          newRow.fecha_llegada,
          `Auto-generado — MPE #${newRow.id}`
        ]
      );
    }
  }

  async afterUpdateMPE(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    const oldSeco = oldRow?.total_material_seco || 0;
    const newSeco = newRow?.total_material_seco || 0;

    if (oldSeco === 0 && newSeco > 0) {
      const condicion = newRow.porcentaje_humedad > 0 ? 'Humedo' : 'Seco';
      
      // ACTUALIZAMOS SOLO LA METADATA (Humedad), NUNCA LAS TONELADAS FÍSICAS
      await conn.execute(
        `UPDATE Inventario_Lotes
         SET porcentaje_humedad = ?, condicion_material = ?
         WHERE id_entrada = ?`,
        [newRow.porcentaje_humedad || 0, condicion, newRow.id]
      );
    }
  }

  async afterInsertProcesamiento(newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    const [rows] = await conn.execute<any[]>(
      `SELECT id, toneladas_disponibles
       FROM Inventario_Lotes
       WHERE id_entrada = ? AND estado IN ('almacenado', 'en_proceso')
       ORDER BY id DESC LIMIT 1`,
      [newRow.id_entrada]
    );

    if (rows.length > 0) {
      const v_id_lote = rows[0].id;
      let v_disp = rows[0].toneladas_disponibles;

      v_disp = Math.max(v_disp - newRow.toneladas_aportadas, 0);
      const estado = v_disp <= 0 ? 'agotado' : 'en_proceso';

      await conn.execute(
        `UPDATE Inventario_Lotes
         SET toneladas_disponibles = ?, estado = ?
         WHERE id = ?`,
        [v_disp, estado, v_id_lote]
      );

      await conn.execute(
        `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
         VALUES (?, NOW(), 'SALIDA_PROCESO', ?, ?)`,
        [v_id_lote, newRow.toneladas_aportadas, `Concentrado #${newRow.id_material_concentrado}`]
      );
    }
  }

  async beforeUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    if (oldRow?.estado === 'en_proceso' && newRow?.estado === 'en_canoa' && newRow.toneladas_humedo > 0) {
      
      let toneladasSeco = newRow.toneladas_seco;
      if (toneladasSeco === null || toneladasSeco === 0 || toneladasSeco === undefined) {
        toneladasSeco = newRow.toneladas_humedo * (1 - (newRow.porcentaje_humedad || 0));
      }

      const [procRows] = await conn.execute<any[]>(
        `SELECT COALESCE(SUM(toneladas_seco_aportadas), 0) AS total_seco
         FROM procesamiento_material
         WHERE id_material_concentrado = ?`,
        [newRow.id]
      );
      const materialSecoProcesado = procRows[0].total_seco;
      
      const v_fecha = newRow.fecha_fin || new Date();

      const [pnRows] = await conn.execute<any[]>(
        `SELECT valor FROM tarifas_proceso
         WHERE codigo = 'PROCESO_NORMAL' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
         ORDER BY fecha_desde DESC LIMIT 1`, [v_fecha, v_fecha]
      );
      const v_pn = pnRows.length > 0 ? pnRows[0].valor : 0;

      const [prRows] = await conn.execute<any[]>(
        `SELECT valor FROM tarifas_proceso
         WHERE codigo = 'PROCESO_RELAVE' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
         ORDER BY fecha_desde DESC LIMIT 1`, [v_fecha, v_fecha]
      );
      const v_pr = prRows.length > 0 ? prRows[0].valor : 0;

      const [psRows] = await conn.execute<any[]>(
        `SELECT valor FROM tarifas_proceso
         WHERE codigo = 'SOLO_FILTROPRENSA' AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
         ORDER BY fecha_desde DESC LIMIT 1`, [v_fecha, v_fecha]
      );
      const v_ps = psRows.length > 0 ? psRows[0].valor : 0;

      let v_precio = 0;
      if (newRow.hizo_relave == 1 && newRow.hizo_filtroprensa == 1) {
        v_precio = v_pr;
      } else if ((newRow.hizo_molienda == 1 || newRow.hizo_flotacion == 1) && newRow.hizo_filtroprensa == 1) {
        v_precio = v_pn;
      } else if (newRow.hizo_filtroprensa == 1) {
        v_precio = v_ps;
      }

      const maquilaTotal = v_precio * materialSecoProcesado;

      await conn.execute(
        `UPDATE material_concentrado
         SET toneladas_seco = ?, material_seco_procesado = ?, toneladas_disponibles = ?,
             precio_maquila_por_ton = ?, maquila_total = ?
         WHERE id = ?`,
        [toneladasSeco, materialSecoProcesado, newRow.toneladas_humedo, v_precio, maquilaTotal, newRow.id]
      );
      
      newRow.toneladas_seco = toneladasSeco;
      newRow.material_seco_procesado = materialSecoProcesado;
      newRow.toneladas_disponibles = newRow.toneladas_humedo;
      newRow.precio_maquila_por_ton = v_precio;
      newRow.maquila_total = maquilaTotal;
    }
  }

  async afterUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    if (oldRow?.estado === 'en_proceso' && newRow?.estado === 'en_canoa' && newRow.toneladas_humedo > 0) {
      
      const [resLote] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Inventario_Lotes (
            id_entrada, id_material_concentrado, id_mina, id_tipo_material,
            condicion_material, porcentaje_humedad,
            toneladas_iniciales, toneladas_disponibles, estado, ubicacion, fecha_ingreso
        ) VALUES (
            NULL, ?, NULL, 1,
            ?, ?, ?, ?, 'almacenado', ?, NOW()
        )`,
        [
          newRow.id,
          (newRow.porcentaje_humedad || 0) > 0 ? 'Humedo' : 'Seco',
          newRow.porcentaje_humedad || 0,
          newRow.toneladas_humedo,
          newRow.toneladas_humedo,
          newRow.ubicacion_canoa || 'Canoa principal'
        ]
      );
      const v_id_lote_conc = resLote.insertId;

      await conn.execute(
        `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
         VALUES (?, NOW(), 'ENTRADA_CONCENTRADO', ?, ?)`,
        [v_id_lote_conc, newRow.toneladas_humedo, `Lote ${newRow.codigo}`]
      );

      await conn.execute(
        `UPDATE Inventario_Lotes il
         INNER JOIN procesamiento_material pm ON pm.id_entrada = il.id_entrada
         SET il.estado = 'agotado'
         WHERE pm.id_material_concentrado = ? AND il.id_entrada IS NOT NULL`,
        [newRow.id]
      );

      if ((newRow.maquila_total || 0) > 0) {
        const [sumRows] = await conn.execute<any[]>(
          `SELECT COALESCE(SUM(toneladas_seco_aportadas), 0) as total_seco
           FROM procesamiento_material WHERE id_material_concentrado = ?`,
          [newRow.id]
        );
        const v_total_seco = sumRows[0].total_seco;

        if (v_total_seco > 0) {
          await conn.execute(
            `UPDATE procesamiento_material
             SET concentrado_proporcional = ROUND((toneladas_seco_aportadas / ?) * ?, 4),
                 maquila_proporcional = ROUND((toneladas_seco_aportadas / ?) * ?, 2)
             WHERE id_material_concentrado = ?`,
            [v_total_seco, newRow.toneladas_seco, v_total_seco, newRow.maquila_total, newRow.id]
          );

          await conn.execute(
            `UPDATE material_planta_entrada mpe
             INNER JOIN procesamiento_material pm ON pm.id_entrada = mpe.id
             SET mpe.costo_maquila = pm.maquila_proporcional
             WHERE pm.id_material_concentrado = ?`,
            [newRow.id]
          );
        }
      }
    }
  }

  async beforeInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    let costoMaquila = 0;
    if (newRow.es_remanente == 1) {
      costoMaquila = 0;
    } else if (newRow.id_material_concentrado) {
      const [mcRows] = await conn.execute<any[]>(
        `SELECT maquila_total, estado FROM material_concentrado WHERE id = ?`,
        [newRow.id_material_concentrado]
      );
      if (mcRows.length > 0) {
        if (mcRows[0].estado === 'en_canoa') {
          costoMaquila = mcRows[0].maquila_total || 0;
        }
      }
    }

    await conn.execute(
      `UPDATE viaje_material SET costo_maquila = ? WHERE id = ?`,
      [costoMaquila, newRow.id]
    );
  }

  async afterInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    const v_humedo = newRow.total_concentrado_humedo || 0;
    
    if (newRow.id_material_concentrado && v_humedo > 0 && newRow.es_remanente == 0) {
      const [mcRows] = await conn.execute<any[]>(
        `SELECT GREATEST(toneladas_disponibles - ?, 0) as v_disp
         FROM material_concentrado WHERE id = ?`,
        [v_humedo, newRow.id_material_concentrado]
      );
      if(mcRows.length > 0) {
          const v_disp = mcRows[0].v_disp;

          await conn.execute(
            `UPDATE material_concentrado
             SET toneladas_disponibles = ?,
                 estado = CASE WHEN ? <= 0 THEN 'enviado_completo' ELSE 'parcialmente_enviado' END
             WHERE id = ?`,
            [v_disp, v_disp, newRow.id_material_concentrado]
          );

          const [ilRows] = await conn.execute<any[]>(
            `SELECT id FROM Inventario_Lotes
             WHERE id_material_concentrado = ? AND estado != 'agotado'
             ORDER BY id DESC LIMIT 1`,
            [newRow.id_material_concentrado]
          );

          if (ilRows.length > 0) {
            const v_id_lote_conc = ilRows[0].id;
            await conn.execute(
              `UPDATE Inventario_Lotes
               SET toneladas_disponibles = ?,
                   estado = CASE WHEN ? <= 0 THEN 'agotado' ELSE estado END
               WHERE id = ?`,
              [v_disp, v_disp, v_id_lote_conc]
            );

            await conn.execute(
              `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
               VALUES (?, NOW(), 'SALIDA_VIAJE', ?, ?)`,
              [v_id_lote_conc, v_humedo, `Viaje #${newRow.id_viaje}`]
            );
          }

          if (v_disp <= 0) {
            await conn.execute(
              `UPDATE material_planta_entrada mpe
               INNER JOIN procesamiento_material pm ON pm.id_entrada = mpe.id
               SET mpe.estado = 'incluida_viaje'
               WHERE pm.id_material_concentrado = ? AND mpe.estado NOT IN ('cancelada')`,
              [newRow.id_material_concentrado]
            );
          }
      }
    }

    await conn.execute(
      `UPDATE Viaje SET
        maquila = (SELECT COALESCE(SUM(vm2.costo_maquila), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = ?),
        total_costo_material = (SELECT COALESCE(SUM(vm2.valor_total_con_gastos), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = ?)
       WHERE id = ?`,
      [newRow.id_viaje, newRow.id_viaje, newRow.id_viaje]
    );
  }

  async afterDeleteViajeMaterial(oldRow: any, tx?: PoolConnection): Promise<void> {
    const conn = this.getConn(tx);
    const v_humedo = oldRow.total_concentrado_humedo || 0;

    if (oldRow.id_material_concentrado && v_humedo > 0) {
      const [ilRows] = await conn.execute<any[]>(
        `SELECT id, toneladas_iniciales FROM Inventario_Lotes
         WHERE id_material_concentrado = ?
         ORDER BY id DESC LIMIT 1`,
        [oldRow.id_material_concentrado]
      );

      if (ilRows.length > 0) {
        const v_id_lote_conc = ilRows[0].id;
        const v_ton_ini = ilRows[0].toneladas_iniciales;

        await conn.execute(
          `UPDATE Inventario_Lotes
           SET toneladas_disponibles = LEAST(toneladas_disponibles + ?, ?),
               estado = 'almacenado'
           WHERE id = ?`,
          [v_humedo, v_ton_ini, v_id_lote_conc]
        );

        await conn.execute(
          `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
           VALUES (?, NOW(), 'AJUSTE_MERMA', ?, ?)`,
          [v_id_lote_conc, v_humedo, `Devolucion Viaje #${oldRow.id_viaje}`]
        );
      }

      await conn.execute(
        `UPDATE material_concentrado
         SET toneladas_disponibles = toneladas_disponibles + ?,
             estado = 'parcialmente_enviado'
         WHERE id = ?`,
        [v_humedo, oldRow.id_material_concentrado]
      );

      const [vmRows] = await conn.execute<any[]>(
        `SELECT COUNT(*) as count FROM viaje_material WHERE id_material_concentrado = ?`,
        [oldRow.id_material_concentrado]
      );
      
      if (vmRows[0].count === 0) {
        await conn.execute(
          `UPDATE material_concentrado SET estado = 'en_canoa' WHERE id = ?`,
          [oldRow.id_material_concentrado]
        );
      }
    }

    await conn.execute(
      `UPDATE Viaje SET
        maquila = (SELECT COALESCE(SUM(vm2.costo_maquila), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = ?),
        total_costo_material = (SELECT COALESCE(SUM(vm2.valor_total_con_gastos), 0) FROM viaje_material vm2 WHERE vm2.id_viaje = ?)
       WHERE id = ?`,
      [oldRow.id_viaje, oldRow.id_viaje, oldRow.id_viaje]
    );
  }
}
