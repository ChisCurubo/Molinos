import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { TipoAlquilerSQL } from '../../models/pagos/sql/tipo_alquiler.sql';
import { ITipoAlquilerRepository } from '../../ports/pagos/repository_port/alquiler.repository.interface';

// --- Original: tipo_alquiler ---
export class TipoAlquilerRepository implements ITipoAlquilerRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<TipoAlquilerSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Alquiler (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoAlquilerSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipos_Alquiler WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoAlquilerSQL;
    }

    async update(id: number, data: Partial<TipoAlquilerSQL>): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (fields.length === 0) return false;
        values.push(id);
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Tipos_Alquiler SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Tipos_Alquiler WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoAlquilerSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipos_Alquiler');
        return rows as TipoAlquilerSQL[];
    }
}