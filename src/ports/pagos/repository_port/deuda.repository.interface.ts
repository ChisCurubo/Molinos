export interface IDeudaRepository {
    deudaMaterialPorMinero(): Promise<any[]>;
    deudaMaterialDeUnMinero(id_minero: number): Promise<any[]>;
    saldoAFavorMinero(id_minero: number): Promise<number>;
    deudaFletePorDueno(): Promise<any[]>;
    deudaFleteDeUnDueno(id_dueno: number): Promise<any[]>;
    resumenGeneral(): Promise<any>;
}

export interface IVEstadoAlquileresRepository {
    findAll(estado?: string): Promise<any[]>;
}

export interface IVEstadoCombustibleRepository {
    findAll(): Promise<any[]>;
}

export interface IVEstadoMulasRepository {
    findAll(): Promise<any[]>;
}

export interface IVSaldosAFavorRepository {
    findAll(): Promise<any[]>;
}
