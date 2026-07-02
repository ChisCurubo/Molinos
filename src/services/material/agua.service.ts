import { CreateAguaPlantaDTO, AguaPlantaSQL } from '../../ports/material/repository_port/agua.repository.interface';
import { IAguaPlantaService } from '../../ports/material/service_port/agua.service.interface';
import { AguaPlantaRepository } from '../../repositories/material/agua.repository';

export class AguaPlantaService implements IAguaPlantaService {
    private repo: AguaPlantaRepository;

    constructor() {
        this.repo = new AguaPlantaRepository();
    }

    async registrar(data: CreateAguaPlantaDTO): Promise<number> {
        return await this.repo.registrar(data);
    }

    async listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]> {
        return await this.repo.listar(fechaDesde, fechaHasta);
    }

    async resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]> {
        return await this.repo.resumenPorDueno(fechaDesde, fechaHasta);
    }
}
