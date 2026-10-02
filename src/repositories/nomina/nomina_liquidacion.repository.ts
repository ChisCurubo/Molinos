import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { INominaLiquidacionRepository } from '../../ports/nomina/repository_port/nomina_liquidacion.repository.interface';
import { NominaLiquidacionSQL } from '../../models/nomina/sql/nomina_liquidacion.sql';

export class NominaLiquidacionRepository implements INominaLiquidacionRepository {
    constructor(private db: Pool) {}

    private conn(c?: PoolConnection): Pool | PoolConnection { return c || this.db; }

    async crear(data: any, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Nomina_Liquidaciones
                (id_empleado, anio, mes, quincena, tipo_pago, unidades, tarifa_aplicada,
                 monto_bruto, total_bonos, total_descuento_prestamo, otros_descuentos, monto_neto,
                 estado, fecha_liquidacion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?)`,
            [
                data.id_empleado, data.anio, data.mes, data.quincena, data.tipo_pago,
                data.unidades, data.tarifa_aplicada, data.monto_bruto, data.total_bonos,
                data.total_descuento_prestamo, data.otros_descuentos, data.monto_neto,
                data.fecha_liquidacion || new Date().toISOString().slice(0, 10)
            ]
        );
        return result.insertId;
    }

    async obtenerPorId(id: number, conn?: PoolConnection): Promise<NominaLiquidacionSQL | null> {
        const [rows] = await this.conn(conn).execute<RowDataPacket[]>(
            `SELECT * FROM Nomina_Liquidaciones WHERE id = ?`, [id]
        );
        return rows.length ? (rows[0] as NominaLiquidacionSQL) : null;
    }

    async obtenerPorPeriodo(id_empleado: number, anio: number, mes: number, quincena: 1 | 2): Promise<NominaLiquidacionSQL | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT * FROM Nomina_Liquidaciones WHERE id_empleado = ? AND anio = ? AND mes = ? AND quincena = ?`,
            [id_empleado, anio, mes, quincena]
        );
        return rows.length ? (rows[0] as NominaLiquidacionSQL) : null;
    }

    async listar(filtros: { id_empleado?: number; anio?: number; mes?: number }): Promise<NominaLiquidacionSQL[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_empleado) { where.push('id_empleado = ?'); params.push(filtros.id_empleado); }
        if (filtros.anio) { where.push('anio = ?'); params.push(filtros.anio); }
        if (filtros.mes) { where.push('mes = ?'); params.push(filtros.mes); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT * FROM Nomina_Liquidaciones ${whereSql} ORDER BY anio DESC, mes DESC, quincena DESC, id DESC`,
            params
        );
        return rows as NominaLiquidacionSQL[];
    }

    async confirmarConCuentaPagar(id: number, id_cuenta_pagar: number, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Nomina_Liquidaciones SET id_cuenta_pagar = ? WHERE id = ?`,
            [id_cuenta_pagar, id]
        );
    }

    async crearCuentaPagar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number> {
        const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, id_empleado, valor_total, valor_pagado, estado, fecha_creacion)
             VALUES ((SELECT id FROM Categorias_CxP WHERE nombre='Nómina' LIMIT 1), ?, ?, ?, 0, 'pendiente', ?)`,
            [data.concepto, data.id_empleado, data.valor_total, data.fecha_creacion]
        );
        return result.insertId;
    }

    async crearBorrador(data: any, conn?: PoolConnection): Promise<number> {
        const [result] = await this.conn(conn).execute<ResultSetHeader>(
            `INSERT INTO Nomina_Liquidaciones
                (id_empleado, anio, mes, quincena, tipo_pago, unidades, tarifa_aplicada,
                 monto_bruto, total_bonos, total_descuento_prestamo, otros_descuentos, monto_neto,
                 estado, fecha_liquidacion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)`,
            [
                data.id_empleado, data.anio, data.mes, data.quincena, data.tipo_pago,
                data.unidades, data.tarifa_aplicada, data.monto_bruto, data.total_bonos,
                data.total_descuento_prestamo, data.otros_descuentos, data.monto_neto,
                data.fecha_liquidacion || new Date().toISOString().slice(0, 10)
            ]
        );
        return result.insertId;
    }

    async actualizarBorrador(id: number, data: { otros_descuentos: number; monto_neto: number }, conn?: PoolConnection): Promise<void> {
        await this.conn(conn).execute(
            `UPDATE Nomina_Liquidaciones SET otros_descuentos = ?, monto_neto = ? WHERE id = ? AND estado = 'borrador'`,
            [data.otros_descuentos, data.monto_neto, id]
        );
    }

    async confirmarBorrador(id: number, id_cuenta_pagar: number, data: {
        tipo_pago: string; unidades: number | null; tarifa_aplicada: number; monto_bruto: number;
        total_bonos: number; total_descuento_prestamo: number; monto_neto: number; fecha_liquidacion: string;
    }, conn: PoolConnection): Promise<void> {
        await conn.execute(
            `UPDATE Nomina_Liquidaciones
             SET tipo_pago = ?, unidades = ?, tarifa_aplicada = ?, monto_bruto = ?, total_bonos = ?,
                 total_descuento_prestamo = ?, monto_neto = ?, fecha_liquidacion = ?,
                 id_cuenta_pagar = ?, estado = 'confirmado'
             WHERE id = ? AND estado = 'borrador'`,
            [
                data.tipo_pago, data.unidades, data.tarifa_aplicada, data.monto_bruto, data.total_bonos,
                data.total_descuento_prestamo, data.monto_neto, data.fecha_liquidacion,
                id_cuenta_pagar, id
            ]
        );
    }
}
