import { IDuenoVolquetaService, IVehiculoService } from '../../ports/material/service_port/volqueta.service.interface';
import { IDuenoVolquetaRepository, IVehiculoRepository } from '../../ports/material/repository_port/volqueta.repository.interface';
import { DuenoVolquetaRepository } from '../../repositories/material/volqueta.repository';
import { DuenoVolquetaSQL } from '../../models/material/sql/dueno_volqueta.sql';

// --- Original: dueno_volqueta ---
export class DuenoVolquetaService implements IDuenoVolquetaService {
    private repository: DuenoVolquetaRepository;

    constructor(repository: DuenoVolquetaRepository) {
        this.repository = repository;
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

// --- Original: volqueta_vehiculo (vehículo vive dentro del módulo volqueta) ---
export class VehiculoService implements IVehiculoService {
    private repository: IVehiculoRepository;

    constructor(repository: IVehiculoRepository) {
        this.repository = repository;
    }

    async list(todas?: boolean): Promise<any[]> {
        return this.repository.list(todas);
    }

    async getById(id: number): Promise<any | null> {
        return this.repository.getById(id);
    }

    async create(data: any): Promise<number> {
        return this.repository.create(data);
    }

    async update(id: number, data: any): Promise<boolean> {
        return this.repository.update(id, data);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async listarPorDueno(id_dueno: number): Promise<any[]> {
        return this.repository.listarPorDueno(id_dueno);
    }

    async listarEntradas(id_vehiculo: number): Promise<any[]> {
        return this.repository.listarEntradas(id_vehiculo);
    }

    async entradasPendientes(id_vehiculo: number): Promise<any[]> {
        return this.repository.listarEntradasPendientesFlete(id_vehiculo);
    }
}