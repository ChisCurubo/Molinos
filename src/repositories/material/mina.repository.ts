import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { CacheService } from '../../services/cache/cache.service';

export class MinaRepository {
  constructor(private db: Pool) {}
  
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || this.db;
  }

  async obtenerZonaDeMina(idMina: number, conn?: any): Promise<number | null> {
    const connection = this.getConn(conn);
    const query = 'SELECT id_zona FROM mina WHERE id = ?';
    const [rows] = await connection.execute<any[]>(query, [idMina]);
    return rows.length > 0 ? rows[0].id_zona : null;
  }

  async list(): Promise<any[]> {
    const query = `
      SELECT mi.id, mi.nombre, mi.ubicacion, mi.estado,
        mn.id AS minero_id, mn.nombre AS minero, mn.alias AS minero_alias,
        z.nombre AS zona, z.id AS zona_id
      FROM mina mi
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN zona z ON z.id = mi.id_zona
      ORDER BY mi.nombre
    `;
    const [rows] = await this.db.execute<any[]>(query);
    return rows;
  }

  async getById(id: number): Promise<any | null> {
    const query = `
      SELECT mi.id, mi.nombre, mi.ubicacion, mi.estado,
        mn.id AS minero_id, mn.nombre AS minero, mn.alias AS minero_alias,
        mn.metodo_calculo, mn.banco, mn.numero_cuenta, mn.nequi,
        z.id AS zona_id, z.nombre AS zona,
        tz.valor_tonelada AS tarifa_flete_tonelada
      FROM mina mi
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN zona z ON z.id = mi.id_zona
      LEFT JOIN tarifa_zona tz ON tz.id_zona = z.id
        AND tz.activo = 1 AND tz.vigente_desde <= CURRENT_DATE
        AND (tz.vigente_hasta IS NULL OR tz.vigente_hasta >= CURRENT_DATE)
      WHERE mi.id = ?
    `;
    const [rows] = await this.db.execute<any[]>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async listarEntradas(id_mina: number): Promise<any[]> {
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada,
          vv.placa, mpe.peso_llegada_planta, mpe.total_material_seco,
          mpe.tenor, mpe.precio_total, mpe.estado
      FROM material_planta_entrada mpe
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      WHERE mpe.id_mina = ? AND mpe.estado != 'cancelada'
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_mina]);
    return rows;
  }

  async resumen(id_mina: number): Promise<any | null> {
    const query = `
      SELECT mi.nombre AS mina, mn.nombre AS minero,
        COUNT(mpe.id) AS total_entradas,
        SUM(mpe.peso_llegada_planta) AS total_bruto_ton,
        SUM(mpe.total_material_seco) AS total_seco_ton,
        ROUND(AVG(mpe.tenor), 4) AS tenor_promedio,
        SUM(mpe.total_gramos) AS total_gramos_au,
        SUM(mpe.precio_total) AS total_pagado_minero,
        SUM(mpe.costo_volqueta) AS total_flete,
        SUM(mpe.total_material) AS total_material
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      WHERE mi.id = ? AND mpe.estado != 'cancelada'
    `;
    const [rows] = await this.db.execute<any[]>(query, [id_mina]);
    return rows.length > 0 ? rows[0] : null;
  }

  async create(data: any): Promise<number> {
    const query = `
      INSERT INTO mina (nombre, id_minero, id_zona, ubicacion, estado)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [
      data.nombre,
      data.id_minero || null,
      data.id_zona || null,
      data.ubicacion || null,
      data.estado || 'activa'
    ];
    const [result] = await this.db.execute<ResultSetHeader>(query, values);
    
    // Sincronizar caché
    const newMina = {
      id: result.insertId,
      nombre: data.nombre,
      id_minero: data.id_minero || null,
      id_zona: data.id_zona || null,
      ubicacion: data.ubicacion || null,
      estado: data.estado || 'activa'
    };
    CacheService.getInstance().addMina(newMina);
    
    return result.insertId;
  }
  async update(id: number, data: any): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return false;
    values.push(id);
    const [result] = await this.db.execute<ResultSetHeader>(`UPDATE mina SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows > 0) {
      const updated = await this.getById(id);
      if (updated) CacheService.getInstance().updateMina(updated);
    }
    return result.affectedRows > 0;
  }
  async delete(id: number): Promise<boolean> {
    const [result] = await this.db.execute<ResultSetHeader>('DELETE FROM mina WHERE id = ?', [id]);
    if (result.affectedRows > 0) CacheService.getInstance().deleteMina(id);
    return result.affectedRows > 0;
  }
}

export class MineroRepository {
  constructor(private db: Pool) {}
  async create(data: any): Promise<number> {
    const query = `
      INSERT INTO minero (nombre, alias, metodo_calculo, estado)
      VALUES (?, ?, ?, ?)
    `;
    const values = [
      data.nombre,
      data.alias || null,
      data.metodo_calculo || 'por_gramo',
      data.estado || 'activo'
    ];
    const [result] = await this.db.execute<ResultSetHeader>(query, values);

    // Sincronizar caché
    const newMinero = {
      id: result.insertId,
      nombre: data.nombre,
      alias: data.alias || null,
      metodo_calculo: data.metodo_calculo || 'por_gramo',
      estado: data.estado || 'activo'
    };
    CacheService.getInstance().addMinero(newMinero);

    return result.insertId;
  }
  async getById(id: number): Promise<any | null> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM minero WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }
  async update(id: number, data: any): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return false;
    values.push(id);
    const [result] = await this.db.execute<ResultSetHeader>(`UPDATE minero SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows > 0) {
      const updated = await this.getById(id);
      if (updated) CacheService.getInstance().updateMinero(updated);
    }
    return result.affectedRows > 0;
  }
  async delete(id: number): Promise<boolean> {
    const [result] = await this.db.execute<ResultSetHeader>('DELETE FROM minero WHERE id = ?', [id]);
    if (result.affectedRows > 0) CacheService.getInstance().deleteMinero(id);
    return result.affectedRows > 0;
  }
  async list(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>(`SELECT id, nombre, alias, metodo_calculo, estado FROM minero WHERE estado = 'activo' ORDER BY nombre`);
    return rows;
  }
}

export class ZonaRepository {
  constructor(private db: Pool) {}
  async create(data: any): Promise<number> {
    const query = `
      INSERT INTO zona (nombre, descripcion)
      VALUES (?, ?)
    `;
    const values = [
      data.nombre,
      data.descripcion || null
    ];
    const [result] = await this.db.execute<ResultSetHeader>(query, values);
    
    if (data.valor_tonelada !== undefined) {
      const tarifaQuery = `
        INSERT INTO tarifa_zona (id_zona, valor_tonelada, vigente_desde, activo)
        VALUES (?, ?, CURRENT_DATE, 1)
      `;
      await this.db.execute(tarifaQuery, [result.insertId, data.valor_tonelada]);
    }
    
    // Sincronizar caché
    const newZona = {
      id: result.insertId,
      nombre: data.nombre,
      descripcion: data.descripcion || null
    };
    CacheService.getInstance().addZona(newZona);
    
    return result.insertId;
  }
  async getById(id: number): Promise<any | null> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM zona WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }
  async update(id: number, data: any): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      const [result] = await this.db.execute<ResultSetHeader>(`UPDATE zona SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    
    if (data.valor_tonelada !== undefined) {
      // Inactivar la tarifa anterior
      await this.db.execute('UPDATE tarifa_zona SET activo = 0, vigente_hasta = CURRENT_DATE WHERE id_zona = ? AND activo = 1', [id]);
      // Crear nueva tarifa
      await this.db.execute('INSERT INTO tarifa_zona (id_zona, valor_tonelada, vigente_desde, activo) VALUES (?, ?, CURRENT_DATE, 1)', [id, data.valor_tonelada]);
    }

    const updated = await this.getById(id);
    if (updated) CacheService.getInstance().updateZona(updated);
    
    return true;
  }
  async delete(id: number): Promise<boolean> {
    const [result] = await this.db.execute<ResultSetHeader>('DELETE FROM zona WHERE id = ?', [id]);
    if (result.affectedRows > 0) CacheService.getInstance().deleteZona(id);
    return result.affectedRows > 0;
  }
  async list(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT z.id, z.nombre, tz.valor_tonelada AS tarifa FROM zona z LEFT JOIN tarifa_zona tz ON tz.id_zona = z.id AND tz.activo = 1 ORDER BY z.nombre');
    return rows;
  }
}

export class TarifaZonaRepository {
  constructor(private db: Pool) {}
  async create(data: any): Promise<number> { throw new Error('Not implemented'); }
  async getById(id: number): Promise<any | null> { throw new Error('Not implemented'); }
  async update(id: number, data: any): Promise<boolean> { throw new Error('Not implemented'); }
  async delete(id: number): Promise<boolean> { throw new Error('Not implemented'); }
  async list(): Promise<any[]> { throw new Error('Not implemented'); }
}
