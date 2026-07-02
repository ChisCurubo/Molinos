export interface AguaPlantaSQL {
    id: number;
    id_dueno_volqueta: number;
    fecha: Date;
    valor_viaje: string;
    cantidad_viajes: number;
    acpm: string;
    valor_total: string;
    comprobante_url: string;
    created_at: Date;
}

import { RowDataPacket } from 'mysql2/promise';

export interface CreateAguaPlantaDTO {
  id_dueno_volqueta: number;
  fecha: string;
  valor_viaje: number;
  cantidad_viajes: number;
  acpm: number;
  comprobante_url?: string;
}

export interface AguaPlanta extends RowDataPacket {
  id: number;
  fecha: Date;
  dueno: string;
  alias: string | null;
  valor_viaje: number;
  cantidad_viajes: number;
  acpm: number;
  valor_total: number;
  comprobante_url: string | null;
  created_at: Date;
}
