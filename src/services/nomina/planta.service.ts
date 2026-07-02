import { IPlantaService } from '../../ports/nomina/service_port/planta.service.interface';
import { IPlantaRepository } from '../../ports/nomina/repository_port/planta.repository.interface';
import { PlantaRepository } from '../../repositories/nomina/planta.repository';
import { PlantaSQL } from '../../models/nomina/sql/planta.sql';

// --- Original: planta ---
export class PlantaService implements IPlantaService {
    private repository: IPlantaRepository;

    constructor() {
        this.repository = new PlantaRepository();
    }

    async create(data: any): Promise<PlantaSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<PlantaSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<PlantaSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<PlantaSQL[]> {
        return this.repository.list();
    }
}