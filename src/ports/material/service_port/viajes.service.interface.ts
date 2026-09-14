export interface IViajesService {
    crearCabeceraViaje(data: any): Promise<number>;
    actualizarCabeceraViajeTx(id: number, data: any): Promise<any>;
    listarViajes(filtros: any): Promise<any[]>;
    obtenerViajeDetalle(id: number): Promise<any>;
    resumenViajes(filtros: any): Promise<any>;
    trazabilidadPorLote(idLote: number): Promise<any[]>;
    trazabilidadDeViaje(idViaje: number): Promise<any>;
    trazabilidadDeLinea(idLinea: number): Promise<any>;
    asignarLoteAViajeTx(data: any): Promise<number>;
    actualizarLineaViajeTx(idLinea: number, data: any): Promise<any>;
    eliminarViajeTx(idViaje: number): Promise<void>;
    eliminarLineaViajeTx(idLinea: number): Promise<void>;
    listarDisponiblesParaMula(): Promise<any[]>;
}
