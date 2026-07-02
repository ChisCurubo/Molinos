// Objeto APP para la entidad de dominio de negocio

import { AnticipoTerceroApp } from './anticipo_tercero.app';
import { MaterialPlantaEntradaApp } from './material_planta_entrada.app';

export interface HistorialDescuentoAnticipoApp {
    id: number;
    anticipo?: AnticipoTerceroApp;
    entrada?: MaterialPlantaEntradaApp;
    fecha: Date;
    monto_descontado: number;
    nota: string;
    created_at: Date;
}
