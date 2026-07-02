// Objeto APP para la entidad de dominio de negocio

export interface DepositoApp {
    id: number;
    fecha: Date;
    monto: number;
    descripcion: string;
    saldo_anterior: number;
    saldo_resultante: number;
    created_at: Date;
}
