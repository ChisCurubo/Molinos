import { Pool } from 'mysql2/promise';
import { EmpleadoSalarioSQL } from '../../models/nomina/sql/empleado_salario.sql';
import { IEmpleadoSalarioRepository } from '../../ports/nomina/repository_port/empleado_salario.repository.interface';
import { IEmpleadoSalarioService } from '../../ports/nomina/service_port/empleado_salario.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const TIPOS_PAGO = ['FIJO_MENSUAL', 'POR_DIAS', 'POR_HORAS'];

export class EmpleadoSalarioService implements IEmpleadoSalarioService {
    constructor(private repo: IEmpleadoSalarioRepository, private db: Pool) {}

    private hoy(): string {
        return new Date().toISOString().slice(0, 10);
    }

    // Crea una nueva vigencia salarial para el empleado y cierra la anterior (versionado,
    // mismo patrón que TarifaProcesoService.crearNuevaVigencia).
    async crearNuevaVigencia(empleado_id: number, data: any): Promise<EmpleadoSalarioSQL> {
        if (!TIPOS_PAGO.includes(data.tipo_pago)) {
            throw err(`tipo_pago inválido, debe ser uno de: ${TIPOS_PAGO.join(', ')}`);
        }
        const tarifa_monto = Number(data.tarifa_monto);
        if (!Number.isFinite(tarifa_monto) || tarifa_monto <= 0) {
            throw err('tarifa_monto debe ser un número mayor a 0');
        }
        const fecha_inicio = data.fecha_inicio || this.hoy();

        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            await this.repo.cerrarVigenciasAbiertas(empleado_id, conn);
            const id = await this.repo.crear({
                empleado_id,
                tipo_pago: data.tipo_pago,
                tarifa_monto,
                aplica_aux_transp: !!data.aplica_aux_transp,
                fecha_inicio,
                activo: true
            }, conn);
            const creada = await this.repo.obtenerPorId(id, conn);
            await conn.commit();
            return creada!;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async obtenerVigente(empleado_id: number): Promise<EmpleadoSalarioSQL | null> {
        return this.repo.obtenerVigente(empleado_id);
    }

    async listarPorEmpleado(empleado_id: number): Promise<EmpleadoSalarioSQL[]> {
        return this.repo.listarPorEmpleado(empleado_id);
    }

    async actualizar(id: number, data: Partial<EmpleadoSalarioSQL>): Promise<EmpleadoSalarioSQL | null> {
        const existe = await this.repo.obtenerPorId(id);
        if (!existe) throw err('Configuración salarial no encontrada', 404);
        if (data.tipo_pago !== undefined && !TIPOS_PAGO.includes(data.tipo_pago)) {
            throw err(`tipo_pago inválido, debe ser uno de: ${TIPOS_PAGO.join(', ')}`);
        }
        if (data.tarifa_monto !== undefined && !(Number(data.tarifa_monto) > 0)) {
            throw err('tarifa_monto debe ser un número mayor a 0');
        }
        await this.repo.actualizar(id, data);
        return this.repo.obtenerPorId(id);
    }

    async eliminar(id: number): Promise<boolean> {
        const existe = await this.repo.obtenerPorId(id);
        if (!existe) throw err('Configuración salarial no encontrada', 404);
        return this.repo.eliminar(id);
    }
}
