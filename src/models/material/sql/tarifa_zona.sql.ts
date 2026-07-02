// Automáticamente generado a partir de molinos_create_v4.sql

export interface TarifaZonaSQL {
    id: number;
    id_zona: number;
    valor_tonelada: number;
    vigente_desde: Date;
    vigente_hasta?: Date;
    activo: boolean;
    created_at: Date;
}

import { RowDataPacket } from 'mysql2/promise';

export interface TarifaZonaLookup extends RowDataPacket {
  id: number;
  valor_tonelada: number;
  vigente_desde: Date;
  zona: string;
}
