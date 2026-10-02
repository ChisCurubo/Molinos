import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { FiltrosIngresoTesoreria, IIngresoTesoreriaRepository } from '../../ports/pagos/repository_port/ingreso_tesoreria.repository.interface';
import { CategoriaIngresoSQL, IngresoTesoreriaSQL } from '../../models/pagos/sql/ingreso_tesoreria.sql';

export class IngresoTesoreriaRepository implements IIngresoTesoreriaRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async resolverCategoriaPorNombre(nombre: string, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<RowDataPacket[]>(
            `SELECT id FROM Categorias_Ingreso WHERE nombre = ? LIMIT 1`, [nombre]
        );
        if (!rows.length) throw new Error(`No existe la categoría '${nombre}' en Categorias_Ingreso`);
        return Number(rows[0].id);
    }

    async crear(data: { id_categoria: number; concepto: string; valor: number; fecha: string; id_prestamo_fin?: number | null; comprobante_url?: string }, conn?: PoolConnection): Promise<number> {
        const [result] = await this.conn(conn).execute<ResultSetHeader>(
            `INSERT INTO Ingresos_Tesoreria (id_categoria, concepto, valor, fecha, id_prestamo_fin, comprobante_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.id_categoria, data.concepto, data.valor, data.fecha, data.id_prestamo_fin ?? null, data.comprobante_url ?? null]
        );
        return result.insertId;
    }

    async obtenerPorId(id: number): Promise<any | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT it.*, cat.nombre AS categoria
             FROM Ingresos_Tesoreria it
             JOIN Categorias_Ingreso cat ON cat.id = it.id_categoria
             WHERE it.id = ?`, [id]
        );
        return rows.length ? rows[0] : null;
    }

    async listar(filtros: FiltrosIngresoTesoreria): Promise<any[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_categoria) { where.push('it.id_categoria = ?'); params.push(filtros.id_categoria); }
        if (filtros.desde) { where.push('it.fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('it.fecha <= ?'); params.push(filtros.hasta); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT it.*, cat.nombre AS categoria
             FROM Ingresos_Tesoreria it
             JOIN Categorias_Ingreso cat ON cat.id = it.id_categoria
             ${whereSql}
             ORDER BY it.fecha DESC, it.id DESC`,
            params
        );
        return rows;
    }

    async actualizar(id: number, data: Partial<IngresoTesoreriaSQL>): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && key !== 'id') { fields.push(`${key} = ?`); values.push(value); }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const [result] = await this.db.execute<ResultSetHeader>(
            `UPDATE Ingresos_Tesoreria SET ${fields.join(', ')} WHERE id = ?`, values
        );
        return result.affectedRows > 0;
    }

    async eliminar(id: number): Promise<boolean> {
        const [result] = await this.db.execute<ResultSetHeader>(`DELETE FROM Ingresos_Tesoreria WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }

    async listarCategorias(): Promise<CategoriaIngresoSQL[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT id, nombre, descripcion FROM Categorias_Ingreso ORDER BY nombre`
        );
        return rows as CategoriaIngresoSQL[];
    }
}
