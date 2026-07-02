// Objeto APP para la entidad de dominio de negocio

import { CategoriaCxpApp } from './categoria_cxp.app';
import { ProveedorApp } from './proveedor.app';
import { EmpleadoApp } from '../../nomina/app/empleado.app';
import { MineroApp } from '../../material/app/minero.app';
import { DuenoVolquetaApp } from '../../material/app/dueno_volqueta.app';

export interface CuentaPorPagarApp {
    id: number;
    categoria?: CategoriaCxpApp;
    concepto: string;
    proveedor?: ProveedorApp;
    empleado?: EmpleadoApp;
    minero?: MineroApp;
    dueno_volqueta?: DuenoVolquetaApp;
    valor_total: number;
    valor_pagado: number;
    saldo: number;
    estado: string;
    fecha_creacion: Date;
    fecha_limite: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
}
