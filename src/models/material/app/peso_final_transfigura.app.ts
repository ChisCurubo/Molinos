// Objeto APP para la entidad de dominio de negocio

import { ViajeApp } from './viaje.app';

export interface PesoFinalTransfiguraApp {
    id: number;
    viaje?: ViajeApp;
    fecha: Date;
    peso_neto: number;
    peso_seco: number;
    infopath_au: number;
    infopath_ag: number;
    tenor_inicial_sgs_au: number;
    tenor_inicial_sgs_ag: number;
    tenor_inicial_sgs_cu: number;
    tenor_final_peru_au: number;
    tenor_final_peru_ag: number;
    arsenico_final_peru: number;
    created_at: Date;
}
