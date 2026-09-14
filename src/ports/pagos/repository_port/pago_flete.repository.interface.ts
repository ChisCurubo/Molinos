import { PoolConnection } from 'mysql2/promise';

// Flete con su ACPM propio (para el neto por viaje). Viene de material + Combustible.
export interface FleteDelDueno {
    id_entrada: number;
    fecha_llegada: string;
    numero_volqueta: number;
    id_vehiculo: number;
    placa: string;
    costo_volqueta: number;   // flete BRUTO congelado
    acpm: number;             // ACPM propio de ese viaje (Σ Combustible por id_entrada)
}

/**
 * SQL del pago de FLETE (por dueño, agrupado por mes, con cascada de abonos).
 * Toda la lógica de negocio vive en el service; aquí solo consultas.
 */
export interface IPagoFleteRepository {
    resolverCategoriaFlete(conn?: PoolConnection): Promise<number>;

    // Materialización
    fletesPayablesDelDueno(idDueno: number, conn?: PoolConnection): Promise<FleteDelDueno[]>;
    idsEntradasConRelacionFlete(idDueno: number, conn?: PoolConnection): Promise<number[]>;
    buscarCuentaMesFlete(idDueno: number, anio: number, mes: number, conn: PoolConnection): Promise<number | null>;
    crearCuentaFlete(data: { id_dueno_volqueta: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    crearRelacionFlete(idCxp: number, idEntrada: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    sumarValorTotal(idCxp: number, delta: number, conn: PoolConnection): Promise<void>;

    // Cuenta / abonos (genéricos sobre CxP)
    obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any>;
    recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    cuentasAbiertasDelDueno(idDueno: number, conn?: PoolConnection): Promise<any[]>;
    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    obtenerAbono(id: number, conn?: PoolConnection): Promise<any>;
    actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarAbono(id: number, conn: PoolConnection): Promise<void>;
    listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }>;
    sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number>;
    esCuentaDeFlete(idCxp: number, conn?: PoolConnection): Promise<boolean>;

    // Efecto extra de flete (§6): estado por viaje + estado del vehículo
    entradasYVehiculosDeCuenta(idCxp: number, conn?: PoolConnection): Promise<Array<{ id_entrada: number; id_vehiculo: number }>>;
    actualizarEstadoFleteEntradas(ids: number[], estado: string, conn: PoolConnection): Promise<void>;
    recomputarEstadoVehiculos(idsVehiculo: number[], conn: PoolConnection): Promise<void>;

    // Saldo a favor por dueño (sobrepago de abonos)
    crearSaldoAFavorDueno(data: any, conn: PoolConnection): Promise<number>;
    obtenerCreditosDisponiblesDueno(idDueno: number, conn?: PoolConnection): Promise<any[]>;
    sumaCreditoDisponibleDueno(idDueno: number, conn?: PoolConnection): Promise<number>;
    aplicarACredito(idSaf: number, monto: number, conn: PoolConnection): Promise<void>;
    saldoAFavorPorAbono(idAbono: number, conn?: PoolConnection): Promise<any>;
    eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void>;

    // Lectura
    relacionesConProrrateo(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    abonadoFletePorDueno(conn?: PoolConnection): Promise<Map<number, number>>;
    duenoDeCuenta(idCxp: number, conn?: PoolConnection): Promise<number | null>;
    duenosConFlete(conn?: PoolConnection): Promise<any[]>;
    cuentasDelDueno(idDueno: number, anio?: number, mes?: number, conn?: PoolConnection): Promise<any[]>;
}
