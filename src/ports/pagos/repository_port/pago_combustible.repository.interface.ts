import { PoolConnection } from 'mysql2/promise';

// Consumo a crédito de una gasolinera, aún sin agrupar en una Cuenta_Por_Pagar.
export interface ConsumoCreditoGasolinera {
    id_combustible: number;
    fecha: string;
    valor: number;
    tipo_consumo: string;
    descripcion: string | null;
}

/**
 * SQL del pago de COMBUSTIBLE a la gasolinera (por proveedor, agrupado por mes,
 * con cascada de abonos). Mismo patrón que Flete/Agua, pero sin neteo: el monto
 * de cada Relacion es directamente el valor del consumo (ya es 100% crédito).
 * Toda la lógica de negocio vive en el service; aquí solo consultas.
 */
export interface IPagoCombustibleRepository {
    resolverCategoriaCombustible(conn?: PoolConnection): Promise<number>;

    // Materialización
    consumosCreditoDeGasolinera(idGasolinera: number, conn?: PoolConnection): Promise<ConsumoCreditoGasolinera[]>;
    idsCombustibleConRelacion(idGasolinera: number, conn?: PoolConnection): Promise<number[]>;
    buscarCuentaMesCombustible(idGasolinera: number, anio: number, mes: number, conn: PoolConnection): Promise<number | null>;
    crearCuentaCombustible(data: { id_gasolinera: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    crearRelacionCombustible(idCxp: number, idCombustible: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    sumarValorTotal(idCxp: number, delta: number, conn: PoolConnection): Promise<void>;

    // Cuenta / abonos (genéricos sobre CxP)
    obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any>;
    recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    cuentasAbiertasDeGasolinera(idGasolinera: number, conn?: PoolConnection): Promise<any[]>;
    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    obtenerAbono(id: number, conn?: PoolConnection): Promise<any>;
    actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarAbono(id: number, conn: PoolConnection): Promise<void>;
    listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_gasolinera?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }>;
    sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number>;
    esCuentaDeCombustible(idCxp: number, conn?: PoolConnection): Promise<boolean>;

    // Saldo a favor por gasolinera (sobrepago de abonos) — beneficiario Proveedor
    crearSaldoAFavorProveedor(data: any, conn: PoolConnection): Promise<number>;
    sumaCreditoDisponibleProveedor(idProveedor: number, conn?: PoolConnection): Promise<number>;
    aplicarACredito(idSaf: number, monto: number, conn: PoolConnection): Promise<void>;
    saldoAFavorPorAbono(idAbono: number, conn?: PoolConnection): Promise<any>;
    eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void>;

    // Lectura
    relacionesDeCuenta(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    abonadoCombustiblePorGasolinera(conn?: PoolConnection): Promise<Map<number, number>>;
    totalCreditoPorGasolinera(idGasolinera: number, conn?: PoolConnection): Promise<number>;
    gasolinerasConCredito(conn?: PoolConnection): Promise<any[]>;
    cuentasDeGasolinera(idGasolinera: number, anio?: number, mes?: number, conn?: PoolConnection): Promise<any[]>;
}
