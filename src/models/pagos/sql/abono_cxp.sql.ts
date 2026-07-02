// Automáticamente generado a partir de molinos_create_v4.sql

export interface AbonoCxpSQL {
    id: number;
    id_cuenta_pagar: number;
    fecha_abono: Date;
    valor: number;
    metodo_pago: string;
    id_saldo_favor?: number;
    comprobante_url: string;
    observaciones: string;
    created_at: Date;
}
