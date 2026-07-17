import { ICategoriaCxCService } from '../../ports/pagos/service_port/cxc.service.interface';
import { ICategoriaCxCRepository } from '../../ports/pagos/repository_port/cxc.repository.interface';
import { CategoriaCxCRepository } from '../../repositories/pagos/cxc.repository';
import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export class CategoriaCxCService implements ICategoriaCxCService {
    constructor(private repository: ICategoriaCxCRepository) {}

    async create(data: any): Promise<CategoriaCxcSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<CategoriaCxcSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<CategoriaCxcSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<CategoriaCxcSQL[]> {
        return this.repository.list();
    }
}