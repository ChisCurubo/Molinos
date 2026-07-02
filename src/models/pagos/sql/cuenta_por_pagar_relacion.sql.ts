// Automáticamente generado a partir de molinos_create_v4.sql

export interface CuentaPorPagarRelacionSQL {
    id: number;
    id_cuenta_pagar: number;
    id_entrada?: number;
    id_viaje?: number;
    id_alquiler?: number;
    id_combustible?: number;
    id_prestamo_emp?: number;
    id_prestamo_fin?: number;
    id_maquila?: number;
    id_deposito?: number;
    id_anticipo?: number;
    id_agua?: number;
    id_mula?: number;
    id_analisis?: number;
    id_excedente?: number;
    subtipo?: string;
    monto_aplicado: number;
    concepto: string;
    fecha: Date;
    nota: string;
    created_at: Date;
}
