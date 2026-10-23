import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { PrestamoFinancieroSQL } from '../../models/pagos/sql/prestamo_financiero.sql';
import { MovimientoPrestamoFinancieroSQL } from '../../models/pagos/sql/movimiento_prestamo_financiero.sql';
import { IPrestamoFinancieroRepository } from '../../ports/pagos/repository_port/prestamo_financiero.repository.interface';

export class PrestamoFinancieroRepository implements IPrestamoFinancieroRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async create(data: Partial<PrestamoFinancieroSQL>, conn?: PoolConnection): Promise<number> {
        const query = `
            INSERT INTO prestamos_financieros (nombre_prestamo, fecha_adquisicion, monto_principal, tasa_interes, saldo_pendiente, activo)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.nombre_prestamo, data.fecha_adquisicion, data.monto_principal, data.tasa_interes, data.saldo_pendiente, data.activo ?? 1
        ];
        const [result] = await this.conn(conn).query<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async getById(id: number, conn?: PoolConnection): Promise<PrestamoFinancieroSQL | null> {
        const [rows] = await this.conn(conn).query<RowDataPacket[]>('SELECT * FROM prestamos_financieros WHERE id = ?', [id]);
        return rows.length ? rows[0] as PrestamoFinancieroSQL : null;
    }

    async crearIngresoTesoreria(data: { concepto: string; valor: number; fecha: string; id_prestamo_fin: number }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Ingresos_Tesoreria (id_categoria, concepto, valor, fecha, id_prestamo_fin)
             VALUES ((SELECT id FROM Categorias_Ingreso WHERE nombre='Préstamo recibido' LIMIT 1), ?, ?, ?, ?)`,
            [data.concepto, data.valor, data.fecha, data.id_prestamo_fin]
        );
        return result.insertId;
    }

    async update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<boolean> {
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
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE prestamos_financieros SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number, conn?: PoolConnection): Promise<boolean> {
        const [result] = await this.conn(conn).query<ResultSetHeader>('DELETE FROM prestamos_financieros WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async eliminarIngresoTesoreria(id_prestamo_fin: number, conn: PoolConnection): Promise<void> {
        await conn.execute('DELETE FROM Ingresos_Tesoreria WHERE id_prestamo_fin = ?', [id_prestamo_fin]);
    }

    async list(): Promise<PrestamoFinancieroSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM prestamos_financieros ORDER BY fecha_adquisicion DESC');
        return rows as PrestamoFinancieroSQL[];
    }

    async actualizarSaldo(id: number, nuevoSaldo: number, activo: boolean, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE prestamos_financieros SET saldo_pendiente = ?, activo = ? WHERE id = ?`, [nuevoSaldo, activo, id]);
    }

    /**
     * CxP persistente del préstamo (categoría 'Préstamo financiero', nace 'pendiente' por
     * monto_principal). A diferencia del patrón viejo (una CxP nueva ya pagada por cada abono),
     * esta SÍ aparece en /pagos/cxp/mensual como deuda real mientras no se termine de pagar —
     * decisión 2026-10-23. Una sola fila en Cuentas_Por_Pagar_Relacion por préstamo (no una por abono).
     */
    async crearCxPInicial(data: { id_prestamo_fin: number; concepto: string; valor_total: number; fecha: string }, conn: PoolConnection): Promise<number> {
        const [cxpResult] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Préstamo financiero' LIMIT 1), ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.valor_total, data.fecha]
        );
        const idCxp = cxpResult.insertId;
        await conn.execute(
            `INSERT INTO Cuentas_Por_Pagar_Relacion (id_cuenta_pagar, id_prestamo_fin, monto_aplicado, concepto)
             VALUES (?, ?, ?, ?)`,
            [idCxp, data.id_prestamo_fin, data.valor_total, data.concepto]
        );
        return idCxp;
    }

    async obtenerCxP(id_prestamo_fin: number, conn?: PoolConnection): Promise<{ id: number; valor_total: number; valor_pagado: number } | null> {
        const [rows] = await this.conn(conn).execute<RowDataPacket[]>(
            `SELECT cp.id, cp.valor_total, cp.valor_pagado
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar
             WHERE cpr.id_prestamo_fin = ?`,
            [id_prestamo_fin]
        );
        return rows.length ? (rows[0] as any) : null;
    }

    // Capitalizar interés crece la deuda total de la CxP — sin esto, saldo (valor_total-valor_pagado)
    // se desincroniza de Prestamos_Financieros.saldo_pendiente.
    async aumentarValorTotalCxP(idCxp: number, incremento: number, conn: PoolConnection): Promise<void> {
        await conn.execute(`UPDATE Cuentas_Por_Pagar SET valor_total = valor_total + ? WHERE id = ?`, [incremento, idCxp]);
        await this.recalcularEstadoCxP(idCxp, conn);
    }

    async registrarAbono(idCxp: number, data: { fecha_abono: string; valor: number; metodo_pago?: string; comprobante_url?: string; observaciones?: string }, conn: PoolConnection): Promise<number> {
        const [abonoResult] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Abonos_CxP (id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idCxp, data.fecha_abono, data.valor, data.metodo_pago || 'transferencia', data.comprobante_url ?? null, data.observaciones ?? null]
        );
        await this.recalcularEstadoCxP(idCxp, conn);
        return abonoResult.insertId;
    }

    async recalcularEstadoCxP(idCxp: number, conn: PoolConnection): Promise<void> {
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

    // Solo se usa cuando delete() ya validó que el préstamo no tiene abonos ni interés acumulado
    // (saldo_pendiente === monto_principal) — Abonos_CxP está vacía, se puede borrar sin rastro que perder.
    async eliminarCxP(id_prestamo_fin: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `DELETE FROM Cuentas_Por_Pagar WHERE id = (SELECT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_fin = ? LIMIT 1)`,
            [id_prestamo_fin]
        );
    }

    async insertarMovimiento(data: {
        id_prestamo_fin: number; tipo: 'interes' | 'abono'; fecha: string; valor: number;
        saldo_resultante: number; id_abono_cxp: number | null; observaciones?: string | null;
    }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Movimientos_Prestamo_Financiero
                (id_prestamo_fin, tipo, fecha, valor, saldo_resultante, id_abono_cxp, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.id_prestamo_fin, data.tipo, data.fecha, data.valor, data.saldo_resultante, data.id_abono_cxp, data.observaciones ?? null]
        );
        return result.insertId;
    }

    async obtenerMovimiento(id: number, conn?: PoolConnection): Promise<MovimientoPrestamoFinancieroSQL | null> {
        const [rows] = await this.conn(conn).query<RowDataPacket[]>(
            'SELECT * FROM Movimientos_Prestamo_Financiero WHERE id = ?', [id]
        );
        return rows.length ? rows[0] as MovimientoPrestamoFinancieroSQL : null;
    }

    async ultimoMovimiento(id_prestamo_fin: number, conn?: PoolConnection): Promise<MovimientoPrestamoFinancieroSQL | null> {
        const [rows] = await this.conn(conn).query<RowDataPacket[]>(
            `SELECT * FROM Movimientos_Prestamo_Financiero WHERE id_prestamo_fin = ? ORDER BY fecha DESC, id DESC LIMIT 1`,
            [id_prestamo_fin]
        );
        return rows.length ? rows[0] as MovimientoPrestamoFinancieroSQL : null;
    }

    async listarMovimientos(id_prestamo_fin: number): Promise<MovimientoPrestamoFinancieroSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Movimientos_Prestamo_Financiero WHERE id_prestamo_fin = ? ORDER BY fecha ASC, id ASC`,
            [id_prestamo_fin]
        );
        return rows as MovimientoPrestamoFinancieroSQL[];
    }
}
