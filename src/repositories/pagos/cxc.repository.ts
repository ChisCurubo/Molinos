import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';
import { ICategoriaCxCRepository, ICuentasPorCobrarRepository } from '../../ports/pagos/repository_port/cxc.repository.interface';

// --- Original: categoria_cxc ---
export class CategoriaCxCRepository implements ICategoriaCxCRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<CategoriaCxcSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Categorias_CxC (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CategoriaCxcSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxC WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as CategoriaCxcSQL;
    }

    async update(id: number, data: Partial<CategoriaCxcSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Categorias_CxC SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Categorias_CxC WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CategoriaCxcSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxC');
        return rows as CategoriaCxcSQL[];
    }
}

// --- Cuentas_Por_Cobrar (espejo de Cuentas_Por_Pagar): tabla existe, aún sin módulo que la alimente ---
export class MySQLCuentasPorCobrarRepo implements ICuentasPorCobrarRepository {
    constructor(private db: Pool) {}

    async listarPaginado(filtros: { mes?: number; anio?: number; id_categoria?: number; estado?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.anio) { where.push('YEAR(cc.fecha_creacion) = ?'); params.push(filtros.anio); }
        if (filtros.mes) { where.push('MONTH(cc.fecha_creacion) = ?'); params.push(filtros.mes); }
        if (filtros.id_categoria) { where.push('cc.id_categoria = ?'); params.push(filtros.id_categoria); }
        if (filtros.estado) { where.push('cc.estado = ?'); params.push(filtros.estado); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [countRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM Cuentas_Por_Cobrar cc ${whereSql}`,
            params
        );
        const offset = (filtros.page - 1) * filtros.limit;
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT cc.*, cat.nombre AS categoria,
                    COALESCE(pr.nombre, mn.nombre, dv.nombre, emp.nombre) AS deudor
             FROM Cuentas_Por_Cobrar cc
             JOIN Categorias_CxC cat      ON cat.id = cc.id_categoria
             LEFT JOIN Proveedores pr     ON pr.id  = cc.id_proveedor
             LEFT JOIN minero mn          ON mn.id  = cc.id_minero
             LEFT JOIN Dueno_Volqueta dv  ON dv.id  = cc.id_dueno_volqueta
             LEFT JOIN Empleados emp      ON emp.id = cc.id_empleado
             ${whereSql}
             ORDER BY cc.fecha_creacion DESC, cc.id DESC
             LIMIT ${filtros.limit} OFFSET ${offset}`,
            params
        );
        return { rows, total: Number(countRows[0]?.total ?? 0) };
    }
}