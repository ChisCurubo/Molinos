import { PoolConnection, ResultSetHeader, Pool } from 'mysql2/promise';
import { IConcentradoRepository } from '../../ports/material/concentrado.interface';

export class ConcentradoRepository implements IConcentradoRepository {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    private getConn(conn?: PoolConnection): PoolConnection | Pool {
        return conn || this.db;
    }

    // Saneador de enteros para LIMIT/OFFSET (evita inyección; mysql2 no bindea bien LIMIT ?).
    private sanitInt(v: any, def: number, max = Number.MAX_SAFE_INTEGER): number {
        const n = parseInt(String(v ?? def), 10);
        if (isNaN(n) || n < 0) return def;
        return Math.min(n, max);
    }

    async obtenerEntradasParaProcesamiento(idEntradas: number[], conn?: PoolConnection): Promise<any[]> {
        if (idEntradas.length === 0) return [];
        const connection = this.getConn(conn);
        const inClause = idEntradas.map(() => '?').join(',');
        const query = `
            SELECT id, peso_llegada_planta, total_material_seco,
                   porcentaje_humedad,
                   COALESCE((
                     SELECT SUM(pm.toneladas_seco_aportadas)
                     FROM procesamiento_material pm WHERE pm.id_entrada = mpe.id
                   ), 0) AS ya_procesado_seco
            FROM material_planta_entrada mpe
            WHERE id IN (${inClause})
        `;
        const [rows] = await connection.execute<any[]>(query, idEntradas);
        return rows;
    }

    async iniciarLote(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO material_concentrado (
                codigo, fecha_inicio, estado,
                hizo_molienda, hizo_flotacion, hizo_relave, hizo_filtroprensa
            ) VALUES (?, ?, 'en_proceso', ?, ?, ?, ?)
        `;
        const values = [
            data.codigo || `LOTE-${Date.now()}`,
            data.fecha_inicio || new Date(),
            data.hizo_molienda ?? 0,
            data.hizo_flotacion ?? 0,
            data.hizo_relave ?? 0,
            data.hizo_filtroprensa ?? 0
        ];

        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async obtenerLotePorId(id: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT * FROM material_concentrado WHERE id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async agregarMaterialAlMolino(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO procesamiento_material (
                id_material_concentrado, id_entrada,
                toneladas_aportadas, toneladas_seco_aportadas
            ) VALUES (?, ?, ?, ?)
        `;
        const values = [
            data.id_material_concentrado,
            data.id_entrada,
            data.toneladas_aportadas,
            data.toneladas_seco_aportadas || data.toneladas_aportadas // Se asume o se calcula
        ];
        
        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async actualizarEstadoLote(id: number, estado: string, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `UPDATE material_concentrado SET estado = ? WHERE id = ?`,
            [estado, id]
        );
    }

    async actualizarLote(id: number, data: any, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        const setParams: string[] = [];
        const values: any[] = [];

        Object.keys(data).forEach(key => {
            setParams.push(`${key} = ?`);
            values.push(data[key]);
        });
        
        if (setParams.length === 0) return;
        
        values.push(id);
        const query = `UPDATE material_concentrado SET ${setParams.join(', ')} WHERE id = ?`;
        
        await connection.execute(query, values);
    }

    // Humedad del análisis de concentrado (tipo 2) del lote, si ya existe (para el cierre opcional).
    async obtenerHumedadAnalisisConcentrado(idLote: number, conn?: PoolConnection): Promise<number | null> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT porcentaje_humedad FROM Analisis
             WHERE id_material_concentrado = ? AND id_tipo_analisis = 2
             ORDER BY id DESC LIMIT 1`,
            [idLote]
        );
        const v = rows[0]?.porcentaje_humedad;
        return v === null || v === undefined ? null : Number(v);
    }

    async obtenerTotalSecoProcesado(idLote: number, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT COALESCE(SUM(toneladas_seco_aportadas), 0) AS total_seco FROM procesamiento_material WHERE id_material_concentrado = ?`,
            [idLote]
        );
        return rows[0].total_seco;
    }

    async obtenerTarifaMaquila(params: { fecha: string, hizo_molienda: number, hizo_flotacion: number, hizo_relave: number, hizo_filtroprensa: number }, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        // Regla de negocio: el relave (PROCESO_RELAVE = Molienda+Flotación+Relave+Filtroprensa)
        // y el proceso normal (PROCESO_NORMAL = Molienda+Flotación+Filtroprensa) YA incluyen la
        // filtroprensa; no se exige marcarla aparte. La filtroprensa sola solo aplica a
        // concentrado comprado / de alta humedad (SOLO_FILTROPRENSA).
        let codigo = '';
        if (params.hizo_relave) codigo = 'PROCESO_RELAVE';
        else if (params.hizo_molienda || params.hizo_flotacion) codigo = 'PROCESO_NORMAL';
        else if (params.hizo_filtroprensa) codigo = 'SOLO_FILTROPRENSA';
        else return 0;

        const [rows] = await connection.execute<any[]>(
            `SELECT valor FROM tarifas_proceso WHERE codigo = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?) ORDER BY fecha_desde DESC LIMIT 1`,
            [codigo, params.fecha, params.fecha]
        );
        return rows.length > 0 ? rows[0].valor : 0;
    }

    async crearInventarioConcentrado(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO Inventario_Lotes (id_material_concentrado, condicion_material, porcentaje_humedad, toneladas_iniciales, toneladas_disponibles, estado, ubicacion, fecha_ingreso) VALUES (?, 'Humedo', ?, ?, ?, 'almacenado', ?, NOW())`,
            [data.id_material_concentrado, data.porcentaje_humedad, data.toneladas_humedo, data.toneladas_humedo, data.ubicacion_canoa]
        );
        return result.insertId;
    }

    // Lote de inventario (Inventario_Lotes) del concentrado de un lote dado (el vigente).
    async obtenerInventarioLoteConcentrado(idLote: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id, toneladas_iniciales, toneladas_disponibles, estado
             FROM Inventario_Lotes
             WHERE id_material_concentrado = ? AND estado != 'agotado'
             ORDER BY id DESC LIMIT 1`,
            [idLote]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // Corrige el lote de inventario del concentrado (cuando aún no se ha despachado).
    async actualizarInventarioLoteConcentrado(idInvLote: number, data: any, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `UPDATE Inventario_Lotes
             SET toneladas_iniciales = ?, toneladas_disponibles = ?,
                 porcentaje_humedad = ?, condicion_material = ?
             WHERE id = ?`,
            [data.toneladas_humedo, data.toneladas_humedo, data.porcentaje_humedad, data.condicion_material, idInvLote]
        );
    }

    async insertarKardexMovimiento(data: any, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia) VALUES (?, NOW(), ?, ?, ?)`,
            [data.id_lote, data.tipo_movimiento, data.toneladas_movidas, data.destino_referencia]
        );
    }

    async distribuirMaquilaYConcentrado(idLote: number, total_seco: number, toneladas_seco: number, maquila_total: number, conn?: PoolConnection): Promise<void> {
        if (total_seco <= 0) return;
        const connection = this.getConn(conn);
        await connection.execute(
            `UPDATE procesamiento_material SET concentrado_proporcional = ROUND((toneladas_seco_aportadas / ?) * ?, 4), maquila_proporcional = ROUND((toneladas_seco_aportadas / ?) * ?, 2) WHERE id_material_concentrado = ?`,
            [total_seco, toneladas_seco, total_seco, maquila_total, idLote]
        );
    }

    // --- Lógica migrada de triggers de BD (inventario + kardex) --------------

    // Réplica FIEL de 'trg_after_insert_procesamiento_material' (#1).
    // OJO: el trigger real solo marca el lote crudo 'en_proceso' y registra
    // SALIDA_PROCESO en el kardex. NO descuenta toneladas_disponibles.
    // (El método espejo antiguo en TriggerLogicRepository SÍ descontaba: quedó desfasado.)
    async marcarCrudoEnProceso(idEntrada: number, idLoteConcentrado: number, toneladas: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id FROM Inventario_Lotes
             WHERE id_entrada = ? AND estado IN ('almacenado', 'en_proceso')
             ORDER BY id DESC LIMIT 1`,
            [idEntrada]
        );
        if (rows.length === 0) return;
        const idInvLote = rows[0].id;

        await connection.execute(
            `UPDATE Inventario_Lotes SET estado = 'en_proceso' WHERE id = ?`,
            [idInvLote]
        );
        await connection.execute(
            `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
             VALUES (?, NOW(), 'SALIDA_PROCESO', ?, ?)`,
            [idInvLote, toneladas, `Concentrado #${idLoteConcentrado}`]
        );
    }

    // Réplica de la parte de inventario de 'trg_after_update_material_concentrado' (#3):
    // marca 'agotado' los lotes crudos que alimentaron este lote de concentrado.
    async marcarCrudosAgotados(idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `UPDATE Inventario_Lotes il
             INNER JOIN procesamiento_material pm ON pm.id_entrada = il.id_entrada
             SET il.estado = 'agotado'
             WHERE pm.id_material_concentrado = ? AND il.id_entrada IS NOT NULL`,
            [idLote]
        );
    }

    // Réplica de la propagación de maquila a la MPE de 'trg_after_update_material_concentrado' (#3).
    // DEBE llamarse DESPUÉS de distribuirMaquilaYConcentrado (usa pm.maquila_proporcional).
    async propagarMaquilaAEntradas(idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `UPDATE material_planta_entrada mpe
             INNER JOIN procesamiento_material pm ON pm.id_entrada = mpe.id
             SET mpe.costo_maquila = pm.maquila_proporcional
             WHERE pm.id_material_concentrado = ?`,
            [idLote]
        );
    }

    // --- Edición / eliminación de lote y desvinculación de material ---

    async contarLineasViajeDeLote(idLote: number, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT COUNT(*) AS n FROM viaje_material WHERE id_material_concentrado = ?`,
            [idLote]
        );
        return Number(rows[0].n) || 0;
    }

    async obtenerProcesamientos(idLote: number, conn?: PoolConnection): Promise<any[]> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id, id_entrada, toneladas_aportadas FROM procesamiento_material WHERE id_material_concentrado = ?`,
            [idLote]
        );
        return rows;
    }

    async obtenerProcesamientoPorLoteYEntrada(idLote: number, idEntrada: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id, id_entrada, toneladas_aportadas FROM procesamiento_material WHERE id_material_concentrado = ? AND id_entrada = ?`,
            [idLote, idEntrada]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // procesamiento_material NO tiene trigger de DELETE: restauramos el inventario a mano.
    async restaurarInventarioDeEntrada(idEntrada: number, toneladas: number, idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id FROM Inventario_Lotes
             WHERE id_entrada = ? AND id_material_concentrado IS NULL
             ORDER BY id DESC LIMIT 1`,
            [idEntrada]
        );
        if (rows.length === 0) return;
        const idInvLote = rows[0].id;
        await connection.execute(
            `UPDATE Inventario_Lotes
             SET toneladas_disponibles = LEAST(toneladas_disponibles + ?, toneladas_iniciales),
                 estado = 'almacenado'
             WHERE id = ?`,
            [toneladas, idInvLote]
        );
        await connection.execute(
            `INSERT INTO Kardex_Movimientos (id_lote, fecha, tipo_movimiento, toneladas_movidas, destino_referencia)
             VALUES (?, NOW(), 'AJUSTE_MERMA', ?, ?)`,
            [idInvLote, toneladas, `Reverso proceso lote #${idLote}`]
        );
    }

    // Revierte la maquila propagada a las entradas (costo_maquila) al eliminar un lote cerrado.
    async revertirMaquilaEntradas(idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `UPDATE material_planta_entrada mpe
             INNER JOIN procesamiento_material pm ON pm.id_entrada = mpe.id
             SET mpe.costo_maquila = 0
             WHERE pm.id_material_concentrado = ?`,
            [idLote]
        );
    }

    // Elimina el/los lote(s) de Inventario_Lotes del concentrado + su kardex (al borrar un lote cerrado).
    async eliminarInventarioConcentradoDeLote(idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id FROM Inventario_Lotes WHERE id_material_concentrado = ?`,
            [idLote]
        );
        const ids = rows.map(r => r.id);
        if (ids.length > 0) {
            const inClause = ids.map(() => '?').join(',');
            await connection.execute(`DELETE FROM Kardex_Movimientos WHERE id_lote IN (${inClause})`, ids);
            await connection.execute(`DELETE FROM Inventario_Lotes WHERE id IN (${inClause})`, ids);
        }
    }

    async eliminarProcesamiento(idProcesamiento: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(`DELETE FROM procesamiento_material WHERE id = ?`, [idProcesamiento]);
    }

    async eliminarAnalisisDeLote(idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(`DELETE FROM Analisis WHERE id_material_concentrado = ?`, [idLote]);
    }

    async eliminarLote(idLote: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(`DELETE FROM material_concentrado WHERE id = ?`, [idLote]);
    }

    // --- LECTURA (listados / detalle / resumen) -------------------------------

    // Listar lotes de TODOS los estados con filtros. Incluye num_materiales y el tenor
    // del análisis de concentrado más reciente (au/ag por ton y gramos totales).
    async listarLotes(f: any = {}): Promise<any[]> {
        const where: string[] = ['1=1'];
        const params: any[] = [];
        if (f.codigo) { where.push('mc.codigo LIKE ?'); params.push(`%${f.codigo}%`); }
        if (f.estado) { where.push('mc.estado = ?'); params.push(f.estado); }
        if (f.desde)  { where.push('mc.fecha_inicio >= ?'); params.push(f.desde); }
        if (f.hasta)  { where.push('mc.fecha_inicio <= ?'); params.push(f.hasta); }
        const lim = this.sanitInt(f.limit, 1000, 5000);
        const off = this.sanitInt(f.offset, 0);
        const query = `
            SELECT
                mc.id, mc.codigo, mc.estado, mc.fecha_inicio, mc.fecha_fin,
                mc.hizo_molienda, mc.hizo_flotacion, mc.hizo_relave, mc.hizo_filtroprensa,
                mc.material_seco_procesado, mc.toneladas_humedo, mc.porcentaje_humedad,
                mc.toneladas_seco, mc.toneladas_disponibles, mc.ubicacion_canoa,
                mc.precio_maquila_por_ton, mc.maquila_total, mc.comentarios,
                (SELECT COUNT(*) FROM procesamiento_material pm WHERE pm.id_material_concentrado = mc.id) AS num_materiales,
                (SELECT COALESCE(SUM(pm.toneladas_seco_aportadas / NULLIF(e.total_material_seco, 0) * e.precio_total), 0)
                   FROM procesamiento_material pm
                   JOIN material_planta_entrada e ON e.id = pm.id_entrada
                  WHERE pm.id_material_concentrado = mc.id) AS precio_total_material,
                an.numero_analisis, an.au_gr_x_ton, an.ag_gr_x_ton, an.au_concentrado, an.ag_concentrado
            FROM material_concentrado mc
            LEFT JOIN (
                SELECT a.id, a.id_material_concentrado, a.numero_analisis,
                       a.au_gr_x_ton, a.ag_gr_x_ton, a.au_concentrado, a.ag_concentrado
                FROM Analisis a
                INNER JOIN (
                    SELECT id_material_concentrado, MAX(id) AS mx
                    FROM Analisis WHERE id_material_concentrado IS NOT NULL
                    GROUP BY id_material_concentrado
                ) last ON last.mx = a.id
            ) an ON an.id_material_concentrado = mc.id
            WHERE ${where.join(' AND ')}
            ORDER BY mc.id DESC
            LIMIT ${lim} OFFSET ${off}
        `;
        const [rows] = await this.db.execute<any[]>(query, params);
        return rows;
    }

    // Materiales (entradas) vinculados a un lote — para el detalle / editar lote.
    async obtenerMaterialesDeLote(idLote: number): Promise<any[]> {
        const query = `
            SELECT mpe.id, mpe.numero_volqueta, mi.nombre AS mina,
                   mpe.fecha_llegada, mpe.peso_llegada_planta, mpe.porcentaje_humedad,
                   mpe.total_material_seco, mpe.tenor,
                   pm.toneladas_aportadas, pm.toneladas_seco_aportadas,
                   pm.concentrado_proporcional, pm.maquila_proporcional,
                   mpe.costo_maquila,
                   mpe.precio_total, mpe.total_material
            FROM procesamiento_material pm
            JOIN material_planta_entrada mpe ON mpe.id = pm.id_entrada
            LEFT JOIN mina mi ON mi.id = mpe.id_mina
            WHERE pm.id_material_concentrado = ?
            ORDER BY mpe.fecha_llegada
        `;
        const [rows] = await this.db.execute<any[]>(query, [idLote]);
        return rows;
    }

    // Análisis del concentrado del lote (los que tienen id_material_concentrado = idLote).
    async obtenerAnalisisDeLote(idLote: number): Promise<any[]> {
        const query = `
            SELECT a.id, a.numero_analisis, a.toneladas_secas,
                   a.au_gr_x_ton, a.ag_gr_x_ton, a.au_concentrado, a.ag_concentrado,
                   a.porcentaje_humedad
            FROM Analisis a
            WHERE a.id_material_concentrado = ?
            ORDER BY a.id
        `;
        const [rows] = await this.db.execute<any[]>(query, [idLote]);
        return rows;
    }

    // Lista PLANA de materiales que están vinculados a algún lote (pestaña "Procesamiento material").
    async listarProcesamiento(f: any = {}): Promise<any[]> {
        const where: string[] = ['1=1'];
        const params: any[] = [];
        if (f.id_lote)     { where.push('pm.id_material_concentrado = ?'); params.push(Number(f.id_lote)); }
        if (f.codigo_lote) { where.push('mc.codigo LIKE ?'); params.push(`%${f.codigo_lote}%`); }
        if (f.id_mina)     { where.push('mpe.id_mina = ?'); params.push(Number(f.id_mina)); }
        if (f.desde)       { where.push('mpe.fecha_llegada >= ?'); params.push(f.desde); }
        if (f.hasta)       { where.push('mpe.fecha_llegada <= ?'); params.push(f.hasta); }
        if (f.estado_lote) { where.push('mc.estado = ?'); params.push(f.estado_lote); }
        const lim = this.sanitInt(f.limit, 1000, 5000);
        const off = this.sanitInt(f.offset, 0);
        const query = `
            SELECT mpe.id AS id_entrada, mc.codigo AS codigo_lote, mc.id AS id_lote,
                   mc.estado AS estado_lote, mpe.numero_volqueta, mi.nombre AS mina,
                   mpe.fecha_llegada, mpe.peso_llegada_planta, mpe.porcentaje_humedad,
                   mpe.total_material_seco, mpe.tenor
            FROM procesamiento_material pm
            JOIN material_planta_entrada mpe ON mpe.id = pm.id_entrada
            JOIN material_concentrado mc ON mc.id = pm.id_material_concentrado
            LEFT JOIN mina mi ON mi.id = mpe.id_mina
            WHERE ${where.join(' AND ')}
            ORDER BY mpe.fecha_llegada DESC
            LIMIT ${lim} OFFSET ${off}
        `;
        const [rows] = await this.db.execute<any[]>(query, params);
        return rows;
    }

    // Análisis de un conjunto de entradas (para embeber en la lista de procesamiento sin N+1).
    async obtenerAnalisisPorEntradas(idEntradas: number[]): Promise<any[]> {
        if (idEntradas.length === 0) return [];
        const inClause = idEntradas.map(() => '?').join(',');
        const query = `
            SELECT a.id_entrada, a.id, a.id_tipo_analisis, a.numero_analisis,
                   a.toneladas_secas, a.au_gr_x_ton, a.ag_gr_x_ton, a.au_concentrado
            FROM Analisis a
            WHERE a.id_entrada IN (${inClause})
            ORDER BY a.id_tipo_analisis, a.id
        `;
        const [rows] = await this.db.execute<any[]>(query, idEntradas);
        return rows;
    }

    // Conteo de lotes por estado + toneladas disponibles totales (KPIs de procesamiento).
    async resumenLotesPorEstado(): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(`
            SELECT estado, COUNT(*) AS n,
                   COALESCE(SUM(toneladas_disponibles),0) AS disponibles
            FROM material_concentrado
            GROUP BY estado
        `);
        return rows;
    }
}
