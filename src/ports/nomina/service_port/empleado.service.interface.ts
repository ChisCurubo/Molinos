import { EmpleadoSQL } from '../../../models/nomina/sql/empleado.sql';
import { PrestamoEmpleadoSQL } from '../../../models/nomina/sql/prestamo_empleado.sql';

// --- Original: empleado ---
export interface IEmpleadoService {
    create(data: any): Promise<EmpleadoSQL>;
    getById(id: number): Promise<EmpleadoSQL | null>;
    update(id: number, data: any): Promise<EmpleadoSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<EmpleadoSQL[]>;
}

// --- Original: prestamo_empleado ---
export interface PrestamoEmpleadoServiceInterface {
    registrarPrestamo(prestamo: Partial<PrestamoEmpleadoSQL>): Promise<PrestamoEmpleadoSQL>;
    listarPrestamosPorEmpleado(id_empleado: number): Promise<PrestamoEmpleadoSQL[]>;
    updatePrestamo(id: number, data: Partial<PrestamoEmpleadoSQL>): Promise<PrestamoEmpleadoSQL | null>;
}