import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import Database from '../../../config/database.config';
import { DuenoVolquetaSQL } from '../../../models/material/sql/dueno_volqueta.sql';
import { IDuenoVolquetaRepository } from '../../ports/material/repository_port/volqueta.repository.interface';

// --- Original: dueno_volqueta ---
export class DuenoVolquetaRepository implements IDuenoVolquetaRepository {
    async create(data: Omit<DuenoVolquetaSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Dueno_Volqueta (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<DuenoVolquetaSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Dueno_Volqueta WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as DuenoVolquetaSQL;
    }

    async update(id: number, data: Partial<DuenoVolquetaSQL>): Promise<boolean> {
        const db = Database.getInstance();
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
        
        const query = `UPDATE Dueno_Volqueta SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Dueno_Volqueta WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<DuenoVolquetaSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Dueno_Volqueta');
        return rows as DuenoVolquetaSQL[];
    }
}
