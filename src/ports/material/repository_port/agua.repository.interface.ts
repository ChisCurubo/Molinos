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

export interface AguaViajeReporteRow {
    id: number;
    fecha: string;
    id_dueno: number;
    dueno: string;
    alias?: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    valor_total: number;
}

export interface IAguaPlantaRepository {
    registrar(data: CreateAguaPlantaDTO): Promise<number>;
    listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]>;
    listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]>;
    resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]>;
    resumenPorIdDueno(id_dueno: number): Promise<any>;
    actualizar(id: number, data: UpdateAguaPlantaDTO): Promise<boolean>;
    obtenerPorId(id: number): Promise<AguaPlantaSQL | null>;
    obtenerViajesPeriodo(fechaDesde: string, fechaHasta: string): Promise<AguaViajeReporteRow[]>;
    obtenerSaldosInicio(fechaDesde: string): Promise<{ id_dueno: number; saldo_inicio: number }[]>;
}
