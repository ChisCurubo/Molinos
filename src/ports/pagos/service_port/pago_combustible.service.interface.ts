export interface IPagoCombustibleService {
    deudaPorGasolinera(): Promise<any[]>;
    estadoCuentaGasolinera(idGasolinera: number, filtros?: { mes?: number; anio?: number }): Promise<any>;
    registrarAbonoGasolineraTx(idGasolinera: number, data: any): Promise<any>;
    actualizarAbonoTx(idAbono: number, data: any): Promise<any>;
    eliminarAbonoTx(idAbono: number): Promise<any>;
    listarAbonosPaginado(filtros: { id_gasolinera?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<{ abonos: any[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>;
}
