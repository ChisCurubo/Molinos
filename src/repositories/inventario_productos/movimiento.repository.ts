import { RowDataPacket, ResultSetHeader, Pool, PoolConnection } from 'mysql2/promise';
import { MovimientoInventarioSQL, TipoMovimientoInventario } from '../../models/inventario_productos/sql/movimiento.sql';
import { IMovimientoRepository } from '../../ports/inventario_productos/repository_port/inventario_productos.repository.interface';

export class MovimientoRepository implements IMovimientoRepository {
    constructor(private db: Pool) {}

    async getUltimoYLockProducto(conn: PoolConnection, id_producto: number): Promise<{ saldo_cantidad: number; saldo_valor: number } | null> {
        const [prod] = await conn.query<RowDataPacket[]>('SELECT id FROM Inventario_Productos WHERE id = ? FOR UPDATE', [id_producto]);
        if (prod.length === 0) return null;
        const [rows] = await conn.query<RowDataPacket[]>(
            'SELECT saldo_cantidad, saldo_valor FROM Inventario_Movimientos WHERE id_producto = ? ORDER BY id DESC LIMIT 1',
            [id_producto]
        );
        if (rows.length === 0) return { saldo_cantidad: 0, saldo_valor: 0 };
        return { saldo_cantidad: Number(rows[0].saldo_cantidad), saldo_valor: Number(rows[0].saldo_valor) };
    }

    async insert(conn: PoolConnection, data: { id_producto: number; fecha: string; tipo: TipoMovimientoInventario; cantidad: number; costo_unitario: number; nota: string | null; costo_total: number; saldo_cantidad: number; saldo_valor: number }): Promise<number> {
        const [result] = await conn.query<ResultSetHeader>(
            `INSERT INTO Inventario_Movimientos (id_producto, fecha, tipo, cantidad, costo_unitario, nota, costo_total, saldo_cantidad, saldo_valor)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.id_producto, data.fecha, data.tipo, data.cantidad, data.costo_unitario, data.nota, data.costo_total, data.saldo_cantidad, data.saldo_valor]
        );
        return result.insertId;
    }

    async getById(id: number): Promise<MovimientoInventarioSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Inventario_Movimientos WHERE id = ?', [id]);
        return rows.length ? (rows[0] as MovimientoInventarioSQL) : null;
    }

    async deleteYObtenerPosteriores(conn: PoolConnection, id: number): Promise<{ id_producto: number; posteriores: MovimientoInventarioSQL[]; saldoBase: { saldo_cantidad: number; saldo_valor: number } } | null> {
        const [actual] = await conn.query<RowDataPacket[]>('SELECT id_producto FROM Inventario_Movimientos WHERE id = ?', [id]);
        if (actual.length === 0) return null;
        const id_producto = actual[0].id_producto as number;

        await conn.query('SELECT id FROM Inventario_Productos WHERE id = ? FOR UPDATE', [id_producto]);

        const [base] = await conn.query<RowDataPacket[]>(
            'SELECT saldo_cantidad, saldo_valor FROM Inventario_Movimientos WHERE id_producto = ? AND id < ? ORDER BY id DESC LIMIT 1',
            [id_producto, id]
        );
        const saldoBase = base.length
            ? { saldo_cantidad: Number(base[0].saldo_cantidad), saldo_valor: Number(base[0].saldo_valor) }
            : { saldo_cantidad: 0, saldo_valor: 0 };

        const [posteriores] = await conn.query<RowDataPacket[]>(
            'SELECT * FROM Inventario_Movimientos WHERE id_producto = ? AND id > ? ORDER BY id ASC',
            [id_producto, id]
        );

        await conn.query('DELETE FROM Inventario_Movimientos WHERE id = ?', [id]);

        return { id_producto, posteriores: posteriores as MovimientoInventarioSQL[], saldoBase };
    }

    async actualizarResueltos(conn: PoolConnection, id: number, data: { costo_unitario: number; costo_total: number; saldo_cantidad: number; saldo_valor: number }): Promise<void> {
        await conn.query(
            'UPDATE Inventario_Movimientos SET costo_unitario = ?, costo_total = ?, saldo_cantidad = ?, saldo_valor = ? WHERE id = ?',
            [data.costo_unitario, data.costo_total, data.saldo_cantidad, data.saldo_valor, id]
        );
    }

    async list(filtros: { id_producto?: number; tipo?: TipoMovimientoInventario; desde?: string; hasta?: string; limit?: number; offset?: number }): Promise<MovimientoInventarioSQL[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_producto) { where.push('id_producto = ?'); params.push(filtros.id_producto); }
        if (filtros.tipo) { where.push('tipo = ?'); params.push(filtros.tipo); }
        if (filtros.desde) { where.push('fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('fecha <= ?'); params.push(filtros.hasta); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const limitSql = filtros.limit !== undefined ? ` LIMIT ${Number(filtros.limit)} OFFSET ${Number(filtros.offset ?? 0)}` : '';
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Inventario_Movimientos ${whereSql} ORDER BY fecha ASC, id ASC${limitSql}`,
            params
        );
        return rows as MovimientoInventarioSQL[];
    }

    async sumaCostoEntradas(filtros: { desde?: string; hasta?: string }): Promise<number> {
        const where: string[] = [`tipo = 'entrada'`];
        const params: any[] = [];
        if (filtros.desde) { where.push('fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('fecha <= ?'); params.push(filtros.hasta); }
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(costo_total), 0) AS total FROM Inventario_Movimientos WHERE ${where.join(' AND ')}`,
            params
        );
        return Number(rows[0].total);
    }
}
