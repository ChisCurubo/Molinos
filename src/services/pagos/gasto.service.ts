import { ITipoGastoOperativoService } from '../../ports/pagos/service_port/gasto.service.interface';
import { ITipoGastoOperativoRepository } from '../../ports/pagos/repository_port/gasto.repository.interface';
import { TipoGastoOperativoRepository } from '../../repositories/pagos/gasto.repository';
import { TipoGastoOperativoSQL } from '../../models/pagos/sql/tipo_gasto_operativo.sql';

// --- Original: tipo_gasto_operativo ---
export class TipoGastoOperativoService implements ITipoGastoOperativoService {
    constructor(private repository: ITipoGastoOperativoRepository) {}

    async create(data: any): Promise<TipoGastoOperativoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TipoGastoOperativoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TipoGastoOperativoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TipoGastoOperativoSQL[]> {
        return this.repository.list();
    }
}