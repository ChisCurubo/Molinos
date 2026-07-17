import { Pool, RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { MaterialPlantaEntradaSQL, CreateMaterialEntradaDTO, UpdateDesdeAnalisisDTO, UpdatePrecioDTO, UpdateCostosDTO, UpdateCompletoDTO, EntradaMaterial, EstadoEntrada, EstadoPagoFlete } from '../../models/material/sql/material_planta_entrada.sql';
import { TipoMaterialSQL } from '../../models/material/sql/tipo_material.sql';
import { ITipoMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { PrecioMaterialSQL } from '../../models/material/sql/precio_material.sql';
import { IPrecioMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { TarifaCalculoSQL } from '../../models/material/sql/tarifa_calculo.sql';
import { ITarifaCalculoRepository } from '../../ports/material/repository_port/material.repository.interface';
import { ProveedorSQL } from '../../models/pagos/sql/proveedor.sql';
import { IProveedorRepository, IMaterialEntradaRepository } from '../../ports/material/repository_port/material.repository.interface';

// --- Original: material_planta_entrada ---
export class MaterialEntradaRepository implements IMaterialEntradaRepository {
  constructor(private db: Pool) {}
  
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || this.db;
  }

  // 3.1 INSERT fase 1
  async registrarLlegada(data: CreateMaterialEntradaDTO, conn?: PoolConnection): Promise<number> {
    const connection = this.getConn(conn);
    const query = `
      INSERT INTO material_planta_entrada (
          numero_volqueta,
          id_mina,
          id_vehiculo,
          id_tipo_material,
          fecha_llegada,
          peso_llegada_planta,
          porcentaje_humedad,
          comentarios
      ) VALUES (?, ?, ?, ?, ?, ?, 0.0000, ?)
    `;
    const values = [
      data.numero_volqueta,
      data.id_mina,
      data.id_vehiculo || null,
      data.id_tipo_material,
      data.fecha_llegada,
      data.peso_llegada_planta,
      data.comentarios || null
    ];
    
    const [result] = await connection.execute<ResultSetHeader>(query, values);
    return result.insertId;
  }

  // 3.2 Leer una entrada completa
  async obtenerPorId(id: number, conn?: import('mysql2/promise').PoolConnection): Promise<import('../../models/material/sql/material_planta_entrada.sql').EntradaMaterial | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mpe.estado, mpe.estado_pago_flete,
          mi.id AS mina_id, mi.nombre AS mina, mi.id_zona AS zona_id,
          mn.id AS minero_id, mn.nombre AS minero, mn.alias AS minero_alias,
          mn.metodo_calculo, mn.banco AS minero_banco, mn.numero_cuenta AS minero_cuenta, mn.nequi AS minero_nequi,
          vv.id AS vehiculo_id, vv.placa, dv.id AS dueno_id, dv.nombre AS dueno, dv.alias AS dueno_alias,
          tm.nombre AS tipo_material,
          mpe.peso_llegada_planta, mpe.porcentaje_humedad, mpe.gramos_humedad, mpe.total_material_seco, mpe.tenor,
          mpe.total_gramos, mpe.id_precio, mpe.precio_por_gramo, mpe.precio_por_tonelada, mpe.precio_total,
          mpe.excedente_calculado, mpe.costo_cargue, mpe.costo_bascula, mpe.costo_maquila, mpe.costo_adicional,
          mpe.costo_volqueta, mpe.total_costos_operativos, mpe.total_material, mpe.comentarios, mpe.created_at, mpe.updated_at
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      LEFT JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      JOIN tipos_material tm ON tm.id = mpe.id_tipo_material
      WHERE mpe.id = ?
    `;
    const [rows] = await connection.execute<any[]>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 3.3 Listar entradas
  async listar(fechaDesde: string, fechaHasta: string, estado: string = '', limit: number = 100, offset: number = 0, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mi.nombre AS mina, mn.nombre AS minero,
          mn.alias AS minero_alias, vv.placa, dv.nombre AS dueno_volqueta, tm.nombre AS tipo_material,
          mpe.peso_llegada_planta, mpe.total_material_seco, mpe.tenor, mpe.precio_total,
          mpe.total_material, mpe.estado, mpe.estado_pago_flete,
          EXISTS (
              SELECT 1 FROM analisis a
              WHERE a.id_entrada = mpe.id AND a.id_tipo_analisis = 1
          ) AS tiene_analisis_cabeza
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      LEFT JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      JOIN tipos_material tm ON tm.id = mpe.id_tipo_material
      WHERE mpe.fecha_llegada BETWEEN ? AND ?
        AND (mpe.estado = ? OR ? = '')
      ORDER BY mpe.fecha_llegada DESC, mpe.id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await connection.execute<any[]>(query, [fechaDesde, fechaHasta, estado, estado, limit.toString(), offset.toString()]);
    return rows;
  }

  // 3.4 Entradas pendientes de análisis
  async listarPendientesAnalisis(conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mi.nombre AS mina, mn.nombre AS minero,
          vv.placa, mpe.peso_llegada_planta, mpe.id_tipo_material AS tipo_material_id, tm.nombre AS tipo_material,
          DATEDIFF(CURRENT_DATE, mpe.fecha_llegada) AS dias_sin_analisis
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      JOIN tipos_material tm ON tm.id = mpe.id_tipo_material
      WHERE mpe.porcentaje_humedad = 0
         OR mpe.tenor IS NULL
      ORDER BY mpe.fecha_llegada
    `;
    const [rows] = await connection.execute<any[]>(query);
    return rows;
  }

  // 3.5 UPDATE fase 3
  async actualizarDesdeAnalisis(id: number, data: UpdateDesdeAnalisisDTO, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE material_planta_entrada SET
          porcentaje_humedad   = ?,
          gramos_humedad       = ?,
          total_material_seco  = ?,
          tenor                = ?,
          total_gramos         = ?
      WHERE id = ?
    `;
    await connection.execute(query, [
      data.porcentaje_humedad,
      data.gramos_humedad,
      data.total_material_seco,
      data.tenor,
      data.total_gramos,
      id
    ]);
  }

  // 3.6 UPDATE fase 4
  async actualizarPrecio(id: number, data: UpdatePrecioDTO, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE material_planta_entrada SET
          id_precio           = ?,
          precio_por_gramo    = ?,
          precio_por_tonelada = ?,
          precio_total        = ?
      WHERE id = ?
    `;
    await connection.execute(query, [
      data.id_precio,
      data.precio_por_gramo,
      data.precio_por_tonelada,
      data.precio_total,
      id
    ]);
  }

  // 3.7 UPDATE fase 5
  async actualizarCostos(id: number, data: UpdateCostosDTO, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE material_planta_entrada SET
          excedente_calculado     = ?,
          costo_cargue            = ?,
          costo_bascula           = ?,
          costo_maquila           = ?,
          costo_adicional         = ?,
          costo_volqueta          = ?,
          total_costos_operativos = ?,
          total_material          = ?
      WHERE id = ?
    `;
    await connection.execute(query, [
      data.excedente_calculado,
      data.costo_cargue,
      data.costo_bascula,
      data.costo_maquila,
      data.costo_adicional,
      data.costo_volqueta,
      data.total_costos_operativos,
      data.total_material,
      id
    ]);
  }

  // 3.8 UPDATE fases 3+4+5 en un solo query
  async actualizarCompleto(id: number, data: UpdateCompletoDTO, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE material_planta_entrada SET
          porcentaje_humedad      = ?,
          gramos_humedad          = ?,
          total_material_seco     = ?,
          tenor                   = ?,
          total_gramos            = ?,
          id_precio               = ?,
          precio_por_gramo        = ?,
          precio_por_tonelada     = ?,
          precio_total            = ?,
          excedente_calculado     = ?,
          costo_cargue            = ?,
          costo_bascula           = ?,
          costo_maquila           = ?,
          costo_adicional         = ?,
          costo_volqueta          = ?,
          total_costos_operativos = ?,
          total_material          = ?
      WHERE id = ?
    `;
    await connection.execute(query, [
      data.porcentaje_humedad,
      data.gramos_humedad,
      data.total_material_seco,
      data.tenor,
      data.total_gramos,
      data.id_precio,
      data.precio_por_gramo,
      data.precio_por_tonelada,
      data.precio_total,
      data.excedente_calculado,
      data.costo_cargue,
      data.costo_bascula,
      data.costo_maquila,
      data.costo_adicional,
      data.costo_volqueta,
      data.total_costos_operativos,
      data.total_material,
      id
    ]);
  }

  // 3.8.1 Resetear cálculos (cuando se remueve un análisis)
  async resetearCalculos(id: number, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE material_planta_entrada SET
          porcentaje_humedad      = 0,
          gramos_humedad          = 0,
          total_material_seco     = 0,
          tenor                   = NULL,
          total_gramos            = 0,
          id_precio               = NULL,
          precio_por_gramo        = 0,
          precio_por_tonelada     = 0,
          precio_total            = 0,
          excedente_calculado     = 0,
          costo_cargue            = 0,
          costo_bascula           = 0,
          costo_maquila           = 0,
          costo_adicional         = 0,
          costo_volqueta          = 0,
          total_costos_operativos = 0,
          total_material          = 0,
          estado                  = 'pendiente'
      WHERE id = ?
    `;
    await connection.execute(query, [id]);
  }

  // 3.9 UPDATE estado
  async actualizarEstado(id: number, estado: EstadoEntrada, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    await connection.execute('UPDATE material_planta_entrada SET estado = ? WHERE id = ?', [estado, id]);
  }

  // 3.10 UPDATE estado_pago_flete
  async actualizarEstadoPagoFlete(id: number, estado: EstadoPagoFlete, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    await connection.execute('UPDATE material_planta_entrada SET estado_pago_flete = ? WHERE id = ?', [estado, id]);
  }

  // 3.11 DELETE logico (cancelar)
  async cancelar(id: number, motivo: string, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE material_planta_entrada
      SET estado = 'cancelada',
          comentarios = CONCAT(IFNULL(comentarios,''), ' | CANCELADA: ', ?)
      WHERE id = ?
    `;
    await connection.execute(query, [motivo, id]);
  }

  // 3.12 Por minero
  async listarPorMinero(id_minero: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mi.nombre AS mina,
          mn.nombre AS minero, vv.placa, mpe.peso_llegada_planta,
          mpe.total_material_seco, mpe.tenor, mpe.precio_total, mpe.estado
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      WHERE mn.id = ? AND mpe.estado != 'cancelada'
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await connection.execute<any[]>(query, [id_minero]);
    return rows;
  }

  // 3.13 Por mina
  async listarPorMina(id_mina: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mn.nombre AS minero,
          vv.placa, mpe.peso_llegada_planta, mpe.total_material_seco,
          mpe.tenor, mpe.precio_total, mpe.estado
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      WHERE mi.id = ? AND mpe.estado != 'cancelada'
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await connection.execute<any[]>(query, [id_mina]);
    return rows;
  }

  // 3.14 Por vehiculo
  async listarPorVehiculo(id_vehiculo: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada,
          mi.nombre AS mina, mn.nombre AS minero,
          vv.placa, dv.nombre AS dueno,
          mpe.peso_llegada_planta, mpe.total_material_seco,
          mpe.costo_volqueta, mpe.estado_pago_flete, mpe.estado
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      WHERE vv.id = ? AND mpe.estado != 'cancelada'
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await connection.execute<any[]>(query, [id_vehiculo]);
    return rows;
  }

  // 3.15 Por dueno de volqueta
  async listarPorDueno(id_dueno: number, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada,
          mi.nombre AS mina, mn.nombre AS minero,
          vv.placa, mpe.peso_llegada_planta, mpe.total_material_seco,
          mpe.costo_volqueta, mpe.estado_pago_flete
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
      WHERE dv.id = ? AND mpe.estado != 'cancelada'
      ORDER BY mpe.fecha_llegada DESC
    `;
    const [rows] = await connection.execute<any[]>(query, [id_dueno]);
    return rows;
  }

  // 3.16 Por fecha exacta
  async listarPorFecha(fecha: string, conn?: PoolConnection): Promise<any[]> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mi.nombre AS mina,
          mn.nombre AS minero, vv.placa,
          mpe.peso_llegada_planta, mpe.tenor,
          mpe.precio_total, mpe.estado,
          EXISTS(
            SELECT 1 FROM analisis a
            WHERE a.id_entrada = mpe.id AND a.id_tipo_analisis = 1
          ) AS tiene_analisis
      FROM material_planta_entrada mpe
      JOIN mina mi ON mi.id = mpe.id_mina
      LEFT JOIN minero mn ON mn.id = mi.id_minero
      LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
      JOIN tipos_material tm ON tm.id = mpe.id_tipo_material
      WHERE mpe.fecha_llegada = ?
      ORDER BY mpe.id
    `;
    const [rows] = await connection.execute<any[]>(query, [fecha]);
    return rows;
  }
}


// --- Original: tipo_material ---
export class TipoMaterialRepository implements ITipoMaterialRepository {
    constructor(private db: Pool) {}
    async create(data: Omit<TipoMaterialSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');

        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Material (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoMaterialSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipo_Material WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoMaterialSQL;
    }

    async update(id: number, data: Partial<TipoMaterialSQL>): Promise<boolean> {
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

        const query = `UPDATE Tipos_Material SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Tipo_Material WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoMaterialSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tipo_Material');
        return rows as TipoMaterialSQL[];
    }
}

// --- Original: precio_material ---
export class PrecioMaterialRepository implements IPrecioMaterialRepository {
    constructor(private db: Pool) {}
    
    private getConn(conn?: PoolConnection): PoolConnection | Pool {
        return conn || this.db;
    }

    async create(data: Omit<PrecioMaterialSQL, 'id'>): Promise<number> {
        const query = `
            INSERT INTO Precio_Material (
                id_minero, id_zona, metodo, precio_por_gramo, precio_por_tonelada, 
                intervalo_tenor_min, intervalo_tenor_max, fecha_inicio, fecha_fin, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_minero || null,
            data.id_zona || null,
            data.metodo,
            data.precio_por_gramo,
            data.precio_por_tonelada,
            data.intervalo_tenor_min,
            data.intervalo_tenor_max,
            data.fecha_inicio,
            data.fecha_fin || null,
            data.activo ? 1 : 0
        ];
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async getById(id: number): Promise<PrecioMaterialSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Precio_Material WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as PrecioMaterialSQL;
    }

    async update(id: number, data: Partial<PrecioMaterialSQL>): Promise<boolean> {
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

        const query = `UPDATE Precio_Material SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Precio_Material WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<PrecioMaterialSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Precio_Material');
        return rows as PrecioMaterialSQL[];
    }

    async insertarLote(precios: Omit<PrecioMaterialSQL, 'id'>[], conn?: PoolConnection): Promise<void> {
        if (!precios || precios.length === 0) return;
        const connection = this.getConn(conn);
        
        const placeholders = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const allPlaceholders = precios.map(() => placeholders).join(', ');
        
        const values: any[] = [];
        for (const data of precios) {
            values.push(
                data.id_minero || null,
                data.id_zona || null,
                data.metodo,
                data.precio_por_gramo,
                data.precio_por_tonelada,
                data.intervalo_tenor_min,
                data.intervalo_tenor_max,
                data.fecha_inicio,
                data.fecha_fin || null,
                data.activo ? 1 : 0
            );
        }

        const query = `
            INSERT INTO Precio_Material (
                id_minero, id_zona, metodo, precio_por_gramo, precio_por_tonelada, 
                intervalo_tenor_min, intervalo_tenor_max, fecha_inicio, fecha_fin, activo
            ) VALUES ${allPlaceholders}
        `;

        await connection.query(query, values);
    }

    async buscarPrecioAplicable(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string, conn?: import('mysql2/promise').PoolConnection): Promise<any | null> {
        const connection = conn || this.db;
        const query = `
            SELECT id, metodo, precio_por_gramo, precio_por_tonelada, intervalo_tenor_min, intervalo_tenor_max
            FROM precio_material pm
            WHERE pm.activo = 1
              AND pm.metodo = ?
              AND (pm.id_minero = ? OR pm.id_minero IS NULL)
              AND (pm.id_zona = ? OR pm.id_zona IS NULL)
              AND ? BETWEEN pm.intervalo_tenor_min AND pm.intervalo_tenor_max
              AND pm.fecha_inicio <= ?
              AND (pm.fecha_fin IS NULL OR pm.fecha_fin >= ?)
            ORDER BY pm.id_minero DESC, pm.id_zona DESC, pm.fecha_inicio DESC
            LIMIT 1
        `;
        const [rows] = await connection.execute<RowDataPacket[]>(query, [
            metodo, idMinero, idZona, tenorFalso, fechaEntrada, fechaEntrada
        ]);
        return rows.length > 0 ? rows[0] : null;
    }
}

// --- Original: tarifa_calculo ---
export class TarifaCalculoRepository implements ITarifaCalculoRepository {
    constructor(private db: Pool) {}
    async create(data: Omit<TarifaCalculoSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');

        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Tarifas_Calculo (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TarifaCalculoSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tarifa_Calculo WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TarifaCalculoSQL;
    }

    async update(id: number, data: Partial<TarifaCalculoSQL>): Promise<boolean> {
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

        const query = `UPDATE Tarifas_Calculo SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Tarifa_Calculo WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TarifaCalculoSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Tarifa_Calculo');
        return rows as TarifaCalculoSQL[];
    }

    async obtenerTarifaZonaOCalculo(idZona: number | null, conn?: import('mysql2/promise').PoolConnection): Promise<number> {
        const connection = conn || this.db;
        if (idZona) {
            const queryZona = `
                SELECT valor_tonelada
                FROM tarifa_zona
                WHERE id_zona = ? AND activo = 1 AND vigente_desde <= CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
                ORDER BY vigente_desde DESC LIMIT 1
            `;
            const [rowsZona] = await connection.execute<RowDataPacket[]>(queryZona, [idZona]);
            if (rowsZona.length > 0) return Number(rowsZona[0].valor_tonelada);
        }

        const queryGlobal = `SELECT valor FROM tarifas_calculo WHERE codigo = 'flete_ton_seca'`;
        const [rowsGlobal] = await connection.execute<RowDataPacket[]>(queryGlobal);
        if (rowsGlobal.length > 0) return Number(rowsGlobal[0].valor);

        return 0; // Fallback extremo
    }
}

// --- Original: proveedor ---
export class ProveedorRepository implements IProveedorRepository {
    constructor(private db: Pool) {}
    async create(data: Omit<ProveedorSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');

        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Proveedores (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<ProveedorSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Proveedores WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as ProveedorSQL;
    }

    async update(id: number, data: Partial<ProveedorSQL>): Promise<boolean> {
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

        const query = `UPDATE Proveedores SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Proveedores WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<ProveedorSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Proveedores');
        return rows as ProveedorSQL[];
    }
}
