import { Pool } from 'mysql2/promise';

export class DeudaRepository {
  constructor(private db: Pool) {}
  async deudaMaterialPorMinero(): Promise<any[]> {
    const query = `
      SELECT mn.id, mn.nombre, mn.alias, mn.metodo_calculo,
        mn.banco, mn.numero_cuenta, mn.nequi,
        COUNT(v.id_entrada) AS num_entradas_pendientes,
        SUM(v.saldo_pendiente) AS total_deuda
      FROM v_estado_pago_material v
      JOIN material_planta_entrada mpe ON mpe.id = v.id_entrada
      JOIN mina mi ON mi.id = mpe.id_mina
      JOIN minero mn ON mn.id = mi.id_minero
      WHERE v.estado_pago != 'pagado'
      GROUP BY mn.id, mn.nombre, mn.alias, mn.metodo_calculo, mn.banco, mn.numero_cuenta, mn.nequi
      ORDER BY total_deuda DESC
    `;
    const [rows] = await this.db.execute<any[]>(query);
    return rows;
  }

  async deudaMaterialDeUnMinero(id_minero: number): Promise<any[]> {
    const query = `
      SELECT v.id_entrada, mpe.numero_volqueta, mpe.fecha_llegada,
        v.valor_total AS precio_total, v.total_pagado AS total_abonado, v.saldo_pendiente, v.estado_pago
      FROM v_estado_pago_material v
      JOIN material_planta_entrada mpe ON mpe.id = v.id_entrada
      JOIN mina mi ON mi.id = mpe.id_mina
      JOIN minero mn ON mn.id = mi.id_minero
      WHERE mn.id = ? AND v.estado_pago != 'pagado'
      ORDER BY v.fecha_llegada
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_minero]);
    return rows;
  }

  async deudaFletePorDueno(): Promise<any[]> {
    const query = `
      SELECT dv.id, dv.nombre, dv.alias, dv.banco, dv.numero_cuenta, dv.nequi,
        COUNT(v.id_entrada) AS num_viajes_pendientes,
        SUM(v.saldo_pendiente) AS total_flete_pendiente
      FROM v_estado_pago_flete v
      JOIN material_planta_entrada mpe ON mpe.id = v.id_entrada
      JOIN volqueta_vehiculo vv ON vv.placa = v.placa
      JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      WHERE v.estado_pago != 'pagado'
      GROUP BY dv.id, dv.nombre, dv.alias, dv.banco, dv.numero_cuenta, dv.nequi
      ORDER BY total_flete_pendiente DESC
    `;
    const [rows] = await this.db.execute<any[]>(query);
    return rows;
  }

  async deudaFleteDeUnDueno(id_dueno: number): Promise<any[]> {
    const query = `
      SELECT v.id_entrada, mpe.numero_volqueta, v.placa, mpe.fecha_llegada,
        v.valor_total AS costo_volqueta, v.total_pagado AS total_abonado, v.saldo_pendiente, v.estado_pago
      FROM v_estado_pago_flete v
      JOIN material_planta_entrada mpe ON mpe.id = v.id_entrada
      JOIN volqueta_vehiculo vv ON vv.placa = v.placa
      JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      WHERE dv.id = ? AND v.estado_pago != 'pagado'
      ORDER BY v.fecha_llegada
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_dueno]);
    return rows;
  }

  async resumenGeneral(): Promise<any> {
    const query = `
      SELECT
        (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM v_estado_pago_material WHERE estado_pago != 'pagado') AS deuda_total_material,
        (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM v_estado_pago_flete WHERE estado_pago != 'pagado') AS deuda_total_flete,
        (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM v_estado_agua WHERE estado_pago != 'pagado') AS deuda_total_agua,
        (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM v_estado_mulas WHERE estado_pago != 'pagado') AS deuda_total_mulas,
        (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM v_estado_alquileres WHERE estado_pago != 'pagado') AS deuda_total_alquileres,
        (SELECT COUNT(*) FROM v_estado_pago_material WHERE estado_pago = 'pendiente') AS entradas_sin_pagar,
        (SELECT COUNT(*) FROM v_estado_pago_flete WHERE estado_pago = 'pendiente') AS fletes_sin_pagar
    `;
    const [rows] = await this.db.execute<any[]>(query);
    return rows[0];
  }
}
