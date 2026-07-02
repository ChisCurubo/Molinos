export interface CreateAguaPlantaDTO {
    id_dueno_volqueta: number;
    fecha: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    comprobante_url?: string;
}

export interface AguaPlantaSQL {
    id: number;
    fecha: string;
    dueno: string;
    alias?: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    valor_total: number;
    comprobante_url?: string;
    created_at: string;
}

export interface IAguaPlantaRepository {
    registrar(data: CreateAguaPlantaDTO): Promise<number>;
    listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]>;
    resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]>;
}
