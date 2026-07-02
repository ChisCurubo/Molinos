// Objeto APP para la entidad de dominio de negocio

import { MaterialPlantaEntradaApp } from './material_planta_entrada.app';
import { MinaApp } from './mina.app';
import { TipoMaterialApp } from './tipo_material.app';

export interface InventarioLoteApp {
    id: number;
    entrada?: MaterialPlantaEntradaApp;
    mina?: MinaApp;
    tipo_material?: TipoMaterialApp;
    condicion_material: string;
    porcentaje_humedad: number;
    toneladas_iniciales: number;
    toneladas_disponibles: number;
    estado: string;
    ubicacion?: string;
    fecha_ingreso: Date;
}
