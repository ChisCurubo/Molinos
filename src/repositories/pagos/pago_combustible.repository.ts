import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IPagoCombustibleRepository, ConsumoCreditoGasolinera } from '../../ports/pagos/repository_port/pago_combustible.repository.interface';

/**
 * Repositorio del pago de COMBUSTIBLE a la gasolinera (proveedor).
 * Modelo: 1 Cuenta_Por_Pagar por (gasolinera, mes) categoría 'Combustible'; 1 Relacion por
 * consumo (id_combustible, monto_aplicado = valor del consumo — sin neteo, ya es 100% crédito).
 * Los abonos se aplican en cascada del mes más viejo al más nuevo (lógica en el service).
 */
export class PagoCombustibleRepository implements IPagoCombustibleRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async resolverCategoriaCombustible(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id FROM Categorias_CxP WHERE nombre = 'Combustible' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la categoría 'Combustible' en Categorias_CxP");
        return Number(rows[0].id);
    }

    // Consumos a crédito de la gasolinera que aún no tienen Relacion (candidatos a materializar).
    async consumosCreditoDeGasolinera(idGasolinera: number, conn?: PoolConnection): Promise<ConsumoCreditoGasolinera[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT c.id AS id_combustible, c.fecha, c.valor, c.tipo_consumo, c.descripcion
             FROM combustible c
             WHERE c.id_gasolinera = ? AND c.forma_pago = 'credito'
             ORDER BY c.fecha ASC, c.id ASC`,
            [idGasolinera]
        );
        return rows as ConsumoCreditoGasolinera[];
    }

    async idsCombustibleConRelacion(idGasolinera: number, conn?: PoolConnection): Promise<number[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT cpr.id_combustible
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             JOIN combustible c ON c.id = cpr.id_combustible
             WHERE c.id_gasolinera = ?`,
            [idGasolinera]
        );
        return rows.map(r => Number(r.id_combustible));
    }

    async buscarCuentaMesCombustible(idGasolinera: number, anio: number, mes: number, conn: PoolConnection): Promise<number | null> {
        const [rows] = await conn.execute<any[]>(
            `SELECT cp.id
             FROM Cuentas_Por_Pagar cp
             WHERE cp.id_proveedor = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Combustible' LIMIT 1)
               AND cp.estado != 'anulado'
               AND YEAR(cp.fecha_creacion) = ? AND MONTH(cp.fecha_creacion) = ?
             ORDER BY cp.id LIMIT 1`,
            [idGasolinera, anio, mes]
        );
        return rows.length ? Number(rows[0].id) : null;
    }

    async crearCuentaCombustible(data: { id_gasolinera: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar
                (id_categoria, concepto, id_proveedor, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Combustible' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_gasolinera, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async crearRelacionCombustible(idCxp: number, idCombustible: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion
                (id_cuenta_pagar, id_combustible, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, idCombustible, monto, concepto]
        );
    }

    async sumarValorTotal(idCxp: number, delta: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET valor_total = valor_total + ? WHERE id = ?`, [delta, idCxp]);
    }

    async obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.*, pr.nombre AS gasolinera
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

    // Cuentas de combustible de la gasolinera con saldo, del mes más viejo al más nuevo.
    async cuentasAbiertasDeGasolinera(idGasolinera: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado, cp.fecha_creacion
             FROM Cuentas_Por_Pagar cp
             WHERE cp.id_proveedor = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Combustible' LIMIT 1)
               AND cp.estado IN ('pendiente','parcial')
             ORDER BY cp.fecha_creacion ASC, cp.id ASC`,
            [idGasolinera]
        );
        return rows;
    }

    async insertarAbono(abono: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxP
                (id_cuenta_pagar, fecha_abono, valor, metodo_pago, id_saldo_favor, comprobante_url, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [abono.id_cuenta_pagar, abono.fecha_abono, abono.valor,
             abono.metodo_pago || 'transferencia', abono.id_saldo_favor ?? null,
             abono.comprobante_url ?? null, abono.observaciones ?? null]
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

    async listarAbonosPaginado(filtros: { id_gasolinera?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre = 'Combustible' LIMIT 1)`];
        const params: any[] = [];
        if (filtros.id_gasolinera) { where.push('cp.id_proveedor = ?'); params.push(filtros.id_gasolinera); }
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
                    cp.concepto, cp.id_proveedor AS id_gasolinera, pr.nombre AS gasolinera
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
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

    async esCuentaDeCombustible(idCxp: number, conn?: PoolConnection): Promise<boolean> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT 1 FROM Cuentas_Por_Pagar
             WHERE id = ? AND id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Combustible' LIMIT 1) LIMIT 1`,
            [idCxp]
        );
        return rows.length > 0;
    }

    // ── Saldo a favor por gasolinera (proveedor) ────────────────────────────
    async crearSaldoAFavorProveedor(data: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Saldo_A_Favor
                (origen, id_abono_cxp_orig, id_proveedor, id_cuenta_pagar, monto_original, tipo_resolucion, descripcion)
             VALUES ('pago_excedido', ?, ?, ?, ?, 'descontar_futuro', ?)`,
            [data.id_abono_cxp_orig ?? null, data.id_proveedor, data.id_cuenta_pagar ?? null,
             data.monto_original, data.descripcion ?? null]
        );
        return result.insertId;
    }

    async sumaCreditoDisponibleProveedor(idProveedor: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(saldo_disponible),0) AS total FROM Saldo_A_Favor
             WHERE id_proveedor = ? AND estado IN ('disponible','parcial')`,
            [idProveedor]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async aplicarACredito(idSaf: number, monto: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Saldo_A_Favor
             SET monto_aplicado = monto_aplicado + ?,
                 estado = CASE
                    WHEN monto_aplicado + ? >= monto_original THEN 'agotado'
                    WHEN monto_aplicado + ? > 0               THEN 'parcial'
                    ELSE 'disponible' END
             WHERE id = ?`,
            [monto, monto, monto, idSaf]
        );
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

    // ── Lectura ─────────────────────────────────────────────────────────────
    async relacionesDeCuenta(idCxp: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cpr.id_combustible, c.fecha, c.tipo_consumo, c.descripcion,
                    cpr.monto_aplicado,
                    ROUND(cpr.monto_aplicado * (cp.valor_pagado / NULLIF(cp.valor_total,0)), 2)     AS pagado,
                    ROUND(cpr.monto_aplicado * (1 - cp.valor_pagado / NULLIF(cp.valor_total,0)), 2) AS saldo
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar
             LEFT JOIN combustible c ON c.id = cpr.id_combustible
             WHERE cpr.id_cuenta_pagar = ? AND cpr.id_combustible IS NOT NULL
             ORDER BY c.fecha, cpr.id_combustible`,
            [idCxp]
        );
        return rows;
    }

    async abonadoCombustiblePorGasolinera(conn?: PoolConnection): Promise<Map<number, number>> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id_proveedor AS id_gasolinera, COALESCE(SUM(ab.valor),0) AS abonado
             FROM Cuentas_Por_Pagar cp
             JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
             WHERE cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Combustible' LIMIT 1)
               AND cp.estado != 'anulado'
             GROUP BY cp.id_proveedor`
        );
        const m = new Map<number, number>();
        for (const r of rows) m.set(Number(r.id_gasolinera), Number(r.abonado));
        return m;
    }

    async totalCreditoPorGasolinera(idGasolinera: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM combustible WHERE id_gasolinera = ? AND forma_pago = 'credito'`,
            [idGasolinera]
        );
        return Number(rows[0]?.total ?? 0);
    }

    // Gasolineras que tienen al menos un consumo a crédito (para el dashboard de deuda).
    async gasolinerasConCredito(conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT pr.id, pr.nombre, pr.alias
             FROM Proveedores pr
             JOIN combustible c ON c.id_gasolinera = pr.id
             WHERE c.forma_pago = 'credito'
             ORDER BY pr.nombre`
        );
        return rows;
    }

    async cuentasDeGasolinera(idGasolinera: number, anio?: number, mes?: number, conn?: PoolConnection): Promise<any[]> {
        const where: string[] = [
            `cp.id_proveedor = ?`,
            `cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Combustible' LIMIT 1)`,
            `cp.estado != 'anulado'`
        ];
        const params: any[] = [idGasolinera];
        if (anio) { where.push('YEAR(cp.fecha_creacion) = ?'); params.push(anio); }
        if (mes)  { where.push('MONTH(cp.fecha_creacion) = ?'); params.push(mes); }
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado, cp.fecha_creacion
             FROM Cuentas_Por_Pagar cp
             WHERE ${where.join(' AND ')}
             ORDER BY cp.fecha_creacion ASC, cp.id ASC`,
            params
        );
        return rows;
    }
}
