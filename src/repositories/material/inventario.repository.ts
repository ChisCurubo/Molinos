import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IInventarioRepository } from '../../ports/material/inventario.interface';

export class InventarioRepository implements IInventarioRepository {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    private getConn(tx?: PoolConnection): PoolConnection | Pool {
        return tx || this.db;
    }

    async obtenerMaterialCrudo(): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(`
            SELECT * FROM v_inventario_material_crudo ORDER BY fecha_llegada ASC
        `);
        return rows;
    }

    async obtenerConcentrado(): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(`
            SELECT * FROM v_inventario_concentrado ORDER BY fecha_fin ASC
        `);
        return rows;
    }

    async obtenerResumenLote(idLote: number): Promise<any> {
        const [rows] = await this.db.execute<any[]>(
            `SELECT * FROM v_resumen_lote WHERE id = ?`,
            [idLote]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // KPIs de inventario calculados sobre tablas base (sin depender de las vistas).
    // Supuesto: "crudo" = entradas NO vinculadas a ningún procesamiento y en estado
    // pendiente/en_proceso (aún por procesar).
    async obtenerResumenInventario(): Promise<any> {
        const [rows] = await this.db.execute<any[]>(`
            SELECT
              (SELECT COUNT(*) FROM material_concentrado WHERE estado = 'en_canoa') AS lotes_en_canoa,
              (SELECT COALESCE(SUM(toneladas_disponibles),0) FROM material_concentrado
                 WHERE estado IN ('en_canoa','parcialmente_enviado')) AS concentrado_humedo_disponible,
              (SELECT COALESCE(SUM(maquila_total),0) FROM material_concentrado) AS concentrado_maquila_total,
              (SELECT COUNT(*) FROM material_planta_entrada mpe
                 WHERE mpe.id NOT IN (SELECT id_entrada FROM procesamiento_material)
                   AND mpe.estado IN ('pendiente','en_proceso')) AS entradas_sin_lote,
              (SELECT COALESCE(SUM(peso_llegada_planta),0) FROM material_planta_entrada mpe
                 WHERE mpe.id NOT IN (SELECT id_entrada FROM procesamiento_material)
                   AND mpe.estado IN ('pendiente','en_proceso')) AS crudo_humedo_total,
              (SELECT COALESCE(SUM(total_material_seco),0) FROM material_planta_entrada mpe
                 WHERE mpe.id NOT IN (SELECT id_entrada FROM procesamiento_material)
                   AND mpe.estado IN ('pendiente','en_proceso')) AS crudo_seco_total
        `);
        return rows[0];
    }

    // ====================================================================
    // Lógica migrada desde el trigger 'trg_after_insert_mpe' (triguer_v5.sql).
    // Al crear una entrada de materia prima se guarda su lote en HÚMEDO en
    // Inventario_Lotes y se registra el movimiento de Kardex (ENTRADA_PLANTA).
    // El Excedente NO se crea aquí: al registrar la entrada aún no hay análisis
    // (excedente_calculado es null). El excedente nace al aplicar el análisis,
    // en AnalisisService.sincronizarExcedente (solo si tenor_real > 2).
    // `entrada` es la fila recién insertada (columnas crudas de material_planta_entrada).
    // ====================================================================
    async triggerAlCrearEntrada(entrada: any, tx?: PoolConnection): Promise<void> {
        const conn = this.getConn(tx);
        const v_condicion = (entrada.porcentaje_humedad || 0) > 0 ? 'Humedo' : 'Seco';

        if (entrada.id_mina != null && entrada.id_tipo_material != null && entrada.peso_llegada_planta > 0) {
            const [resLote] = await conn.execute<ResultSetHeader>(
                `INSERT INTO Inventario_Lotes (
                    id_entrada, id_mina, id_tipo_material,
                    condicion_material, porcentaje_humedad,
                    toneladas_iniciales, toneladas_disponibles,
                    estado, fecha_ingreso
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'almacenado', NOW())`,
                [
                    entrada.id, entrada.id_mina, entrada.id_tipo_material,
                    v_condicion, entrada.porcentaje_humedad || 0,
                    entrada.peso_llegada_planta, entrada.peso_llegada_planta // Siempre HÚMEDO
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
                    entrada.peso_llegada_planta,
                    `Entrada MPE #${entrada.id} | Vol:${entrada.numero_volqueta} | ${entrada.fecha_llegada}`
                ]
            );
        }
    }

    // ====================================================================
    // Lógica migrada desde el trigger 'trg_after_update_mpe' (triguer_v5.sql).
    // Cuando llega el análisis (total_material_seco pasa de 0 a un valor real) se
    // corrige el lote de peso bruto (húmedo) a peso seco:
    //   Caso A (sin salidas): corrige toneladas_iniciales y toneladas_disponibles
    //     al peso seco y registra un kardex AJUSTE_MERMA con la diferencia.
    //   Caso B (ya hubo salidas): solo actualiza condición y humedad (las toneladas
    //     ya salieron proporcional al bruto) y registra un AJUSTE_MERMA informativo.
    // ====================================================================
    async triggerAlActualizarAnalisis(oldEntrada: any, newEntrada: any, tx?: PoolConnection): Promise<void> {
        const conn = this.getConn(tx);
        const oldSeco = oldEntrada?.total_material_seco || 0;
        const newSeco = newEntrada?.total_material_seco || 0;

        // Solo dispara cuando total_material_seco pasa de 0/NULL a un valor real.
        if (!(oldSeco === 0 && newSeco > 0)) return;

        const v_ton_nuevo = newSeco;
        const v_humedad = newEntrada.porcentaje_humedad || 0;
        const v_condicion = v_humedad > 0 ? 'Humedo' : 'Seco';

        // Buscar el lote activo de esta entrada.
        const [loteRows] = await conn.execute<any[]>(
            `SELECT id, toneladas_iniciales, toneladas_disponibles
             FROM Inventario_Lotes
             WHERE id_entrada = ?
             ORDER BY id DESC LIMIT 1`,
            [newEntrada.id]
        );
        if (loteRows.length === 0) return;

        const v_id_lote = loteRows[0].id;
        const v_ton_ini = Number(loteRows[0].toneladas_iniciales);
        const v_ton_disp = Number(loteRows[0].toneladas_disponibles);

        // ── Caso A: Sin salidas todavía → corregir bruto → seco ──────────
        if (v_ton_disp === v_ton_ini) {
            const v_diferencia = v_ton_ini - v_ton_nuevo; // cuánto se "pierde" de bruto a seco

            await conn.execute(
                `UPDATE Inventario_Lotes
                 SET toneladas_iniciales = ?, toneladas_disponibles = ?,
                     condicion_material = ?, porcentaje_humedad = ?
                 WHERE id = ?`,
                [v_ton_nuevo, v_ton_nuevo, v_condicion, v_humedad, v_id_lote]
            );

            await conn.execute(
                `INSERT INTO Kardex_Movimientos (
                    id_lote, fecha, tipo_movimiento,
                    toneladas_movidas, destino_referencia, comentarios
                ) VALUES (?, NOW(), 'AJUSTE_MERMA', ?, ?, ?)`,
                [
                    v_id_lote,
                    Math.abs(v_diferencia),
                    `Corrección bruto→seco tras análisis. MPE #${newEntrada.id}`,
                    `Anterior (bruto): ${v_ton_ini} t  →  Nuevo (seco): ${v_ton_nuevo} t  |  ` +
                        `Humedad: ${Math.round(v_humedad * 100 * 100) / 100}%`
                ]
            );

        // ── Caso B: Ya hubo salidas → solo actualizar metadata ───────────
        } else {
            await conn.execute(
                `UPDATE Inventario_Lotes
                 SET condicion_material = ?, porcentaje_humedad = ?
                 WHERE id = ?`,
                [v_condicion, v_humedad, v_id_lote]
            );

            await conn.execute(
                `INSERT INTO Kardex_Movimientos (
                    id_lote, fecha, tipo_movimiento,
                    toneladas_movidas, destino_referencia, comentarios
                ) VALUES (?, NOW(), 'AJUSTE_MERMA', 0, ?, ?)`,
                [
                    v_id_lote,
                    `Análisis tardío MPE #${newEntrada.id} — lote ya tiene salidas`,
                    `Análisis registrado con salidas previas. ` +
                        `Saldo disponible se mantiene en ${v_ton_disp} t. ` +
                        `Revisar manualmente si hay discrepancia.`
                ]
            );
        }
    }
}
