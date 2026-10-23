import { PoolConnection } from 'mysql2/promise';
import { PrestamoFinancieroSQL } from '../../../models/pagos/sql/prestamo_financiero.sql';
import { MovimientoPrestamoFinancieroSQL } from '../../../models/pagos/sql/movimiento_prestamo_financiero.sql';

export interface IPrestamoFinancieroRepository {
    create(data: Partial<PrestamoFinancieroSQL>, conn?: PoolConnection): Promise<number>;
    getById(id: number, conn?: PoolConnection): Promise<PrestamoFinancieroSQL | null>;
    update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<boolean>;
    delete(id: number, conn?: PoolConnection): Promise<boolean>;
    list(): Promise<PrestamoFinancieroSQL[]>;

    // Enganche Tesorería: el desembolso de un préstamo bancario es dinero real que entra
    // a la empresa — ver EMPLEADOS_PRESTAMOS_plan.md Fase 2.
    crearIngresoTesoreria(data: { concepto: string; valor: number; fecha: string; id_prestamo_fin: number }, conn: PoolConnection): Promise<number>;
    eliminarIngresoTesoreria(id_prestamo_fin: number, conn: PoolConnection): Promise<void>;

    // Interés + abonos — ver migracion_prestamos_financieros_interes_2026-10-01.sql
    actualizarSaldo(id: number, nuevoSaldo: number, activo: boolean, conn: PoolConnection): Promise<void>;

    // CxP persistente del préstamo — decisión 2026-10-23: antes cada abono abría y pagaba una
    // CxP nueva (nunca se veía deuda pendiente en /cxp/mensual); ahora hay UNA CxP que nace
    // 'pendiente' por monto_principal, crece con cada interés capitalizado, y se abona de verdad.
    crearCxPInicial(data: { id_prestamo_fin: number; concepto: string; valor_total: number; fecha: string }, conn: PoolConnection): Promise<number>;
    obtenerCxP(id_prestamo_fin: number, conn?: PoolConnection): Promise<{ id: number; valor_total: number; valor_pagado: number } | null>;
    aumentarValorTotalCxP(idCxp: number, incremento: number, conn: PoolConnection): Promise<void>;
    registrarAbono(idCxp: number, data: { fecha_abono: string; valor: number; metodo_pago?: string; comprobante_url?: string; observaciones?: string }, conn: PoolConnection): Promise<number>;
    recalcularEstadoCxP(idCxp: number, conn: PoolConnection): Promise<void>;
    eliminarCxP(id_prestamo_fin: number, conn: PoolConnection): Promise<void>;
    insertarMovimiento(data: {
        id_prestamo_fin: number; tipo: 'interes' | 'abono'; fecha: string; valor: number;
        saldo_resultante: number; id_abono_cxp: number | null; observaciones?: string | null;
    }, conn: PoolConnection): Promise<number>;
    obtenerMovimiento(id: number, conn?: PoolConnection): Promise<MovimientoPrestamoFinancieroSQL | null>;
    ultimoMovimiento(id_prestamo_fin: number, conn?: PoolConnection): Promise<MovimientoPrestamoFinancieroSQL | null>;
    listarMovimientos(id_prestamo_fin: number): Promise<MovimientoPrestamoFinancieroSQL[]>;
}
