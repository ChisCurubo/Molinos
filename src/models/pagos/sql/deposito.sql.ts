// Automáticamente generado a partir de molinos_create_v4.sql

export interface DepositoSQL {
    id: number;
    fecha: Date;
    monto: number;
    descripcion: string;
    saldo_anterior: number;
    saldo_resultante: number;
    created_at: Date;
}
