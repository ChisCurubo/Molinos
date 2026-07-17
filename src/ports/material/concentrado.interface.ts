import { PoolConnection } from 'mysql2/promise';

export interface IConcentradoRepository {
    iniciarLote(data: any, conn?: PoolConnection): Promise<number>;
    obtenerLotePorId(id: number, conn?: PoolConnection): Promise<any>;
    obtenerEntradasParaProcesamiento(idEntradas: number[], conn?: PoolConnection): Promise<any[]>;
    agregarMaterialAlMolino(data: any, conn?: PoolConnection): Promise<number>;
    actualizarEstadoLote(id: number, estado: string, conn?: PoolConnection): Promise<void>;
    actualizarLote(id: number, data: any, conn?: PoolConnection): Promise<void>;
    obtenerTotalSecoProcesado(idLote: number, conn?: PoolConnection): Promise<number>;
    obtenerTarifaMaquila(params: { fecha: string, hizo_molienda: number, hizo_flotacion: number, hizo_relave: number, hizo_filtroprensa: number }, conn?: PoolConnection): Promise<number>;
    crearInventarioConcentrado(data: any, conn?: PoolConnection): Promise<number>;
    insertarKardexMovimiento(data: any, conn?: PoolConnection): Promise<void>;
    distribuirMaquilaYConcentrado(idLote: number, total_seco: number, toneladas_seco: number, maquila_total: number, conn?: PoolConnection): Promise<void>;
}
