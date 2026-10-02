import { BonoEmpleadoSQL } from '../../../models/nomina/sql/bono_empleado.sql';

export interface IBonoEmpleadoService {
    registrarBono(data: { id_empleado: number; fecha?: string; concepto: string; valor: number }): Promise<BonoEmpleadoSQL>;
    listar(filtros: { id_empleado?: number; desde?: string; hasta?: string }): Promise<BonoEmpleadoSQL[]>;
    obtenerPorId(id: number): Promise<BonoEmpleadoSQL | null>;
    eliminar(id: number): Promise<boolean>;
}
