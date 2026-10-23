import { Pool, RowDataPacket } from 'mysql2/promise';
import { IFlujoCajaRepository, GastoPorCategoria, TotalesPorMes, TransaccionLibro } from '../../ports/pagos/repository_port/flujo_caja.repository.interface';

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

    // 3 consultas (una por tabla), agrupadas por mes — no 36 (12 meses × 3 totales) en loop.
    async totalesPorMesDelAnio(anio: number): Promise<Map<number, TotalesPorMes>> {
        const meses = new Map<number, TotalesPorMes>();
        for (let m = 1; m <= 12; m++) meses.set(m, { ingresos_tesoreria: 0, cobros_cxc: 0, gastos_cxp: 0 });

        const [itRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT MONTH(fecha) AS mes, COALESCE(SUM(valor),0) AS total
             FROM Ingresos_Tesoreria WHERE YEAR(fecha) = ? GROUP BY MONTH(fecha)`,
            [anio]
        );
        for (const r of itRows) meses.get(Number(r.mes))!.ingresos_tesoreria = Number(r.total);

        const cxcPh = METODOS_CXC_CAJA.map(() => '?').join(',');
        const [cxcRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT MONTH(fecha_cobro) AS mes, COALESCE(SUM(valor),0) AS total
             FROM Abonos_CxC WHERE YEAR(fecha_cobro) = ? AND metodo IN (${cxcPh}) GROUP BY MONTH(fecha_cobro)`,
            [anio, ...METODOS_CXC_CAJA]
        );
        for (const r of cxcRows) meses.get(Number(r.mes))!.cobros_cxc = Number(r.total);

        const cxpPh = METODOS_CXP_CAJA.map(() => '?').join(',');
        const [cxpRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT MONTH(fecha_abono) AS mes, COALESCE(SUM(valor),0) AS total
             FROM Abonos_CxP WHERE YEAR(fecha_abono) = ? AND metodo_pago IN (${cxpPh}) GROUP BY MONTH(fecha_abono)`,
            [anio, ...METODOS_CXP_CAJA]
        );
        for (const r of cxpRows) meses.get(Number(r.mes))!.gastos_cxp = Number(r.total);

        return meses;
    }

    // Beneficiario: el único de los 4 posibles (proveedor/empleado/minero/dueño de volqueta)
    // que no sea NULL en la Cuenta_Por_Pagar — mismo check CHECK que ya tiene esa tabla.
    async libroGastos(mes: number, anio: number): Promise<TransaccionLibro[]> {
        const placeholders = METODOS_CXP_CAJA.map(() => '?').join(',');
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT a.id, a.fecha_abono AS fecha, cat.nombre AS categoria, cat.color, cp.concepto,
                    COALESCE(prov.nombre, emp.nombre, min.nombre, duv.nombre) AS beneficiario,
                    a.valor AS monto, a.metodo_pago, a.comprobante_url, a.observaciones
             FROM Abonos_CxP a
             JOIN Cuentas_Por_Pagar cp ON cp.id = a.id_cuenta_pagar
             JOIN Categorias_CxP cat  ON cat.id = cp.id_categoria
             LEFT JOIN Proveedores prov     ON prov.id = cp.id_proveedor
             LEFT JOIN Empleados emp        ON emp.id  = cp.id_empleado
             LEFT JOIN Minero min            ON min.id  = cp.id_minero
             LEFT JOIN Dueno_Volqueta duv    ON duv.id  = cp.id_dueno_volqueta
             WHERE MONTH(a.fecha_abono) = ? AND YEAR(a.fecha_abono) = ? AND a.metodo_pago IN (${placeholders})
             ORDER BY a.fecha_abono DESC, a.id DESC`,
            [mes, anio, ...METODOS_CXP_CAJA]
        );
        return rows as unknown as TransaccionLibro[];
    }

    async libroCobros(mes: number, anio: number): Promise<TransaccionLibro[]> {
        const placeholders = METODOS_CXC_CAJA.map(() => '?').join(',');
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT a.id, a.fecha_cobro AS fecha, cat.nombre AS categoria, cat.color, cc.concepto,
                    COALESCE(emp.nombre, min.nombre, duv.nombre, prov.nombre) AS beneficiario,
                    a.valor AS monto, a.metodo AS metodo_pago, a.comprobante_url, a.observaciones
             FROM Abonos_CxC a
             JOIN Cuentas_Por_Cobrar cc ON cc.id = a.id_cxc
             JOIN Categorias_CxC cat   ON cat.id = cc.id_categoria
             LEFT JOIN Empleados emp        ON emp.id  = cc.id_empleado
             LEFT JOIN Minero min            ON min.id  = cc.id_minero
             LEFT JOIN Dueno_Volqueta duv    ON duv.id  = cc.id_dueno_volqueta
             LEFT JOIN Proveedores prov     ON prov.id = cc.id_proveedor
             WHERE MONTH(a.fecha_cobro) = ? AND YEAR(a.fecha_cobro) = ? AND a.metodo IN (${placeholders})
             ORDER BY a.fecha_cobro DESC, a.id DESC`,
            [mes, anio, ...METODOS_CXC_CAJA]
        );
        return rows as unknown as TransaccionLibro[];
    }
}
