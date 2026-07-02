// Objeto APP para la entidad de dominio de negocio

import { ProveedorApp } from './proveedor.app';

export interface MulaApp {
    id: number;
    proveedor?: ProveedorApp;
    id_viaje?: number;
    fecha: Date;
    concepto: string;
    factura_num: string;
    foto_factura_url: string;
    valor: number;
    comprobante_url: string;
    created_at: Date;
}
