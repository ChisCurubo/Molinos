import { PoolConnection } from 'mysql2/promise';

/**
 * SQL del pago de MULAS (despachos de concentrado a Barranquilla). 1 Mula = 1 Cuenta_Por_Pagar
 * (categoría 'Mula', beneficiario = proveedor transportador) por el NETO de retención (`v_mulas`).
 * Los abonos se registran por PROVEEDOR y se aplican en cascada (fecha más vieja primero) sobre
 * todas sus cuentas de mula abiertas — igual patrón que pago_flete/pago_agua.
 */
export interface IPagoMulaRepository {
    resolverCategoriaMula(conn?: PoolConnection): Promise<number>;
    pctRetencionMula(conn?: PoolConnection): Promise<number>;

    // Mula (el despacho)
    crearMula(data: { id_proveedor: number; id_viaje?: number; fecha: string; concepto?: string; factura_num?: string; foto_factura_url?: string; valor: number }, conn: PoolConnection): Promise<number>;
    obtenerMula(id: number, conn?: PoolConnection): Promise<any>;
    listarMulas(filtros: { id_proveedor?: number; id_viaje?: number; estado?: string }): Promise<any[]>;
    actualizarMula(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarMula(id: number, conn: PoolConnection): Promise<void>;
    resumenMulas(filtros: { desde?: string; hasta?: string; id_proveedor?: number }): Promise<any>;

    // Cuenta (CxP)
    crearCuentaMula(data: { id_proveedor: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    obtenerCuenta(idCxp: number, conn?: PoolConnection): Promise<any>;
    ajustarValorTotalCuenta(idCxp: number, nuevoValorTotal: number, conn: PoolConnection): Promise<void>;
    anularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    recalcularCuenta(idCxp: number, conn: PoolConnection): Promise<void>;
    cuentasAbiertasDelProveedor(idProveedor: number, conn?: PoolConnection): Promise<any[]>;

    // Relación Mula ↔ Cuenta
    crearRelacionMula(idCxp: number, idMula: number, monto: number, concepto: string, conn: PoolConnection): Promise<void>;
    eliminarRelacionMula(idMula: number, conn: PoolConnection): Promise<void>;
    cuentaDeMula(idMula: number, conn?: PoolConnection): Promise<number | null>;

    // Abonos
    insertarAbono(abono: any, conn: PoolConnection): Promise<number>;
    obtenerAbono(id: number, conn?: PoolConnection): Promise<any>;
    actualizarAbono(id: number, campos: any, conn: PoolConnection): Promise<void>;
    eliminarAbono(id: number, conn: PoolConnection): Promise<void>;
    listarAbonos(idCxp: number, conn?: PoolConnection): Promise<any[]>;
    listarAbonosPaginado(filtros: { id_proveedor?: number; desde?: string; hasta?: string; metodo_pago?: string; page: number; limit: number }): Promise<{ rows: any[]; total: number }>;
    sumaOtrosAbonos(idCxp: number, excluirAbono: number, conn?: PoolConnection): Promise<number>;
    esCuentaDeMula(idCxp: number, conn?: PoolConnection): Promise<boolean>;

    // Estado del Viaje (almacenado/despachado) — lo mantiene este service al crear/editar/eliminar una Mula
    obtenerEstadoViaje(idViaje: number, conn?: PoolConnection): Promise<string | null>;
    marcarEstadoViaje(idViaje: number, estado: 'almacenado' | 'despachado', conn: PoolConnection): Promise<void>;

    // Saldo a favor por sobrepago (mismo patrón que material/flete/agua)
    crearSaldoAFavorProveedor(data: { id_abono_cxp_orig?: number; id_proveedor: number; id_cuenta_pagar?: number; monto_original: number; descripcion?: string }, conn: PoolConnection): Promise<number>;
    saldoAFavorPorAbono(idAbono: number, conn?: PoolConnection): Promise<any>;
    eliminarSaldoAFavor(id: number, conn: PoolConnection): Promise<void>;

    // Trazabilidad por viaje: cada mula-con-viaje, su proveedor y su cuenta/abonos.
    trazabilidadPorViaje(): Promise<any[]>;
}
