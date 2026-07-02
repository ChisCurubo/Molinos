// Automáticamente generado a partir de molinos_create_v4.sql

export interface CotizacionMaterialSQL {
    id: number;
    id_material: number;
    id_proveedor?: number;
    fecha_cotizacion: Date;
    fecha_necesidad: Date;
    valor_bolsa: number;
    valor_cliente: number;
    lugar_uso: string;
    observaciones: string;
    created_at: Date;
}
