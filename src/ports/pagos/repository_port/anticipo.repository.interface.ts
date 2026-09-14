import { PoolConnection } from 'mysql2/promise';

export type TerceroAnticipo = 'minero' | 'dueno_volqueta' | 'proveedor';

/**
 * SQL de Anticipos a terceros. Un anticipo crea, en la misma transacción:
 * Anticipos_Terceros (registro de negocio) + Cuentas_Por_Pagar/Abonos_CxP (el egreso,
 * pagado de inmediato) + Saldo_A_Favor origen='anticipo' (el crédito que de verdad se
 * consume después, vía metodo_pago='saldo_a_favor' en la cascada de abonos).
 */
export interface IAnticipoRepository {
    resolverCategoriaAnticipo(conn?: PoolConnection): Promise<number>;

    crearAnticipo(data: { tercero: TerceroAnticipo; id: number; fecha: string; monto: number; descripcion?: string }, conn: PoolConnection): Promise<number>;
    obtenerAnticipo(id: number, conn?: PoolConnection): Promise<any>;
    listarAnticipos(filtros: { tercero?: TerceroAnticipo; id?: number; estado?: string }): Promise<any[]>;
    actualizarUsoAnticipo(id: number, deltaUsado: number, conn: PoolConnection): Promise<void>;
    anularAnticipo(id: number, conn: PoolConnection): Promise<void>;

    crearCuentaAnticipo(data: { tercero: TerceroAnticipo; id: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    anularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    crearRelacionAnticipo(idCxp: number, idAnticipo: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    cuentaDeAnticipo(idAnticipo: number, conn?: PoolConnection): Promise<number | null>;

    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;

    crearSaldoAFavorAnticipo(data: { id_anticipo: number; tercero: TerceroAnticipo; id: number; id_cuenta_pagar: number; monto_original: number; descripcion?: string }, conn: PoolConnection): Promise<number>;
    saldoAFavorDeAnticipo(idAnticipo: number, conn?: PoolConnection): Promise<any>;
    eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void>;

    historialDescuentos(idAnticipo: number, conn?: PoolConnection): Promise<any[]>;
}
