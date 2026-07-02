// Objeto APP para la entidad de dominio de negocio

import { ViajeApp } from './viaje.app';
import { MaterialPlantaEntradaApp } from './material_planta_entrada.app';

export interface ViajeMaterialApp {
    id: number;
    viaje?: ViajeApp;
    entrada?: MaterialPlantaEntradaApp;
    es_remanente: boolean;
    viaje_origen?: ViajeApp;
    concepto: string;
    total_material: number;
    total_concentrado_humedo: number;
    porcentaje_humedad: number;
    peso_humedad: number;
    concentrado_seco: number;
    costo_maquila?: number;
    valor_total_con_gastos: number;
    created_at: Date;
}
