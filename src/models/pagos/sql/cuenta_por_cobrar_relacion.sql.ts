// Automáticamente generado a partir de molinos_create_v4.sql

export interface CuentaPorCobrarRelacionSQL {
    id: number;
    id_cxc: number;
    id_prestamo_emp?: number;
    id_combustible?: number;
    id_anticipo?: number;
    id_excedente?: number;
    monto_aplicado: number;
    concepto: string;
    fecha: Date;
    nota: string;
    created_at: Date;
}
