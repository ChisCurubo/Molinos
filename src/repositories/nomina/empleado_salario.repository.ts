import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { EmpleadoSalarioSQL } from '../../models/nomina/sql/empleado_salario.sql';
import { IEmpleadoSalarioRepository } from '../../ports/nomina/repository_port/empleado_salario.repository.interface';

export class EmpleadoSalarioRepository implements IEmpleadoSalarioRepository {
    constructor(private db: Pool) {}

    private getConn(tx?: PoolConnection): PoolConnection | Pool {
        return tx || this.db;
    }

    async crear(data: Omit<EmpleadoSalarioSQL, 'id' | 'created_at'>, conn?: PoolConnection): Promise<number> {
        const [result] = await this.getConn(conn).query<ResultSetHeader>(
            `INSERT INTO Empleados_Salario (empleado_id, tipo_pago, tarifa_monto, aplica_aux_transp, fecha_inicio, activo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.empleado_id, data.tipo_pago, data.tarifa_monto, data.aplica_aux_transp ?? false, data.fecha_inicio, data.activo ?? true]
        );
        return result.insertId;
    }

    async obtenerPorId(id: number, conn?: PoolConnection): Promise<EmpleadoSalarioSQL | null> {
        const [rows] = await this.getConn(conn).query<RowDataPacket[]>('SELECT * FROM Empleados_Salario WHERE id = ?', [id]);
        return rows.length ? (rows[0] as EmpleadoSalarioSQL) : null;
    }

    async obtenerVigente(empleado_id: number): Promise<EmpleadoSalarioSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM Empleados_Salario WHERE empleado_id = ? AND activo = 1 ORDER BY fecha_inicio DESC LIMIT 1',
            [empleado_id]
        );
        return rows.length ? (rows[0] as EmpleadoSalarioSQL) : null;
    }

    async listarPorEmpleado(empleado_id: number): Promise<EmpleadoSalarioSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM Empleados_Salario WHERE empleado_id = ? ORDER BY fecha_inicio DESC',
            [empleado_id]
        );
        return rows as EmpleadoSalarioSQL[];
    }

    async cerrarVigenciasAbiertas(empleado_id: number, conn: PoolConnection): Promise<void> {
        await conn.query(
            'UPDATE Empleados_Salario SET activo = 0 WHERE empleado_id = ? AND activo = 1',
            [empleado_id]
        );
    }

    async actualizar(id: number, data: Partial<EmpleadoSalarioSQL>): Promise<boolean> {
        const permitidos = ['tipo_pago', 'tarifa_monto', 'aplica_aux_transp', 'fecha_inicio', 'activo'];
        const fields: string[] = [];
        const values: any[] = [];
        for (const k of permitidos) {
            if ((data as any)[k] !== undefined) { fields.push(`${k} = ?`); values.push((data as any)[k]); }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Empleados_Salario SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async eliminar(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Empleados_Salario WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}
