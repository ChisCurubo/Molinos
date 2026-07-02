// Objeto APP para la entidad de dominio de negocio

import { MaterialApp } from './material.app';
import { ProveedorApp } from '../../pagos/app/proveedor.app';

export interface CotizacionMaterialApp {
    id: number;
    material?: MaterialApp;
    proveedor?: ProveedorApp;
    fecha_cotizacion: Date;
    fecha_necesidad: Date;
    valor_bolsa: number;
    valor_cliente: number;
    lugar_uso: string;
    observaciones: string;
    created_at: Date;
}
