// Automáticamente generado a partir de molinos_create_v4.sql

export interface ViajeMaterialSQL {
    id: number;
    id_viaje: number;
    id_entrada: number;
    es_remanente: boolean;
    id_viaje_origen?: number;
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
