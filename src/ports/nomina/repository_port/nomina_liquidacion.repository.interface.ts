import { PoolConnection } from 'mysql2/promise';
import { NominaLiquidacionSQL } from '../../../models/nomina/sql/nomina_liquidacion.sql';

export interface INominaLiquidacionRepository {
    crear(data: Omit<NominaLiquidacionSQL, 'id' | 'created_at' | 'id_cuenta_pagar' | 'estado' | 'fecha_liquidacion'> & { fecha_liquidacion?: string }, conn: PoolConnection): Promise<number>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<NominaLiquidacionSQL | null>;
    obtenerPorPeriodo(id_empleado: number, anio: number, mes: number, quincena: 1 | 2): Promise<NominaLiquidacionSQL | null>;
    listar(filtros: { id_empleado?: number; anio?: number; mes?: number }): Promise<NominaLiquidacionSQL[]>;
    confirmarConCuentaPagar(id: number, id_cuenta_pagar: number, conn: PoolConnection): Promise<void>;

    // Enganche CxP (categoría Nómina) — beneficiario directo (id_empleado), sin Relacion.
    crearCuentaPagar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;

    // Borrador editable (estado='borrador', sin CxP) — ver comentario de columna `estado` en
    // Nomina_Liquidaciones (migracion_nomina_quincenal_2026-09-21.sql).
    crearBorrador(data: Omit<NominaLiquidacionSQL, 'id' | 'created_at' | 'id_cuenta_pagar' | 'estado' | 'fecha_liquidacion'> & { fecha_liquidacion?: string }, conn?: PoolConnection): Promise<number>;
    actualizarBorrador(id: number, data: { otros_descuentos: number; monto_neto: number }, conn?: PoolConnection): Promise<void>;
    confirmarBorrador(id: number, id_cuenta_pagar: number, data: {
        tipo_pago: string; unidades: number | null; tarifa_aplicada: number; monto_bruto: number;
        total_bonos: number; total_descuento_prestamo: number; monto_neto: number; fecha_liquidacion: string;
    }, conn: PoolConnection): Promise<void>;
}
