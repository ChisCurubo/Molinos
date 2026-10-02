import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { IBonoEmpleadoRepository } from '../../ports/nomina/repository_port/bono_empleado.repository.interface';
import { BonoEmpleadoSQL } from '../../models/nomina/sql/bono_empleado.sql';

export class BonoEmpleadoRepository implements IBonoEmpleadoRepository {
    constructor(private db: Pool) {}

    async crear(data: { id_empleado: number; fecha: string; concepto: string; valor: number }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Bonos_Empleado (id_empleado, fecha, concepto, valor) VALUES (?, ?, ?, ?)`,
            [data.id_empleado, data.fecha, data.concepto, data.valor]
        );
        return result.insertId;
    }

    async confirmarConCuentaPagar(id: number, id_cuenta_pagar: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Bonos_Empleado SET id_cuenta_pagar = ? WHERE id = ?`, [id_cuenta_pagar, id]);
    }

    async obtenerPorId(id: number, conn?: PoolConnection): Promise<BonoEmpleadoSQL | null> {
        const [rows] = await (conn || this.db).execute<RowDataPacket[]>(`SELECT * FROM Bonos_Empleado WHERE id = ?`, [id]);
        return rows.length ? (rows[0] as BonoEmpleadoSQL) : null;
    }

    async listar(filtros: { id_empleado?: number; desde?: string; hasta?: string }): Promise<BonoEmpleadoSQL[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_empleado) { where.push('id_empleado = ?'); params.push(filtros.id_empleado); }
        if (filtros.desde) { where.push('fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('fecha <= ?'); params.push(filtros.hasta); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT * FROM Bonos_Empleado ${whereSql} ORDER BY fecha DESC, id DESC`,
            params
        );
        return rows as BonoEmpleadoSQL[];
    }

    async sumarPorEmpleadoYRango(id_empleado: number, desde: string, hasta: string): Promise<number> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Bonos_Empleado WHERE id_empleado = ? AND fecha BETWEEN ? AND ?`,
            [id_empleado, desde, hasta]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async eliminar(id: number, conn?: PoolConnection): Promise<boolean> {
        const [result] = await (conn || this.db).execute<ResultSetHeader>(`DELETE FROM Bonos_Empleado WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }

    async estadoCuentaPagar(id_cuenta_pagar: number): Promise<{ valor_pagado: number; estado: string } | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT valor_pagado, estado FROM Cuentas_Por_Pagar WHERE id = ?`, [id_cuenta_pagar]
        );
        return rows.length ? { valor_pagado: Number(rows[0].valor_pagado), estado: rows[0].estado } : null;
    }

    async anularCuentaPagar(id_cuenta_pagar: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET estado = 'anulado', deleted_at = NOW() WHERE id = ?`, [id_cuenta_pagar]);
    }

    async crearCuentaPagar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, id_empleado, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Bono empleado' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_empleado, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }
}
