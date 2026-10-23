import { ITipoAlquilerService, IAlquilerService } from '../../ports/pagos/service_port/alquiler.service.interface';
import { ITipoAlquilerRepository, IAlquilerRepository } from '../../ports/pagos/repository_port/alquiler.repository.interface';
import { TipoAlquilerRepository } from '../../repositories/pagos/alquiler.repository';
import { TipoAlquilerSQL } from '../../models/pagos/sql/tipo_alquiler.sql';
import { AlquilerSQL } from '../../models/pagos/sql/alquiler.sql';

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

// --- Alquiler (contrato real) ---
export class AlquilerService implements IAlquilerService {
    constructor(private repository: IAlquilerRepository) {}

    async create(data: any): Promise<AlquilerSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<AlquilerSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<AlquilerSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(filtros?: { id_contrato?: number; mes?: number; anio?: number }): Promise<AlquilerSQL[]> {
        return this.repository.list(filtros);
    }
}