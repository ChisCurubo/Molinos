// Objeto APP para la entidad de dominio de negocio

import { MineroApp } from './minero.app';
import { DuenoVolquetaApp } from './dueno_volqueta.app';
import { ProveedorApp } from '../../pagos/app/proveedor.app';

export interface AnticipoTerceroApp {
    id: number;
    minero?: MineroApp;
    dueno_volqueta?: DuenoVolquetaApp;
    proveedor?: ProveedorApp;
    fecha: Date;
    monto_inicial: number;
    monto_usado: number;
    saldo_disponible: number;
    descripcion: string;
    estado: string;
    created_at: Date;
}
