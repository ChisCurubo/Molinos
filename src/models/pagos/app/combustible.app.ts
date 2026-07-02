// Objeto APP para la entidad de dominio de negocio

import { ProveedorApp } from './proveedor.app';
import { DuenoVolquetaApp } from '../../material/app/dueno_volqueta.app';
import { VolquetaVehiculoApp } from '../../material/app/volqueta_vehiculo.app';
import { PlantaApp } from '../../material/app/planta.app';

export interface CombustibleApp {
    id: number;
    gasolinera?: ProveedorApp;
    tipo_consumo: string;
    dueno_volqueta?: DuenoVolquetaApp;
    vehiculo?: VolquetaVehiculoApp;
    planta?: PlantaApp;
    id_material_planta_entrada?: number;
    fecha: Date;
    descripcion: string;
    valor: number;
    comprobante_url: string;
    created_at: Date;
}
