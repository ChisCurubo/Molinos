// Automáticamente generado a partir de molinos_create_v4.sql

export interface CombustibleSQL {
    id: number;
    id_gasolinera: number;
    tipo_consumo: string;
    id_dueno_volqueta?: number;
    id_vehiculo?: number;
    id_planta?: number;
    id_material_planta_entrada?: number;
    fecha: Date;
    descripcion: string;
    valor: number;
    comprobante_url: string;
    created_at: Date;
}
