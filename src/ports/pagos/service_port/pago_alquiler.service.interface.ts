export interface IPagoAlquilerService {
    estadoAlquiler(idAlquiler: number): Promise<any>;
    registrarAbonoTx(idAlquiler: number, data: any): Promise<any>;
    actualizarAbonoTx(idAbono: number, data: any): Promise<any>;
    eliminarAbonoTx(idAbono: number): Promise<any>;
    listarAbonosPaginado(filtros: { id_alquiler?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<{ abonos: any[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>;
}
