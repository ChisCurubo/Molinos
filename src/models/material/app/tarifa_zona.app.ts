// Objeto APP para la entidad de dominio de negocio

import { ZonaApp } from './zona.app';

export interface TarifaZonaApp {
    id: number;
    zona?: ZonaApp;
    valor_tonelada: number;
    vigente_desde: Date;
    vigente_hasta?: Date;
    activo: boolean;
    created_at: Date;
}
