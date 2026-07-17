import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { TurnoSQL } from '../../models/nomina/sql/turno.sql';
import { ITurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { TipoTurnoSQL } from '../../models/nomina/sql/tipo_turno.sql';
import { ITipoTurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';

// --- Original: turno ---
export class TurnoRepository implements ITurnoRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<TurnoSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Turnos (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TurnoSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Turnos WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TurnoSQL;
    }

    async update(id: number, data: Partial<TurnoSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Turnos SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Turnos WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TurnoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Turnos');
        return rows as TurnoSQL[];
    }

    async listByEmpleadoAndMonth(id_empleado: number, mes: number, anio: number): Promise<TurnoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM Turnos WHERE id_empleado = ? AND MONTH(fecha) = ? AND YEAR(fecha) = ? ORDER BY fecha DESC',
            [id_empleado, mes, anio]
        );
        return rows as TurnoSQL[];
    }

    async listByEmpleadoAndQuincena(id_empleado: number, quincena: number, mes: number, anio: number): Promise<TurnoSQL[]> {
        let dayCondition = quincena === 1 ? 'DAY(fecha) <= 15' : 'DAY(fecha) > 15';
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Turnos WHERE id_empleado = ? AND MONTH(fecha) = ? AND YEAR(fecha) = ? AND ${dayCondition} ORDER BY fecha DESC`,
            [id_empleado, mes, anio]
        );
        return rows as TurnoSQL[];
    }

    async listByMonth(mes: number, anio: number): Promise<TurnoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM Turnos WHERE MONTH(fecha) = ? AND YEAR(fecha) = ? ORDER BY fecha DESC',
            [mes, anio]
        );
        return rows as TurnoSQL[];
    }

    async listByQuincena(quincena: number, mes: number, anio: number): Promise<TurnoSQL[]> {
        let dayCondition = quincena === 1 ? 'DAY(fecha) <= 15' : 'DAY(fecha) > 15';
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Turnos WHERE MONTH(fecha) = ? AND YEAR(fecha) = ? AND ${dayCondition} ORDER BY fecha DESC`,
            [mes, anio]
        );
        return rows as TurnoSQL[];
    }
}

// --- Original: tipo_turno ---
export class TipoTurnoRepository implements ITipoTurnoRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<TipoTurnoSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Turno (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoTurnoSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipos_Turno WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoTurnoSQL;
    }

    async update(id: number, data: Partial<TipoTurnoSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Tipos_Turno SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Tipos_Turno WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoTurnoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipos_Turno');
        return rows as TipoTurnoSQL[];
    }
}