import { Pool } from 'mysql2/promise';

export class VEstadoPagoMaterialRepository {
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

export class VEstadoPagoFleteRepository {
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

export class VExcedenteEmpresaRepository {
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

export class VExcedentePorVehiculoRepository {
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

export class VAnalisisCompletoRepository {
  constructor(private db: Pool) {}
  async findAll(id_minero?: number, id_mina?: number, desde?: string, hasta?: string): Promise<any[]> {
    let query = 'SELECT * FROM v_analisis_completo WHERE 1=1';
    const params: any[] = [];
    if (id_minero) { query += ' AND id_minero = ?'; params.push(id_minero); }
    if (id_mina)   { query += ' AND id_mina = ?';   params.push(id_mina); }
    if (desde)     { query += ' AND fecha_llegada >= ?'; params.push(desde); }
    if (hasta)     { query += ' AND fecha_llegada <= ?'; params.push(hasta); }
    query += ' ORDER BY fecha_llegada DESC';
    const [rows] = await this.db.execute<any[]>(query, params);
    return rows;
  }
}

export class VEstadoAguaRepository {
  constructor(private db: Pool) {}
  async findAll(estado?: string): Promise<any[]> {
    const query = estado
      ? 'SELECT * FROM v_estado_agua WHERE estado_pago = ?'
      : 'SELECT * FROM v_estado_agua';
    const [rows] = await this.db.execute<any[]>(query, estado ? [estado] : []);
    return rows;
  }
}
