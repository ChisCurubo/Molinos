import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import Database from '../../config/database.config';
import { TurnoSQL } from '../../models/nomina/sql/turno.sql';
import { ITurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { TipoTurnoSQL } from '../../models/nomina/sql/tipo_turno.sql';
import { ITipoTurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';

// --- Original: turno ---
export class TurnoRepository implements ITurnoRepository {
    async create(data: Omit<TurnoSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Turnos (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TurnoSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Turnos WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TurnoSQL;
    }

    async update(id: number, data: Partial<TurnoSQL>): Promise<boolean> {
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
        
        const query = `UPDATE Turnos SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Turnos WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TurnoSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Turnos');
        return rows as TurnoSQL[];
    }
}

// --- Original: tipo_turno ---
export class TipoTurnoRepository implements ITipoTurnoRepository {
    async create(data: Omit<TipoTurnoSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Turno (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoTurnoSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tipos_Turno WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoTurnoSQL;
    }

    async update(id: number, data: Partial<TipoTurnoSQL>): Promise<boolean> {
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
        
        const query = `UPDATE Tipos_Turno SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Tipos_Turno WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoTurnoSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tipos_Turno');
        return rows as TipoTurnoSQL[];
    }
}