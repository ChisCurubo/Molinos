import { Pool } from 'mysql2/promise';

export class VSaldoPrestamosEmpleadoRepository {
  constructor(private db: Pool) {}
  async findAll(): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>('SELECT * FROM v_saldo_prestamos_empleado');
    return rows;
  }

  async findByEmpleado(id_empleado: number): Promise<any[]> {
    const [rows] = await this.db.execute<any[]>(
      'SELECT * FROM v_saldo_prestamos_empleado WHERE id_empleado = ?', [id_empleado]
    );
    return rows;
  }
}
