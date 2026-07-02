// Objeto APP para la entidad de dominio de negocio

import { CategoriaCxcApp } from './categoria_cxc.app';
import { EmpleadoApp } from '../../nomina/app/empleado.app';
import { MineroApp } from '../../material/app/minero.app';
import { DuenoVolquetaApp } from '../../material/app/dueno_volqueta.app';
import { ProveedorApp } from './proveedor.app';

export interface CuentaPorCobrarApp {
    id: number;
    categoria?: CategoriaCxcApp;
    concepto: string;
    empleado?: EmpleadoApp;
    minero?: MineroApp;
    dueno_volqueta?: DuenoVolquetaApp;
    proveedor?: ProveedorApp;
    valor_total: number;
    valor_cobrado: number;
    saldo: number;
    estado: string;
    fecha_creacion: Date;
    fecha_limite?: Date;
    created_at: Date;
    updated_at: Date;
}
