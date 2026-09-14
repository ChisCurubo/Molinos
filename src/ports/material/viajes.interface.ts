import { PoolConnection } from 'mysql2/promise';

export interface IViajesRepository {
    crearCabeceraViaje(data: any, conn?: PoolConnection): Promise<number>;
    actualizarCabeceraViaje(id: number, data: any, conn?: PoolConnection): Promise<void>;
    obtenerViajePorId(id: number, conn?: PoolConnection): Promise<any>;
    asignarLoteAViaje(data: any, conn?: PoolConnection): Promise<number>;
    actualizarLineaViaje(idLinea: number, data: any, conn?: PoolConnection): Promise<void>;
    obtenerLoteConAnalisis(idLote: number, conn?: PoolConnection): Promise<any>;
    eliminarLineaViaje(idLinea: number, conn?: PoolConnection): Promise<void>;
    obtenerLineaViajePorId(idLinea: number, conn?: PoolConnection): Promise<any>;
    obtenerLineasDeViaje(idViaje: number, conn?: PoolConnection): Promise<any[]>;
    eliminarViaje(idViaje: number, conn?: PoolConnection): Promise<void>;
    // --- Movimiento de stock del concentrado (migrado de triggers #4/#5/#7) ---
    obtenerTenorCompraPromedioLote(idLote: number, conn?: PoolConnection): Promise<number | null>;
    obtenerTotalMaterialLote(idLote: number, conn?: PoolConnection): Promise<number>;
    obtenerEstadoYStockLote(idLote: number, conn?: PoolConnection): Promise<any>;
    descontarStockConcentrado(idLote: number, humedo: number, idViaje: number, conn?: PoolConnection): Promise<number>;
    devolverStockConcentrado(idLote: number, humedo: number, idViaje: number, conn?: PoolConnection): Promise<void>;
    marcarLoteEnCanoaSiSinLineas(idLote: number, conn?: PoolConnection): Promise<void>;
    marcarEntradasIncluidasViaje(idLote: number, conn?: PoolConnection): Promise<void>;
    revertirEntradasIncluidasViaje(idLote: number, conn?: PoolConnection): Promise<void>;
    recalcularTotalesViaje(idViaje: number, conn?: PoolConnection): Promise<void>;
    // --- Lectura (listados / detalle / resumen / trazabilidad) ---
    listarViajes(filtros: any): Promise<any[]>;
    obtenerLineasDeViajes(idViajes: number[]): Promise<any[]>;
    resumenViajes(filtros: any): Promise<any>;
    listarLineasPorLote(idLote: number): Promise<any[]>;
    obtenerLineasConLote(idViaje: number): Promise<any[]>;
    obtenerAportesDeLotes(idLotes: number[]): Promise<any[]>;
    // --- Selector para Mulas: viajes armados (con líneas) y aún sin despachar ---
    listarDisponiblesParaMula(): Promise<any[]>;
}
