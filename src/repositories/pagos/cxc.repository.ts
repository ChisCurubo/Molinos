import { RowDataPacket, ResultSetHeader, Pool, PoolConnection } from 'mysql2/promise';
import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';
import { ICategoriaCxCRepository, ICuentasPorCobrarRepository, CrearCxCData, AbonoCxCData, EditarCxCData } from '../../ports/pagos/repository_port/cxc.repository.interface';

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

    private exec(conn?: PoolConnection): Pool | PoolConnection { return conn || this.db; }

    async crear(data: CrearCxCData, conn?: PoolConnection): Promise<number> {
        const [result] = await this.exec(conn).execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Cobrar
                (id_categoria, concepto, id_empleado, id_minero, id_dueno_volqueta, id_proveedor, valor_total, fecha_creacion, fecha_limite)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.id_categoria, data.concepto, data.id_empleado ?? null, data.id_minero ?? null,
             data.id_dueno_volqueta ?? null, data.id_proveedor ?? null, data.valor_total, data.fecha_creacion, data.fecha_limite ?? null]
        );
        return result.insertId;
    }

    async crearAbono(idCxc: number, data: AbonoCxCData, conn?: PoolConnection): Promise<number> {
        const [result] = await this.exec(conn).execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxC (id_cxc, fecha_cobro, valor, metodo, comprobante_url, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idCxc, data.fecha_cobro, data.valor, data.metodo || 'efectivo', data.comprobante_url, data.observaciones ?? null]
        );
        return result.insertId;
    }

    async recalcularCuenta(idCxc: number, conn?: PoolConnection): Promise<void> {
        await this.exec(conn).execute(
            `UPDATE Cuentas_Por_Cobrar cc
             SET valor_cobrado = (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxC WHERE id_cxc = cc.id),
                 estado = CASE
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxC WHERE id_cxc = cc.id) <= 0 THEN 'pendiente'
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxC WHERE id_cxc = cc.id) >= cc.valor_total THEN 'cobrado'
                    ELSE 'parcial' END
             WHERE cc.id = ? AND cc.estado != 'anulado'`,
            [idCxc]
        );
    }

    async obtenerPorId(id: number): Promise<any | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT cc.*, cat.nombre AS categoria,
                    COALESCE(pr.nombre, mn.nombre, dv.nombre, emp.nombre) AS deudor
             FROM Cuentas_Por_Cobrar cc
             JOIN Categorias_CxC cat      ON cat.id = cc.id_categoria
             LEFT JOIN Proveedores pr     ON pr.id  = cc.id_proveedor
             LEFT JOIN minero mn          ON mn.id  = cc.id_minero
             LEFT JOIN Dueno_Volqueta dv  ON dv.id  = cc.id_dueno_volqueta
             LEFT JOIN Empleados emp      ON emp.id = cc.id_empleado
             WHERE cc.id = ?`,
            [id]
        );
        if (!rows.length) return null;
        const [abonos] = await this.db.execute<RowDataPacket[]>(
            `SELECT * FROM Abonos_CxC WHERE id_cxc = ? ORDER BY fecha_cobro ASC, id ASC`,
            [id]
        );
        return { ...rows[0], abonos };
    }

    // Corrige una cuenta ya creada (concepto, categoría, fechas, valor_total, deudor). Tocar
    // cualquiera de los 4 campos de deudor reemplaza el conjunto completo (CHECK exige ≤1 no-nulo).
    async editar(id: number, cambios: EditarCxCData): Promise<void> {
        const sets: string[] = []; const params: any[] = [];
        if (cambios.concepto !== undefined) { sets.push('concepto = ?'); params.push(cambios.concepto); }
        if (cambios.id_categoria !== undefined) { sets.push('id_categoria = ?'); params.push(cambios.id_categoria); }
        if (cambios.valor_total !== undefined) { sets.push('valor_total = ?'); params.push(cambios.valor_total); }
        if (cambios.fecha_creacion !== undefined) { sets.push('fecha_creacion = ?'); params.push(cambios.fecha_creacion); }
        if (cambios.fecha_limite !== undefined) { sets.push('fecha_limite = ?'); params.push(cambios.fecha_limite); }
        if (cambios.deudor) {
            sets.push('id_empleado = ?, id_minero = ?, id_dueno_volqueta = ?, id_proveedor = ?');
            params.push(cambios.deudor.id_empleado, cambios.deudor.id_minero, cambios.deudor.id_dueno_volqueta, cambios.deudor.id_proveedor);
        }
        if (!sets.length) return;
        params.push(id);
        await this.db.execute(`UPDATE Cuentas_Por_Cobrar SET ${sets.join(', ')} WHERE id = ?`, params);
        if (cambios.valor_total !== undefined) await this.recalcularCuenta(id);
    }

    // Cuentas_Por_Cobrar no tiene deleted_at (a diferencia de Cuentas_Por_Pagar) — el borrado
    // lógico es solo el estado. Los Abonos_CxC ya registrados se conservan para auditoría.
    async anular(id: number): Promise<boolean> {
        const [result] = await this.db.execute<ResultSetHeader>(
            `UPDATE Cuentas_Por_Cobrar SET estado = 'anulado' WHERE id = ? AND estado != 'anulado'`,
            [id]
        );
        return result.affectedRows > 0;
    }
}