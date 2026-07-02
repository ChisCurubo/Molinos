// Objeto APP para la entidad de dominio de negocio

import { TipoAlquilerApp } from './tipo_alquiler.app';
import { ProveedorApp } from './proveedor.app';

export interface AlquilerApp {
    id: number;
    tipo?: TipoAlquilerApp;
    proveedor?: ProveedorApp;
    fecha_inicio: Date;
    concepto: string;
    valor: number;
    created_at: Date;
    deleted_at?: Date;
}
