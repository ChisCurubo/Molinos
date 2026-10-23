import { PoolConnection } from 'mysql2/promise';

/**
 * SQL del pago de un ALQUILER individual. A diferencia de Flete/Agua/Combustible,
 * v_estado_alquileres agrupa por cada alquiler (no por proveedor+mes): 1 Cuenta_Por_Pagar
 * por alquiler, creada perezosamente en el primer abono. Sin cascada entre registros.
 */
export interface IPagoAlquilerRepository {
    obtenerAlquiler(idAlquiler: number, conn?: PoolConnection): Promise<any>;
    buscarCuentaDeAlquiler(idAlquiler: number, conn: PoolConnection): Promise<number | null>;
    crearCuentaAlquiler(data: { id_alquiler: number; id_proveedor: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    crearRelacionAlquiler(idCxp: number, idAlquiler: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;

    obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any>;
    recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    obtenerAbono(id: number, conn?: PoolConnection): Promise<any>;
    actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarAbono(id: number, conn: PoolConnection): Promise<void>;
    listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_alquiler?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }>;
    sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number>;
    esCuentaDeAlquiler(idCxp: number, conn?: PoolConnection): Promise<boolean>;
}
