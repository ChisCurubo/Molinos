import { Pool, PoolConnection } from 'mysql2/promise';
import { IBonoEmpleadoRepository } from '../../ports/nomina/repository_port/bono_empleado.repository.interface';
import { IEmpleadoRepository } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { IBonoEmpleadoService } from '../../ports/nomina/service_port/bono_empleado.service.interface';
import { BonoEmpleadoSQL } from '../../models/nomina/sql/bono_empleado.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };

/**
 * Bonos a empleados: ocasionales, sin periodicidad — un mes puede no tener ninguno y
 * otro puede tener varios. Cada bono es un egreso real: genera su propia Cuenta_Por_Pagar
 * (categoría 'Bono empleado') igual que cualquier otro pago, pagable con el flujo normal
 * de Abonos_CxP. NOMINA_QUINCENAL_plan.md Fase 3.
 */
export class BonoEmpleadoService implements IBonoEmpleadoService {
    constructor(
        private repo: IBonoEmpleadoRepository,
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

    async registrarBono(data: { id_empleado: number; fecha?: string; concepto: string; valor: number }): Promise<BonoEmpleadoSQL> {
        if (!data.id_empleado) throw err('id_empleado es requerido');
        if (!(Number(data.valor) > 0)) throw err('El valor del bono debe ser mayor a 0');
        const concepto = (data.concepto || '').trim();
        if (!concepto) throw err('El concepto del bono es requerido');

        const empleado = await this.empleadoRepo.getById(data.id_empleado);
        if (!empleado) throw err('El empleado no existe', 404);

        const fecha = data.fecha || new Date().toISOString().slice(0, 10);

        return this.tx(async conn => {
            const id = await this.repo.crear({ id_empleado: data.id_empleado, fecha, concepto, valor: data.valor }, conn);
            const idCxp = await this.repo.crearCuentaPagar(
                { id_empleado: data.id_empleado, concepto, valor_total: data.valor, fecha_creacion: fecha }, conn
            );
            await this.repo.confirmarConCuentaPagar(id, idCxp, conn);
            const creado = await this.repo.obtenerPorId(id, conn);
            return creado!;
        });
    }

    async listar(filtros: { id_empleado?: number; desde?: string; hasta?: string }): Promise<BonoEmpleadoSQL[]> {
        return this.repo.listar(filtros);
    }

    async obtenerPorId(id: number): Promise<BonoEmpleadoSQL | null> {
        return this.repo.obtenerPorId(id);
    }

    async eliminar(id: number): Promise<boolean> {
        const bono = await this.repo.obtenerPorId(id);
        if (!bono) throw err('Bono no encontrado', 404);

        if (bono.id_cuenta_pagar) {
            const cxp = await this.repo.estadoCuentaPagar(bono.id_cuenta_pagar);
            if (cxp && cxp.valor_pagado > 0) {
                throw err('Este bono ya fue pagado (tiene abonos); no se puede eliminar', 409);
            }
        }

        return this.tx(async conn => {
            if (bono.id_cuenta_pagar) await this.repo.anularCuentaPagar(bono.id_cuenta_pagar, conn);
            return this.repo.eliminar(id, conn);
        });
    }
}
