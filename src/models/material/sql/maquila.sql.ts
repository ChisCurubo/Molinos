// Automáticamente generado a partir de molinos_create_v4.sql

export interface MaquilaSQL {
    id: number;
    id_viaje: number;
    descripcion?: string;
    total_material: number;
    precio_por_tonelada: number;
    peso_humedad: number;
    valor_total_maquila: number;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
