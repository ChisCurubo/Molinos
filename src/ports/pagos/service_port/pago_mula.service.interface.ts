export interface IPagoMulaService {
    crearMulaTx(data: any): Promise<any>;
    listarMulas(filtros: { id_proveedor?: number; id_viaje?: number; estado?: string }): Promise<any[]>;
    resumenMulas(filtros: { desde?: string; hasta?: string; id_proveedor?: number }): Promise<any>;
    obtenerMulaDetalle(id: number): Promise<any>;
    actualizarMulaTx(id: number, data: any): Promise<any>;
    eliminarMulaTx(id: number): Promise<void>;

    registrarAbonoProveedorTx(idProveedor: number, data: any): Promise<any>;
    actualizarAbonoTx(idAbono: number, data: any): Promise<any>;
    eliminarAbonoTx(idAbono: number): Promise<any>;
    listarAbonosPaginado(filtros: { id_proveedor?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any>;

    trazabilidadPorViaje(): Promise<any[]>;
}
