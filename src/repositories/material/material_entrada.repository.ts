import { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import Database from '../../config/database.config';
const db = Database.getInstance(); // Asumo la ruta de DB
import {
  CreateMaterialEntradaDTO,
  UpdateDesdeAnalisisDTO,
  UpdatePrecioDTO,
  UpdateCostosDTO,
  UpdateCompletoDTO,
  EntradaMaterial,
  EstadoEntrada,
  EstadoPagoFlete
} from '../../models/material/sql/material_planta_entrada.sql';

export class MaterialEntradaRepository {
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || db;
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
  async obtenerPorId(id: number, conn?: PoolConnection): Promise<EntradaMaterial | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mpe.estado, mpe.estado_pago_flete,
          mi.id AS mina_id, mi.nombre AS mina,
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
    const [rows] = await connection.execute<EntradaMaterial[]>(query, [id]);
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
}
