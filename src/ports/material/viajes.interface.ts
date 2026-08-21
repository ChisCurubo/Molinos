import { PoolConnection } from 'mysql2/promise';

export interface IViajesRepository {
    crearCabeceraViaje(data: any, conn?: PoolConnection): Promise<number>;
    obtenerViajePorId(id: number, conn?: PoolConnection): Promise<any>;
    asignarLoteAViaje(data: any, conn?: PoolConnection): Promise<number>;
    obtenerLoteConAnalisis(idLote: number, conn?: PoolConnection): Promise<any>;
    eliminarLineaViaje(idLinea: number, conn?: PoolConnection): Promise<void>;
    obtenerLineaViajePorId(idLinea: number, conn?: PoolConnection): Promise<any>;
    obtenerLineasDeViaje(idViaje: number, conn?: PoolConnection): Promise<any[]>;
    eliminarViaje(idViaje: number, conn?: PoolConnection): Promise<void>;
    // --- Lectura (listados / detalle / resumen / trazabilidad) ---
    listarViajes(filtros: any): Promise<any[]>;
    obtenerLineasDeViajes(idViajes: number[]): Promise<any[]>;
    resumenViajes(filtros: any): Promise<any>;
    listarLineasPorLote(idLote: number): Promise<any[]>;
    obtenerLineasConLote(idViaje: number): Promise<any[]>;
    obtenerAportesDeLotes(idLotes: number[]): Promise<any[]>;
}
