import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { CategoriaProveedorSQL } from '../../models/pagos/sql/categoria_proveedor.sql';
import { ICategoriaProveedorRepository } from '../../ports/pagos/repository_port/proveedor.repository.interface';

// --- Original: categoria_proveedor ---
export class CategoriaProveedorRepository implements ICategoriaProveedorRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<CategoriaProveedorSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Categorias_Proveedor (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CategoriaProveedorSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_Proveedor WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as CategoriaProveedorSQL;
    }

    async update(id: number, data: Partial<CategoriaProveedorSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Categorias_Proveedor SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Categorias_Proveedor WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CategoriaProveedorSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_Proveedor');
        return rows as CategoriaProveedorSQL[];
    }
}