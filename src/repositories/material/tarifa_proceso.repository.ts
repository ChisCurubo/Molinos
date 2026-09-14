import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { ITarifaProcesoRepository } from '../../ports/material/tarifa_proceso.interface';

// CRUD de la tabla `tarifas_proceso` (tarifas de maquila por proceso).
// Columnas: id, codigo, descripcion, valor, unidad, fecha_desde, fecha_hasta, activo,
// created_at, updated_at. El cálculo de maquila lee esta tabla por código + rango de
// fechas (ver ConcentradoRepository.obtenerTarifaMaquila).
export class TarifaProcesoRepository implements ITarifaProcesoRepository {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    private getConn(tx?: PoolConnection): PoolConnection | Pool {
        return tx || this.db;
    }

    async listar(filtros: { codigo?: string; activo?: number }): Promise<any[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.codigo) { where.push('codigo = ?'); params.push(filtros.codigo); }
        if (filtros.activo !== undefined) { where.push('activo = ?'); params.push(filtros.activo); }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<any[]>(
            `SELECT id, codigo, descripcion, valor, unidad, fecha_desde, fecha_hasta, activo, created_at, updated_at
             FROM tarifas_proceso ${clause}
             ORDER BY codigo ASC, fecha_desde DESC`,
            params
        );
        return rows;
    }

    // Tarifa vigente por código en una fecha dada (la de mayor fecha_desde dentro del rango).
    async obtenerVigentes(fecha: string): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(
            `SELECT t.id, t.codigo, t.descripcion, t.valor, t.unidad, t.fecha_desde, t.fecha_hasta, t.activo
             FROM tarifas_proceso t
             INNER JOIN (
                 SELECT codigo, MAX(fecha_desde) AS fmax
                 FROM tarifas_proceso
                 WHERE fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 GROUP BY codigo
             ) v ON v.codigo = t.codigo AND v.fmax = t.fecha_desde
             WHERE t.fecha_desde <= ? AND (t.fecha_hasta IS NULL OR t.fecha_hasta >= ?)
             ORDER BY t.codigo ASC`,
            [fecha, fecha, fecha, fecha]
        );
        return rows;
    }

    async obtenerPorId(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.getConn(conn).execute<any[]>(
            `SELECT id, codigo, descripcion, valor, unidad, fecha_desde, fecha_hasta, activo, created_at, updated_at
             FROM tarifas_proceso WHERE id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async cerrarVigenciasAbiertas(codigo: string, fechaDesdeNueva: string, conn?: PoolConnection): Promise<void> {
        await this.getConn(conn).execute(
            `UPDATE tarifas_proceso
             SET fecha_hasta = DATE_SUB(?, INTERVAL 1 DAY), activo = 0, updated_at = NOW()
             WHERE codigo = ? AND fecha_hasta IS NULL`,
            [fechaDesdeNueva, codigo]
        );
    }

    async crear(data: any, conn?: PoolConnection): Promise<number> {
        const [result] = await this.getConn(conn).execute<ResultSetHeader>(
            `INSERT INTO tarifas_proceso
                (codigo, descripcion, valor, unidad, fecha_desde, fecha_hasta, activo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                data.codigo,
                data.descripcion ?? null,
                data.valor,
                data.unidad ?? 'COP/ton',
                data.fecha_desde,
                data.fecha_hasta ?? null,
                data.activo ?? 1
            ]
        );
        return result.insertId;
    }

    async actualizar(id: number, data: any, conn?: PoolConnection): Promise<void> {
        const permitidos = ['descripcion', 'valor', 'unidad', 'fecha_desde', 'fecha_hasta', 'activo'];
        const sets: string[] = [];
        const values: any[] = [];
        for (const k of permitidos) {
            if (data[k] !== undefined) { sets.push(`${k} = ?`); values.push(data[k]); }
        }
        if (sets.length === 0) return;
        sets.push('updated_at = NOW()');
        values.push(id);
        await this.getConn(conn).execute(
            `UPDATE tarifas_proceso SET ${sets.join(', ')} WHERE id = ?`,
            values
        );
    }
}
