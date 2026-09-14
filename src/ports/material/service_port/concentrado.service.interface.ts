export interface IConcentradoService {
    iniciarLote(data: any): Promise<number>;
    obtenerMerma(id: number): Promise<any>;
    actualizarMerma(id: number, data: any): Promise<any>;
    listarLotes(filtros: any): Promise<any[]>;
    obtenerLoteDetalle(id: number): Promise<any>;
    listarProcesamiento(filtros: any): Promise<any[]>;
    resumenProcesamiento(): Promise<any>;
    procesarLote(id_lote: number, id_entradas: number[], toneladas_procesadas_seco: number): Promise<any>;
    agregarMaterialAlMolinoTx(data: any): Promise<number>;
    editarLote(id: number, data: any): Promise<void>;
    desvincularMaterialTx(idLote: number, idEntrada: number): Promise<void>;
    eliminarLoteTx(idLote: number): Promise<void>;
    cerrarLoteConcentradoTx(id: number, data: any): Promise<void>;
    corregirConcentradoTx(id: number, data: any): Promise<void>;
}
