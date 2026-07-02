import { CreateAguaPlantaDTO, AguaPlantaSQL } from '../repository_port/agua.repository.interface';

export interface IAguaPlantaService {
    registrar(data: CreateAguaPlantaDTO): Promise<number>;
    listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]>;
    resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]>;
}
