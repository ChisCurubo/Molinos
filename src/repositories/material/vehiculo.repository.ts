import { Pool, PoolConnection } from 'mysql2/promise';
import { IVehiculoRepository } from '../../ports/material/repository_port/volqueta.repository.interface';

export class VehiculoRepository implements IVehiculoRepository {
  constructor(private db: Pool) {}
  
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || this.db;
  }

  async list(todas: boolean = false): Promise<any[]> {
    // Por defecto solo se devuelven vehículos activos; con ?todas=true se incluyen los dados de baja.
    const query = `
      SELECT vv.id, vv.placa, vv.tipo_vehiculo, vv.conductor, vv.capacidad_ton,
        vv.estado_pago, vv.activo,
        dv.id AS dueno_id, dv.nombre AS dueno, dv.nombre AS dueno_nombre, dv.alias AS dueno_alias
      FROM volqueta_vehiculo vv
      JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      WHERE (vv.activo = 1 OR ? = 1)
      ORDER BY vv.placa
    `;
    const [rows] = await this.db.execute<any[]>(query, [todas ? 1 : 0]);
    return rows;
  }

  async create(data: any, conn?: PoolConnection): Promise<number> {
    const connection = this.getConn(conn);
    const query = `
      INSERT INTO volqueta_vehiculo (id_dueno_volqueta, placa, tipo_vehiculo, conductor, conductor_cc, capacidad_ton, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.id_dueno_volqueta ?? null, data.placa, data.tipo_vehiculo ?? null, data.conductor ?? null, data.conductor_cc ?? null, data.capacidad_ton ?? null, data.activo ?? 1
    ];
    const [result] = await connection.execute<any>(query, params);
    return result.insertId;
  }

  async update(id: number, data: any): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) {
        fields.push(`${k} = ?`);
        values.push(v);
      }
    });
    if (!fields.length) return false;
    values.push(id);
    const [result] = await this.db.execute<any>(`UPDATE volqueta_vehiculo SET ${fields.join(', ')} WHERE id = ?`, values);
    return result.affectedRows > 0;
  }

  async delete(id: number): Promise<boolean> {
    const [result] = await this.db.execute<any>('DELETE FROM volqueta_vehiculo WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async getById(id: number): Promise<any | null> {
    const query = `
      SELECT vv.id, vv.placa, vv.tipo_vehiculo, vv.conductor, vv.conductor_cc,
        vv.capacidad_ton, vv.estado_pago, vv.activo, vv.created_at,
        dv.id AS dueno_id, dv.nombre AS dueno, dv.alias,
        dv.banco, dv.numero_cuenta, dv.nequi
      FROM volqueta_vehiculo vv
      JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      WHERE vv.id = ?
    `;
    const [rows] = await this.db.execute<any[]>(query, [id]);
    return rows.length ? rows[0] : null;
  }

  async listarPorDueno(id_dueno: number): Promise<any[]> {
    const query = `
      SELECT vv.id, vv.placa, vv.tipo_vehiculo, vv.estado_pago, vv.activo
      FROM volqueta_vehiculo vv
      WHERE vv.id_dueno_volqueta = ?
      ORDER BY vv.placa
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_dueno]);
    return rows;
  }

  async listarEntradas(id_vehiculo: number): Promise<any[]> {
    const query = `
      SELECT mpe.id, mpe.numero_volqueta, mpe.fecha_llegada,
        mi.nombre AS mina, mpe.total_material_seco, mpe.costo_volqueta,
        mpe.estado_pago_flete, mpe.estado
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      WHERE mpe.id_vehiculo = ?
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_vehiculo]);
    return rows;
  }

  async listarEntradasPendientesFlete(id_vehiculo: number): Promise<any[]> {
    const query = `
      SELECT mpe.id, mpe.numero_volqueta, mpe.fecha_llegada,
        mi.nombre AS mina, mpe.total_material_seco, mpe.costo_volqueta,
        mpe.estado_pago_flete
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      WHERE mpe.id_vehiculo = ?
        AND mpe.estado_pago_flete IN ('pendiente', 'parcial')
      ORDER BY mpe.fecha_llegada
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_vehiculo]);
    return rows;
  }
}

export class DuenoVolquetaFullRepository {
  constructor(private db: Pool) {}
  async list(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT id, nombre, alias, banco, numero_cuenta, nequi, estado FROM dueno_volqueta ORDER BY nombre'
    );
    return rows;
  }

  async getById(id: number): Promise<any | null> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM dueno_volqueta WHERE id = ?', [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}
