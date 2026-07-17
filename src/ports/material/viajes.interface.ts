import { PoolConnection } from 'mysql2/promise';

export interface IViajesRepository {
    crearCabeceraViaje(data: any, conn?: PoolConnection): Promise<number>;
    obtenerViajePorId(id: number, conn?: PoolConnection): Promise<any>;
    asignarLoteAViaje(data: any, conn?: PoolConnection): Promise<number>;
    eliminarLineaViaje(idLinea: number, conn?: PoolConnection): Promise<void>;
    obtenerLineaViajePorId(idLinea: number, conn?: PoolConnection): Promise<any>;
}
