import { ICuentaBancariaRepository } from '../../ports/pagos/repository_port/cuenta_bancaria.repository.interface';
import { ICuentaBancariaService } from '../../ports/pagos/service_port/cuenta_bancaria.service.interface';
import { CuentaBancariaSQL } from '../../models/pagos/sql/cuenta_bancaria.sql';
import { AppError } from '../../errors/app-error';

const err = (msg: string, status = 400, code?: string): AppError => AppError.http(status, msg, code ?? (status === 400 ? 'BUSINESS_RULE' : undefined));

export class CuentaBancariaService implements ICuentaBancariaService {
    constructor(private repo: ICuentaBancariaRepository) {}

    async create(data: any): Promise<CuentaBancariaSQL> {
        const nombre = (data.nombre || '').trim();
        if (!nombre) throw err('nombre es requerido');
        const propietario = (data.propietario || '').trim();
        if (!propietario) throw err('propietario es requerido');

        const id = await this.repo.create({
            nombre, banco: data.banco ?? null, numero_cuenta: data.numero_cuenta ?? null,
            tipo_cuenta: data.tipo_cuenta ?? null, propietario, id_empleado: data.id_empleado ?? null,
            exento_4x1000: !!data.exento_4x1000, activa: data.activa ?? true
        });
        return (await this.repo.getById(id))!;
    }

    async getById(id: number): Promise<CuentaBancariaSQL | null> {
        return this.repo.getById(id);
    }

    async update(id: number, data: any): Promise<CuentaBancariaSQL | null> {
        const existe = await this.repo.getById(id);
        if (!existe) throw err('Cuenta bancaria no encontrada', 404);
        await this.repo.update(id, data);
        return this.repo.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        const existe = await this.repo.getById(id);
        if (!existe) throw err('Cuenta bancaria no encontrada', 404);
        try {
            return await this.repo.delete(id);
        } catch (e: any) {
            if (e?.errno === 1451) {
                throw err('Esta cuenta bancaria tiene movimientos asociados (pagos, gastos, etc.) y no se puede eliminar', 409);
            }
            throw e;
        }
    }

    async list(): Promise<CuentaBancariaSQL[]> {
        return this.repo.list();
    }

    async getSaldo(id: number): Promise<any> {
        const saldo = await this.repo.getSaldo(id);
        if (!saldo) throw err('Cuenta bancaria no encontrada', 404);
        return saldo;
    }

    async listarSaldos(): Promise<any[]> {
        return this.repo.listarSaldos();
    }
}
