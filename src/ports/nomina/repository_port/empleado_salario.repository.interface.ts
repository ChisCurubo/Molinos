import { PoolConnection } from 'mysql2/promise';
import { EmpleadoSalarioSQL } from '../../../models/nomina/sql/empleado_salario.sql';

export interface IEmpleadoSalarioRepository {
    crear(data: Omit<EmpleadoSalarioSQL, 'id' | 'created_at'>, conn?: PoolConnection): Promise<number>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<EmpleadoSalarioSQL | null>;
    obtenerVigente(empleado_id: number): Promise<EmpleadoSalarioSQL | null>;
    listarPorEmpleado(empleado_id: number): Promise<EmpleadoSalarioSQL[]>;
    // Cierra (activo=0) la(s) vigencia(s) abiertas de un empleado antes de insertar la nueva.
    cerrarVigenciasAbiertas(empleado_id: number, conn: PoolConnection): Promise<void>;
    actualizar(id: number, data: Partial<EmpleadoSalarioSQL>): Promise<boolean>;
    eliminar(id: number): Promise<boolean>;
}
