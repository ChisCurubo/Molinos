import { PoolConnection } from 'mysql2/promise';

// Registro de agua con su ACPM propio (cruzado desde Combustible por id_agua).
export interface AguaDelDueno {
    id_agua: number;
    fecha: string;
    valor_viaje: number;
    cantidad_viajes: number;
    bruto: number;    // valor_total = valor_viaje × cantidad_viajes
    acpm: number;     // Σ Combustible.valor WHERE id_agua = registro
    neto: number;     // max(0, bruto − acpm)  (per-registro, sin arrastre)
}

/**
 * SQL del pago de AGUA (por dueño, agrupado por mes, con cascada de abonos).
 * Mismo motor que flete; el ítem es un registro de agua_planta (enlace id_agua) y el ACPM se
 * cruza desde Combustible (fuente única), NO desde la columna legada agua_planta.acpm.
 */
export interface IPagoAguaRepository {
    resolverCategoriaAgua(conn?: PoolConnection): Promise<number>;

    // Materialización
    aguasPayablesDelDueno(idDueno: number, conn?: PoolConnection): Promise<AguaDelDueno[]>;
    idsAguaConRelacion(idDueno: number, conn?: PoolConnection): Promise<number[]>;
    buscarCuentaMesAgua(idDueno: number, anio: number, mes: number, conn: PoolConnection): Promise<number | null>;
    crearCuentaAgua(data: { id_dueno_volqueta: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    crearRelacionAgua(idCxp: number, idAgua: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    sumarValorTotal(idCxp: number, delta: number, conn: PoolConnection): Promise<void>;

    // Cuenta / abonos
    obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any>;
    recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    cuentasAbiertasDelDueno(idDueno: number, conn?: PoolConnection): Promise<any[]>;
    cuentasDelDueno(idDueno: number, anio?: number, mes?: number, conn?: PoolConnection): Promise<any[]>;
    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    obtenerAbono(id: number, conn?: PoolConnection): Promise<any>;
    actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarAbono(id: number, conn: PoolConnection): Promise<void>;
    listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }>;
    sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number>;
    esCuentaDeAgua(idCxp: number, conn?: PoolConnection): Promise<boolean>;

    // Efecto: estado de pago por registro de agua
    idsAguaDeCuenta(idCxp: number, conn?: PoolConnection): Promise<number[]>;
    actualizarEstadoAguaRegistros(ids: number[], estado: string, conn: PoolConnection): Promise<void>;

    // Saldo a favor por dueño (sobrepago de abonos)
    crearSaldoAFavorDueno(data: any, conn: PoolConnection): Promise<number>;
    sumaCreditoDisponibleDueno(idDueno: number, conn?: PoolConnection): Promise<number>;
    aplicarACredito(idSaf: number, monto: number, conn: PoolConnection): Promise<void>;
    saldoAFavorPorAbono(idAbono: number, conn?: PoolConnection): Promise<any>;
    eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void>;

    // Lectura
    relacionesConProrrateo(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    abonadoAguaPorDueno(conn?: PoolConnection): Promise<Map<number, number>>;
    duenosConAgua(conn?: PoolConnection): Promise<any[]>;
}
