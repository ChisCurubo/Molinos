// Objeto APP para la entidad de dominio de negocio

import { MaterialPlantaEntradaApp } from './material_planta_entrada.app';
import { TipoAnalisisApp } from './tipo_analisis.app';
import { MinaApp } from './mina.app';
import { MineroApp } from './minero.app';
import { TipoMaterialApp } from './tipo_material.app';
import { ProveedorApp } from '../../pagos/app/proveedor.app';

export interface AnalisisApp {
    id: number;
    entrada?: MaterialPlantaEntradaApp;
    tipo_analisis?: TipoAnalisisApp;
    mina?: MinaApp;
    minero?: MineroApp;
    tipo_material?: TipoMaterialApp;
    laboratorio?: ProveedorApp;
    numero_analisis: string;
    au_concentrado: number;
    ag_concentrado: number;
    ton: number;
    porcentaje_humedad: number;
    toneladas_humedas: number;
    toneladas_secas: number;
    au_gr_x_ton: number;
    au_gr_x_ton_falso?: number;
    ag_gr_x_ton: number;
    valor_analisis?: number;
    estado_pago: string;
    fecha_salida: Date;
    comentarios: string;
    created_at: Date;
}
