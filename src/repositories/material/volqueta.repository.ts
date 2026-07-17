import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { DuenoVolquetaSQL } from '../../models/material/sql/dueno_volqueta.sql';
import { IDuenoVolquetaRepository } from '../../ports/material/repository_port/volqueta.repository.interface';
import { CacheService } from '../../services/cache/cache.service';

// --- Original: dueno_volqueta ---
export class DuenoVolquetaRepository implements IDuenoVolquetaRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<DuenoVolquetaSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Dueno_Volqueta (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        
        CacheService.getInstance().addDueno({ id: result.insertId, ...data });
        
        return result.insertId;
    }

    async getById(id: number): Promise<DuenoVolquetaSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Dueno_Volqueta WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as DuenoVolquetaSQL;
    }

    async update(id: number, data: Partial<DuenoVolquetaSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Dueno_Volqueta SET ${fields.join(', ')} WHERE id = ?`, values);
        
        if (result.affectedRows > 0) {
            // Retrieve updated row for cache (since data is partial)
            const updated = await this.getById(id);
            if (updated) {
                CacheService.getInstance().updateDueno(updated);
            }
        }
        
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Dueno_Volqueta WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            CacheService.getInstance().deleteDueno(id);
        }
        return result.affectedRows > 0;
    }

    async list(): Promise<DuenoVolquetaSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Dueno_Volqueta');
        return rows as DuenoVolquetaSQL[];
    }
}
