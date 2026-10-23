import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { TipoAlquilerSQL } from '../../models/pagos/sql/tipo_alquiler.sql';
import { AlquilerSQL } from '../../models/pagos/sql/alquiler.sql';
import { ITipoAlquilerRepository, IAlquilerRepository } from '../../ports/pagos/repository_port/alquiler.repository.interface';

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

// --- Alquiler (contrato real). Borrado lógico: el registro nunca se elimina (deleted_at). ---
export class AlquilerRepository implements IAlquilerRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<AlquilerSQL, 'id' | 'created_at' | 'deleted_at'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');

        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Alquileres (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<AlquilerSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Alquileres WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as AlquilerSQL;
    }

    async update(id: number, data: Partial<AlquilerSQL>): Promise<boolean> {
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

        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Alquileres SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>(
            'UPDATE Alquileres SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
            [id]
        );
        return result.affectedRows > 0;
    }

    async list(filtros?: { id_contrato?: number; mes?: number; anio?: number }): Promise<AlquilerSQL[]> {
        const where: string[] = ['deleted_at IS NULL'];
        const params: any[] = [];
        if (filtros?.id_contrato) { where.push('id_contrato = ?'); params.push(filtros.id_contrato); }
        if (filtros?.mes) { where.push('MONTH(fecha_inicio) = ?'); params.push(filtros.mes); }
        if (filtros?.anio) { where.push('YEAR(fecha_inicio) = ?'); params.push(filtros.anio); }

        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Alquileres WHERE ${where.join(' AND ')} ORDER BY fecha_inicio DESC, id DESC`,
            params
        );
        return rows as AlquilerSQL[];
    }
}