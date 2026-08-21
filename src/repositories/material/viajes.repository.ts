import { PoolConnection, ResultSetHeader, Pool } from 'mysql2/promise';
import { IViajesRepository } from '../../ports/material/viajes.interface';

export class ViajesRepository implements IViajesRepository {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    private getConn(conn?: PoolConnection): PoolConnection | Pool {
        return conn || this.db;
    }

    // Saneador de enteros para LIMIT/OFFSET (mysql2 no bindea bien LIMIT ?).
    private sanitInt(v: any, def: number, max = Number.MAX_SAFE_INTEGER): number {
        const n = parseInt(String(v ?? def), 10);
        if (isNaN(n) || n < 0) return def;
        return Math.min(n, max);
    }

    async crearCabeceraViaje(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO Viaje (
                numero_viaje, fecha, comentarios
            ) VALUES (?, ?, ?)
        `;
        const values = [
            data.numero_viaje,
            data.fecha || new Date(),
            data.comentarios || null
        ];
        
        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async obtenerViajePorId(id: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT * FROM Viaje WHERE id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // Trae el lote + su análisis de concentrado (tipo 2) más reciente, para derivar la línea del viaje.
    async obtenerLoteConAnalisis(idLote: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT mc.id, mc.codigo, mc.porcentaje_humedad, mc.toneladas_humedo,
                    mc.toneladas_seco, mc.toneladas_disponibles, mc.estado,
                    a.au_gr_x_ton AS tenor_au, a.ag_gr_x_ton AS tenor_ag
             FROM material_concentrado mc
             LEFT JOIN Analisis a
                    ON a.id_material_concentrado = mc.id AND a.id_tipo_analisis = 2
             WHERE mc.id = ?
             ORDER BY a.fecha_salida DESC, a.id DESC
             LIMIT 1`,
            [idLote]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async asignarLoteAViaje(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        // costo_maquila NO se envía: lo fija el trigger BEFORE INSERT según el estado del lote.
        const query = `
            INSERT INTO viaje_material (
                id_viaje, id_material_concentrado, total_concentrado_humedo,
                concentrado_seco, porcentaje_humedad, peso_humedad,
                es_remanente, id_viaje_origen, concepto,
                valor_total_con_gastos,
                tenor_au_venta, total_grs_au_venta, tenor_ag, total_grs_ag_venta
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_viaje,
            data.id_material_concentrado,
            data.total_concentrado_humedo,
            data.concentrado_seco || 0,
            data.porcentaje_humedad || 0,
            data.peso_humedad || 0,
            data.es_remanente || 0,
            data.id_viaje_origen || null,
            data.concepto || null,
            data.valor_total_con_gastos ?? null,
            data.tenor_au_venta ?? null,
            data.total_grs_au_venta ?? null,
            data.tenor_ag ?? null,
            data.total_grs_ag_venta ?? null
        ];

        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async eliminarLineaViaje(idLinea: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `DELETE FROM viaje_material WHERE id = ?`,
            [idLinea]
        );
    }

    async obtenerLineaViajePorId(idLinea: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT * FROM viaje_material WHERE id = ?`,
            [idLinea]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async obtenerLineasDeViaje(idViaje: number, conn?: PoolConnection): Promise<any[]> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT id FROM viaje_material WHERE id_viaje = ?`,
            [idViaje]
        );
        return rows;
    }

    async eliminarViaje(idViaje: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(`DELETE FROM Viaje WHERE id = ?`, [idViaje]);
    }

    // --- LECTURA (listados / detalle / resumen / trazabilidad) ---------------

    // Cabeceras de viaje con agregados (sumas de sus líneas) y filtros. Acepta filtro por id.
    async listarViajes(f: any = {}): Promise<any[]> {
        const where: string[] = ['1=1'];
        const params: any[] = [];
        if (f.id)           { where.push('v.id = ?'); params.push(Number(f.id)); }
        if (f.desde)        { where.push('v.fecha >= ?'); params.push(f.desde); }
        if (f.hasta)        { where.push('v.fecha <= ?'); params.push(f.hasta); }
        if (f.numero_viaje) { where.push('v.numero_viaje LIKE ?'); params.push(`%${f.numero_viaje}%`); }
        if (f.id_lote)      { where.push('v.id IN (SELECT id_viaje FROM viaje_material WHERE id_material_concentrado = ?)'); params.push(Number(f.id_lote)); }
        if (f.codigo_lote)  { where.push('v.id IN (SELECT vm2.id_viaje FROM viaje_material vm2 JOIN material_concentrado mc2 ON mc2.id = vm2.id_material_concentrado WHERE mc2.codigo LIKE ?)'); params.push(`%${f.codigo_lote}%`); }
        const lim = this.sanitInt(f.limit, 1000, 5000);
        const off = this.sanitInt(f.offset, 0);
        const query = `
            SELECT v.id, v.numero_viaje, v.fecha, v.comentarios,
                COALESCE(SUM(vm.total_concentrado_humedo),0) AS total_concentrado_humedo,
                COALESCE(SUM(vm.concentrado_seco),0)         AS total_concentrado_seco,
                COALESCE(SUM(vm.costo_maquila),0)            AS maquila_total,
                COALESCE(SUM(vm.valor_total_con_gastos),0)   AS valor_material_total,
                COALESCE(SUM(vm.total_grs_au_venta),0)       AS au_gramos_total,
                COALESCE(SUM(vm.total_grs_ag_venta),0)       AS ag_gramos_total
            FROM Viaje v
            LEFT JOIN viaje_material vm ON vm.id_viaje = v.id
            WHERE ${where.join(' AND ')}
            GROUP BY v.id
            ORDER BY v.fecha DESC, v.id DESC
            LIMIT ${lim} OFFSET ${off}
        `;
        const [rows] = await this.db.execute<any[]>(query, params);
        return rows;
    }

    // Líneas de un conjunto de viajes (para embeber sin N+1).
    async obtenerLineasDeViajes(idViajes: number[]): Promise<any[]> {
        if (idViajes.length === 0) return [];
        const inClause = idViajes.map(() => '?').join(',');
        const query = `
            SELECT vm.id, vm.id_viaje, vm.id_material_concentrado, mc.codigo AS codigo_lote,
                   vm.concepto, vm.total_concentrado_humedo AS concentrado_humedo,
                   vm.porcentaje_humedad, vm.concentrado_seco, vm.costo_maquila,
                   vm.valor_total_con_gastos AS valor_total,
                   vm.tenor_au_venta AS au_gr_x_ton, vm.tenor_ag AS ag_gr_x_ton,
                   vm.total_grs_au_venta AS au_gramos, vm.total_grs_ag_venta AS ag_gramos
            FROM viaje_material vm
            LEFT JOIN material_concentrado mc ON mc.id = vm.id_material_concentrado
            WHERE vm.id_viaje IN (${inClause})
            ORDER BY vm.id
        `;
        const [rows] = await this.db.execute<any[]>(query, idViajes);
        return rows;
    }

    // Agregados del período (KPIs).
    async resumenViajes(f: any = {}): Promise<any> {
        const where: string[] = ['1=1'];
        const params: any[] = [];
        if (f.desde) { where.push('v.fecha >= ?'); params.push(f.desde); }
        if (f.hasta) { where.push('v.fecha <= ?'); params.push(f.hasta); }
        const query = `
            SELECT COUNT(DISTINCT v.id) AS total_viajes,
                COALESCE(SUM(vm.total_concentrado_humedo),0) AS toneladas_humedo,
                COALESCE(SUM(vm.concentrado_seco),0)         AS toneladas_seco,
                COALESCE(SUM(vm.costo_maquila),0)            AS maquila_total,
                COALESCE(SUM(vm.valor_total_con_gastos),0)   AS valor_material_total,
                COALESCE(SUM(vm.total_grs_au_venta),0)       AS au_gramos_total,
                COALESCE(SUM(vm.total_grs_ag_venta),0)       AS ag_gramos_total
            FROM Viaje v
            LEFT JOIN viaje_material vm ON vm.id_viaje = v.id
            WHERE ${where.join(' AND ')}
        `;
        const [rows] = await this.db.execute<any[]>(query, params);
        return rows[0];
    }

    // Trazabilidad: en qué viajes salió un lote y cuánto metal llevó.
    async listarLineasPorLote(idLote: number): Promise<any[]> {
        const query = `
            SELECT v.id AS id_viaje, v.numero_viaje, v.fecha,
                   vm.total_concentrado_humedo AS concentrado_humedo, vm.concentrado_seco,
                   vm.total_grs_au_venta AS au_gramos, vm.total_grs_ag_venta AS ag_gramos
            FROM viaje_material vm
            JOIN Viaje v ON v.id = vm.id_viaje
            WHERE vm.id_material_concentrado = ?
            ORDER BY v.fecha DESC, v.id DESC
        `;
        const [rows] = await this.db.execute<any[]>(query, [idLote]);
        return rows;
    }

    // --- TRAZABILIDAD COMPLETA (viaje/línea → lote → materiales de origen) ----

    // Líneas de un viaje con datos de su lote (para el árbol de trazabilidad).
    async obtenerLineasConLote(idViaje: number): Promise<any[]> {
        const query = `
            SELECT vm.id AS id_linea, vm.id_material_concentrado AS id_lote,
                   mc.codigo AS codigo_lote, mc.estado AS estado_lote,
                   vm.total_concentrado_humedo AS concentrado_humedo, vm.concentrado_seco,
                   vm.total_grs_au_venta AS au_gramos, vm.total_grs_ag_venta AS ag_gramos
            FROM viaje_material vm
            LEFT JOIN material_concentrado mc ON mc.id = vm.id_material_concentrado
            WHERE vm.id_viaje = ?
            ORDER BY vm.id
        `;
        const [rows] = await this.db.execute<any[]>(query, [idViaje]);
        return rows;
    }

    // Materiales (entradas) que compusieron uno o varios lotes, con su aporte.
    async obtenerAportesDeLotes(idLotes: number[]): Promise<any[]> {
        if (idLotes.length === 0) return [];
        const inClause = idLotes.map(() => '?').join(',');
        const query = `
            SELECT pm.id_material_concentrado AS id_lote,
                   mpe.id AS id_entrada, mpe.numero_volqueta,
                   mi.nombre AS mina, mn.nombre AS minero,
                   mpe.fecha_llegada, mpe.tenor, mpe.total_material_seco,
                   pm.toneladas_aportadas, pm.toneladas_seco_aportadas,
                   pm.concentrado_proporcional, pm.maquila_proporcional
            FROM procesamiento_material pm
            JOIN material_planta_entrada mpe ON mpe.id = pm.id_entrada
            LEFT JOIN mina mi ON mi.id = mpe.id_mina
            LEFT JOIN minero mn ON mn.id = mi.id_minero
            WHERE pm.id_material_concentrado IN (${inClause})
            ORDER BY pm.id_material_concentrado, mpe.fecha_llegada
        `;
        const [rows] = await this.db.execute<any[]>(query, idLotes);
        return rows;
    }
}
