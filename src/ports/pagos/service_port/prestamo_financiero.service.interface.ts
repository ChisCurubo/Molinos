import { PrestamoFinancieroSQL } from '../../../models/pagos/sql/prestamo_financiero.sql';
import { MovimientoPrestamoFinancieroSQL } from '../../../models/pagos/sql/movimiento_prestamo_financiero.sql';

export interface ProyeccionInteres {
    id_prestamo_fin: number;
    saldo_actual: number;
    meses_a_acumular: number;
    interes_proyectado: number;
    saldo_si_se_acumula: number;
}

export interface IPrestamoFinancieroService {
    create(data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL>;
    getById(id: number): Promise<PrestamoFinancieroSQL | null>;
    update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<PrestamoFinancieroSQL[]>;

    /** Acumula (capitaliza) el interés del período transcurrido desde el último movimiento. */
    acumularInteres(id: number, fecha?: string): Promise<MovimientoPrestamoFinancieroSQL>;
    /** Cuánto interés se acumularía hoy (o a `fecha`) sin persistir nada. */
    proyectarInteres(id: number, fecha?: string): Promise<ProyeccionInteres>;
    /** Registra un abono real: CxP+Abono_CxP (categoría 'Préstamo financiero') + reduce saldo_pendiente. */
    abonar(id: number, data: { valor: number; fecha_abono?: string; metodo_pago?: string; comprobante_url?: string; observaciones?: string }): Promise<MovimientoPrestamoFinancieroSQL>;
    listarMovimientos(id: number): Promise<MovimientoPrestamoFinancieroSQL[]>;
}
