import { IDuenoVolquetaService } from '../../ports/material/service_port/volqueta.service.interface';
import { IDuenoVolquetaRepository } from '../../ports/material/repository_port/volqueta.repository.interface';
import { DuenoVolquetaRepository } from '../../repositories/material/volqueta.repository';
import { DuenoVolquetaSQL } from '../../models/material/sql/dueno_volqueta.sql';

// --- Original: dueno_volqueta ---
export class DuenoVolquetaService implements IDuenoVolquetaService {
    private repository: IDuenoVolquetaRepository;

    constructor() {
        this.repository = new DuenoVolquetaRepository();
    }

    async create(data: any): Promise<DuenoVolquetaSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<DuenoVolquetaSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<DuenoVolquetaSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<DuenoVolquetaSQL[]> {
        return this.repository.list();
    }
}