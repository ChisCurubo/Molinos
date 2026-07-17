export interface CreateAguaPlantaDTO {
    id_vehiculo: number;
    id_dueno_volqueta?: number;
    fecha: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    comprobante_url?: string;
}

export interface UpdateAguaPlantaDTO {
    valor_viaje?: number;
    cantidad_viajes?: number;
    acpm?: number;
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
    listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]>;
    resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]>;
    resumenPorIdDueno(id_dueno: number): Promise<any>;
    actualizar(id: number, data: UpdateAguaPlantaDTO): Promise<boolean>;
}
