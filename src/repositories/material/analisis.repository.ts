import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import Database from '../../config/database.config';
const db = Database.getInstance();
import { CreateAnalisisDTO, UpdateAnalisisDTO, Analisis, EstadoPagoAnalisis } from '../../models/material/sql/analisis.sql';

export class AnalisisRepository {
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || db;
  }

  // 4.1 INSERT análisis Cabeza
  async insertar(data: CreateAnalisisDTO, conn?: PoolConnection): Promise<number> {
    const connection = this.getConn(conn);
    const query = `
      INSERT INTO analisis (
          id_entrada,
          id_tipo_analisis,
          id_laboratorio,
          numero_analisis,
          au_concentrado,
          ton,
          porcentaje_humedad,
          toneladas_humedas,
          toneladas_secas,
          au_gr_x_ton,
          au_gr_x_ton_falso,
          ag_gr_x_ton,
          valor_analisis,
          estado_pago,
          comentarios
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'no_aplica', ?)
    `;
    const values = [
      data.id_entrada,
      data.id_tipo_analisis,
      data.id_laboratorio || null,
      data.numero_analisis || null,
      data.au_concentrado || null,
      data.ton || null,
      data.porcentaje_humedad,
      data.toneladas_humedas || null,
      data.toneladas_secas,
      data.au_gr_x_ton,
      data.au_gr_x_ton_falso,
      data.ag_gr_x_ton || null,
      data.valor_analisis || null,
      data.comentarios || null
    ];
    
    const [result] = await connection.execute<ResultSetHeader>(query, values);
    return result.insertId;
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
          a.au_gr_x_ton AS tenor_real,
          a.au_gr_x_ton_falso AS tenor_falso,
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
          a.au_gr_x_ton AS tenor_real,
          a.au_gr_x_ton_falso AS tenor_falso,
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

  // 4.4 Corregir un análisis
  async corregir(id: number, data: UpdateAnalisisDTO, conn?: PoolConnection): Promise<void> {
    const connection = this.getConn(conn);
    const query = `
      UPDATE analisis SET
          porcentaje_humedad  = ?,
          toneladas_humedas   = ?,
          toneladas_secas     = ?,
          au_gr_x_ton         = ?,
          au_gr_x_ton_falso   = ?,
          ag_gr_x_ton         = ?,
          au_concentrado      = ?
      WHERE id = ?
    `;
    await connection.execute(query, [
      data.porcentaje_humedad,
      data.toneladas_humedas || null,
      data.toneladas_secas,
      data.au_gr_x_ton,
      data.au_gr_x_ton_falso,
      data.ag_gr_x_ton || null,
      data.au_concentrado || null,
      id
    ]);
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
}
