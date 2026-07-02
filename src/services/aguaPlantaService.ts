import { CreateAguaPlantaDTO, AguaPlanta } from '../models/material/sql/agua_planta.sql';
import { AguaPlantaRepository } from '../repositories/material/agua_planta.repository';

export class AguaPlantaService {
  private aguaPlantaRepo = new AguaPlantaRepository();

  // 5.1 INSERT agua_planta
  async registrar(data: CreateAguaPlantaDTO): Promise<number> {
    return await this.aguaPlantaRepo.registrar(data);
  }

  // 5.2 Listar viajes de agua con dueño
  async listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlanta[]> {
    return await this.aguaPlantaRepo.listar(fechaDesde, fechaHasta);
  }

  // 5.3 Total de agua por dueño en un rango de fechas (para liquidación)
  async resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]> {
    return await this.aguaPlantaRepo.resumenPorDueno(fechaDesde, fechaHasta);
  }
}
