import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { CreateAnalisisDTO, UpdateAnalisisDTO, Analisis, EstadoPagoAnalisis } from '../../models/material/sql/analisis.sql';

import { IAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';

export class AnalisisRepository implements IAnalisisRepository {
  constructor(private db: Pool) {}
  
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || this.db;
  }

  // 4.1 INSERT análisis Cabeza
  async insertar(data: CreateAnalisisDTO, conn?: PoolConnection): Promise<number> {
    const connection = this.getConn(conn);
    const query = `
      INSERT INTO Analisis (
          id_entrada,
          id_material_concentrado,
          id_tipo_analisis,
          id_laboratorio,
          id_tipo_material,
          numero_analisis,
          ton,
          porcentaje_humedad,
          toneladas_humedas,
          toneladas_secas,
          au_concentrado,
          ag_concentrado,
          au_gr_x_ton,
          au_falso,
          ag_gr_x_ton,
          estado_pago,
          comentarios
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'no_aplica', ?)
    `;
    const values = [
      data.id_entrada ?? null,
      data.id_material_concentrado ?? null,
      data.id_tipo_analisis ?? null,
      data.id_laboratorio ?? null,
      data.id_tipo_material ?? null,
      data.numero_analisis ?? null,
      data.toneladas ?? null,
      data.porcentaje_humedad ?? null,
      data.toneladas_humedas ?? null,
      data.toneladas_secas ?? null,
      data.au_concentrado ?? null,
      data.ag_concentrado ?? null,
      data.au_gr_x_ton ?? null,
      data.au_falso ?? null,
      data.ag_gr_x_ton ?? null,
      data.comentarios ?? null
    ];
    
    const [result] = await connection.execute<ResultSetHeader>(query, values);
    return result.insertId;
  }

  async actualizar(identificador: string | number, data: UpdateAnalisisDTO, conn?: PoolConnection): Promise<boolean> {
    const connection = this.getConn(conn);
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.id_entrada !== undefined) { fields.push('id_entrada = ?'); values.push(data.id_entrada); }
    if (data.numero_analisis !== undefined) { fields.push('numero_analisis = ?'); values.push(data.numero_analisis); }
    if (data.id_laboratorio !== undefined) { fields.push('id_laboratorio = ?'); values.push(data.id_laboratorio); }
    if (data.id_tipo_material !== undefined) { fields.push('id_tipo_material = ?'); values.push(data.id_tipo_material); }
    if (data.toneladas !== undefined) { 
        fields.push('ton = ?'); values.push(data.toneladas); 
    }
    if (data.porcentaje_humedad !== undefined) { fields.push('porcentaje_humedad = ?'); values.push(data.porcentaje_humedad); }
    if (data.toneladas_humedas !== undefined) { fields.push('toneladas_humedas = ?'); values.push(data.toneladas_humedas); }
    if (data.toneladas_secas !== undefined) { fields.push('toneladas_secas = ?'); values.push(data.toneladas_secas); }
    
    if (data.au_concentrado !== undefined) { fields.push('au_concentrado = ?'); values.push(data.au_concentrado); }
    if (data.ag_concentrado !== undefined) { fields.push('ag_concentrado = ?'); values.push(data.ag_concentrado); }
    if (data.au_gr_x_ton !== undefined) { fields.push('au_gr_x_ton = ?'); values.push(data.au_gr_x_ton); }
    if (data.au_falso !== undefined) { fields.push('au_falso = ?'); values.push(data.au_falso); }
    if (data.ag_gr_x_ton !== undefined) { fields.push('ag_gr_x_ton = ?'); values.push(data.ag_gr_x_ton); }
    if (data.comentarios !== undefined) { fields.push('comentarios = ?'); values.push(data.comentarios); }

    if (fields.length === 0) return true;

    const isId = !isNaN(Number(identificador));
    values.push(isId ? Number(identificador) : identificador);
    const whereClause = isId ? 'id = ?' : 'numero_analisis = ?';
    
    const query = `UPDATE analisis SET ${fields.join(', ')} WHERE ${whereClause}`;
    
    const [result] = await connection.execute<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  async actualizarValor(identificador: string | number, valor_analisis: number, conn?: PoolConnection): Promise<boolean> {
    const connection = this.getConn(conn);
    const isId = !isNaN(Number(identificador));
    const whereClause = isId ? 'id = ?' : 'numero_analisis = ?';
    const query = `UPDATE analisis SET valor_analisis = ? WHERE ${whereClause}`;
    
    const [result] = await connection.execute<ResultSetHeader>(query, [valor_analisis, isId ? Number(identificador) : identificador]);
    return result.affectedRows > 0;
  }

  // 4.2 Obtener el análisis Cabeza de una entrada
  async obtenerCabezaPorEntrada(id_entrada: number, conn?: PoolConnection): Promise<Analisis | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          a.id,
          a.id_entrada,
          ta.nombre AS tipo_analisis,
          a.numero_analisis,
          a.porcentaje_humedad,
          a.toneladas_humedas,
          a.toneladas_secas,
          (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real,
          a.au_concentrado AS au_gramos_totales,
          a.au_falso AS tenor_falso,
          a.au_concentrado,
          a.ag_gr_x_ton,
          a.valor_analisis,
          a.estado_pago,
          a.fecha_salida,
          a.comentarios,
          a.created_at
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      WHERE a.id_entrada = ?
        AND a.id_tipo_analisis = 1
      LIMIT 1
    `;
    const [rows] = await connection.execute<Analisis[]>(query, [id_entrada]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 4.3 Todos los análisis de una entrada
  async obtenerTodosPorEntrada(id_entrada: number, conn?: PoolConnection): Promise<Analisis[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          a.id,
          ta.nombre AS tipo_analisis,
          a.numero_analisis,
          a.porcentaje_humedad,
          a.toneladas_secas,
          (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real,
          a.au_concentrado AS au_gramos_totales,
          a.au_falso AS tenor_falso,
          a.au_concentrado,
          a.estado_pago,
          a.created_at
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      WHERE a.id_entrada = ?
      ORDER BY a.id_tipo_analisis, a.created_at
    `;
    const [rows] = await connection.execute<Analisis[]>(query, [id_entrada]);
    return rows;
  }



  // 4.5 Marcar análisis como pagado
  async actualizarEstadoPago(id: number, estado: EstadoPagoAnalisis, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE analisis
      SET estado_pago = ?
      WHERE id = ?
    `;
    await connection.execute(query, [estado, id]);
  }

  // 4.6 Obtener análisis por id propio
  async obtenerPorId(id: number, conn?: PoolConnection): Promise<Analisis | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT a.id, a.id_entrada, a.id_tipo_analisis, ta.nombre AS tipo_analisis,
        a.numero_analisis, a.ton, a.porcentaje_humedad, a.toneladas_humedas, a.toneladas_secas,
        (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real, a.au_concentrado AS au_gramos_totales, a.au_falso AS tenor_falso,
        a.au_concentrado, a.ag_concentrado, a.ag_gr_x_ton, a.valor_analisis,
        a.estado_pago, a.comentarios, a.created_at
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      WHERE a.id = ?
    `;
    const [rows] = await connection.execute<Analisis[]>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 4.6.2 DELETE físico del análisis (la validación de reglas va en el Service)
  async eliminar(id: number, conn?: PoolConnection): Promise<boolean> {
    const connection = this.getConn(conn);
    const [result] = await connection.execute<ResultSetHeader>('DELETE FROM analisis WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // 4.6.1 Obtener análisis por identificador (id o numero_analisis)
  async obtenerPorIdentificador(identificador: string | number, conn?: PoolConnection): Promise<Analisis | null> {
    const connection = this.getConn(conn);
    const isId = !isNaN(Number(identificador));
    const whereClause = isId ? 'a.id = ?' : 'a.numero_analisis = ?';
    const query = `
      SELECT a.id, a.id_entrada, a.id_tipo_analisis, ta.nombre AS tipo_analisis,
        a.numero_analisis, a.ton, a.porcentaje_humedad, a.toneladas_humedas, a.toneladas_secas,
        (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real, a.au_concentrado AS au_gramos_totales, a.au_falso AS tenor_falso,
        a.au_concentrado, a.ag_concentrado, a.ag_gr_x_ton, a.valor_analisis,
        a.estado_pago, a.comentarios, a.created_at,
        a.ton AS toneladas
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      WHERE ${whereClause}
    `;
    const [rows] = await connection.execute<any[]>(query, [isId ? Number(identificador) : identificador]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 4.7 Por minero
  async listarPorMinero(id_minero: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT a.id, a.id_entrada, ta.nombre AS tipo_analisis,
        mi.nombre AS mina, mn.nombre AS minero,
        mpe.fecha_llegada, mpe.numero_volqueta,
        a.porcentaje_humedad, a.toneladas_secas,
        (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real, a.au_concentrado AS au_gramos_totales, a.au_falso AS tenor_falso,
        a.au_concentrado, a.estado_pago
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
      JOIN mina mi ON mi.id = mpe.id_mina
      JOIN minero mn ON mn.id = mi.id_minero
      WHERE mn.id = ?
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await connection.execute<any[]>(query, [id_minero]);
    return rows;
  }

  // 4.8 Por mina
  async listarPorMina(id_mina: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT a.id, a.id_entrada, ta.nombre AS tipo_analisis,
        mpe.fecha_llegada, mpe.numero_volqueta,
        a.porcentaje_humedad, a.toneladas_secas,
        (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real, a.au_concentrado AS au_gramos_totales, a.au_falso AS tenor_falso,
        a.au_concentrado
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
      WHERE mpe.id_mina = ?
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await connection.execute<any[]>(query, [id_mina]);
    return rows;
  }

  // 4.9 Por fecha de llegada de la entrada
  async listarPorFecha(fecha: string, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT a.id, a.id_entrada, ta.nombre AS tipo_analisis,
        mi.nombre AS mina, mn.nombre AS minero,
        a.porcentaje_humedad, a.toneladas_secas,
        (a.au_concentrado / NULLIF(a.toneladas_secas, 0)) AS tenor_real, a.au_concentrado AS au_gramos_totales, a.au_falso AS tenor_falso,
        a.au_concentrado, a.estado_pago
      FROM analisis a
      JOIN tipos_analisis ta ON ta.id = a.id_tipo_analisis
      JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      WHERE mpe.fecha_llegada = ?
    `;
    const [rows] = await connection.execute<any[]>(query, [fecha]);
    return rows;
  }

  // 4.10 Análisis del CONCENTRADO de un lote (id_material_concentrado = id_lote).
  async obtenerAnalisisDeConcentrado(id_lote: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT a.id, a.numero_analisis, a.toneladas_secas,
             a.au_gr_x_ton, a.ag_gr_x_ton, a.au_concentrado, a.ag_concentrado,
             a.porcentaje_humedad
      FROM analisis a
      WHERE a.id_material_concentrado = ?
      ORDER BY a.id
    `;
    const [rows] = await connection.execute<any[]>(query, [id_lote]);
    return rows;
  }
}

import { ITipoAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';
import { TipoAnalisisSQL } from '../../models/material/sql/tipo_analisis.sql';

export class TipoAnalisisRepository implements ITipoAnalisisRepository {
    constructor(private db: Pool) {}
    async create(data: Omit<TipoAnalisisSQL, 'id'>): Promise<number> {
        const [result] = await this.db.execute<ResultSetHeader>('INSERT INTO tipos_analisis (nombre, descripcion) VALUES (?, ?)', [data.nombre, data.descripcion || null]);
        return result.insertId;
    }
    async getById(id: number): Promise<TipoAnalisisSQL | null> {
        const [rows] = await this.db.execute<RowDataPacket[]>('SELECT * FROM tipos_analisis WHERE id = ?', [id]);
        return rows.length ? (rows[0] as TipoAnalisisSQL) : null;
    }
    async update(id: number, data: Partial<TipoAnalisisSQL>): Promise<boolean> {
        const updates: string[] = [];
        const values: any[] = [];
        if (data.nombre !== undefined) { updates.push('nombre = ?'); values.push(data.nombre); }
        if (data.descripcion !== undefined) { updates.push('descripcion = ?'); values.push(data.descripcion); }
        if (updates.length === 0) return false;
        values.push(id);
        const [result] = await this.db.execute<ResultSetHeader>(`UPDATE tipos_analisis SET ${updates.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }
    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.execute<ResultSetHeader>('DELETE FROM tipos_analisis WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
    async list(): Promise<TipoAnalisisSQL[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>('SELECT * FROM tipos_analisis');
        return rows as TipoAnalisisSQL[];
    }
}
