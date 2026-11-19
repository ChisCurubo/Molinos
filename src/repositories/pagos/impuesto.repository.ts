import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { FiltrosImpuestosAplicados, IImpuestoRepository } from '../../ports/pagos/repository_port/impuesto.repository.interface';
import { ImpuestoAplicadoSQL, ImpuestoSQL } from '../../models/pagos/sql/impuesto.sql';

export class ImpuestoRepository implements IImpuestoRepository {
    constructor(private db: Pool) {}

    async list(): Promise<ImpuestoSQL[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM Impuestos ORDER BY nombre`);
        return rows as ImpuestoSQL[];
    }

    async listarAplicados(filtros: FiltrosImpuestosAplicados): Promise<ImpuestoAplicadoSQL[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_cuenta_bancaria) { where.push('ia.id_cuenta_bancaria = ?'); params.push(filtros.id_cuenta_bancaria); }
        if (filtros.desde) { where.push('ia.fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('ia.fecha <= ?'); params.push(filtros.hasta); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT ia.*, imp.nombre AS impuesto, cb.nombre AS cuenta_bancaria
             FROM Impuestos_Aplicados ia
             JOIN Impuestos imp        ON imp.id = ia.id_impuesto
             JOIN Cuentas_Bancarias cb ON cb.id  = ia.id_cuenta_bancaria
             ${whereSql}
             ORDER BY ia.fecha DESC, ia.id DESC`,
            params
        );
        return rows as ImpuestoAplicadoSQL[];
    }
}

/**
 * Calcula y persiste el 4x1000 sobre un abono recién insertado — llamarla con la MISMA
 * conexión/transacción del INSERT en Abonos_CxP para que quede atómico. No hace nada si
 * id_cuenta_bancaria es nulo (pago que no mueve una cuenta real) o si la cuenta está exenta.
 */
export async function aplicarImpuesto4x1000(
    conn: Pool | PoolConnection,
    p: { id_abono_cxp: number; id_cuenta_bancaria?: number | null; valor_base: number; fecha: string | Date }
): Promise<void> {
    if (!p.id_cuenta_bancaria) return;

    const [cuentaRows] = await conn.execute<RowDataPacket[]>(
        `SELECT exento_4x1000 FROM Cuentas_Bancarias WHERE id = ?`, [p.id_cuenta_bancaria]
    );
    if (!cuentaRows.length || cuentaRows[0].exento_4x1000) return;

    const [impRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id, tasa FROM Impuestos WHERE nombre = '4x1000' AND activo = 1 LIMIT 1`
    );
    if (!impRows.length) return;

    const valorImpuesto = Math.round(Number(p.valor_base) * Number(impRows[0].tasa) * 100) / 100;
    if (!(valorImpuesto > 0)) return;

    await conn.execute<ResultSetHeader>(
        `INSERT INTO Impuestos_Aplicados (id_impuesto, id_abono_cxp, id_cuenta_bancaria, valor_base, valor_impuesto, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [impRows[0].id, p.id_abono_cxp, p.id_cuenta_bancaria, p.valor_base, valorImpuesto, p.fecha]
    );
}
