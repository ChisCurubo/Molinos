export interface IPagoMaterialService {
    crearCuentaTx(data: any): Promise<any>;
    actualizarCuentaTx(idCxp: number, data: any): Promise<any>;
    anularCuentaTx(idCxp: number): Promise<void>;
    registrarAbonoTx(idCxp: number, data: any): Promise<any>;
    abonarConCreditoTx(idCxp: number, data: any): Promise<any>;
    actualizarAbonoTx(idAbono: number, data: any): Promise<any>;
    eliminarAbonoTx(idAbono: number): Promise<any>;
    obtenerDetalle(idCxp: number): Promise<any>;
    listarCuentas(filtros: any): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_minero?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<{ abonos: any[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>;
}
