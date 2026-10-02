import { Pool, RowDataPacket } from 'mysql2/promise';
import { IFlujoCajaRepository, GastoPorCategoria } from '../../ports/pagos/repository_port/flujo_caja.repository.interface';

/**
 * Métodos de pago que representan movimiento REAL de caja. Se excluyen a propósito los
 * métodos de compensación interna — no mueven dinero, solo netean una deuda contra otra:
 *  - Abonos_CxP.metodo_pago: 'saldo_a_favor' (usa un crédito previo) y 'descuento_nomina'
 *    (se rebaja del salario del empleado, no sale efectivo aparte).
 *  - Abonos_CxC.metodo: 'descuento_flete'/'descuento_nomina' (se compensa contra otro pago,
 *    no entra efectivo aparte — de hecho el CxP de nómina que originó el descuento ya sale
 *    NETO de esa cuota, así que sumar el abono de nuevo aquí duplicaría el efecto en caja).
 */
const METODOS_CXP_CAJA = ['efectivo', 'consignacion', 'transferencia', 'nequi', 'otro'];
const METODOS_CXC_CAJA = ['efectivo', 'transferencia', 'otro'];

export class FlujoCajaRepository implements IFlujoCajaRepository {
    constructor(private db: Pool) {}

    async ingresosTesoreriaDelMes(mes: number, anio: number): Promise<number> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Ingresos_Tesoreria WHERE MONTH(fecha) = ? AND YEAR(fecha) = ?`,
            [mes, anio]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async cobrosCxCDelMes(mes: number, anio: number): Promise<number> {
        const placeholders = METODOS_CXC_CAJA.map(() => '?').join(',');
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Abonos_CxC
             WHERE MONTH(fecha_cobro) = ? AND YEAR(fecha_cobro) = ? AND metodo IN (${placeholders})`,
            [mes, anio, ...METODOS_CXC_CAJA]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async gastosCxPDelMes(mes: number, anio: number): Promise<number> {
        const placeholders = METODOS_CXP_CAJA.map(() => '?').join(',');
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Abonos_CxP
             WHERE MONTH(fecha_abono) = ? AND YEAR(fecha_abono) = ? AND metodo_pago IN (${placeholders})`,
            [mes, anio, ...METODOS_CXP_CAJA]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async gastosCxPPorCategoriaDelMes(mes: number, anio: number): Promise<GastoPorCategoria[]> {
        const placeholders = METODOS_CXP_CAJA.map(() => '?').join(',');
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT c.id AS id_categoria, c.nombre AS categoria, c.color,
                    COALESCE(SUM(a.valor),0) AS total
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             JOIN Categorias_CxP c     ON c.id = cp.id_categoria
             WHERE MONTH(a.fecha_abono) = ? AND YEAR(a.fecha_abono) = ? AND a.metodo_pago IN (${placeholders})
             GROUP BY c.id, c.nombre, c.color
             ORDER BY total DESC`,
            [mes, anio, ...METODOS_CXP_CAJA]
        );
        return rows.map(r => ({ id_categoria: Number(r.id_categoria), categoria: r.categoria, color: r.color ?? null, total: Number(r.total) }));
    }

    async gastosCxPPorCategoriaHistorico(): Promise<GastoPorCategoria[]> {
        const placeholders = METODOS_CXP_CAJA.map(() => '?').join(',');
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT c.id AS id_categoria, c.nombre AS categoria, c.color,
                    COALESCE(SUM(a.valor),0) AS total
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             JOIN Categorias_CxP c     ON c.id = cp.id_categoria
             WHERE a.metodo_pago IN (${placeholders})
             GROUP BY c.id, c.nombre, c.color
             ORDER BY total DESC`,
            METODOS_CXP_CAJA
        );
        return rows.map(r => ({ id_categoria: Number(r.id_categoria), categoria: r.categoria, color: r.color ?? null, total: Number(r.total) }));
    }

    async totalesHistoricos(): Promise<{ ingresos_tesoreria: number; cobros_cxc: number; gastos_cxp: number }> {
        const [itRows] = await this.db.execute<RowDataPacket[]>(`SELECT COALESCE(SUM(valor),0) AS total FROM Ingresos_Tesoreria`);
        const cxcPh = METODOS_CXC_CAJA.map(() => '?').join(',');
        const [cxcRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Abonos_CxC WHERE metodo IN (${cxcPh})`, METODOS_CXC_CAJA
        );
        const cxpPh = METODOS_CXP_CAJA.map(() => '?').join(',');
        const [cxpRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(valor),0) AS total FROM Abonos_CxP WHERE metodo_pago IN (${cxpPh})`, METODOS_CXP_CAJA
        );
        return {
            ingresos_tesoreria: Number(itRows[0]?.total ?? 0),
            cobros_cxc: Number(cxcRows[0]?.total ?? 0),
            gastos_cxp: Number(cxpRows[0]?.total ?? 0)
        };
    }
}
