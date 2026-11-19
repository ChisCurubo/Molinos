// Ver migracion_prestamos_financieros_interes_2026-10-01.sql

export interface MovimientoPrestamoFinancieroSQL {
    id: number;
    id_prestamo_fin: number;
    tipo: 'interes' | 'abono';
    fecha: Date;
    valor: number;
    saldo_resultante: number;
    id_abono_cxp: number | null;
    observaciones: string | null;
    created_at: Date;
}
