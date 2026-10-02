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
    /** Crea la CxP (categoría 'Préstamo financiero') + su Abono_CxP + la Relación, pagada de inmediato. */
    crearAbonoPrestamo(data: {
        id_prestamo_fin: number; concepto: string; valor: number; fecha_abono: string;
        metodo_pago?: string; comprobante_url?: string; observaciones?: string;
    }, conn: PoolConnection): Promise<{ id_cuenta_pagar: number; id_abono: number }>;
    insertarMovimiento(data: {
        id_prestamo_fin: number; tipo: 'interes' | 'abono'; fecha: string; valor: number;
        saldo_resultante: number; id_abono_cxp: number | null; observaciones?: string | null;
    }, conn: PoolConnection): Promise<number>;
    obtenerMovimiento(id: number, conn?: PoolConnection): Promise<MovimientoPrestamoFinancieroSQL | null>;
    ultimoMovimiento(id_prestamo_fin: number, conn?: PoolConnection): Promise<MovimientoPrestamoFinancieroSQL | null>;
    listarMovimientos(id_prestamo_fin: number): Promise<MovimientoPrestamoFinancieroSQL[]>;
}
