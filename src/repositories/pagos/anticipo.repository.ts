import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { IAnticipoRepository, TerceroAnticipo } from '../../ports/pagos/repository_port/anticipo.repository.interface';

// Whitelist fija — nunca se arma a partir de input del usuario sin pasar por este mapa.
const COLUMNA_TERCERO: Record<TerceroAnticipo, string> = {
    minero: 'id_minero',
    dueno_volqueta: 'id_dueno_volqueta',
    proveedor: 'id_proveedor'
};

/**
 * Repositorio de Anticipos a terceros (minero/dueño de volqueta/proveedor).
 * Ver IAnticipoRepository para el diseño de las 3 tablas involucradas.
 */
export class AnticipoRepository implements IAnticipoRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async resolverCategoriaAnticipo(conn?: PoolConnection): Promise<number> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id FROM Categorias_CxP WHERE nombre = 'Anticipo' LIMIT 1`
        );
        if (!rows.length) throw new Error("No existe la categoría 'Anticipo' en Categorias_CxP");
        return Number(rows[0].id);
    }

    async crearAnticipo(data: { tercero: TerceroAnticipo; id: number; fecha: string; monto: number; descripcion?: string }, conn: PoolConnection): Promise<number> {
        const col = COLUMNA_TERCERO[data.tercero];
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Anticipos_Terceros (${col}, fecha, monto_inicial, monto_usado, descripcion, estado)
             VALUES (?, ?, ?, 0, ?, 'disponible')`,
            [data.id, data.fecha, data.monto, data.descripcion ?? null]
        );
        return result.insertId;
    }

    async obtenerAnticipo(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT at.*,
                    m.nombre  AS minero,
                    dv.nombre AS dueno_volqueta,
                    p.nombre  AS proveedor
             FROM Anticipos_Terceros at
             LEFT JOIN Minero m          ON m.id  = at.id_minero
             LEFT JOIN Dueno_Volqueta dv ON dv.id = at.id_dueno_volqueta
             LEFT JOIN Proveedores p     ON p.id  = at.id_proveedor
             WHERE at.id = ?`,
            [id]
        );
        return rows.length ? rows[0] : null;
    }

    async listarAnticipos(filtros: { tercero?: TerceroAnticipo; id?: number; estado?: string }): Promise<any[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.tercero) {
            const col = COLUMNA_TERCERO[filtros.tercero];
            where.push(`at.${col} IS NOT NULL`);
            if (filtros.id) { where.push(`at.${col} = ?`); params.push(filtros.id); }
        }
        if (filtros.estado) { where.push('at.estado = ?'); params.push(filtros.estado); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<any[]>(
            `SELECT at.*,
                    m.nombre  AS minero,
                    dv.nombre AS dueno_volqueta,
                    p.nombre  AS proveedor
             FROM Anticipos_Terceros at
             LEFT JOIN Minero m          ON m.id  = at.id_minero
             LEFT JOIN Dueno_Volqueta dv ON dv.id = at.id_dueno_volqueta
             LEFT JOIN Proveedores p     ON p.id  = at.id_proveedor
             ${whereSql}
             ORDER BY at.fecha DESC, at.id DESC`,
            params
        );
        return rows;
    }

    async actualizarUsoAnticipo(id: number, deltaUsado: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Anticipos_Terceros
             SET monto_usado = monto_usado + ?,
                 estado = CASE
                    WHEN estado = 'anulado'                THEN estado
                    WHEN monto_usado + ? >= monto_inicial   THEN 'agotado'
                    ELSE 'disponible' END
             WHERE id = ?`,
            [deltaUsado, deltaUsado, id]
        );
    }

    async anularAnticipo(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Anticipos_Terceros SET estado = 'anulado' WHERE id = ?`, [id]);
    }

    async crearCuentaAnticipo(data: { tercero: TerceroAnticipo; id: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const col = COLUMNA_TERCERO[data.tercero];
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, ${col}, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Anticipo' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async anularCuenta(idCxp: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET estado = 'anulado', deleted_at = NOW() WHERE id = ?`, [idCxp]);
    }

    async crearRelacionAnticipo(idCxp: number, idAnticipo: number, monto: number, concepto: string, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion (id_cuenta_pagar, id_anticipo, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, idAnticipo, monto, concepto]
        );
    }

    async cuentaDeAnticipo(idAnticipo: number, conn?: PoolConnection): Promise<number | null> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_anticipo = ? LIMIT 1`,
            [idAnticipo]
        );
        return rows.length ? Number(rows[0].id_cuenta_pagar) : null;
    }

    async insertarAbono(abono: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxP (id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [abono.id_cuenta_pagar, abono.fecha_abono, abono.valor,
             abono.metodo_pago || 'efectivo', abono.comprobante_url ?? null, abono.observaciones ?? null]
        );
        return result.insertId;
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

    async crearSaldoAFavorAnticipo(data: { id_anticipo: number; tercero: TerceroAnticipo; id: number; id_cuenta_pagar: number; monto_original: number; descripcion?: string }, conn: PoolConnection): Promise<number> {
        const col = COLUMNA_TERCERO[data.tercero];
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Saldo_A_Favor (origen, id_anticipo, ${col}, id_cuenta_pagar, monto_original, tipo_resolucion, estado, descripcion)
             VALUES ('anticipo', ?, ?, ?, ?, 'descontar_futuro', 'disponible', ?)`,
            [data.id_anticipo, data.id, data.id_cuenta_pagar, data.monto_original, data.descripcion ?? null]
        );
        return result.insertId;
    }

    async saldoAFavorDeAnticipo(idAnticipo: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT * FROM Saldo_A_Favor WHERE id_anticipo = ? LIMIT 1`,
            [idAnticipo]
        );
        return rows.length ? rows[0] : null;
    }

    async eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`DELETE FROM Saldo_A_Favor WHERE id = ?`, [id]);
    }

    async historialDescuentos(idAnticipo: number, conn?: PoolConnection): Promise<any[]> {
        const [rows] = await this.conn(conn).execute<any[]>(
            `SELECT h.*, mpe.numero_volqueta
             FROM Historial_Descuentos_Anticipos h
             LEFT JOIN material_planta_entrada mpe ON mpe.id = h.id_entrada
             WHERE h.id_anticipo = ?
             ORDER BY h.fecha DESC, h.id DESC`,
            [idAnticipo]
        );
        return rows;
    }
}
