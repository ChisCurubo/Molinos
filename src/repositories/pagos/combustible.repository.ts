import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
    ICombustibleRepository,
    CrearCombustibleDTO,
    CombustibleRow,
    FleteConAcpmRow,
    ResumenMensualCombustibleRow,
    TopGasolineraRow,
    TopDuenoAdelantoRow
} from '../../ports/pagos/repository_port/combustible.repository.interface';

export class CombustibleRepository implements ICombustibleRepository {
    constructor(private db: Pool) {}

    private getConn(conn?: PoolConnection): PoolConnection | Pool {
        return conn || this.db;
    }

    // SELECT base con los nombres de origen (gasolinera/dueño/placa) y el estado de pago
    // (v_estado_combustible: efectivo→siempre pagado; credito→pendiente/parcial/pagado según abonos).
    private readonly SELECT_BASE = `
        SELECT
            c.id, c.id_gasolinera, pr.nombre AS gasolinera, c.tipo_consumo, c.forma_pago,
            c.id_dueno_volqueta, dv.nombre AS dueno_volqueta,
            c.id_vehiculo, vv.placa,
            c.id_planta, c.id_material_planta_entrada, c.id_agua,
            c.fecha, c.descripcion, c.valor, c.comprobante_url, c.created_at,
            COALESCE(ve.estado_pago, 'pendiente')   AS estado_pago,
            COALESCE(ve.total_pagado, 0)             AS total_pagado,
            COALESCE(ve.saldo_pendiente, c.valor)    AS saldo_pendiente
        FROM combustible c
        LEFT JOIN proveedores pr     ON pr.id = c.id_gasolinera
        LEFT JOIN dueno_volqueta dv  ON dv.id = c.id_dueno_volqueta
        LEFT JOIN volqueta_vehiculo vv ON vv.id = c.id_vehiculo
        LEFT JOIN v_estado_combustible ve ON ve.id = c.id
    `;

    async crear(data: CrearCombustibleDTO, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO combustible (
                id_gasolinera, tipo_consumo, forma_pago, id_dueno_volqueta, id_vehiculo, id_planta,
                id_material_planta_entrada, id_agua, fecha, descripcion, valor, comprobante_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_gasolinera ?? null,
            data.tipo_consumo || 'vehiculo',
            data.forma_pago || 'credito',
            data.id_dueno_volqueta ?? null,
            data.id_vehiculo ?? null,
            data.id_planta ?? null,
            data.id_material_planta_entrada ?? null,
            data.id_agua ?? null,
            data.fecha,
            data.descripcion ?? null,
            data.valor,
            data.comprobante_url ?? null
        ];
        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async actualizarValor(id: number, valor: number, comprobante_url: string | null | undefined, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        if (comprobante_url !== undefined) {
            await connection.execute(
                'UPDATE combustible SET valor = ?, comprobante_url = ? WHERE id = ?',
                [valor, comprobante_url ?? null, id]
            );
        } else {
            await connection.execute('UPDATE combustible SET valor = ? WHERE id = ?', [valor, id]);
        }
    }

    async eliminarPorEntrada(idEntrada: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute('DELETE FROM combustible WHERE id_material_planta_entrada = ?', [idEntrada]);
    }

    async eliminarPorAgua(idAgua: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute('DELETE FROM combustible WHERE id_agua = ?', [idAgua]);
    }

    async actualizar(id: number, data: Partial<CrearCombustibleDTO>): Promise<void> {
        const campos: string[] = [];
        const values: any[] = [];
        const asignables: (keyof CrearCombustibleDTO)[] = [
            'id_gasolinera', 'tipo_consumo', 'forma_pago', 'id_dueno_volqueta', 'id_vehiculo',
            'id_planta', 'fecha', 'descripcion', 'valor', 'comprobante_url'
        ];
        for (const campo of asignables) {
            if (data[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                values.push(data[campo]);
            }
        }
        if (campos.length === 0) return;
        values.push(id);
        await this.db.execute(`UPDATE combustible SET ${campos.join(', ')} WHERE id = ?`, values);
    }

    async eliminar(id: number): Promise<void> {
        await this.db.execute('DELETE FROM combustible WHERE id = ?', [id]);
    }

    // ¿Ya fue agrupado en una Cuenta_Por_Pagar (materializado por el módulo de pago a la
    // gasolinera)? Si existe la Relacion, el valor ya está sumado en Cuentas_Por_Pagar.valor_total
    // — editar/eliminar aquí desincronizaría esa cuenta, tenga o no abonos ya aplicados.
    async estadoCxpDeCombustible(id: number, conn?: PoolConnection): Promise<{ materializado: boolean; abonado: number }> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT cp.valor_pagado
             FROM Cuentas_Por_Pagar_Relacion cpr
             JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
             WHERE cpr.id_combustible = ?
             LIMIT 1`,
            [id]
        );
        if (!rows.length) return { materializado: false, abonado: 0 };
        return { materializado: true, abonado: Number(rows[0].valor_pagado) };
    }

    async obtenerAcpmDeEntrada(idEntrada: number, conn?: PoolConnection): Promise<CombustibleRow | null> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE c.id_material_planta_entrada = ? ORDER BY c.id LIMIT 1`,
            [idEntrada]
        );
        return rows.length > 0 ? (rows[0] as CombustibleRow) : null;
    }

    async obtenerAcpmDeAgua(idAgua: number, conn?: PoolConnection): Promise<CombustibleRow | null> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE c.id_agua = ? ORDER BY c.id LIMIT 1`,
            [idAgua]
        );
        return rows.length > 0 ? (rows[0] as CombustibleRow) : null;
    }

    async sumaPorEntrada(idEntrada: number, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT COALESCE(SUM(valor), 0) AS total FROM combustible WHERE id_material_planta_entrada = ?',
            [idEntrada]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async sumaPorAgua(idAgua: number, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT COALESCE(SUM(valor), 0) AS total FROM combustible WHERE id_agua = ?',
            [idAgua]
        );
        return Number(rows[0]?.total ?? 0);
    }

    async fletesConAcpmPorDueno(idDueno: number, conn?: PoolConnection): Promise<FleteConAcpmRow[]> {
        const connection = this.getConn(conn);
        const query = `
            SELECT
                mpe.id AS id_entrada, mpe.fecha_llegada, mpe.numero_volqueta,
                vv.placa, mpe.costo_volqueta,
                COALESCE((
                    SELECT SUM(c.valor) FROM combustible c
                    WHERE c.id_material_planta_entrada = mpe.id
                ), 0) AS acpm
            FROM material_planta_entrada mpe
            JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
            WHERE vv.id_dueno_volqueta = ? AND mpe.estado != 'cancelada'
            ORDER BY mpe.fecha_llegada ASC, mpe.id ASC
        `;
        const [rows] = await connection.execute<RowDataPacket[]>(query, [idDueno]);
        return rows as FleteConAcpmRow[];
    }

    async listar(filtros: { desde?: string; hasta?: string; id_gasolinera?: number; id_dueno_volqueta?: number; tipo_consumo?: string; forma_pago?: string }): Promise<CombustibleRow[]> {
        const where: string[] = ['1 = 1'];
        const params: any[] = [];
        if (filtros.desde && filtros.hasta) { where.push('c.fecha BETWEEN ? AND ?'); params.push(filtros.desde, filtros.hasta); }
        if (filtros.id_gasolinera) { where.push('c.id_gasolinera = ?'); params.push(filtros.id_gasolinera); }
        if (filtros.id_dueno_volqueta) { where.push('c.id_dueno_volqueta = ?'); params.push(filtros.id_dueno_volqueta); }
        if (filtros.tipo_consumo) { where.push('c.tipo_consumo = ?'); params.push(filtros.tipo_consumo); }
        if (filtros.forma_pago) { where.push('c.forma_pago = ?'); params.push(filtros.forma_pago); }

        const [rows] = await this.db.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE ${where.join(' AND ')} ORDER BY c.fecha DESC, c.id DESC`,
            params
        );
        return rows as CombustibleRow[];
    }

    async obtenerPorId(id: number): Promise<CombustibleRow | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `${this.SELECT_BASE} WHERE c.id = ?`,
            [id]
        );
        return rows.length > 0 ? (rows[0] as CombustibleRow) : null;
    }

    async resumenMensual(filtros: { anio?: number; forma_pago?: string; tipo_consumo?: string }): Promise<ResumenMensualCombustibleRow[]> {
        const where: string[] = ['1 = 1'];
        const params: any[] = [];
        if (filtros.anio) { where.push('YEAR(c.fecha) = ?'); params.push(filtros.anio); }
        if (filtros.forma_pago) { where.push('c.forma_pago = ?'); params.push(filtros.forma_pago); }
        if (filtros.tipo_consumo) { where.push('c.tipo_consumo = ?'); params.push(filtros.tipo_consumo); }

        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT
                DATE_FORMAT(c.fecha, '%Y-%m') AS periodo,
                COUNT(*) AS cantidad,
                COALESCE(SUM(c.valor), 0) AS total,
                COALESCE(SUM(CASE WHEN c.forma_pago = 'efectivo' THEN c.valor ELSE 0 END), 0) AS total_efectivo,
                COALESCE(SUM(CASE WHEN c.forma_pago = 'credito'  THEN c.valor ELSE 0 END), 0) AS total_credito,
                COALESCE(SUM(CASE WHEN c.tipo_consumo = 'vehiculo'   THEN c.valor ELSE 0 END), 0) AS total_vehiculo,
                COALESCE(SUM(CASE WHEN c.tipo_consumo = 'planta'     THEN c.valor ELSE 0 END), 0) AS total_planta,
                COALESCE(SUM(CASE WHEN c.tipo_consumo = 'maquinaria' THEN c.valor ELSE 0 END), 0) AS total_maquinaria,
                COALESCE(SUM(CASE WHEN c.tipo_consumo = 'otro'       THEN c.valor ELSE 0 END), 0) AS total_otro
            FROM combustible c
            WHERE ${where.join(' AND ')}
            GROUP BY periodo
            ORDER BY periodo DESC`,
            params
        );
        return rows as unknown as ResumenMensualCombustibleRow[];
    }

    async topGasolinerasPorValor(limite: number): Promise<TopGasolineraRow[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT c.id_gasolinera, pr.nombre AS gasolinera, COALESCE(SUM(c.valor),0) AS total, COUNT(*) AS cantidad
             FROM combustible c
             LEFT JOIN proveedores pr ON pr.id = c.id_gasolinera
             WHERE c.id_gasolinera IS NOT NULL
             GROUP BY c.id_gasolinera, pr.nombre
             ORDER BY total DESC
             LIMIT ${Number(limite) || 5}`
        );
        return rows as unknown as TopGasolineraRow[];
    }

    async topDuenosPorAdelanto(limite: number): Promise<TopDuenoAdelantoRow[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT c.id_dueno_volqueta, dv.nombre AS dueno_volqueta, COALESCE(SUM(c.valor),0) AS total_adelantado, COUNT(*) AS cantidad
             FROM combustible c
             LEFT JOIN dueno_volqueta dv ON dv.id = c.id_dueno_volqueta
             WHERE c.id_dueno_volqueta IS NOT NULL AND c.forma_pago = 'efectivo'
             GROUP BY c.id_dueno_volqueta, dv.nombre
             ORDER BY total_adelantado DESC
             LIMIT ${Number(limite) || 5}`
        );
        return rows as unknown as TopDuenoAdelantoRow[];
    }
}
