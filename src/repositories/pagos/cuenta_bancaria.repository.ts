import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ICuentaBancariaRepository } from '../../ports/pagos/repository_port/cuenta_bancaria.repository.interface';
import { CuentaBancariaSQL } from '../../models/pagos/sql/cuenta_bancaria.sql';

import { ident } from '../../helpers/sql.helper';
export class CuentaBancariaRepository implements ICuentaBancariaRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<CuentaBancariaSQL, 'id' | 'created_at'>): Promise<number> {
        const [result] = await this.db.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Bancarias (nombre, banco, numero_cuenta, tipo_cuenta, propietario, id_empleado, exento_4x1000, activa)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.nombre, data.banco ?? null, data.numero_cuenta ?? null, data.tipo_cuenta ?? null,
             data.propietario, data.id_empleado ?? null, !!data.exento_4x1000, data.activa ?? true]
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CuentaBancariaSQL | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM Cuentas_Bancarias WHERE id = ?`, [id]);
        return rows.length ? (rows[0] as CuentaBancariaSQL) : null;
    }

    async update(id: number, data: Partial<CuentaBancariaSQL>): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && key !== 'id') { fields.push(`${ident(key)} = ?`); values.push(value); }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const [result] = await this.db.execute<ResultSetHeader>(
            `UPDATE Cuentas_Bancarias SET ${fields.join(', ')} WHERE id = ?`, values
        );
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.execute<ResultSetHeader>(`DELETE FROM Cuentas_Bancarias WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CuentaBancariaSQL[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM Cuentas_Bancarias ORDER BY nombre`);
        return rows as CuentaBancariaSQL[];
    }

    async getSaldo(id: number): Promise<any | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM v_saldo_cuentas WHERE id_cuenta_bancaria = ?`, [id]);
        return rows.length ? rows[0] : null;
    }

    async listarSaldos(): Promise<any[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM v_saldo_cuentas ORDER BY nombre`);
        return rows;
    }
}
