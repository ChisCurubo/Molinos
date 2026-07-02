// Objeto APP para la entidad de dominio de negocio

import { ViajeApp } from './viaje.app';

export interface MaquilaApp {
    id: number;
    viaje?: ViajeApp;
    descripcion?: string;
    total_material: number;
    precio_por_tonelada: number;
    peso_humedad: number;
    valor_total_maquila: number;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
