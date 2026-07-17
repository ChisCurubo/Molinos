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
                codigo, fecha_inicio, estado
            ) VALUES (?, ?, 'en_proceso')
        `;
        const values = [
            data.codigo || `LOTE-${Date.now()}`,
            data.fecha_inicio || new Date()
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
        let codigo = '';
        if (params.hizo_relave && params.hizo_filtroprensa) codigo = 'PROCESO_RELAVE';
        else if ((params.hizo_molienda || params.hizo_flotacion) && params.hizo_filtroprensa) codigo = 'PROCESO_NORMAL';
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
}
