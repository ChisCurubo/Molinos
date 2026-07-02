// Objeto APP para la entidad de dominio de negocio

import { CuentaPorCobrarApp } from './cuenta_por_cobrar.app';

export interface AbonoCxcApp {
    id: number;
    cxc?: CuentaPorCobrarApp;
    fecha_cobro: Date;
    valor: number;
    metodo: string;
    comprobante_url: string;
    observaciones: string;
    created_at: Date;
}
