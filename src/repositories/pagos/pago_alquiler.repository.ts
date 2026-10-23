import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IPagoAlquilerRepository } from '../../ports/pagos/repository_port/pago_alquiler.repository.interface';

/**
 * Repositorio del pago de un ALQUILER a su proveedor. Modelo: 1 Cuenta_Por_Pagar por
 * alquiler (categoría 'Alquiler'), creada la primera vez que se registra un abono;
 * 1 Relacion con monto_aplicado = valor completo del alquiler. Sin cascada entre
 * alquileres (a diferencia de Flete/Agua/Combustible): v_estado_alquileres agrupa por
 * cada alquiler individualmente.
 */
export class PagoAlquilerRepository implements IPagoAlquilerRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async obtenerAlquiler(idAlquiler: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT al.*, pr.nombre AS proveedor
             FROM Alquileres al
             LEFT JOIN Proveedores pr ON pr.id = al.id_proveedor
             WHERE al.id = ?`,
            [idAlquiler]
        );
        return rows.length ? rows[0] : null;
    }

    async buscarCuentaDeAlquiler(idAlquiler: number, conn: PoolConnection): Promise<number | null> {
        const [rows] = await conn.execute<any[]>(
            `SELECT cpr.id_cuenta_pagar AS id
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             WHERE cpr.id_alquiler = ? LIMIT 1`,
            [idAlquiler]
        );
        return rows.length ? Number(rows[0].id) : null;
    }

    async crearCuentaAlquiler(data: { id_alquiler: number; id_proveedor: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar
                (id_categoria, concepto, id_proveedor, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Alquiler' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_proveedor, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async crearRelacionAlquiler(idCxp: number, idAlquiler: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion
                (id_cuenta_pagar, id_alquiler, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, idAlquiler, monto, concepto]
        );
    }

    async obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.*, pr.nombre AS proveedor
             FROM Cuentas_Por_Pagar cp
             LEFT JOIN Proveedores pr ON pr.id = cp.id_proveedor
             WHERE cp.id = ?`,
            [idCxp]
        );
        return rows.length ? rows[0] : null;
    }

    async recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Cuentas_Por_Pagar cp
             SET valor_pagado = (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id),
                 estado = CASE
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id) <= 0 THEN 'pendiente'
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id) >= cp.valor_total THEN 'pagado'
                    ELSE 'parcial' END
             WHERE cp.id = ? AND cp.estado != 'anulado'`,
            [idCxp]
        );
    }

    async insertarAbono(abono: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxP
                (id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [abono.id_cuenta_pagar, abono.fecha_abono, abono.valor,
             abono.metodo_pago || 'transferencia', abono.comprobante_url ?? null, abono.observaciones ?? null]
        );
        return result.insertId;
    }

    async obtenerAbono(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(`SELECT * FROM Abonos_CxP WHERE id = ?`, [id]);
        return rows.length ? rows[0] : null;
    }

    async actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void> {
        const permitidos = ['fecha_abono', 'valor', 'metodo_pago', 'comprobante_url', 'observaciones'];
        const sets: string[] = []; const values: any[] = [];
        for (const k of permitidos) if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(campos[k]); }
        if (sets.length === 0) return;
        values.push(id);
        await conn.execute(`UPDATE Abonos_CxP SET ${sets.join(', ')} WHERE id = ?`, values);
    }

    async eliminarAbono(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`DELETE FROM Abonos_CxP WHERE id = ?`, [id]);
    }

    async listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id, id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones, created_at
             FROM Abonos_CxP WHERE id_cuenta_pagar = ? ORDER BY fecha_abono, id`,
            [idCxp]
        );
        return rows;
    }

    async listarAbonosPaginado(filtros: { id_alquiler?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre = 'Alquiler' LIMIT 1)`];
        const params: any[] = [];
        if (filtros.id_alquiler) { where.push('cpr.id_alquiler = ?'); params.push(filtros.id_alquiler); }
        if (filtros.desde) { where.push('a.fecha_abono >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('a.fecha_abono <= ?'); params.push(filtros.hasta); }
        if (filtros.metodo_pago) { where.push('a.metodo_pago = ?'); params.push(filtros.metodo_pago); }
        const whereSql = where.join(' AND ');
        const [countRows] = await this.db.execute<any[]>(
            `SELECT COUNT(*) AS total FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_cuenta_pagar = cp.id
             WHERE ${whereSql}`,
            params
        );
        const offset = (filtros.page - 1) * filtros.limit;
        const [rows] = await this.db.execute<any[]>(
            `SELECT a.id, a.id_cuenta_pagar, a.fecha_abono, a.valor, a.metodo_pago, a.comprobante_url, a.observaciones, a.created_at,
                    cp.concepto, cpr.id_alquiler, pr.nombre AS proveedor
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_cuenta_pagar = cp.id
             LEFT JOIN Proveedores pr ON pr.id = cp.id_proveedor
             WHERE ${whereSql}
             ORDER BY a.fecha_abono DESC, a.id DESC
             LIMIT ${filtros.limit} OFFSET ${offset}`,
            params
        );
        return { rows, total: Number(countRows[0]?.total ?? 0) };
    }

    async sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Abonos_CxP WHERE id_cuenta_pagar = ? AND id != ?`,
            [idCxp, excluirAbono]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async esCuentaDeAlquiler(idCxp: number, conn?: PoolConnection): Promise<boolean> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT 1 FROM Cuentas_Por_Pagar
             WHERE id = ? AND id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Alquiler' LIMIT 1) LIMIT 1`,
            [idCxp]
        );
        return rows.length > 0;
    }
}
