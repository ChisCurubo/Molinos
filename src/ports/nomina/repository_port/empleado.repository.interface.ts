import { PoolConnection } from 'mysql2/promise';
import { EmpleadoSQL } from '../../../models/nomina/sql/empleado.sql';
import { PrestamoEmpleadoSQL } from '../../../models/nomina/sql/prestamo_empleado.sql';

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
    create(prestamo: Partial<PrestamoEmpleadoSQL>, conn?: PoolConnection): Promise<number>;
    getById(id: number, conn?: PoolConnection): Promise<PrestamoEmpleadoSQL | null>;
    listByEmpleadoSQL(id_empleado: number): Promise<PrestamoEmpleadoSQL[]>;
    update(id: number, data: Partial<PrestamoEmpleadoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    listAll(filtros?: { id_empleado?: number }): Promise<PrestamoEmpleadoSQL[]>;

    // Enganche CxP (egreso, reduce capital) / CxC (cobro, el empleado la irá pagando).
    // Ver Cuentas_Por_Pagar_Relacion.id_prestamo_emp / Cuentas_Por_Cobrar_Relacion.id_prestamo_emp.
    crearCuentaPagar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    crearRelacionPagar(idCxp: number, idPrestamo: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    crearCuentaCobrar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    crearRelacionCobrar(idCxc: number, idPrestamo: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;

    cxcDePrestamo(idPrestamo: number, conn?: PoolConnection): Promise<any | null>;
    insertarAbonoCxC(abono: { id_cxc: number; fecha_cobro: string; valor: number; metodo?: string; observaciones?: string }, conn: PoolConnection): Promise<number>;
    recalcularCuentaCobrar(idCxc: number, conn: PoolConnection): Promise<void>;
}