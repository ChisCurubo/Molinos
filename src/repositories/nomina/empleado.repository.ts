import { RowDataPacket, ResultSetHeader, Pool, PoolConnection } from 'mysql2/promise';
import Database from '../../config/database.config';
import { EmpleadoSQL } from '../../models/nomina/sql/empleado.sql';
import { IEmpleadoRepository } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { PrestamoEmpleadoRepositoryInterface } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { PrestamoEmpleadoSQL } from '../../models/nomina/sql/prestamo_empleado.sql';

// --- Original: empleado ---
export class EmpleadoRepository implements IEmpleadoRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<EmpleadoSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Empleados (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<EmpleadoSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Empleados WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as EmpleadoSQL;
    }

    async update(id: number, data: Partial<EmpleadoSQL>): Promise<boolean> {
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
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Empleados WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<EmpleadoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Empleados');
        return rows as EmpleadoSQL[];
    }
}

// --- Original: prestamo_empleado ---
export class PrestamoEmpleadoRepository implements PrestamoEmpleadoRepositoryInterface {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async create(prestamo: Partial<PrestamoEmpleadoSQL>, conn?: PoolConnection): Promise<number> {
        const query = `
            INSERT INTO Prestamos_Empleados (id_empleado, fecha, valor, cuotas, concepto)
            VALUES (?, ?, ?, ?, ?)
        `;
        const values: any[] = [
            prestamo.id_empleado,
            prestamo.fecha || new Date(),
            prestamo.valor,
            prestamo.cuotas || 1,
            prestamo.concepto || null
        ];

        const [result] = await this.conn(conn).query<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async getById(id: number, conn?: PoolConnection): Promise<PrestamoEmpleadoSQL | null> {
        const query = `SELECT * FROM Prestamos_Empleados WHERE id = ?`;
        const [rows] = await this.conn(conn).query<RowDataPacket[]>(query, [id]);

        if (rows.length === 0) return null;
        return rows[0] as PrestamoEmpleadoSQL;
    }

    async listByEmpleadoSQL(id_empleado: number): Promise<PrestamoEmpleadoSQL[]> {
        const query = `SELECT * FROM Prestamos_Empleados WHERE id_empleado = ? ORDER BY fecha DESC`;
        const [rows] = await this.db.query<RowDataPacket[]>(query, [id_empleado]);
        return rows as PrestamoEmpleadoSQL[];
    }

    async update(id: number, data: Partial<PrestamoEmpleadoSQL>): Promise<boolean> {
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

        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Prestamos_Empleados SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Prestamos_Empleados WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async listAll(filtros?: { id_empleado?: number }): Promise<PrestamoEmpleadoSQL[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros?.id_empleado) { where.push('id_empleado = ?'); params.push(filtros.id_empleado); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Prestamos_Empleados ${whereSql} ORDER BY fecha DESC`,
            params
        );
        return rows as PrestamoEmpleadoSQL[];
    }

    // --- Enganche CxP (egreso) / CxC (cobro vía descuento_nomina) ---

    async crearCuentaPagar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, id_empleado, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Préstamo empleado' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_empleado, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async crearRelacionPagar(idCxp: number, idPrestamo: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion (id_cuenta_pagar, id_prestamo_emp, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, idPrestamo, monto, concepto]
        );
    }

    async crearCuentaCobrar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Cobrar (id_categoria, concepto, id_empleado, valor_total, valor_cobrado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxC WHERE nombre='Préstamo empleado' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_empleado, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async crearRelacionCobrar(idCxc: number, idPrestamo: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Cobrar_Relacion (id_cxc, id_prestamo_emp, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxc, idPrestamo, monto, concepto]
        );
    }

    async cxcDePrestamo(idPrestamo: number, conn?: PoolConnection): Promise<any | null> {
        const [rows] = await this.conn(conn).execute<RowDataPacket[]>(
            `SELECT cxc.*
             FROM Cuentas_Por_Cobrar cxc
             JOIN Cuentas_Por_Cobrar_Relacion r ON r.id_cxc = cxc.id
             WHERE r.id_prestamo_emp = ?
             LIMIT 1`,
            [idPrestamo]
        );
        return rows.length ? rows[0] : null;
    }

    async insertarAbonoCxC(abono: { id_cxc: number; fecha_cobro: string; valor: number; metodo?: string; observaciones?: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxC (id_cxc, fecha_cobro, valor, metodo, observaciones)
             VALUES (?, ?, ?, ?, ?)`,
            [abono.id_cxc, abono.fecha_cobro, abono.valor, abono.metodo || 'descuento_nomina', abono.observaciones ?? null]
        );
        return result.insertId;
    }

    async recalcularCuentaCobrar(idCxc: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Cuentas_Por_Cobrar cxc
             SET valor_cobrado = (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxC WHERE id_cxc = cxc.id),
                 estado = CASE
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxC WHERE id_cxc = cxc.id) <= 0 THEN 'pendiente'
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxC WHERE id_cxc = cxc.id) >= cxc.valor_total THEN 'cobrado'
                    ELSE 'parcial' END
             WHERE cxc.id = ? AND cxc.estado != 'anulado'`,
            [idCxc]
        );
    }
}