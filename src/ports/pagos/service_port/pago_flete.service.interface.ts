export interface IPagoFleteService {
    deudaPorDueno(): Promise<any[]>;
    estadoCuentaDueno(idDueno: number, filtros?: { mes?: number; anio?: number }): Promise<any>;
    registrarAbonoDuenoTx(idDueno: number, data: any): Promise<any>;
    actualizarAbonoTx(idAbono: number, data: any): Promise<any>;
    eliminarAbonoTx(idAbono: number): Promise<any>;
    listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<{ abonos: any[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>;
}
