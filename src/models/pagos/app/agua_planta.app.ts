// Objeto APP para la entidad de dominio de negocio

import { DuenoVolquetaApp } from '../../material/app/dueno_volqueta.app';

export interface AguaPlantaApp {
    id: number;
    dueno_volqueta?: DuenoVolquetaApp;
    fecha: Date;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    valor_total?: number;
    comprobante_url: string;
    created_at: Date;
}
