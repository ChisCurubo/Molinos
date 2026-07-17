import { Pool } from 'mysql2/promise';

export class InfoRepository {
  constructor(private db: Pool) {}
  async estadisticas(): Promise<any> {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM material_planta_entrada)                                     AS total_entradas,
        (SELECT COUNT(*) FROM material_planta_entrada WHERE estado = 'pendiente')          AS entradas_pendientes,
        (SELECT COUNT(*) FROM material_planta_entrada WHERE estado = 'en_proceso')         AS entradas_en_proceso,
        (SELECT COUNT(*) FROM material_planta_entrada WHERE estado = 'pagada')             AS entradas_pagadas,
        (SELECT COUNT(*) FROM material_planta_entrada WHERE estado = 'incluida_viaje')     AS entradas_en_viaje,
        (SELECT COUNT(*) FROM analisis)                                                    AS total_analisis,
        (SELECT COUNT(*) FROM analisis WHERE id_tipo_analisis = 1)                        AS analisis_cabeza,
        (SELECT COUNT(*) FROM minero WHERE estado = 'activo')                             AS mineros_activos,
        (SELECT COUNT(*) FROM mina WHERE estado = 'activa')                               AS minas_activas,
        (SELECT COUNT(*) FROM volqueta_vehiculo WHERE activo = 1)                         AS vehiculos_activos,
        (SELECT COUNT(*) FROM dueno_volqueta WHERE estado = 'activo')                     AS duenos_activos,
        (SELECT COUNT(*) FROM precio_material WHERE activo = 1)                           AS precios_vigentes
    `;
    const [rows] = await this.db.execute<any[]>(query);
    return rows[0];
  }

  async health(): Promise<{ db: boolean; uptime: number }> {
    try {
      await this.db.query('SELECT 1');
      return { db: true, uptime: process.uptime() };
    } catch {
      return { db: false, uptime: process.uptime() };
    }
  }
}
