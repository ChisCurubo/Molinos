export interface IVEstadoPagoMaterialRepository {
    findAll(estado?: string): Promise<any[]>;
    findByEntrada(id_entrada: number): Promise<any | null>;
}

export interface IVEstadoPagoFleteRepository {
    findAll(estado?: string): Promise<any[]>;
    findByEntrada(id_entrada: number): Promise<any | null>;
}

export interface IVExcedenteEmpresaRepository {
    findAll(estado_distribucion?: string): Promise<any[]>;
}

export interface IVExcedentePorVehiculoRepository {
    findAll(): Promise<any[]>;
    findByVehiculo(id_vehiculo: number): Promise<any[]>;
}

export interface IVAnalisisCompletoRepository {
    findAll(id_minero?: number, id_mina?: number, desde?: string, hasta?: string): Promise<any[]>;
}

export interface IVEstadoAguaRepository {
    findAll(estado?: string): Promise<any[]>;
}
