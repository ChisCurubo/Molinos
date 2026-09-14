import { PoolConnection } from 'mysql2/promise';

export interface ITarifaProcesoRepository {
    listar(filtros: { codigo?: string; activo?: number }): Promise<any[]>;
    obtenerVigentes(fecha: string): Promise<any[]>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<any>;
    // Cierra las vigencias abiertas (fecha_hasta IS NULL) de un código:
    // les pone fecha_hasta = día anterior a la nueva vigencia y activo = 0.
    cerrarVigenciasAbiertas(codigo: string, fechaDesdeNueva: string, conn?: PoolConnection): Promise<void>;
    crear(data: any, conn?: PoolConnection): Promise<number>;
    actualizar(id: number, data: any, conn?: PoolConnection): Promise<void>;
}

export interface ITarifaProcesoService {
    listar(filtros: { codigo?: string; activo?: number }): Promise<any[]>;
    obtenerVigentes(fecha?: string): Promise<any[]>;
    // Crea una nueva vigencia para un código y cierra la anterior (versionado por fechas).
    crearNuevaVigencia(data: any): Promise<any>;
    actualizar(id: number, data: any): Promise<any>;
}
