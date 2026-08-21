import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { IAguaPlantaRepository, CreateAguaPlantaDTO, AguaPlantaSQL, AguaViajeReporteRow } from '../../ports/material/repository_port/agua.repository.interface';

export class AguaPlantaRepository implements IAguaPlantaRepository {
    constructor(private pool: Pool) {}

    // 5.1 INSERT agua_planta
    async registrar(data: CreateAguaPlantaDTO): Promise<number> {
        const query = `
            INSERT INTO agua_planta (id_dueno_volqueta, fecha, valor_viaje, cantidad_viajes, acpm, comprobante_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_dueno_volqueta || null,
            data.fecha,
            data.valor_viaje,
            data.cantidad_viajes,
            data.acpm,
            data.comprobante_url || null
        ];
        
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    // 5.1.1 ACTUALIZAR agua_planta
    async actualizar(id: number, data: import('../../ports/material/repository_port/agua.repository.interface').UpdateAguaPlantaDTO): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.valor_viaje !== undefined) { fields.push('valor_viaje = ?'); values.push(data.valor_viaje); }
        if (data.cantidad_viajes !== undefined) { fields.push('cantidad_viajes = ?'); values.push(data.cantidad_viajes); }
        if (data.acpm !== undefined) { fields.push('acpm = ?'); values.push(data.acpm); }
        
        // El campo valor_total no se actualiza manualmente porque es una columna STORED generada automáticamente
        // si data.valor_total llegara, se ignora.
        
        if (data.comprobante_url !== undefined) { fields.push('comprobante_url = ?'); values.push(data.comprobante_url); }

        if (fields.length === 0) return true;

        values.push(id);
        const query = `UPDATE agua_planta SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    // 5.2 Listar viajes de agua con dueño
    async listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]> {
        const query = `
            SELECT
                ap.id,
                ap.fecha,
                dv.nombre AS dueno,
                dv.alias,
                ap.valor_viaje,
                ap.cantidad_viajes,
                ap.acpm,
                ap.valor_total,
                ap.comprobante_url,
                ap.created_at
            FROM agua_planta ap
            JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
            WHERE ap.fecha BETWEEN ? AND ?
            ORDER BY ap.fecha DESC
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [fechaDesde, fechaHasta]);
        return rows as AguaPlantaSQL[];
    }

    // 5.2.1 Listar viajes de agua filtrando por un dueño
    async listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]> {
        const query = `
            SELECT
                ap.id, ap.fecha, dv.nombre AS dueno, dv.alias,
                ap.valor_viaje, ap.cantidad_viajes, ap.acpm,
                ap.valor_total, ap.comprobante_url, ap.created_at
            FROM agua_planta ap
            JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
            WHERE dv.id = ?
            ORDER BY ap.fecha DESC
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id_dueno]);
        return rows as AguaPlantaSQL[];
    }

    // 5.3 Total de agua por dueño en un rango de fechas (para liquidación)
    async resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]> {
        const query = `
            SELECT
                dv.id,
                dv.nombre,
                COUNT(ap.id)            AS num_viajes,
                SUM(ap.cantidad_viajes) AS total_viajes,
                SUM(ap.valor_total)     AS total_a_pagar
            FROM agua_planta ap
            JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
            WHERE ap.fecha BETWEEN ? AND ?
            GROUP BY dv.id, dv.nombre
            ORDER BY dv.nombre
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [fechaDesde, fechaHasta]);
        return rows as any[];
    }

    // 5.4 Obtener un viaje de agua específico por ID
    async obtenerPorId(id: number): Promise<AguaPlantaSQL | null> {
        const query = `
            SELECT
                ap.id, ap.fecha, dv.id AS id_dueno, dv.nombre AS dueno, dv.alias,
                ap.valor_viaje, ap.cantidad_viajes, ap.acpm,
                ap.valor_total, ap.comprobante_url, ap.created_at
            FROM agua_planta ap
            JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
            WHERE ap.id = ?
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? (rows[0] as AguaPlantaSQL) : null;
    }

    // 5.5 Viajes de un período (para el reporte mensual agrupado por dueño)
    async obtenerViajesPeriodo(fechaDesde: string, fechaHasta: string): Promise<AguaViajeReporteRow[]> {
        const query = `
            SELECT
                ap.id, ap.fecha, dv.id AS id_dueno, dv.nombre AS dueno, dv.alias,
                ap.valor_viaje, ap.cantidad_viajes, ap.acpm, ap.valor_total
            FROM agua_planta ap
            JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
            WHERE ap.fecha BETWEEN ? AND ?
            ORDER BY dv.nombre, ap.fecha
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [fechaDesde, fechaHasta]);
        return rows as AguaViajeReporteRow[];
    }

    // 5.6 Saldo acumulado (neto) por dueño ANTES de una fecha — arrastre de meses previos
    async obtenerSaldosInicio(fechaDesde: string): Promise<{ id_dueno: number; saldo_inicio: number }[]> {
        const query = `
            SELECT ap.id_dueno_volqueta AS id_dueno, SUM(ap.valor_total) AS saldo_inicio
            FROM agua_planta ap
            WHERE ap.fecha < ?
            GROUP BY ap.id_dueno_volqueta
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [fechaDesde]);
        return rows as { id_dueno: number; saldo_inicio: number }[];
    }

    // 5.3.1 Resumen total por ID de dueño
    async resumenPorIdDueno(id_dueno: number): Promise<any> {
        const query = `
            SELECT
                dv.id,
                dv.nombre,
                COUNT(ap.id)            AS num_viajes,
                SUM(ap.cantidad_viajes) AS total_viajes,
                SUM(ap.valor_total)     AS total_a_pagar
            FROM agua_planta ap
            JOIN dueno_volqueta dv ON dv.id = ap.id_dueno_volqueta
            WHERE dv.id = ?
            GROUP BY dv.id, dv.nombre
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id_dueno]);
        return rows.length > 0 ? rows[0] : null;
    }
}
