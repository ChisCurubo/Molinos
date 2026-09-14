export interface IDeudaService {
    deudaMaterialPorMinero(): Promise<any[]>;
    deudaMaterialDeMinero(id_minero: number): Promise<any>;
    deudaFletePorDueno(): Promise<any[]>;
    deudaFleteDeDueno(id_dueno: number): Promise<any[]>;
    resumenGeneral(): Promise<any>;
    estadoAlquileres(estado?: string): Promise<any[]>;
    estadoCombustible(): Promise<any[]>;
    estadoMulas(): Promise<any[]>;
    saldosAFavor(): Promise<any[]>;
}
