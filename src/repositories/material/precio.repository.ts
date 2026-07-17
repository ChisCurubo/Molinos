import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { PrecioMaterialLookup } from '../../models/material/sql/precio_material.sql';
import { TarifaZonaLookup } from '../../models/material/sql/tarifa_zona.sql';

export class PrecioRepository {
  constructor(private db: Pool) {}
  
  private getConn(conn?: PoolConnection | Pool): PoolConnection | Pool {
    return conn || this.db;
  }

  // 2.1 Buscar precio aplicable
  async buscarPrecio(
    idMinero: number | null,
    idZona: number | null,
    metodo: string,
    tenorFalso: number,
    fechaEntrada: string,
    conn?: PoolConnection
  ): Promise<PrecioMaterialLookup | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          pm.id,
          pm.metodo,
          pm.precio_por_gramo,
          pm.precio_por_tonelada,
          pm.intervalo_tenor_min,
          pm.intervalo_tenor_max,
          CASE
              WHEN pm.id_minero IS NOT NULL THEN 'especifica_minero'
              WHEN pm.id_zona   IS NOT NULL THEN 'especifica_zona'
              ELSE 'global'
          END AS tipo_tarifa
      FROM precio_material pm
      WHERE pm.activo = 1
        AND pm.metodo = ?
        AND (pm.id_minero = ? OR pm.id_minero IS NULL)
        AND (pm.id_zona = ? OR pm.id_zona IS NULL)
        AND ? BETWEEN pm.intervalo_tenor_min AND pm.intervalo_tenor_max
        AND pm.fecha_inicio <= ?
        AND (pm.fecha_fin IS NULL OR pm.fecha_fin >= ?)
      ORDER BY
          pm.id_minero DESC,
          pm.id_zona DESC,
          pm.fecha_inicio DESC
      LIMIT 1
    `;
    
    const [rows] = await connection.execute<PrecioMaterialLookup[]>(query, [
      metodo,
      idMinero,
      idZona,
      tenorFalso,
      fechaEntrada,
      fechaEntrada
    ]);

    return rows.length > 0 ? rows[0] : null;
  }

  // 2.2 Buscar tarifa de zona
  async buscarTarifaZona(idZona: number, conn?: PoolConnection): Promise<number | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT
          tz.id,
          tz.valor_tonelada,
          tz.vigente_desde,
          z.nombre AS zona
      FROM tarifa_zona tz
      JOIN zona z ON z.id = tz.id_zona
      WHERE tz.id_zona = ?
        AND tz.activo = 1
        AND tz.vigente_desde <= CURRENT_DATE
        AND (tz.vigente_hasta IS NULL OR tz.vigente_hasta >= CURRENT_DATE)
      ORDER BY tz.vigente_desde DESC
      LIMIT 1
    `;
    const [rows] = await connection.execute<TarifaZonaLookup[]>(query, [idZona]);
    return rows.length > 0 ? rows[0].valor_tonelada : null;
  }

  // 2.3 Fallback: tarifa global
  async buscarTarifaGlobal(conn?: PoolConnection): Promise<number | null> {
    const connection = this.getConn(conn);
    const query = `
      SELECT valor AS tarifa_flete
      FROM tarifas_calculo
      WHERE codigo = 'flete_ton_seca'
    `;
    const [rows] = await connection.execute<any[]>(query);
    return rows.length > 0 ? rows[0].tarifa_flete : null;
  }
}
