import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { PlantaSQL } from '../../models/nomina/sql/planta.sql';
import { IPlantaRepository } from '../../ports/nomina/repository_port/planta.repository.interface';

// --- Original: planta ---
export class PlantaRepository implements IPlantaRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<PlantaSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Planta (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<PlantaSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Planta WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as PlantaSQL;
    }

    async update(id: number, data: Partial<PlantaSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Planta SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Planta WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<PlantaSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Planta');
        return rows as PlantaSQL[];
    }
}