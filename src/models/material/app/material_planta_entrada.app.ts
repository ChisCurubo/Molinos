// Objeto APP para la entidad de dominio de negocio

import { MinaApp } from './mina.app';
import { VolquetaVehiculoApp } from './volqueta_vehiculo.app';
import { TipoMaterialApp } from './tipo_material.app';
import { PrecioMaterialApp } from './precio_material.app';

export interface MaterialPlantaEntradaApp {
    id: number;
    numero_volqueta: number;
    mina?: MinaApp;
    vehiculo?: VolquetaVehiculoApp;
    tipo_material?: TipoMaterialApp;
    precio?: PrecioMaterialApp;
    fecha_llegada: Date;
    peso_llegada_planta: number;
    porcentaje_humedad: number;
    gramos_humedad: number;
    tenor: number;
    total_material_seco: number;
    total_gramos: number;
    precio_por_gramo: number;
    precio_por_tonelada: number;
    precio_total: number;
    excedente_calculado: number;
    costo_cargue: number;
    costo_bascula: number;
    costo_maquila: number;
    costo_adicional: number;
    costo_volqueta: number;
    total_costos_operativos: number;
    total_material: number;
    estado: string;
    estado_pago_flete: string;
    comentarios: string;
    created_at: Date;
    updated_at: Date;
}
