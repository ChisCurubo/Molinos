import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { IContratoAlquilerRepository } from '../../ports/pagos/repository_port/contrato_alquiler.repository.interface';
import { ContratoAlquilerSQL } from '../../models/pagos/sql/contrato_alquiler.sql';
import { AlquilerSQL } from '../../models/pagos/sql/alquiler.sql';

export class ContratoAlquilerRepository implements IContratoAlquilerRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async create(data: Omit<ContratoAlquilerSQL, 'id' | 'created_at' | 'deleted_at'>, conn: PoolConnection): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');

        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Contratos_Alquiler (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number, conn?: PoolConnection): Promise<ContratoAlquilerSQL | null> {
        const [rows] = await this.conn(conn).execute<RowDataPacket[]>('SELECT * FROM Contratos_Alquiler WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as ContratoAlquilerSQL;
    }

    async update(id: number, data: Partial<ContratoAlquilerSQL>): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) { fields.push(`${key} = ?`); values.push(value); }
        }
        if (fields.length === 0) return false;
        values.push(id);

        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Contratos_Alquiler SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>(
            'UPDATE Contratos_Alquiler SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
            [id]
        );
        return result.affectedRows > 0;
    }

    async list(): Promise<ContratoAlquilerSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Contratos_Alquiler WHERE deleted_at IS NULL ORDER BY fecha_inicio DESC, id DESC');
        return rows as ContratoAlquilerSQL[];
    }

    async crearAlquilerMensual(data: Omit<AlquilerSQL, 'id' | 'created_at' | 'deleted_at'>, conn: PoolConnection): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');

        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Alquileres (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async mesesDeContrato(idContrato: number): Promise<AlquilerSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM Alquileres WHERE id_contrato = ? ORDER BY fecha_inicio ASC',
            [idContrato]
        );
        return rows as AlquilerSQL[];
    }
}
