import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { TipoGastoOperativoSQL } from '../../models/pagos/sql/tipo_gasto_operativo.sql';
import { ITipoGastoOperativoRepository } from '../../ports/pagos/repository_port/gasto.repository.interface';

// --- Original: tipo_gasto_operativo ---
export class TipoGastoOperativoRepository implements ITipoGastoOperativoRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<TipoGastoOperativoSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Gasto_Operativo (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoGastoOperativoSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipos_Gasto_Operativo WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoGastoOperativoSQL;
    }

    async update(id: number, data: Partial<TipoGastoOperativoSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Tipos_Gasto_Operativo SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Tipos_Gasto_Operativo WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoGastoOperativoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipos_Gasto_Operativo');
        return rows as TipoGastoOperativoSQL[];
    }
}