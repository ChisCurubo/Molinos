import { Pool } from 'mysql2/promise';
import {
    IVEstadoPagoMaterialRepository, IVEstadoPagoFleteRepository, IVExcedenteEmpresaRepository,
    IVExcedentePorVehiculoRepository, IVAnalisisCompletoRepository, IVEstadoAguaRepository
} from '../../../ports/material/repository_port/vistas.material.repository.interface';

export class VEstadoPagoMaterialRepository implements IVEstadoPagoMaterialRepository {
  constructor(private db: Pool) {}
  async findAll(estado?: string): Promise<any[]> {
    const query = estado
      ? 'SELECT * FROM v_estado_pago_material WHERE estado_pago = ? ORDER BY id_entrada DESC'
      : 'SELECT * FROM v_estado_pago_material ORDER BY id_entrada DESC';
    const [rows] = await this.db.execute<any[]>(query, estado ? [estado] : []);
    return rows;
  }

  async findByEntrada(id_entrada: number): Promise<any | null> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_resumen_liquidacion_material WHERE id_entrada = ?', [id_entrada]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}

export class VEstadoPagoFleteRepository implements IVEstadoPagoFleteRepository {
  constructor(private db: Pool) {}
  async findAll(estado?: string): Promise<any[]> {
    const query = estado
      ? 'SELECT * FROM v_estado_pago_flete WHERE estado_pago = ? ORDER BY id_entrada DESC'
      : 'SELECT * FROM v_estado_pago_flete ORDER BY id_entrada DESC';
    const [rows] = await this.db.execute<any[]>(query, estado ? [estado] : []);
    return rows;
  }

  async findByEntrada(id_entrada: number): Promise<any | null> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_estado_pago_flete WHERE id_entrada = ?', [id_entrada]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}

export class VExcedenteEmpresaRepository implements IVExcedenteEmpresaRepository {
  constructor(private db: Pool) {}
  async findAll(estado_distribucion?: string): Promise<any[]> {
    const query = estado_distribucion
      ? 'SELECT * FROM v_excedente_empresa WHERE estado_distribucion = ? ORDER BY id_entrada DESC'
      : 'SELECT * FROM v_excedente_empresa ORDER BY id_entrada DESC';
    const [rows] = await this.db.execute<any[]>(query, estado_distribucion ? [estado_distribucion] : []);
    return rows;
  }
}

export class VMovimientosCajaRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_movimientos_caja ORDER BY fecha_llegada DESC, id_entrada DESC');
    return rows;
  }

  async findByVehiculo(id_vehiculo: number): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_movimientos_caja WHERE id_vehiculo = ?', [id_vehiculo]
    );
    return rows;
  }

  async findByEntrada(id_entrada: number): Promise<any | null> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_movimientos_caja WHERE id_entrada = ?', [id_entrada]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}

export class VResumenLiquidacionMaterialRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_resumen_liquidacion_material ORDER BY id_entrada DESC');
    return rows;
  }

  async findByVehiculo(id_vehiculo: number): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_resumen_liquidacion_material WHERE id_vehiculo = ?', [id_vehiculo]
    );
    return rows;
  }
}

export class VExcedentePorVehiculoRepository implements IVExcedentePorVehiculoRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_excedente_por_vehiculo ORDER BY total_excedentes DESC');
    return rows;
  }

  async findByVehiculo(id_vehiculo: number): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_excedente_por_vehiculo WHERE id_vehiculo = ?', [id_vehiculo]
    );
    return rows;
  }
}

export class VAnalisisCompletoRepository implements IVAnalisisCompletoRepository {
  constructor(private db: Pool) {}
  async findAll(id_minero?: number, id_mina?: number, desde?: string, hasta?: string): Promise<any[]> {
    let query = 'SELECT * FROM v_analisis_completo WHERE 1=1';
    const params: any[] = [];
    if (id_minero) { query += ' AND id_minero_resuelto = ?'; params.push(id_minero); }
    if (id_mina)   { query += ' AND id_mina_resuelto = ?';   params.push(id_mina); }
    // v_analisis_completo no expone fecha_llegada (solo columnas de `analisis` + los *_resuelto);
    // se filtra/ordena por created_at (fecha de registro del análisis) como aproximación.
    if (desde)     { query += ' AND created_at >= ?'; params.push(desde); }
    if (hasta)     { query += ' AND created_at <= ?'; params.push(hasta); }
    query += ' ORDER BY created_at DESC';
    const [rows] = await this.db.execute<any[]>(query, params);
    return rows;
  }
}

export class VEstadoAguaRepository implements IVEstadoAguaRepository {
  constructor(private db: Pool) {}
  async findAll(estado?: string): Promise<any[]> {
    const query = estado
      ? 'SELECT * FROM v_estado_agua WHERE estado_pago = ?'
      : 'SELECT * FROM v_estado_agua';
    const [rows] = await this.db.execute<any[]>(query, estado ? [estado] : []);
    return rows;
  }
}
