import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CuentasPorPagarRepositoryInterface } from '../../ports/pagos/repository_port/cxp.repository.interface';
import { CuentaPorPagarSQL } from '../../models/pagos/sql/cuenta_por_pagar.sql';
import Database from '../../config/database.config';
import { CategoriaCxpSQL } from '../../models/pagos/sql/categoria_cxp.sql';
import { ICategoriaCxPRepository } from '../../ports/pagos/repository_port/cxp.repository.interface';

// --- Original: cuentas_por_pagar ---
export class MySQLCuentasPorPagarRepo implements CuentasPorPagarRepositoryInterface {
    private pool: Pool;

    constructor() {
        this.pool = Database.getInstance();
    }

    async create(cuenta: Partial<CuentaPorPagarSQL>): Promise<CuentaPorPagarSQL> {
        const query = `INSERT INTO Cuentas_Por_Pagar 
            (id_categoria, concepto, id_proveedor, id_empleado, id_minero, id_dueno_volqueta, valor_total, valor_pagado, estado, fecha_limite) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values: any[] = [
            cuenta.id_categoria, cuenta.concepto, cuenta.id_proveedor || null, 
            cuenta.id_empleado || null, cuenta.id_minero || null, 
            cuenta.id_dueno_volqueta || null, cuenta.valor_total, 
            cuenta.valor_pagado || 0, cuenta.estado || 'pendiente', 
            cuenta.fecha_limite || null
        ];
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return { id: result.insertId, ...cuenta } as CuentaPorPagarSQL;
    }

    async getById(id: number): Promise<CuentaPorPagarSQL | null> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM Cuentas_Por_Pagar WHERE id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as CuentaPorPagarSQL) : null;
    }

    async listAll(): Promise<CuentaPorPagarSQL[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM Cuentas_Por_Pagar ORDER BY created_at DESC`
        );
        return rows as CuentaPorPagarSQL[];
    }

    async listByEstado(estado: string): Promise<CuentaPorPagarSQL[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM Cuentas_Por_Pagar WHERE estado = ? ORDER BY created_at DESC`,
            [estado]
        );
        return rows as CuentaPorPagarSQL[];
    }

    async update(id: number, cuenta: Partial<CuentaPorPagarSQL>): Promise<boolean> {
        const query = `UPDATE Cuentas_Por_Pagar SET valor_pagado = ?, estado = ? WHERE id = ?`;
        const values: any[] = [cuenta.valor_pagado, cuenta.estado, id];
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }
}

// --- Original: categoria_cxp ---
export class CategoriaCxPRepository implements ICategoriaCxPRepository {
    async create(data: Omit<CategoriaCxpSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Categorias_CxP (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CategoriaCxpSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxP WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as CategoriaCxpSQL;
    }

    async update(id: number, data: Partial<CategoriaCxpSQL>): Promise<boolean> {
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
        
        const query = `UPDATE Categorias_CxP SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Categorias_CxP WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CategoriaCxpSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxP');
        return rows as CategoriaCxpSQL[];
    }
}