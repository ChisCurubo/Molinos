import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IPagoMulaRepository } from '../../ports/pagos/repository_port/pago_mula.repository.interface';

/**
 * Repositorio del pago de MULAS. Ver IPagoMulaRepository para el diseño.
 */
export class PagoMulaRepository implements IPagoMulaRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async resolverCategoriaMula(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id FROM Categorias_CxP WHERE nombre = 'Mula' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la categoría 'Mula' en Categorias_CxP");
        return Number(rows[0].id);
    }

    async pctRetencionMula(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT valor FROM Tarifas_Calculo WHERE codigo = 'retencion_mula_pct' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la tarifa 'retencion_mula_pct' en Tarifas_Calculo");
        return Number(rows[0].valor);
    }

    // ── Mula (el despacho) ──────────────────────────────────────────────────
    async crearMula(data: { id_proveedor: number; id_viaje?: number; fecha: string; concepto?: string; factura_num?: string; foto_factura_url?: string; valor: number }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Mulas (id_proveedor, id_viaje, fecha, concepto, factura_num, foto_factura_url, valor)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.id_proveedor, data.id_viaje ?? null, data.fecha, data.concepto ?? null,
             data.factura_num ?? null, data.foto_factura_url ?? null, data.valor]
        );
        return result.insertId;
    }

    async obtenerMula(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT m.*, p.nombre AS proveedor, v.numero_viaje
             FROM Mulas m
             JOIN Proveedores p ON p.id = m.id_proveedor
             LEFT JOIN Viaje v  ON v.id = m.id_viaje
             WHERE m.id = ?`,
            [id]
        );
        return rows.length ? rows[0] : null;
    }

    async listarMulas(filtros: { id_proveedor?: number; id_viaje?: number; estado?: string }): Promise<any[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_proveedor) { where.push('m.id_proveedor = ?'); params.push(filtros.id_proveedor); }
        if (filtros.id_viaje) { where.push('m.id_viaje = ?'); params.push(filtros.id_viaje); }
        if (filtros.estado) { where.push('cp.estado = ?'); params.push(filtros.estado); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        // No se usa v_estado_mulas: esa vista calcula el saldo sobre m.valor (la factura bruta),
        // pero la CxP real de Mulas queda por el NETO de retención — se lee directo de Cuentas_Por_Pagar.
        const [rows] = await this.db.execute<any[]>(
            `SELECT m.*, p.nombre AS proveedor, v.numero_viaje,
                    vm.pct_retencion, vm.retencion, vm.abono_neto,
                    cp.valor_pagado AS total_pagado, cp.saldo AS saldo_pendiente, cp.estado AS estado_pago
             FROM Mulas m
             JOIN Proveedores p     ON p.id = m.id_proveedor
             LEFT JOIN Viaje v      ON v.id = m.id_viaje
             LEFT JOIN v_mulas vm   ON vm.id = m.id
             LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_mula = m.id
             LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             ${whereSql}
             ORDER BY m.fecha DESC, m.id DESC`,
            params
        );
        return rows;
    }

    async resumenMulas(filtros: { desde?: string; hasta?: string; id_proveedor?: number }): Promise<any> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.desde) { where.push('m.fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('m.fecha <= ?'); params.push(filtros.hasta); }
        if (filtros.id_proveedor) { where.push('m.id_proveedor = ?'); params.push(filtros.id_proveedor); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<any[]>(
            `SELECT
                COUNT(*)                                                          AS total_despachos,
                COALESCE(SUM(m.valor),0)                                          AS valor_adeudado_total,
                COALESCE(SUM(vm.retencion),0)                                     AS retencion_total,
                COALESCE(SUM(vm.abono_neto),0)                                    AS abono_neto_total,
                COALESCE(SUM(cp.valor_pagado),0)                                  AS total_pagado,
                COALESCE(SUM(cp.saldo),0)                                         AS total_pendiente
             FROM Mulas m
             LEFT JOIN v_mulas vm   ON vm.id = m.id
             LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_mula = m.id
             LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             ${whereSql}`,
            params
        );
        return rows[0];
    }

    async actualizarMula(id: number, campos: any, conn: PoolConnection): Promise<void> {
        const permitidos = ['id_viaje', 'fecha', 'concepto', 'factura_num', 'foto_factura_url', 'valor'];
        const sets: string[] = []; const values: any[] = [];
        for (const k of permitidos) if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(campos[k]); }
        if (sets.length === 0) return;
        values.push(id);
        await conn.execute(`UPDATE Mulas SET ${sets.join(', ')} WHERE id = ?`, values);
    }

    async eliminarMula(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`DELETE FROM Mulas WHERE id = ?`, [id]);
    }

    // ── Cuenta (CxP) ─────────────────────────────────────────────────────────
    async crearCuentaMula(data: { id_proveedor: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, id_proveedor, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Mula' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_proveedor, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT * FROM Cuentas_Por_Pagar WHERE id = ?`, [idCxp]
        );
        return rows.length ? rows[0] : null;
    }

    async ajustarValorTotalCuenta(idCxp: number, nuevoValorTotal: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Cuentas_Por_Pagar SET valor_total = ? WHERE id = ? AND estado != 'anulado'`,
            [nuevoValorTotal, idCxp]
        );
    }

    async anularCuenta(idCxp: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET estado = 'anulado', deleted_at = NOW() WHERE id = ?`, [idCxp]);
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

    // Cuentas de mula abiertas (pendiente/parcial) de un proveedor, del despacho más viejo al más nuevo.
    async cuentasAbiertasDelProveedor(idProveedor: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado, cp.fecha_creacion,
                    m.id AS id_mula, m.id_viaje
             FROM Cuentas_Por_Pagar cp
             JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_cuenta_pagar = cp.id
             JOIN Mulas m ON m.id = cpr.id_mula
             WHERE cp.id_proveedor = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Mula' LIMIT 1)
               AND cp.estado IN ('pendiente','parcial')
             ORDER BY cp.fecha_creacion ASC, cp.id ASC`,
            [idProveedor]
        );
        return rows;
    }

    // ── Relación Mula ↔ Cuenta ───────────────────────────────────────────────
    async crearRelacionMula(idCxp: number, idMula: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion (id_cuenta_pagar, id_mula, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, idMula, monto, concepto]
        );
    }

    async eliminarRelacionMula(idMula: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_mula = ?`, [idMula]);
    }

    async cuentaDeMula(idMula: number, conn?: PoolConnection): Promise<number | null> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_mula = ? LIMIT 1`,
            [idMula]
        );
        return rows.length ? Number(rows[0].id_cuenta_pagar) : null;
    }

    // ── Abonos ───────────────────────────────────────────────────────────────
    async insertarAbono(abono: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxP (id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones)
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

    async listarAbonosPaginado(filtros: { id_proveedor?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre = 'Mula' LIMIT 1)`];
        const params: any[] = [];
        if (filtros.id_proveedor) { where.push('cp.id_proveedor = ?'); params.push(filtros.id_proveedor); }
        if (filtros.desde) { where.push('a.fecha_abono >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('a.fecha_abono <= ?'); params.push(filtros.hasta); }
        if (filtros.metodo_pago) { where.push('a.metodo_pago = ?'); params.push(filtros.metodo_pago); }
        const whereSql = where.join(' AND ');
        const [countRows] = await this.db.execute<any[]>(
            `SELECT COUNT(*) AS total FROM Abonos_CxP a JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar WHERE ${whereSql}`,
            params
        );
        const offset = (filtros.page - 1) * filtros.limit;
        const [rows] = await this.db.execute<any[]>(
            `SELECT a.id, a.id_cuenta_pagar, a.fecha_abono, a.valor, a.metodo_pago, a.comprobante_url, a.observaciones, a.created_at,
                    cp.concepto, cp.id_proveedor, p.nombre AS proveedor,
                    m.id AS id_mula, m.id_viaje, v.numero_viaje
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             LEFT JOIN Proveedores p   ON p.id = cp.id_proveedor
             LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_cuenta_pagar = cp.id
             LEFT JOIN Mulas m ON m.id = cpr.id_mula
             LEFT JOIN Viaje v ON v.id = m.id_viaje
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

    async esCuentaDeMula(idCxp: number, conn?: PoolConnection): Promise<boolean> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT 1 FROM Cuentas_Por_Pagar
             WHERE id = ? AND id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Mula' LIMIT 1) LIMIT 1`,
            [idCxp]
        );
        return rows.length > 0;
    }

    // ── Estado del Viaje (almacenado/despachado) ────────────────────────────
    async obtenerEstadoViaje(idViaje: number, conn?: PoolConnection): Promise<string | null> {
        const [rows] = await this.conn(conn).execute<any[]>(`SELECT estado FROM Viaje WHERE id = ?`, [idViaje]);
        return rows.length ? rows[0].estado : null;
    }

    async marcarEstadoViaje(idViaje: number, estado: 'almacenado' | 'despachado', conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Viaje SET estado = ? WHERE id = ?`, [estado, idViaje]);
    }

    // ── Saldo a favor por sobrepago ──────────────────────────────────────────
    async crearSaldoAFavorProveedor(data: { id_abono_cxp_orig?: number; id_proveedor: number; id_cuenta_pagar?: number; monto_original: number; descripcion?: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Saldo_A_Favor
                (origen, id_abono_cxp_orig, id_proveedor, id_cuenta_pagar, monto_original, tipo_resolucion, descripcion)
             VALUES ('pago_excedido', ?, ?, ?, ?, 'descontar_futuro', ?)`,
            [data.id_abono_cxp_orig ?? null, data.id_proveedor, data.id_cuenta_pagar ?? null,
             data.monto_original, data.descripcion ?? null]
        );
        return result.insertId;
    }

    async saldoAFavorPorAbono(idAbono: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id, monto_original, monto_aplicado FROM Saldo_A_Favor WHERE id_abono_cxp_orig = ?`,
            [idAbono]
        );
        return rows.length ? rows[0] : null;
    }

    async eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`DELETE FROM Saldo_A_Favor WHERE id = ?`, [id]);
    }

    // ── Trazabilidad por viaje ───────────────────────────────────────────────
    async trazabilidadPorViaje(): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(
            `SELECT m.id AS id_mula, m.id_viaje, v.numero_viaje, v.fecha AS fecha_viaje,
                    m.id_proveedor, p.nombre AS proveedor,
                    m.valor, m.fecha AS fecha_despacho,
                    cp.id AS id_cuenta_pagar, cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado
             FROM Mulas m
             JOIN Proveedores p ON p.id = m.id_proveedor
             JOIN Viaje v       ON v.id = m.id_viaje
             LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_mula = m.id
             LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             WHERE m.id_viaje IS NOT NULL
             ORDER BY v.fecha DESC, v.id DESC`
        );
        return rows;
    }
}
