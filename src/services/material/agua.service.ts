import { CreateAguaPlantaDTO, AguaPlantaSQL, IAguaPlantaRepository } from '../../ports/material/repository_port/agua.repository.interface';
import { IAguaPlantaService } from '../../ports/material/service_port/agua.service.interface';
import { VehiculoRepository } from '../../repositories/material/vehiculo.repository';

export class AguaPlantaService implements IAguaPlantaService {
    private repo: IAguaPlantaRepository;
    private vehiculoRepo: VehiculoRepository;

    constructor(repo: IAguaPlantaRepository, vehiculoRepo: VehiculoRepository) {
        this.repo = repo;
        this.vehiculoRepo = vehiculoRepo;
    }

    async registrar(data: CreateAguaPlantaDTO): Promise<number> {
        if (!data.id_vehiculo) {
            throw new Error('id_vehiculo es requerido');
        }

        const vehiculo = await this.vehiculoRepo.getById(data.id_vehiculo);
        if (!vehiculo) {
            throw new Error('Vehículo no encontrado');
        }

        data.id_dueno_volqueta = vehiculo.dueno_id;

        // valor_total es calculado automáticamente por la DB (columna STORED)

        return await this.repo.registrar(data);
    }

    async actualizar(id: number, data: import('../../ports/material/repository_port/agua.repository.interface').UpdateAguaPlantaDTO): Promise<boolean> {
        return await this.repo.actualizar(id, data);
    }

    async listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]> {
        return await this.repo.listar(fechaDesde, fechaHasta);
    }

    async resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]> {
        return await this.repo.resumenPorDueno(fechaDesde, fechaHasta);
    }

    async listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]> {
        return await this.repo.listarPorDueno(id_dueno);
    }

    async resumenPorIdDueno(id_dueno: number): Promise<any> {
        return await this.repo.resumenPorIdDueno(id_dueno);
    }
}
