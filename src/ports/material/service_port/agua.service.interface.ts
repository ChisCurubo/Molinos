import { CreateAguaPlantaDTO, AguaPlantaSQL } from '../repository_port/agua.repository.interface';

export interface IAguaPlantaService {
    registrar(data: CreateAguaPlantaDTO): Promise<number>;
    listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]>;
    listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]>;
    resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]>;
    resumenPorIdDueno(id_dueno: number): Promise<any>;
    actualizar(id: number, data: import('../repository_port/agua.repository.interface').UpdateAguaPlantaDTO): Promise<boolean>;
}
