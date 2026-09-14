import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IPagoAguaRepository, AguaDelDueno } from '../../ports/pagos/repository_port/pago_agua.repository.interface';

/**
 * Repositorio del pago de AGUA al dueño de camión cisterna.
 * Modelo: 1 Cuenta_Por_Pagar por (dueño, mes) categoría 'Agua'; 1 Relacion por registro de agua
 * (id_agua, monto_aplicado = NETO = bruto − ACPM de Combustible, piso 0). Abonos en cascada del mes
 * más viejo al más nuevo (lógica en el service). El ACPM se cruza desde Combustible (por id_agua),
 * nunca desde la columna legada agua_planta.acpm.
 */
export class PagoAguaRepository implements IPagoAguaRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async resolverCategoriaAgua(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id FROM Categorias_CxP WHERE nombre = 'Agua' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la categoría 'Agua' en Categorias_CxP");
        return Number(rows[0].id);
    }

    async aguasPayablesDelDueno(idDueno: number, conn?: PoolConnection): Promise<AguaDelDueno[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT ap.id AS id_agua, ap.fecha, ap.valor_viaje, ap.cantidad_viajes,
                    ap.valor_total AS bruto,
                    COALESCE((SELECT SUM(c.valor) FROM combustible c WHERE c.id_agua = ap.id), 0) AS acpm,
                    GREATEST(ap.valor_total - COALESCE((SELECT SUM(c.valor) FROM combustible c WHERE c.id_agua = ap.id), 0), 0) AS neto
             FROM agua_planta ap
             WHERE ap.id_dueno_volqueta = ? AND ap.valor_total > 0
             ORDER BY ap.fecha ASC, ap.id ASC`,
            [idDueno]
        );
        return rows as AguaDelDueno[];
    }

    async idsAguaConRelacion(idDueno: number, conn?: PoolConnection): Promise<number[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT cpr.id_agua
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             JOIN agua_planta ap ON ap.id = cpr.id_agua
             WHERE cpr.id_agua IS NOT NULL AND ap.id_dueno_volqueta = ?`,
            [idDueno]
        );
        return rows.map(r => Number(r.id_agua));
    }

    async buscarCuentaMesAgua(idDueno: number, anio: number, mes: number, conn: PoolConnection): Promise<number | null> {
        const [rows] = await conn.execute<any[]>(
            `SELECT cp.id FROM Cuentas_Por_Pagar cp
             WHERE cp.id_dueno_volqueta = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1)
               AND cp.estado != 'anulado'
               AND YEAR(cp.fecha_creacion) = ? AND MONTH(cp.fecha_creacion) = ?
             ORDER BY cp.id LIMIT 1`,
            [idDueno, anio, mes]
        );
        return rows.length ? Number(rows[0].id) : null;
    }

    async crearCuentaAgua(data: { id_dueno_volqueta: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar
                (id_categoria, concepto, id_dueno_volqueta, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_dueno_volqueta, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    // Relacion de agua: enlace por id_agua, subtipo NULL (el CHECK solo permite subtipo con id_entrada).
    async crearRelacionAgua(idCxp: number, idAgua: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion
                (id_cuenta_pagar, id_agua, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, idAgua, monto, concepto]
        );
    }

    async sumarValorTotal(idCxp: number, delta: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET valor_total = valor_total + ? WHERE id = ?`, [delta, idCxp]);
    }

    async obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.*, dv.nombre AS dueno_volqueta
             FROM Cuentas_Por_Pagar cp
             LEFT JOIN Dueno_Volqueta dv ON dv.id = cp.id_dueno_volqueta
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

    async cuentasAbiertasDelDueno(idDueno: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado, cp.fecha_creacion
             FROM Cuentas_Por_Pagar cp
             WHERE cp.id_dueno_volqueta = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1)
               AND cp.estado IN ('pendiente','parcial')
             ORDER BY cp.fecha_creacion ASC, cp.id ASC`,
            [idDueno]
        );
        return rows;
    }

    async cuentasDelDueno(idDueno: number, anio?: number, mes?: number, conn?: PoolConnection): Promise<any[]> {
        const where: string[] = [
            `cp.id_dueno_volqueta = ?`,
            `cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1)`,
            `cp.estado != 'anulado'`
        ];
        const params: any[] = [idDueno];
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

    // Todos los abonos de agua (todas las cuentas), paginado — para reportes/auditoría.
    async listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre = 'Agua' LIMIT 1)`];
        const params: any[] = [];
        if (filtros.id_dueno_volqueta) { where.push('cp.id_dueno_volqueta = ?'); params.push(filtros.id_dueno_volqueta); }
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
                    cp.concepto, cp.id_dueno_volqueta, dv.nombre AS dueno_volqueta
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             LEFT JOIN Dueno_Volqueta dv ON dv.id = cp.id_dueno_volqueta
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

    async esCuentaDeAgua(idCxp: number, conn?: PoolConnection): Promise<boolean> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT 1 FROM Cuentas_Por_Pagar
             WHERE id = ? AND id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1) LIMIT 1`,
            [idCxp]
        );
        return rows.length > 0;
    }

    async idsAguaDeCuenta(idCxp: number, conn?: PoolConnection): Promise<number[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id_agua FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar = ? AND id_agua IS NOT NULL`,
            [idCxp]
        );
        return rows.map(r => Number(r.id_agua));
    }

    async actualizarEstadoAguaRegistros(ids: number[], estado: string, conn: PoolConnection): Promise<void> {
        if (ids.length === 0) return;
        const inClause = ids.map(() => '?').join(',');
        await conn.execute(
            `UPDATE agua_planta SET estado_pago = ?
             WHERE id IN (${inClause}) AND estado_pago != 'no_aplica'`,
            [estado, ...ids]
        );
    }

    // ── Saldo a favor por dueño ─────────────────────────────────────────────
    async crearSaldoAFavorDueno(data: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Saldo_A_Favor
                (origen, id_abono_cxp_orig, id_dueno_volqueta, id_cuenta_pagar, monto_original, tipo_resolucion, descripcion)
             VALUES ('pago_excedido', ?, ?, ?, ?, 'descontar_futuro', ?)`,
            [data.id_abono_cxp_orig ?? null, data.id_dueno_volqueta, data.id_cuenta_pagar ?? null,
             data.monto_original, data.descripcion ?? null]
        );
        return result.insertId;
    }

    async sumaCreditoDisponibleDueno(idDueno: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(saldo_disponible),0) AS total FROM Saldo_A_Favor
             WHERE id_dueno_volqueta = ? AND estado IN ('disponible','parcial')`,
            [idDueno]
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
    async relacionesConProrrateo(idCxp: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cpr.id_agua,
                    ap.fecha,
                    ap.valor_viaje,
                    ap.cantidad_viajes,
                    ap.valor_total                                      AS bruto,
                    COALESCE((SELECT SUM(c.valor) FROM combustible c WHERE c.id_agua = ap.id), 0) AS acpm,
                    cpr.monto_aplicado                                  AS neto,
                    ap.estado_pago,
                    ROUND(cpr.monto_aplicado * (cp.valor_pagado / NULLIF(cp.valor_total,0)), 2)     AS pagado,
                    ROUND(cpr.monto_aplicado * (1 - cp.valor_pagado / NULLIF(cp.valor_total,0)), 2) AS saldo
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar
             LEFT JOIN agua_planta ap ON ap.id = cpr.id_agua
             WHERE cpr.id_cuenta_pagar = ? AND cpr.id_agua IS NOT NULL
             ORDER BY ap.fecha`,
            [idCxp]
        );
        return rows;
    }

    async abonadoAguaPorDueno(conn?: PoolConnection): Promise<Map<number, number>> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id_dueno_volqueta AS id_dueno, COALESCE(SUM(ab.valor),0) AS abonado
             FROM Cuentas_Por_Pagar cp
             JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
             WHERE cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1)
               AND cp.estado != 'anulado'
             GROUP BY cp.id_dueno_volqueta`
        );
        const m = new Map<number, number>();
        for (const r of rows) m.set(Number(r.id_dueno), Number(r.abonado));
        return m;
    }

    async duenosConAgua(conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT dv.id, dv.nombre, dv.alias, dv.banco, dv.numero_cuenta, dv.nequi
             FROM Dueno_Volqueta dv
             JOIN agua_planta ap ON ap.id_dueno_volqueta = dv.id
             WHERE ap.valor_total > 0
             ORDER BY dv.nombre`
        );
        return rows;
    }
}
