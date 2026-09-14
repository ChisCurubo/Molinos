import { PoolConnection } from 'mysql2/promise';

// Entrada (volqueta) candidata a pago de material.
export interface EntradaPagoMaterial {
    id: number;
    precio_total: number;      // precio del material SIN gastos (lo que se le paga al minero)
    numero_volqueta: number;
    id_minero: number | null;
    minero: string | null;
}

export interface IPagoMaterialRepository {
    // Resuelve el id de la categoría 'Material' (para no hardcodearlo).
    resolverCategoriaMaterial(conn?: PoolConnection): Promise<number>;

    // Trae precio_total + minero de las entradas indicadas.
    obtenerEntradasParaPago(ids: number[], conn?: PoolConnection): Promise<EntradaPagoMaterial[]>;

    // De las entradas dadas, cuáles ya están en una CxP de material NO anulada (para no duplicar).
    entradasYaEnCuenta(ids: number[], excluirCuenta?: number, conn?: PoolConnection): Promise<number[]>;

    // --- Cuenta (cabecera) ---
    crearCuenta(data: any, conn: PoolConnection): Promise<number>;
    obtenerCuenta(id: number, conn?: PoolConnection): Promise<any>;
    actualizarCabeceraCuenta(id: number, campos: any, conn: PoolConnection): Promise<void>;
    actualizarValorTotal(id: number, valorTotal: number, conn: PoolConnection): Promise<void>;
    // Recalcula valor_pagado = Σ abonos y estado (pendiente/parcial/pagado). No toca cuentas anuladas.
    recalcularCuenta(id: number, conn: PoolConnection): Promise<void>;
    anularCuenta(id: number, conn: PoolConnection): Promise<void>;

    // --- Relación CxP ↔ entrada (una volqueta del grupo) ---
    crearRelacion(idCxp: number, idEntrada: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    eliminarRelacion(idCxp: number, idEntrada: number, conn: PoolConnection): Promise<number>;
    idsEntradasDeCuenta(idCxp: number, conn?: PoolConnection): Promise<number[]>;
    sumaMontoRelaciones(idCxp: number, conn?: PoolConnection): Promise<number>;
    obtenerRelacionesConProrrateo(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    obtenerAnalisisDeEntradas(ids: number[], conn?: PoolConnection): Promise<any[]>;

    // --- Abonos ---
    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    obtenerAbono(id: number, conn?: PoolConnection): Promise<any>;
    actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarAbono(id: number, conn: PoolConnection): Promise<void>;
    listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_minero?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }>;
    sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number>;

    // --- Saldo a favor (crédito por sobrepago) ---
    crearSaldoAFavor(data: any, conn: PoolConnection): Promise<number>;
    obtenerCreditosDisponibles(idMinero: number, conn?: PoolConnection): Promise<any[]>;
    sumaCreditoDisponible(idMinero: number, conn?: PoolConnection): Promise<number>;
    aplicarACredito(idSaf: number, monto: number, conn: PoolConnection): Promise<void>;
    saldoAFavorPorAbono(idAbono: number, conn?: PoolConnection): Promise<any>;
    eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void>;

    // --- Listado (tablero) ---
    listarCuentasMaterial(filtros: any): Promise<any[]>;
}
