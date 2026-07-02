import { EmpleadoSQL } from '../../models/nomina/sql/empleado.sql';
import { PrestamoEmpleadoSQL } from '../../models/nomina/sql/prestamo_empleado.sql';

// --- Original: empleado ---
export interface IEmpleadoRepository {
    create(data: Omit<EmpleadoSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<EmpleadoSQL | null>;
    update(id: number, data: Partial<EmpleadoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<EmpleadoSQL[]>;
}

// --- Original: prestamo_empleado ---
export interface PrestamoEmpleadoRepositoryInterface {
    create(prestamo: Partial<PrestamoEmpleadoSQL>): Promise<number>;
    getById(id: number): Promise<PrestamoEmpleadoSQL | null>;
    listByEmpleadoSQL(id_empleado: number): Promise<PrestamoEmpleadoSQL[]>;
}