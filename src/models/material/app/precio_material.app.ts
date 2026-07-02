// Objeto APP para la entidad de dominio de negocio

import { MineroApp } from './minero.app';
import { ZonaApp } from './zona.app';

export interface PrecioMaterialApp {
    id: number;
    minero?: MineroApp;
    zona?: ZonaApp;
    metodo: string;
    precio_por_gramo: number;
    precio_por_tonelada: number;
    intervalo_tenor_min: number;
    intervalo_tenor_max: number;
    fecha_inicio: Date;
    fecha_fin: Date;
    activo: boolean;
    created_at: Date;
}
