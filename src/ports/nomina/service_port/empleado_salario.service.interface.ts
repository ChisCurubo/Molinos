import { EmpleadoSalarioSQL } from '../../../models/nomina/sql/empleado_salario.sql';

export interface IEmpleadoSalarioService {
    // Crea una nueva vigencia para el empleado y cierra la anterior (versionado, transaccional).
    crearNuevaVigencia(empleado_id: number, data: any): Promise<EmpleadoSalarioSQL>;
    obtenerVigente(empleado_id: number): Promise<EmpleadoSalarioSQL | null>;
    listarPorEmpleado(empleado_id: number): Promise<EmpleadoSalarioSQL[]>;
    actualizar(id: number, data: Partial<EmpleadoSalarioSQL>): Promise<EmpleadoSalarioSQL | null>;
    eliminar(id: number): Promise<boolean>;
}
