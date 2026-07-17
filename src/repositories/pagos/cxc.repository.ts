import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';
import { ICategoriaCxCRepository } from '../../ports/pagos/repository_port/cxc.repository.interface';

// --- Original: categoria_cxc ---
export class CategoriaCxCRepository implements ICategoriaCxCRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<CategoriaCxcSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Categorias_CxC (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CategoriaCxcSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxC WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as CategoriaCxcSQL;
    }

    async update(id: number, data: Partial<CategoriaCxcSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Categorias_CxC SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Categorias_CxC WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CategoriaCxcSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxC');
        return rows as CategoriaCxcSQL[];
    }
}