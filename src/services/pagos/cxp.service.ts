import { CuentaPorPagarSQL } from '../../models/pagos/sql/cuenta_por_pagar.sql';
import { CuentasPorPagarRepositoryInterface } from '../../ports/pagos/repository_port/cxp.repository.interface';
import { CuentasPorPagarServiceInterface } from '../../ports/pagos/service_port/cxp.service.interface';
import { ICategoriaCxPService } from '../../ports/pagos/service_port/cxp.service.interface';
import { ICategoriaCxPRepository } from '../../ports/pagos/repository_port/cxp.repository.interface';
import { CategoriaCxPRepository } from '../../repositories/pagos/cxp.repository';
import { CategoriaCxpSQL } from '../../models/pagos/sql/categoria_cxp.sql';

// --- Original: cuentas_por_pagar ---
export class CuentasPorPagarService implements CuentasPorPagarServiceInterface {
    constructor(private repo: CuentasPorPagarRepositoryInterface) {}

    async registrarCuenta(cuenta: Partial<CuentaPorPagarSQL>): Promise<CuentaPorPagarSQL> {
        return await this.repo.create(cuenta);
    }

    async obtenerCuenta(id: number): Promise<CuentaPorPagarSQL> {
        const cuenta = await this.repo.getById(id);
        if (!cuenta) throw new Error('Cuenta no encontrada');
        return cuenta;
    }

    async listarCuentas(): Promise<CuentaPorPagarSQL[]> {
        return await this.repo.listAll();
    }

    async listarCuentasPorEstado(estado: string): Promise<CuentaPorPagarSQL[]> {
        return await this.repo.listByEstado(estado);
    }

    async actualizarEstadoPago(id: number, pagoAdicional: number): Promise<boolean> {
        const cuenta = await this.obtenerCuenta(id);
        const nuevoPagado = Number(cuenta.valor_pagado) + Number(pagoAdicional);
        let nuevoEstado = cuenta.estado;
        
        if (nuevoPagado >= cuenta.valor_total) {
            nuevoEstado = 'pagado';
        } else if (nuevoPagado > 0) {
            nuevoEstado = 'parcial';
        }

        return await this.repo.update(id, { 
            valor_pagado: nuevoPagado,
            estado: nuevoEstado
        });
    }
}

// --- Original: categoria_cxp ---
export class CategoriaCxPService implements ICategoriaCxPService {
    constructor(private repository: ICategoriaCxPRepository) {}

    async create(data: any): Promise<CategoriaCxpSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<CategoriaCxpSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<CategoriaCxpSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<CategoriaCxpSQL[]> {
        return this.repository.list();
    }
}