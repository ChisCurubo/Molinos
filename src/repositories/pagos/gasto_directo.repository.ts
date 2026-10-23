import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { IGastoDirectoRepository, EditarGastoDirectoData } from '../../ports/pagos/repository_port/gasto_directo.repository.interface';

const CATEGORIA_SQL = `(SELECT id FROM Categorias_CxP WHERE nombre='Gasto Directo' LIMIT 1)`;

/**
 * Gasto Directo: todo gasto pagado de inmediato (parqueadero, peajes, etc.) es su propia
 * Cuenta_Por_Pagar ya pagada — sin saldo de caja física que rastrear (decisión 2026-10-22,
 * reemplaza el diseño de Caja Menor con Deposito/Gasto_Operativo).
 */
export class GastoDirectoRepository implements IGastoDirectoRepository {
    constructor(private db: Pool) {}

    async crear(data: { concepto: string; monto: number; fecha: string; metodo_pago?: string; comprobante_url: string; observaciones?: string }): Promise<{ id_cuenta_pagar: number; id_abono: number }> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const [cxpResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, valor_total, valor_pagado, estado, fecha_creacion)
                 VALUES (${CATEGORIA_SQL}, ?, ?, ?, 'pagado', ?)`,
                [data.concepto, data.monto, data.monto, data.fecha]
            );
            const idCxp = cxpResult.insertId;

            const [abonoResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO Abonos_CxP (id_cuenta_pagar, fecha_abono, valor, metodo_pago, comprobante_url, observaciones)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [idCxp, data.fecha, data.monto, data.metodo_pago || 'efectivo', data.comprobante_url, data.observaciones ?? null]
            );

            await conn.commit();
            return { id_cuenta_pagar: idCxp, id_abono: abonoResult.insertId };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    async listar(filtros: { desde?: string; hasta?: string }): Promise<any[]> {
        const where: string[] = [`cp.id_categoria = ${CATEGORIA_SQL}`, `cp.estado != 'anulado'`];
        const params: any[] = [];
        if (filtros.desde) { where.push('cp.fecha_creacion >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('cp.fecha_creacion <= ?'); params.push(filtros.hasta); }
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total AS monto, cp.fecha_creacion AS fecha, cp.created_at,
                    ab.id AS id_abono, ab.metodo_pago, ab.comprobante_url, ab.observaciones
             FROM Cuentas_Por_Pagar cp
             JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
             WHERE ${where.join(' AND ')}
             ORDER BY cp.fecha_creacion DESC, cp.id DESC`,
            params
        );
        return rows;
    }

    async obtenerPorId(id: number): Promise<any | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT cp.id, cp.concepto, cp.valor_total AS monto, cp.fecha_creacion AS fecha, cp.estado, cp.created_at,
                    ab.id AS id_abono, ab.metodo_pago, ab.comprobante_url, ab.observaciones
             FROM Cuentas_Por_Pagar cp
             JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
             WHERE cp.id = ? AND cp.id_categoria = ${CATEGORIA_SQL}`,
            [id]
        );
        return rows[0] ?? null;
    }

    // Corrige un gasto mal digitado (monto, comprobante, fecha...) sin anular y recrear —
    // actualiza la CxP y su abono juntos, ya que son un solo movimiento (siempre pagada 1:1).
    async editar(id: number, cambios: EditarGastoDirectoData): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const cxpSets: string[] = []; const cxpParams: any[] = [];
            if (cambios.concepto !== undefined) { cxpSets.push('concepto = ?'); cxpParams.push(cambios.concepto); }
            if (cambios.monto !== undefined) { cxpSets.push('valor_total = ?, valor_pagado = ?'); cxpParams.push(cambios.monto, cambios.monto); }
            if (cambios.fecha !== undefined) { cxpSets.push('fecha_creacion = ?'); cxpParams.push(cambios.fecha); }
            if (cxpSets.length) {
                cxpParams.push(id);
                await conn.execute(
                    `UPDATE Cuentas_Por_Pagar SET ${cxpSets.join(', ')} WHERE id = ? AND id_categoria = ${CATEGORIA_SQL}`,
                    cxpParams
                );
            }

            const abonoSets: string[] = []; const abonoParams: any[] = [];
            if (cambios.monto !== undefined) { abonoSets.push('valor = ?'); abonoParams.push(cambios.monto); }
            if (cambios.fecha !== undefined) { abonoSets.push('fecha_abono = ?'); abonoParams.push(cambios.fecha); }
            if (cambios.metodo_pago !== undefined) { abonoSets.push('metodo_pago = ?'); abonoParams.push(cambios.metodo_pago); }
            if (cambios.comprobante_url !== undefined) { abonoSets.push('comprobante_url = ?'); abonoParams.push(cambios.comprobante_url); }
            if (cambios.observaciones !== undefined) { abonoSets.push('observaciones = ?'); abonoParams.push(cambios.observaciones); }
            if (abonoSets.length) {
                abonoParams.push(id);
                await conn.execute(`UPDATE Abonos_CxP SET ${abonoSets.join(', ')} WHERE id_cuenta_pagar = ?`, abonoParams);
            }

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    async anular(id: number): Promise<boolean> {
        const [result] = await this.db.execute<ResultSetHeader>(
            `UPDATE Cuentas_Por_Pagar SET estado = 'anulado', deleted_at = NOW()
             WHERE id = ? AND id_categoria = ${CATEGORIA_SQL} AND estado != 'anulado'`,
            [id]
        );
        return result.affectedRows > 0;
    }
}
