import { Pool, PoolConnection } from 'mysql2/promise';
import { IEmpleadoService } from '../../ports/nomina/service_port/empleado.service.interface';
import { IEmpleadoRepository } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { EmpleadoRepository } from '../../repositories/nomina/empleado.repository';
import { EmpleadoSQL } from '../../models/nomina/sql/empleado.sql';
import { PrestamoEmpleadoSQL } from '../../models/nomina/sql/prestamo_empleado.sql';
import { PrestamoEmpleadoRepositoryInterface } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { PrestamoEmpleadoServiceInterface } from '../../ports/nomina/service_port/empleado.service.interface';

// --- Original: empleado ---
export class EmpleadoService implements IEmpleadoService {
    constructor(private repository: IEmpleadoRepository) {}

    async create(data: any): Promise<EmpleadoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<EmpleadoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<EmpleadoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        try {
            return await this.repository.delete(id);
        } catch (e: any) {
            if (e?.errno === 1451) {
                const err: any = new Error('Este empleado tiene registros asociados (turnos, salario, préstamos, liquidaciones, etc.) y no se puede eliminar');
                err.status = 409;
                throw err;
            }
            throw e;
        }
    }

    async list(): Promise<EmpleadoSQL[]> {
        return this.repository.list();
    }
}

// --- Original: prestamo_empleado ---
export class PrestamoEmpleadoService implements PrestamoEmpleadoServiceInterface {
    constructor(
        private repo: PrestamoEmpleadoRepositoryInterface,
        private empleadoRepo: IEmpleadoRepository,
        private db: Pool
    ) {}

    private async tx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const out = await fn(conn);
            await conn.commit();
            return out;
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    /**
     * Un préstamo a empleado es, a la vez: un egreso real (la empresa entrega dinero,
     * reduce su capital) y una cuenta de cobro (el empleado la irá pagando). Por eso, en
     * la misma transacción de creación se generan también la Cuenta_Por_Pagar (desembolso)
     * y la Cuenta_Por_Cobrar (deuda del empleado) — ver NOMINA_QUINCENAL_plan.md Fase 1.
     * El desembolso se paga después con el flujo normal de Abonos_CxP; el cobro se
     * recupera manualmente (Abonos_CxC) o automáticamente por cuotas en cada liquidación
     * de nómina (descuento_nomina).
     */
    async registrarPrestamo(req: Partial<PrestamoEmpleadoSQL>): Promise<any> {
        if (!req.id_empleado || !req.valor || req.valor <= 0) {
            throw new Error("El ID de empleado y un valor válido son requeridos");
        }
        const cuotas = Number(req.cuotas) || 1;
        if (cuotas < 1) throw new Error("El número de cuotas debe ser al menos 1");

        const empleado = await this.empleadoRepo.getById(req.id_empleado);
        if (!empleado) {
            throw new Error("El empleado no existe");
        }

        const fecha = req.fecha ? new Date(req.fecha) : new Date();
        const fechaSql = fecha.toISOString().slice(0, 10);
        const concepto = (req.concepto && String(req.concepto).trim())
            || `Préstamo a ${empleado.nombre} ${empleado.apellido}`;

        return this.tx(async conn => {
            const id = await this.repo.create({ ...req, fecha, cuotas, concepto }, conn);

            const idCxp = await this.repo.crearCuentaPagar(
                { id_empleado: req.id_empleado!, concepto, valor_total: req.valor!, fecha_creacion: fechaSql }, conn
            );
            await this.repo.crearRelacionPagar(idCxp, id, req.valor!, concepto, conn);

            const idCxc = await this.repo.crearCuentaCobrar(
                { id_empleado: req.id_empleado!, concepto, valor_total: req.valor!, fecha_creacion: fechaSql }, conn
            );
            await this.repo.crearRelacionCobrar(idCxc, id, req.valor!, concepto, conn);

            const nuevoPrestamo = await this.repo.getById(id, conn);
            if (!nuevoPrestamo) throw new Error("Error registrando el préstamo");

            return { ...nuevoPrestamo, id_cuenta_pagar: idCxp, id_cuenta_cobrar: idCxc };
        });
    }

    async listarPrestamosPorEmpleado(id_empleado: number): Promise<PrestamoEmpleadoSQL[]> {
        return await this.repo.listByEmpleadoSQL(id_empleado);
    }

    async updatePrestamo(id: number, data: Partial<PrestamoEmpleadoSQL>): Promise<PrestamoEmpleadoSQL | null> {
        const success = await this.repo.update(id, data);
        if (!success) return null;
        return await this.repo.getById(id);
    }

    async getById(id: number): Promise<PrestamoEmpleadoSQL | null> {
        return this.repo.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        const existe = await this.repo.getById(id);
        if (!existe) { const e: any = new Error('Préstamo de empleado no encontrado'); e.status = 404; throw e; }
        try {
            return await this.repo.delete(id);
        } catch (e: any) {
            if (e?.errno === 1451) {
                const err: any = new Error('Este préstamo tiene registros asociados (cuentas por pagar/cobrar) y no se puede eliminar');
                err.status = 409;
                throw err;
            }
            throw e;
        }
    }

    async listAll(filtros?: { id_empleado?: number }): Promise<PrestamoEmpleadoSQL[]> {
        return this.repo.listAll(filtros);
    }
}