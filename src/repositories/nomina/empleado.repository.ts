import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import Database from '../../config/database.config';
import { EmpleadoSQL } from '../../models/nomina/sql/empleado.sql';
import { IEmpleadoRepository } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { PrestamoEmpleadoRepositoryInterface } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { PrestamoEmpleadoSQL } from '../../models/nomina/sql/prestamo_empleado.sql';

// --- Original: empleado ---
export class EmpleadoRepository implements IEmpleadoRepository {
    async create(data: Omit<EmpleadoSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Empleados (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<EmpleadoSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Empleados WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as EmpleadoSQL;
    }

    async update(id: number, data: Partial<EmpleadoSQL>): Promise<boolean> {
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
        
        const query = `UPDATE Empleados SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Empleados WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<EmpleadoSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Empleados');
        return rows as EmpleadoSQL[];
    }
}

// --- Original: prestamo_empleado ---
export class MySQLPrestamoEmpleadoRepo implements PrestamoEmpleadoRepositoryInterface {
    private pool: Pool;

    constructor() {
        this.pool = Database.getInstance();
    }

    async create(prestamo: Partial<PrestamoEmpleadoSQL>): Promise<number> {
        const query = `
            INSERT INTO Prestamos_Empleados (id_empleado, fecha, valor, concepto)
            VALUES (?, ?, ?, ?)
        `;
        const values: any[] = [
            prestamo.id_empleado,
            prestamo.fecha || new Date(),
            prestamo.valor,
            prestamo.concepto || null
        ];

        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async getById(id: number): Promise<PrestamoEmpleadoSQL | null> {
        const query = `SELECT * FROM Prestamos_Empleados WHERE id = ?`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
        
        if (rows.length === 0) return null;
        return rows[0] as PrestamoEmpleadoSQL;
    }

    async listByEmpleadoSQL(id_empleado: number): Promise<PrestamoEmpleadoSQL[]> {
        const query = `SELECT * FROM Prestamos_Empleados WHERE id_empleado = ? ORDER BY fecha DESC`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id_empleado]);
        return rows as PrestamoEmpleadoSQL[];
    }
}