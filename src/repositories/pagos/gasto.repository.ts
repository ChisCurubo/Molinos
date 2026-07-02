import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import Database from '../../config/database.config';
import { TipoGastoOperativoSQL } from '../../models/pagos/sql/tipo_gasto_operativo.sql';
import { ITipoGastoOperativoRepository } from '../../ports/pagos/repository_port/gasto.repository.interface';

// --- Original: tipo_gasto_operativo ---
export class TipoGastoOperativoRepository implements ITipoGastoOperativoRepository {
    async create(data: Omit<TipoGastoOperativoSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Gasto_Operativo (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoGastoOperativoSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tipos_Gasto_Operativo WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoGastoOperativoSQL;
    }

    async update(id: number, data: Partial<TipoGastoOperativoSQL>): Promise<boolean> {
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
        
        const query = `UPDATE Tipos_Gasto_Operativo SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Tipos_Gasto_Operativo WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoGastoOperativoSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tipos_Gasto_Operativo');
        return rows as TipoGastoOperativoSQL[];
    }
}