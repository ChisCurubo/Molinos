// Automáticamente generado a partir de molinos_create_v4.sql

export interface InventarioLoteSQL {
    id: number;
    id_entrada: number;
    id_mina: number;
    id_tipo_material: number;
    condicion_material: string;
    porcentaje_humedad: number;
    toneladas_iniciales: number;
    toneladas_disponibles: number;
    estado: string;
    ubicacion?: string;
    fecha_ingreso: Date;
}
