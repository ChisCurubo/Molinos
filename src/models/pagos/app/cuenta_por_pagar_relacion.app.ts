// Objeto APP para la entidad de dominio de negocio

import { CuentaPorPagarApp } from './cuenta_por_pagar.app';
import { MaterialPlantaEntradaApp } from '../../material/app/material_planta_entrada.app';
import { ViajeApp } from '../../material/app/viaje.app';
import { AlquilerApp } from './alquiler.app';
import { CombustibleApp } from './combustible.app';
import { PrestamoEmpleadoApp } from '../../nomina/app/prestamo_empleado.app';
import { PrestamoFinancieroApp } from './prestamo_financiero.app';
import { MaquilaApp } from '../../material/app/maquila.app';
import { DepositoApp } from './deposito.app';
import { AnticipoTerceroApp } from '../../material/app/anticipo_tercero.app';
import { AguaPlantaApp } from './agua_planta.app';
import { MulaApp } from './mula.app';
import { AnalisisApp } from '../../material/app/analisis.app';
import { ExcedenteApp } from '../../material/app/excedente.app';

export interface CuentaPorPagarRelacionApp {
    id: number;
    cuenta_pagar?: CuentaPorPagarApp;
    entrada?: MaterialPlantaEntradaApp;
    viaje?: ViajeApp;
    alquiler?: AlquilerApp;
    combustible?: CombustibleApp;
    prestamo_emp?: PrestamoEmpleadoApp;
    prestamo_fin?: PrestamoFinancieroApp;
    maquila?: MaquilaApp;
    deposito?: DepositoApp;
    anticipo?: AnticipoTerceroApp;
    agua?: AguaPlantaApp;
    mula?: MulaApp;
    analisis?: AnalisisApp;
    excedente?: ExcedenteApp;
    subtipo?: string;
    monto_aplicado: number;
    concepto: string;
    fecha: Date;
    nota: string;
    created_at: Date;
}
