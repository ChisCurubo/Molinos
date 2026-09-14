import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IPagoFleteRepository, FleteDelDueno } from '../../ports/pagos/repository_port/pago_flete.repository.interface';

/**
 * Repositorio del pago de FLETE al dueño de volqueta.
 * Modelo: 1 Cuenta_Por_Pagar por (dueño, mes) categoría 'Flete volqueta'; 1 Relacion por viaje
 * (id_entrada, subtipo='flete', monto_aplicado = flete NETO del viaje = costo_volqueta − ACPM).
 * Los abonos se aplican en cascada del mes más viejo al más nuevo (lógica en el service).
 * Reemplaza en la app al trigger `trg_after_abono_cxp` (estado_pago_flete + Volqueta_Vehiculo.estado_pago).
 */
export class PagoFleteRepository implements IPagoFleteRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async resolverCategoriaFlete(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id FROM Categorias_CxP WHERE nombre = 'Flete volqueta' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la categoría 'Flete volqueta' en Categorias_CxP");
        return Number(rows[0].id);
    }

    // Todos los fletes cobrables del dueño (no cancelados, con costo) + su ACPM propio.
    async fletesPayablesDelDueno(idDueno: number, conn?: PoolConnection): Promise<FleteDelDueno[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT mpe.id AS id_entrada, mpe.fecha_llegada, mpe.numero_volqueta,
                    mpe.id_vehiculo, vv.placa, mpe.costo_volqueta,
                    COALESCE((SELECT SUM(c.valor) FROM Combustible c
                              WHERE c.id_material_planta_entrada = mpe.id), 0) AS acpm
             FROM material_planta_entrada mpe
             JOIN Volqueta_Vehiculo vv ON vv.id = mpe.id_vehiculo
             WHERE vv.id_dueno_volqueta = ?
               AND mpe.estado != 'cancelada'
               AND mpe.costo_volqueta > 0
             ORDER BY mpe.fecha_llegada ASC, mpe.id ASC`,
            [idDueno]
        );
        return rows as FleteDelDueno[];
    }

    async idsEntradasConRelacionFlete(idDueno: number, conn?: PoolConnection): Promise<number[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT cpr.id_entrada
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             JOIN material_planta_entrada mpe ON mpe.id = cpr.id_entrada
             JOIN Volqueta_Vehiculo vv ON vv.id = mpe.id_vehiculo
             WHERE cpr.subtipo = 'flete' AND vv.id_dueno_volqueta = ?`,
            [idDueno]
        );
        return rows.map(r => Number(r.id_entrada));
    }

    // Busca la CxP del mes de un dueño por el mes de los fletes que ya contiene.
    async buscarCuentaMesFlete(idDueno: number, anio: number, mes: number, conn: PoolConnection): Promise<number | null> {
        const [rows] = await conn.execute<any[]>(
            `SELECT cp.id
             FROM Cuentas_Por_Pagar cp
             WHERE cp.id_dueno_volqueta = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Flete volqueta' LIMIT 1)
               AND cp.estado != 'anulado'
               AND YEAR(cp.fecha_creacion) = ? AND MONTH(cp.fecha_creacion) = ?
             ORDER BY cp.id LIMIT 1`,
            [idDueno, anio, mes]
        );
        return rows.length ? Number(rows[0].id) : null;
    }

    async crearCuentaFlete(data: { id_dueno_volqueta: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar
                (id_categoria, concepto, id_dueno_volqueta, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Flete volqueta' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_dueno_volqueta, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async crearRelacionFlete(idCxp: number, idEntrada: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion
                (id_cuenta_pagar, id_entrada, subtipo, monto_aplicado, concepto)
             VALUES (?, ?, 'flete', ?, ?)`,
            [idCxp, idEntrada, monto, concepto]
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

    // Cuentas de flete del dueño con saldo, ordenadas del mes más viejo al más nuevo.
    async cuentasAbiertasDelDueno(idDueno: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado, cp.fecha_creacion
             FROM Cuentas_Por_Pagar cp
             WHERE cp.id_dueno_volqueta = ?
               AND cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Flete volqueta' LIMIT 1)
               AND cp.estado IN ('pendiente','parcial')
             ORDER BY cp.fecha_creacion ASC, cp.id ASC`,
            [idDueno]
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

    // Todos los abonos de flete (todas las cuentas), paginado — para reportes/auditoría.
    async listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre = 'Flete volqueta' LIMIT 1)`];
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

    async esCuentaDeFlete(idCxp: number, conn?: PoolConnection): Promise<boolean> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT 1 FROM Cuentas_Por_Pagar
             WHERE id = ? AND id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Flete volqueta' LIMIT 1) LIMIT 1`,
            [idCxp]
        );
        return rows.length > 0;
    }

    // ── Efecto extra de flete (§6) ──────────────────────────────────────────
    async entradasYVehiculosDeCuenta(idCxp: number, conn?: PoolConnection): Promise<Array<{ id_entrada: number; id_vehiculo: number }>> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cpr.id_entrada, mpe.id_vehiculo
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN material_planta_entrada mpe ON mpe.id = cpr.id_entrada
             WHERE cpr.id_cuenta_pagar = ? AND cpr.subtipo = 'flete'`,
            [idCxp]
        );
        return rows.map(r => ({ id_entrada: Number(r.id_entrada), id_vehiculo: Number(r.id_vehiculo) }));
    }

    async actualizarEstadoFleteEntradas(ids: number[], estado: string, conn: PoolConnection): Promise<void> {
        if (ids.length === 0) return;
        const inClause = ids.map(() => '?').join(',');
        await conn.execute(
            `UPDATE material_planta_entrada SET estado_pago_flete = ?
             WHERE id IN (${inClause}) AND estado_pago_flete != 'no_aplica'`,
            [estado, ...ids]
        );
    }

    // Recomputa Volqueta_Vehiculo.estado_pago agregando el estado_pago_flete de sus entradas.
    async recomputarEstadoVehiculos(idsVehiculo: number[], conn: PoolConnection): Promise<void> {
        const unicos = [...new Set(idsVehiculo.filter(v => v != null))];
        if (unicos.length === 0) return;
        for (const idv of unicos) {
            await conn.execute(
                `UPDATE Volqueta_Vehiculo vv
                 SET vv.estado_pago = (
                    SELECT CASE
                        WHEN COUNT(*) = 0 THEN 'no_aplica'
                        WHEN SUM(e.estado_pago_flete = 'pagado')   = COUNT(*) THEN 'pagado'
                        WHEN SUM(e.estado_pago_flete = 'pendiente') = COUNT(*) THEN 'pendiente'
                        ELSE 'parcial' END
                    FROM material_planta_entrada e
                    WHERE e.id_vehiculo = vv.id AND e.estado_pago_flete != 'no_aplica' AND e.estado != 'cancelada'
                 )
                 WHERE vv.id = ?`,
                [idv]
            );
        }
    }

    // ── Saldo a favor por dueño (sobrepago de abonos) ───────────────────────
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

    async obtenerCreditosDisponiblesDueno(idDueno: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id, saldo_disponible FROM Saldo_A_Favor
             WHERE id_dueno_volqueta = ? AND estado IN ('disponible','parcial') AND (monto_original - monto_aplicado) > 0
             ORDER BY fecha, id`,
            [idDueno]
        );
        return rows;
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
    // Cada viaje de la cuenta con su bruto, su ACPM propio y el saldo prorrateado. Trazable 1:1.
    async relacionesConProrrateo(idCxp: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cpr.id_entrada,
                    mpe.numero_volqueta,
                    mpe.fecha_llegada,
                    vv.placa,
                    mpe.costo_volqueta                                  AS flete_bruto,
                    COALESCE((SELECT SUM(c.valor) FROM Combustible c
                              WHERE c.id_material_planta_entrada = mpe.id), 0) AS acpm,
                    cpr.monto_aplicado                                  AS flete_neto,
                    mpe.estado_pago_flete,
                    ROUND(cpr.monto_aplicado * (cp.valor_pagado / NULLIF(cp.valor_total,0)), 2)     AS pagado_flete,
                    ROUND(cpr.monto_aplicado * (1 - cp.valor_pagado / NULLIF(cp.valor_total,0)), 2) AS saldo_flete
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar
             LEFT JOIN material_planta_entrada mpe ON mpe.id = cpr.id_entrada
             LEFT JOIN Volqueta_Vehiculo vv ON vv.id = mpe.id_vehiculo
             WHERE cpr.id_cuenta_pagar = ? AND cpr.subtipo = 'flete'
             ORDER BY mpe.fecha_llegada, mpe.numero_volqueta`,
            [idCxp]
        );
        return rows;
    }

    // Abonado total de flete por dueño (para el dashboard de deuda).
    async abonadoFletePorDueno(conn?: PoolConnection): Promise<Map<number, number>> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.id_dueno_volqueta AS id_dueno, COALESCE(SUM(ab.valor),0) AS abonado
             FROM Cuentas_Por_Pagar cp
             JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
             WHERE cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Flete volqueta' LIMIT 1)
               AND cp.estado != 'anulado'
             GROUP BY cp.id_dueno_volqueta`
        );
        const m = new Map<number, number>();
        for (const r of rows) m.set(Number(r.id_dueno), Number(r.abonado));
        return m;
    }

    async duenoDeCuenta(idCxp: number, conn?: PoolConnection): Promise<number | null> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id_dueno_volqueta FROM Cuentas_Por_Pagar WHERE id = ?`, [idCxp]
        );
        return rows.length && rows[0].id_dueno_volqueta != null ? Number(rows[0].id_dueno_volqueta) : null;
    }

    // Dueños que tienen al menos un flete cobrable (para el dashboard de deuda).
    async duenosConFlete(conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT dv.id, dv.nombre, dv.alias, dv.banco, dv.numero_cuenta, dv.nequi
             FROM Dueno_Volqueta dv
             JOIN Volqueta_Vehiculo vv ON vv.id_dueno_volqueta = dv.id
             JOIN material_planta_entrada mpe ON mpe.id_vehiculo = vv.id
             WHERE mpe.estado != 'cancelada' AND mpe.costo_volqueta > 0
             ORDER BY dv.nombre`
        );
        return rows;
    }

    // Cuentas de flete del dueño (todas menos anuladas), con filtro opcional por mes/año.
    async cuentasDelDueno(idDueno: number, anio?: number, mes?: number, conn?: PoolConnection): Promise<any[]> {
        const where: string[] = [
            `cp.id_dueno_volqueta = ?`,
            `cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Flete volqueta' LIMIT 1)`,
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
}
