import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import Database from '../../../config/database.config';
import { IAguaPlantaRepository, CreateAguaPlantaDTO, AguaPlantaSQL } from '../../../ports/material/repository_port/agua.repository.interface';

export class AguaPlantaRepository implements IAguaPlantaRepository {
    private pool: Pool;

    constructor() {
        this.pool = Database.getInstance();
    }

    // 5.1 INSERT agua_planta
    async registrar(data: CreateAguaPlantaDTO): Promise<number> {
        const query = `
            INSERT INTO agua_planta (id_dueno_volqueta, fecha, valor_viaje, cantidad_viajes, acpm, comprobante_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_dueno_volqueta,
            data.fecha,
            data.valor_viaje,
            data.cantidad_viajes,
            data.acpm,
            data.comprobante_url || null
        ];
        
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.insertId;
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
}
