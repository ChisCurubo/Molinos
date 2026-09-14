import { Pool } from 'mysql2/promise';
import {
    IVEstadoAlquileresRepository, IVEstadoCombustibleRepository,
    IVEstadoMulasRepository, IVSaldosAFavorRepository
} from '../../../ports/pagos/repository_port/deuda.repository.interface';

export class VEstadoAlquileresRepository implements IVEstadoAlquileresRepository {
  constructor(private db: Pool) {}
  async findAll(estado?: string): Promise<any[]> {
    const query = estado
      ? 'SELECT * FROM v_estado_alquileres WHERE estado_pago = ?'
      : 'SELECT * FROM v_estado_alquileres';
    const [rows] = await this.db.execute<any[]>(query, estado ? [estado] : []);
    return rows;
  }
}

export class VEstadoCombustibleRepository implements IVEstadoCombustibleRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_estado_combustible');
    return rows;
  }
}

export class VEstadoMulasRepository implements IVEstadoMulasRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_estado_mulas');
    return rows;
  }
}

export class VSaldosAFavorRepository implements IVSaldosAFavorRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_saldos_a_favor_disponibles');
    return rows;
  }
}
