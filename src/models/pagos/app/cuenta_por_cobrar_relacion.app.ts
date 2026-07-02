// Objeto APP para la entidad de dominio de negocio

import { CuentaPorCobrarApp } from './cuenta_por_cobrar.app';
import { PrestamoEmpleadoApp } from '../../nomina/app/prestamo_empleado.app';
import { CombustibleApp } from './combustible.app';
import { AnticipoTerceroApp } from '../../material/app/anticipo_tercero.app';
import { ExcedenteApp } from '../../material/app/excedente.app';

export interface CuentaPorCobrarRelacionApp {
    id: number;
    cxc?: CuentaPorCobrarApp;
    prestamo_emp?: PrestamoEmpleadoApp;
    combustible?: CombustibleApp;
    anticipo?: AnticipoTerceroApp;
    excedente?: ExcedenteApp;
    monto_aplicado: number;
    concepto: string;
    fecha: Date;
    nota: string;
    created_at: Date;
}
