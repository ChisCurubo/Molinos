// Objeto APP para la entidad de dominio de negocio

import { DuenoVolquetaApp } from './dueno_volqueta.app';

export interface VolquetaVehiculoApp {
    id: number;
    dueno_volqueta?: DuenoVolquetaApp;
    placa: string;
    tipo_vehiculo: string;
    conductor: string;
    conductor_cc: string;
    capacidad_ton?: number;
    fecha?: Date;
    estado_pago: string;
    activo: boolean;
    created_at: Date;
}
