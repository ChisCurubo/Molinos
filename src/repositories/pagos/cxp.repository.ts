import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { aplicarImpuesto4x1000 } from './impuesto.repository';
import { CuentasPorPagarRepositoryInterface } from '../../ports/pagos/repository_port/cxp.repository.interface';
import { CuentaPorPagarSQL } from '../../models/pagos/sql/cuenta_por_pagar.sql';
import { CategoriaCxpSQL } from '../../models/pagos/sql/categoria_cxp.sql';
import { ICategoriaCxPRepository } from '../../ports/pagos/repository_port/cxp.repository.interface';


import { ident } from '../../helpers/sql.helper';
import { AppError } from '../../errors/app-error';
// --- Original: cuentas_por_pagar ---
export class MySQLCuentasPorPagarRepo implements CuentasPorPagarRepositoryInterface {
    constructor(private pool: Pool) {}

    async create(cuenta: Partial<CuentaPorPagarSQL>): Promise<CuentaPorPagarSQL> {
        const query = `INSERT INTO Cuentas_Por_Pagar 
            (id_categoria, concepto, id_proveedor, id_empleado, id_minero, id_dueno_volqueta, valor_total, valor_pagado, estado, fecha_limite) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values: any[] = [
            cuenta.id_categoria, cuenta.concepto, cuenta.id_proveedor || null, 
            cuenta.id_empleado || null, cuenta.id_minero || null, 
            cuenta.id_dueno_volqueta || null, cuenta.valor_total, 
            cuenta.valor_pagado || 0, cuenta.estado || 'pendiente', 
            cuenta.fecha_limite || null
        ];
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return { id: result.insertId, ...cuenta } as CuentaPorPagarSQL;
    }

    /**
     * Abono a una CxP de nómina, bono o préstamo de empleado (las que no tienen módulo propio de pago).
     * Una sola transacción: bloquea la cuenta, valida que no se pague de más, inserta el abono con su
     * comprobante, aplica 4x1000 y recalcula valor_pagado/estado (la retención cuenta como pagada).
     */
    async registrarAbono(idCxp: number, a: any): Promise<{ id_abono: number; estado: string; saldo: number }> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.execute<RowDataPacket[]>(
                `SELECT cp.id, cp.estado, cp.valor_total, cp.valor_pagado, cp.valor_retenido, cat.nombre AS categoria
                 FROM Cuentas_Por_Pagar cp JOIN Categorias_CxP cat ON cat.id = cp.id_categoria
                 WHERE cp.id = ? AND cp.deleted_at IS NULL FOR UPDATE`, [idCxp]);
            const cp = rows[0];
            if (!cp) throw AppError.noEncontrado('Cuenta por pagar no encontrada');
            if (!['Nómina', 'Bono empleado', 'Préstamo empleado'].includes(cp.categoria))
                throw AppError.reglaNegocio(`La categoría "${cp.categoria}" se paga desde su propio módulo`);
            if (cp.estado === 'anulado') throw AppError.reglaNegocio('La cuenta está anulada');
            const valor = Number(a.valor);
            if (!(valor > 0)) throw AppError.validacion('valor debe ser mayor a 0');
            const saldo = Number(cp.valor_total) - Number(cp.valor_pagado);
            if (valor > saldo + 0.005) throw AppError.reglaNegocio(`El abono (${valor}) supera el saldo pendiente (${saldo})`);

            const fecha = a.fecha_abono || new Date().toISOString().slice(0, 10);
            const [r] = await conn.execute<ResultSetHeader>(
                `INSERT INTO Abonos_CxP (id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones, id_cuenta_bancaria)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [idCxp, fecha, valor, a.metodo_pago || 'transferencia', a.comprobante_url ?? null, a.observaciones ?? null, a.id_cuenta_bancaria ?? null]);
            await aplicarImpuesto4x1000(conn, { id_abono_cxp: r.insertId, id_cuenta_bancaria: a.id_cuenta_bancaria, valor_base: valor, fecha });
            await conn.execute(
                `UPDATE Cuentas_Por_Pagar cp
                 SET valor_pagado = (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id) + cp.valor_retenido,
                     estado = CASE WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id) + cp.valor_retenido >= cp.valor_total THEN 'pagado' ELSE 'parcial' END
                 WHERE cp.id = ?`, [idCxp]);
            const [after] = await conn.execute<RowDataPacket[]>(`SELECT estado, saldo FROM Cuentas_Por_Pagar WHERE id = ?`, [idCxp]);
            await conn.commit();
            return { id_abono: r.insertId, estado: after[0].estado, saldo: Number(after[0].saldo) };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    async getById(id: number): Promise<CuentaPorPagarSQL | null> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM Cuentas_Por_Pagar WHERE id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as CuentaPorPagarSQL) : null;
    }

    async listAll(): Promise<CuentaPorPagarSQL[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM Cuentas_Por_Pagar ORDER BY created_at DESC`
        );
        return rows as CuentaPorPagarSQL[];
    }

    async listByEstado(estado: string): Promise<CuentaPorPagarSQL[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM Cuentas_Por_Pagar WHERE estado = ? ORDER BY created_at DESC`,
            [estado]
        );
        return rows as CuentaPorPagarSQL[];
    }

    // Listado mes a mes, paginado (50 por página), con filtro opcional de categoría/estado.
    async listarPaginado(filtros: { mes?: number; anio?: number; id_categoria?: number; estado?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.anio) { where.push('YEAR(cp.fecha_creacion) = ?'); params.push(filtros.anio); }
        if (filtros.mes) { where.push('MONTH(cp.fecha_creacion) = ?'); params.push(filtros.mes); }
        if (filtros.id_categoria) { where.push('cp.id_categoria = ?'); params.push(filtros.id_categoria); }
        if (filtros.estado) { where.push('cp.estado = ?'); params.push(filtros.estado); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [countRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM Cuentas_Por_Pagar cp ${whereSql}`,
            params
        );
        const offset = (filtros.page - 1) * filtros.limit;
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT cp.*, cat.nombre AS categoria,
                    COALESCE(pr.nombre, mn.nombre, dv.nombre, emp.nombre) AS beneficiario
             FROM Cuentas_Por_Pagar cp
             JOIN Categorias_CxP cat      ON cat.id = cp.id_categoria
             LEFT JOIN Proveedores pr     ON pr.id  = cp.id_proveedor
             LEFT JOIN minero mn          ON mn.id  = cp.id_minero
             LEFT JOIN Dueno_Volqueta dv  ON dv.id  = cp.id_dueno_volqueta
             LEFT JOIN Empleados emp      ON emp.id = cp.id_empleado
             ${whereSql}
             ORDER BY cp.fecha_creacion DESC, cp.id DESC
             LIMIT ${filtros.limit} OFFSET ${offset}`,
            params
        );
        return { rows, total: Number(countRows[0]?.total ?? 0) };
    }

    async update(id: number, cuenta: Partial<CuentaPorPagarSQL>): Promise<boolean> {
        const query = `UPDATE Cuentas_Por_Pagar SET valor_pagado = ?, estado = ? WHERE id = ?`;
        const values: any[] = [cuenta.valor_pagado, cuenta.estado, id];
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }
}

// --- Original: categoria_cxp ---
export class CategoriaCxPRepository implements ICategoriaCxPRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<CategoriaCxpSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Categorias_CxP (${fields.map(ident).join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CategoriaCxpSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxP WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as CategoriaCxpSQL;
    }

    async update(id: number, data: Partial<CategoriaCxpSQL>): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                fields.push(`${ident(key)} = ?`);
                values.push(value);
            }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Categorias_CxP SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Categorias_CxP WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CategoriaCxpSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_CxP');
        return rows as CategoriaCxpSQL[];
    }
}