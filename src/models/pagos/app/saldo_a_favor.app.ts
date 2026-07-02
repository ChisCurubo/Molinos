// Objeto APP para la entidad de dominio de negocio

import { MineroApp } from '../../material/app/minero.app';
import { DuenoVolquetaApp } from '../../material/app/dueno_volqueta.app';
import { ProveedorApp } from './proveedor.app';
import { EmpleadoApp } from '../../nomina/app/empleado.app';
import { CuentaPorPagarApp } from './cuenta_por_pagar.app';

export interface SaldoAFavorApp {
    id: number;
    origen: string;
    id_abono_cxp_orig?: number;
    minero?: MineroApp;
    dueno_volqueta?: DuenoVolquetaApp;
    proveedor?: ProveedorApp;
    empleado?: EmpleadoApp;
    cuenta_pagar?: CuentaPorPagarApp;
    monto_original: number;
    monto_aplicado: number;
    saldo_disponible: number;
    tipo_resolucion: string;
    estado: string;
    fecha: Date;
    descripcion: string;
    created_at: Date;
    updated_at: Date;
}
