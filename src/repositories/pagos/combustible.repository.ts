import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
    ICombustibleRepository,
    CrearCombustibleDTO,
    CombustibleRow,
    FleteConAcpmRow
} from '../../ports/pagos/repository_port/combustible.repository.interface';

export class CombustibleRepository implements ICombustibleRepository {
    constructor(private db: Pool) {}

    private getConn(conn?: PoolConnection): PoolConnection | Pool {
        return conn || this.db;
    }

    // SELECT base con los nombres de origen (gasolinera/dueño/placa) para listados y lecturas.
    private readonly SELECT_BASE = `
        SELECT
            c.id, c.id_gasolinera, pr.nombre AS gasolinera, c.tipo_consumo,
            c.id_dueno_volqueta, dv.nombre AS dueno_volqueta,
            c.id_vehiculo, vv.placa,
            c.id_planta, c.id_material_planta_entrada, c.id_agua,
            c.fecha, c.descripcion, c.valor, c.comprobante_url, c.created_at
        FROM combustible c
        LEFT JOIN proveedores pr     ON pr.id = c.id_gasolinera
        LEFT JOIN dueno_volqueta dv  ON dv.id = c.id_dueno_volqueta
        LEFT JOIN volqueta_vehiculo vv ON vv.id = c.id_vehiculo
    `;

    async crear(data: CrearCombustibleDTO, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO combustible (
                id_gasolinera, tipo_consumo, id_dueno_volqueta, id_vehiculo, id_planta,
                id_material_planta_entrada, id_agua, fecha, descripcion, valor, comprobante_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_gasolinera ?? null,
            data.tipo_consumo || 'vehiculo',
            data.id_dueno_volqueta ?? null,
            data.id_vehiculo ?? null,
            data.id_planta ?? null,
            data.id_material_planta_entrada ?? null,
            data.id_agua ?? null,
            data.fecha,
            data.descripcion ?? null,
            data.valor,
            data.comprobante_url ?? null
        ];
        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async actualizarValor(id: number, valor: number, comprobante_url: string | null | undefined, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        if (comprobante_url !== undefined) {
            await connection.execute(
                'UPDATE combustible SET valor = ?, comprobante_url = ? WHERE id = ?',
                [valor, comprobante_url ?? null, id]
            );
        } else {
            await connection.execute('UPDATE combustible SET valor = ? WHERE id = ?', [valor, id]);
        }
    }

    async eliminarPorEntrada(idEntrada: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute('DELETE FROM combustible WHERE id_material_planta_entrada = ?', [idEntrada]);
    }

    async eliminarPorAgua(idAgua: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute('DELETE FROM combustible WHERE id_agua = ?', [idAgua]);
    }

    async obtenerAcpmDeEntrada(idEntrada: number, conn?: PoolConnection): Promise<CombustibleRow | null> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE c.id_material_planta_entrada = ? ORDER BY c.id LIMIT 1`,
            [idEntrada]
        );
        return rows.length > 0 ? (rows[0] as CombustibleRow) : null;
    }

    async obtenerAcpmDeAgua(idAgua: number, conn?: PoolConnection): Promise<CombustibleRow | null> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE c.id_agua = ? ORDER BY c.id LIMIT 1`,
            [idAgua]
        );
        return rows.length > 0 ? (rows[0] as CombustibleRow) : null;
    }

    async sumaPorEntrada(idEntrada: number, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT COALESCE(SUM(valor), 0) AS total FROM combustible WHERE id_material_planta_entrada = ?',
            [idEntrada]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async sumaPorAgua(idAgua: number, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT COALESCE(SUM(valor), 0) AS total FROM combustible WHERE id_agua = ?',
            [idAgua]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async fletesConAcpmPorDueno(idDueno: number, conn?: PoolConnection): Promise<FleteConAcpmRow[]> {
        const connection = this.getConn(conn);
        const query = `
            SELECT
                mpe.id AS id_entrada, mpe.fecha_llegada, mpe.numero_volqueta,
                vv.placa, mpe.costo_volqueta,
                COALESCE((
                    SELECT SUM(c.valor) FROM combustible c
                    WHERE c.id_material_planta_entrada = mpe.id
                ), 0) AS acpm
            FROM material_planta_entrada mpe
            JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
            WHERE vv.id_dueno_volqueta = ? AND mpe.estado != 'cancelada'
            ORDER BY mpe.fecha_llegada ASC, mpe.id ASC
        `;
        const [rows] = await connection.execute<RowDataPacket[]>(query, [idDueno]);
        return rows as FleteConAcpmRow[];
    }

    async listar(filtros: { desde?: string; hasta?: string; id_gasolinera?: number; id_dueno_volqueta?: number; tipo_consumo?: string }): Promise<CombustibleRow[]> {
        const where: string[] = ['1 = 1'];
        const params: any[] = [];
        if (filtros.desde && filtros.hasta) { where.push('c.fecha BETWEEN ? AND ?'); params.push(filtros.desde, filtros.hasta); }
        if (filtros.id_gasolinera) { where.push('c.id_gasolinera = ?'); params.push(filtros.id_gasolinera); }
        if (filtros.id_dueno_volqueta) { where.push('c.id_dueno_volqueta = ?'); params.push(filtros.id_dueno_volqueta); }
        if (filtros.tipo_consumo) { where.push('c.tipo_consumo = ?'); params.push(filtros.tipo_consumo); }

        const [rows] = await this.db.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE ${where.join(' AND ')} ORDER BY c.fecha DESC, c.id DESC`,
            params
        );
        return rows as CombustibleRow[];
    }

    async obtenerPorId(id: number): Promise<CombustibleRow | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE c.id = ?`,
            [id]
        );
        return rows.length > 0 ? (rows[0] as CombustibleRow) : null;
    }
}
