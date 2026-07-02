// Objeto APP para la entidad de dominio de negocio

import { MaterialPlantaEntradaApp } from './material_planta_entrada.app';

export interface ExcedenteApp {
    id: number;
    entrada?: MaterialPlantaEntradaApp;
    valor_excedente: number;
    monto_distribuido: number;
    saldo_por_distribuir: number;
    fecha_calculo: Date;
    concepto?: string;
    estado_distribucion: string;
    notas: string;
    created_at: Date;
    updated_at: Date;
}
