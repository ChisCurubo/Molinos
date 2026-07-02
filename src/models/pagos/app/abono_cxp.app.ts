// Objeto APP para la entidad de dominio de negocio

import { CuentaPorPagarApp } from './cuenta_por_pagar.app';

export interface AbonoCxpApp {
    id: number;
    cuenta_pagar?: CuentaPorPagarApp;
    fecha_abono: Date;
    valor: number;
    metodo_pago: string;
    id_saldo_favor?: number;
    comprobante_url: string;
    observaciones: string;
    created_at: Date;
}
