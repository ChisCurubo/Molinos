// Objeto APP para la entidad de dominio de negocio

import { DepositoApp } from './deposito.app';
import { TipoGastoOperativoApp } from './tipo_gasto_operativo.app';

export interface GastoOperativoApp {
    id: number;
    deposito?: DepositoApp;
    tipo_gasto?: TipoGastoOperativoApp;
    id_material_planta_entrada?: number;
    id_viaje?: number;
    fecha: Date;
    concepto: string;
    monto: number;
    saldo_resultante: number;
    mensaje_mauricio: string;
    created_at: Date;
}
