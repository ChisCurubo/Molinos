import { ITipoAlquilerService } from '../../ports/pagos/service_port/alquiler.service.interface';
import { ITipoAlquilerRepository } from '../../ports/pagos/repository_port/alquiler.repository.interface';
import { TipoAlquilerRepository } from '../../repositories/pagos/alquiler.repository';
import { TipoAlquilerSQL } from '../../models/pagos/sql/tipo_alquiler.sql';

// --- Original: tipo_alquiler ---
export class TipoAlquilerService implements ITipoAlquilerService {
    constructor(private repository: ITipoAlquilerRepository) {}

    async create(data: any): Promise<TipoAlquilerSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TipoAlquilerSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TipoAlquilerSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TipoAlquilerSQL[]> {
        return this.repository.list();
    }
}