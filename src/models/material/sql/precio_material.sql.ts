// Automáticamente generado a partir de molinos_create_v4.sql

export interface PrecioMaterialSQL {
    id: number;
    id_minero?: number;
    id_zona?: number;
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

import { RowDataPacket } from 'mysql2/promise';
import { MetodoCalculoMinero } from './material_planta_entrada.sql';

export enum TipoTarifa {
  ESPECIFICA_MINERO = 'especifica_minero',
  ESPECIFICA_ZONA = 'especifica_zona',
  GLOBAL = 'global'
}

export interface PrecioMaterialLookup extends RowDataPacket {
  id: number;
  metodo: MetodoCalculoMinero;
  precio_por_gramo: number | null;
  precio_por_tonelada: number | null;
  intervalo_tenor_min: number;
  intervalo_tenor_max: number;
  tipo_tarifa: TipoTarifa;
}
