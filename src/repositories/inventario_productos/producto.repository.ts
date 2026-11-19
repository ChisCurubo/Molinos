import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { CategoriaProducto } from '../../models/inventario_productos/sql/producto.sql';
import { IProductoRepository, ProductoConStock } from '../../ports/inventario_productos/repository_port/inventario_productos.repository.interface';

// Subconsulta reutilizable: último movimiento (mayor id) de cada producto = su saldo actual.
const ULTIMO_MOVIMIENTO_CTE = `
    SELECT id_producto, saldo_cantidad, saldo_valor
    FROM (
        SELECT id_producto, saldo_cantidad, saldo_valor,
               ROW_NUMBER() OVER (PARTITION BY id_producto ORDER BY id DESC) AS rn
        FROM Inventario_Movimientos
    ) u
    WHERE u.rn = 1
`;

export class ProductoRepository implements IProductoRepository {
    constructor(private db: Pool) {}

    async create(data: { nombre: string; categoria: CategoriaProducto; unidad: string; stock_minimo?: number }): Promise<number> {
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Inventario_Productos (nombre, categoria, unidad, stock_minimo) VALUES (?, ?, ?, ?)`,
            [data.nombre, data.categoria, data.unidad, data.stock_minimo ?? 0]
        );
        return result.insertId;
    }

    async getById(id: number): Promise<ProductoConStock | null> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT p.*,
                    COALESCE(u.saldo_cantidad, 0) AS stock_actual,
                    COALESCE(ROUND(u.saldo_valor / u.saldo_cantidad, 2), 0) AS costo_promedio,
                    COALESCE(u.saldo_valor, 0) AS valor_stock
             FROM Inventario_Productos p
             LEFT JOIN (${ULTIMO_MOVIMIENTO_CTE}) u ON u.id_producto = p.id
             WHERE p.id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as ProductoConStock) : null;
    }

    async update(id: number, data: Partial<{ nombre: string; categoria: CategoriaProducto; unidad: string; stock_minimo: number }>): Promise<boolean> {
        const permitidos = ['nombre', 'categoria', 'unidad', 'stock_minimo'];
        const fields: string[] = []; const values: any[] = [];
        for (const k of permitidos) if ((data as any)[k] !== undefined) { fields.push(`${k} = ?`); values.push((data as any)[k]); }
        if (fields.length === 0) return false;
        values.push(id);
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Inventario_Productos SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        // ON DELETE CASCADE en Inventario_Movimientos.id_producto borra el cardex del producto.
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Inventario_Productos WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(filtros: { categoria?: string; q?: string; bajo_minimo?: boolean; limit?: number; offset?: number }): Promise<ProductoConStock[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.categoria) { where.push('p.categoria = ?'); params.push(filtros.categoria); }
        if (filtros.q) { where.push('p.nombre LIKE ?'); params.push(`%${filtros.q}%`); }
        if (filtros.bajo_minimo) { where.push('COALESCE(u.saldo_cantidad, 0) < p.stock_minimo'); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const limitSql = filtros.limit !== undefined ? ` LIMIT ${Number(filtros.limit)} OFFSET ${Number(filtros.offset ?? 0)}` : '';
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT p.*,
                    COALESCE(u.saldo_cantidad, 0) AS stock_actual,
                    COALESCE(ROUND(u.saldo_valor / u.saldo_cantidad, 2), 0) AS costo_promedio,
                    COALESCE(u.saldo_valor, 0) AS valor_stock
             FROM Inventario_Productos p
             LEFT JOIN (${ULTIMO_MOVIMIENTO_CTE}) u ON u.id_producto = p.id
             ${whereSql}
             ORDER BY p.nombre${limitSql}`,
            params
        );
        return rows as ProductoConStock[];
    }
}
