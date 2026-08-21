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
    // --- Edición / eliminación de lote y desvinculación de material ---
    contarLineasViajeDeLote(idLote: number, conn?: PoolConnection): Promise<number>;
    obtenerProcesamientos(idLote: number, conn?: PoolConnection): Promise<any[]>;
    obtenerProcesamientoPorLoteYEntrada(idLote: number, idEntrada: number, conn?: PoolConnection): Promise<any>;
    restaurarInventarioDeEntrada(idEntrada: number, toneladas: number, idLote: number, conn?: PoolConnection): Promise<void>;
    eliminarProcesamiento(idProcesamiento: number, conn?: PoolConnection): Promise<void>;
    eliminarAnalisisDeLote(idLote: number, conn?: PoolConnection): Promise<void>;
    eliminarLote(idLote: number, conn?: PoolConnection): Promise<void>;
    // --- Lectura (listados / detalle / resumen) ---
    listarLotes(filtros: any): Promise<any[]>;
    obtenerMaterialesDeLote(idLote: number): Promise<any[]>;
    obtenerAnalisisDeLote(idLote: number): Promise<any[]>;
    listarProcesamiento(filtros: any): Promise<any[]>;
    obtenerAnalisisPorEntradas(idEntradas: number[]): Promise<any[]>;
    resumenLotesPorEstado(): Promise<any[]>;
}
