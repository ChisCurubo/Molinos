import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IPagoMaterialRepository, EntradaPagoMaterial } from '../../ports/pagos/repository_port/pago_material.repository.interface';

/**
 * Repositorio del pago AGRUPADO de material (varias volquetas de un minero → 1 CxP).
 * Toda la lógica de negocio (validaciones, prorrateo) vive en el service; aquí solo SQL.
 * Reemplaza en la app al trigger `trg_after_abono_cxp` (que sigue Pendiente en la BD).
 */
export class PagoMaterialRepository implements IPagoMaterialRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection {
        return c || this.db;
    }

    async resolverCategoriaMaterial(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id FROM Categorias_CxP WHERE nombre = 'Material' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la categoría 'Material' en Categorias_CxP");
        return Number(rows[0].id);
    }

    async obtenerEntradasParaPago(ids: number[], conn?: PoolConnection): Promise<EntradaPagoMaterial[]> {
        if (ids.length === 0) return [];
        const inClause = ids.map(() => '?').join(',');
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT mpe.id, mpe.precio_total, mpe.numero_volqueta,
                    mi.id_minero, mn.nombre AS minero
             FROM material_planta_entrada mpe
             JOIN Mina   mi ON mi.id = mpe.id_mina
             LEFT JOIN Minero mn ON mn.id = mi.id_minero
             WHERE mpe.id IN (${inClause})`,
            ids
        );
        return rows as EntradaPagoMaterial[];
    }

    async entradasYaEnCuenta(ids: number[], excluirCuenta?: number, conn?: PoolConnection): Promise<number[]> {
        if (ids.length === 0) return [];
        const inClause = ids.map(() => '?').join(',');
        const params: any[] = [...ids];
        let filtroExcluir = '';
        if (excluirCuenta) { filtroExcluir = 'AND cpr.id_cuenta_pagar != ?'; params.push(excluirCuenta); }
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT DISTINCT cpr.id_entrada
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar
             WHERE cpr.subtipo = 'material' AND cp.estado != 'anulado'
               AND cpr.id_entrada IN (${inClause}) ${filtroExcluir}`,
            params
        );
        return rows.map(r => Number(r.id_entrada));
    }

    // --- Cuenta ---

    async crearCuenta(data: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar
                (id_categoria, concepto, id_minero, valor_total, valor_pagado, estado, fecha_limite)
             VALUES (?, ?, ?, ?, 0, 'pendiente', ?)`,
            [data.id_categoria, data.concepto, data.id_minero, data.valor_total, data.fecha_limite ?? null]
        );
        return result.insertId;
    }

    async obtenerCuenta(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cp.*, mn.nombre AS minero
             FROM Cuentas_Por_Pagar cp
             LEFT JOIN Minero mn ON mn.id = cp.id_minero
             WHERE cp.id = ?`,
            [id]
        );
        return rows.length ? rows[0] : null;
    }

    async actualizarCabeceraCuenta(id: number, campos: any, conn: PoolConnection): Promise<void> {
        const permitidos = ['concepto', 'fecha_limite'];
        const sets: string[] = [];
        const values: any[] = [];
        for (const k of permitidos) {
            if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(campos[k]); }
        }
        if (sets.length === 0) return;
        values.push(id);
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET ${sets.join(', ')} WHERE id = ?`, values);
    }

    async actualizarValorTotal(id: number, valorTotal: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET valor_total = ? WHERE id = ?`, [valorTotal, id]);
    }

    async recalcularCuenta(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Cuentas_Por_Pagar cp
             SET valor_pagado = (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id),
                 estado = CASE
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id) <= 0 THEN 'pendiente'
                    WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id) >= cp.valor_total THEN 'pagado'
                    ELSE 'parcial' END
             WHERE cp.id = ? AND cp.estado != 'anulado'`,
            [id]
        );
    }

    async anularCuenta(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Cuentas_Por_Pagar SET estado = 'anulado', deleted_at = NOW() WHERE id = ?`,
            [id]
        );
    }

    // --- Relaciones ---

    async crearRelacion(idCxp: number, idEntrada: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion
                (id_cuenta_pagar, id_entrada, subtipo, monto_aplicado, concepto)
             VALUES (?, ?, 'material', ?, ?)`,
            [idCxp, idEntrada, monto, concepto]
        );
    }

    async eliminarRelacion(idCxp: number, idEntrada: number, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `DELETE FROM Cuentas_Por_Pagar_Relacion
             WHERE id_cuenta_pagar = ? AND id_entrada = ? AND subtipo = 'material'`,
            [idCxp, idEntrada]
        );
        return result.affectedRows;
    }

    async idsEntradasDeCuenta(idCxp: number, conn?: PoolConnection): Promise<number[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id_entrada FROM Cuentas_Por_Pagar_Relacion
             WHERE id_cuenta_pagar = ? AND subtipo = 'material'`,
            [idCxp]
        );
        return rows.map(r => Number(r.id_entrada));
    }

    async sumaMontoRelaciones(idCxp: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(monto_aplicado),0) AS total
             FROM Cuentas_Por_Pagar_Relacion
             WHERE id_cuenta_pagar = ? AND subtipo = 'material'`,
            [idCxp]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async obtenerRelacionesConProrrateo(idCxp: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT cpr.id_entrada,
                    mpe.numero_volqueta,
                    mpe.fecha_llegada,
                    tm.nombre                       AS tipo_material,
                    -- Peso y humedad
                    mpe.peso_llegada_planta         AS peso_humedo,
                    mpe.porcentaje_humedad,
                    mpe.total_material_seco         AS peso_seco,
                    -- Ley / metal
                    mpe.tenor                       AS tenor_au,        -- gr Au por ton seca
                    mpe.total_gramos                AS gramos_oro,      -- gr Au totales
                    -- Precio del material (SIN gastos)
                    CASE WHEN mpe.precio_por_gramo IS NOT NULL AND mpe.precio_por_gramo > 0
                         THEN 'por_gramo' ELSE 'por_tonelada' END       AS metodo_precio,
                    mpe.precio_por_gramo,
                    mpe.precio_por_tonelada,
                    COALESCE(mpe.precio_por_gramo, mpe.precio_por_tonelada) AS precio_unitario,
                    mpe.precio_total                AS valor_material,  -- lo que se le paga al minero
                    -- Prorrateo del pago del grupo a esta volqueta
                    ROUND(cpr.monto_aplicado * (cp.valor_pagado / NULLIF(cp.valor_total,0)), 2)       AS pagado_volqueta,
                    ROUND(cpr.monto_aplicado * (1 - cp.valor_pagado / NULLIF(cp.valor_total,0)), 2)   AS saldo_volqueta
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar
             LEFT JOIN material_planta_entrada mpe ON mpe.id = cpr.id_entrada
             LEFT JOIN Tipos_Material tm ON tm.id = mpe.id_tipo_material
             WHERE cpr.id_cuenta_pagar = ? AND cpr.subtipo = 'material'
             ORDER BY mpe.fecha_llegada, mpe.numero_volqueta`,
            [idCxp]
        );
        return rows;
    }

    // Análisis de un conjunto de entradas (para mostrarlos en el detalle de cada volqueta).
    async obtenerAnalisisDeEntradas(ids: number[], conn?: PoolConnection): Promise<any[]> {
        if (ids.length === 0) return [];
        const inClause = ids.map(() => '?').join(',');
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT a.id_entrada,
                    a.id                    AS id_analisis,
                    a.numero_analisis,
                    a.id_tipo_analisis,
                    ta.nombre               AS tipo_analisis,
                    a.porcentaje_humedad,
                    a.toneladas_secas,
                    a.au_gr_x_ton           AS tenor_real_au,
                    a.ag_gr_x_ton           AS tenor_real_ag,
                    a.au_falso              AS tenor_falso,
                    a.au_concentrado,
                    a.ag_concentrado,
                    a.valor_analisis,
                    a.estado_pago,
                    a.fecha_salida
             FROM Analisis a
             LEFT JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
             WHERE a.id_entrada IN (${inClause})
             ORDER BY a.id_entrada, a.id_tipo_analisis, a.fecha_salida`,
            ids
        );
        return rows;
    }

    // --- Abonos ---

    async insertarAbono(abono: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxP
                (id_cuenta_pagar, fecha_abono, valor, metodo_pago, id_saldo_favor, comprobante_url, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                abono.id_cuenta_pagar, abono.fecha_abono, abono.valor,
                abono.metodo_pago || 'transferencia',
                abono.id_saldo_favor ?? null,
                abono.comprobante_url ?? null, abono.observaciones ?? null
            ]
        );
        return result.insertId;
    }

    // ── Saldo a favor (crédito por sobrepago) ───────────────────────────────

    // Registra un crédito por sobrepago para el minero.
    async crearSaldoAFavor(data: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Saldo_A_Favor
                (origen, id_abono_cxp_orig, id_minero, id_cuenta_pagar, monto_original, tipo_resolucion, descripcion)
             VALUES ('pago_excedido', ?, ?, ?, ?, 'descontar_futuro', ?)`,
            [data.id_abono_cxp_orig ?? null, data.id_minero, data.id_cuenta_pagar ?? null,
             data.monto_original, data.descripcion ?? null]
        );
        return result.insertId;
    }

    // Créditos disponibles del minero (más viejos primero).
    async obtenerCreditosDisponibles(idMinero: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id, saldo_disponible
             FROM Saldo_A_Favor
             WHERE id_minero = ? AND estado IN ('disponible','parcial') AND (monto_original - monto_aplicado) > 0
             ORDER BY fecha, id`,
            [idMinero]
        );
        return rows;
    }

    async sumaCreditoDisponible(idMinero: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(saldo_disponible),0) AS total
             FROM Saldo_A_Favor
             WHERE id_minero = ? AND estado IN ('disponible','parcial')`,
            [idMinero]
        );
        return Number(rows[0]?.total ?? 0);
    }

    // Aplica (o revierte, con monto negativo) crédito y ajusta el estado.
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

    // El crédito generado por un abono concreto (para revertir al borrarlo).
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

    async obtenerAbono(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT * FROM Abonos_CxP WHERE id = ?`, [id]
        );
        return rows.length ? rows[0] : null;
    }

    async actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void> {
        const permitidos = ['fecha_abono', 'valor', 'metodo_pago', 'comprobante_url', 'observaciones'];
        const sets: string[] = [];
        const values: any[] = [];
        for (const k of permitidos) {
            if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(campos[k]); }
        }
        if (sets.length === 0) return;
        values.push(id);
        await conn.execute(`UPDATE Abonos_CxP SET ${sets.join(', ')} WHERE id = ?`, values);
    }

    async eliminarAbono(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`DELETE FROM Abonos_CxP WHERE id = ?`, [id]);
    }

    async listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id, fecha_abono, valor, metodo_pago, comprobante_url, observaciones, created_at
             FROM Abonos_CxP WHERE id_cuenta_pagar = ? ORDER BY fecha_abono, id`,
            [idCxp]
        );
        return rows;
    }

    // Todos los abonos de material (todas las cuentas), paginado — para reportes/auditoría.
    async listarAbonosPaginado(filtros: { id_minero?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre = 'Material' LIMIT 1)`];
        const params: any[] = [];
        if (filtros.id_minero) { where.push('cp.id_minero = ?'); params.push(filtros.id_minero); }
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
                    cp.concepto, cp.id_minero, mn.nombre AS minero
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             LEFT JOIN minero mn ON mn.id = cp.id_minero
             WHERE ${whereSql}
             ORDER BY a.fecha_abono DESC, a.id DESC
             LIMIT ${filtros.limit} OFFSET ${offset}`,
            params
        );
        return { rows, total: Number(countRows[0]?.total ?? 0) };
    }

    async sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Abonos_CxP
             WHERE id_cuenta_pagar = ? AND id != ?`,
            [idCxp, excluirAbono]
        );
        return Number(rows[0]?.total ?? 0);
    }

    // --- Listado (tablero de deudas de material) ---

    async listarCuentasMaterial(filtros: any = {}): Promise<any[]> {
        const where: string[] = [`cp.id_categoria = (SELECT id FROM Categorias_CxP WHERE nombre='Material' LIMIT 1)`];
        const params: any[] = [];
        if (filtros.id_minero) { where.push('cp.id_minero = ?'); params.push(Number(filtros.id_minero)); }
        if (filtros.estado)    { where.push('cp.estado = ?'); params.push(filtros.estado); }
        else                   { where.push(`cp.estado != 'anulado'`); }
        const [rows] = await this.db.execute<any[]>(
            `SELECT cp.id, cp.concepto, cp.id_minero, mn.nombre AS minero,
                    cp.valor_total, cp.valor_pagado, cp.saldo, cp.estado,
                    cp.fecha_creacion, cp.fecha_limite,
                    (SELECT COUNT(*) FROM Cuentas_Por_Pagar_Relacion r
                      WHERE r.id_cuenta_pagar = cp.id AND r.subtipo = 'material') AS num_volquetas,
                    (SELECT COUNT(*) FROM Abonos_CxP a WHERE a.id_cuenta_pagar = cp.id) AS num_abonos
             FROM Cuentas_Por_Pagar cp
             LEFT JOIN Minero mn ON mn.id = cp.id_minero
             WHERE ${where.join(' AND ')}
             ORDER BY cp.fecha_creacion DESC, cp.id DESC`,
            params
        );
        return rows;
    }
}
