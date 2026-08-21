import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ExcedenteSQL, UpsertExcedenteDTO } from '../../models/material/sql/excedente.sql';
import { IExcedenteRepository } from '../../ports/material/excedente.interface';

export class ExcedenteRepository implements IExcedenteRepository {
    constructor(private db: Pool) {}

    private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
        return conn || this.db;
    }

    // Excedente de la entrada. saldo_por_distribuir es columna calculada (STORED) en la BD.
    async obtenerPorEntrada(id_entrada: number, conn?: PoolConnection): Promise<ExcedenteSQL | null> {
        const connection = this.getConn(conn);
        const query = `
            SELECT id, id_entrada, valor_excedente, monto_distribuido, saldo_por_distribuir,
                   fecha_calculo, concepto, estado_distribucion, notas, created_at, updated_at
            FROM excedente
            WHERE id_entrada = ?
            ORDER BY id DESC
            LIMIT 1
        `;
        const [rows] = await connection.execute<RowDataPacket[]>(query, [id_entrada]);
        return rows.length > 0 ? (rows[0] as ExcedenteSQL) : null;
    }

    async insertar(id_entrada: number, data: UpsertExcedenteDTO, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO excedente (id_entrada, valor_excedente, fecha_calculo, concepto, notas)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await connection.execute<ResultSetHeader>(query, [
            id_entrada,
            data.valor_excedente ?? 0,
            data.fecha_calculo ?? new Date().toISOString().split('T')[0],
            data.concepto ?? null,
            data.notas ?? null
        ]);
        return result.insertId;
    }

    // No toca monto_distribuido ni estado_distribucion (los maneja el flujo de distribución/CxP).
    async actualizar(id: number, data: UpsertExcedenteDTO, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        const fields: string[] = ['valor_excedente = ?'];
        const values: any[] = [data.valor_excedente ?? 0];
        if (data.fecha_calculo !== undefined) { fields.push('fecha_calculo = ?'); values.push(data.fecha_calculo); }
        if (data.concepto !== undefined) { fields.push('concepto = ?'); values.push(data.concepto); }
        if (data.notas !== undefined) { fields.push('notas = ?'); values.push(data.notas); }
        values.push(id);
        await connection.execute(`UPDATE excedente SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    async eliminar(id: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(`DELETE FROM excedente WHERE id = ?`, [id]);
    }
}
