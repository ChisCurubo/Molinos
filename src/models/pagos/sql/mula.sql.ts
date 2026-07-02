// Automáticamente generado a partir de molinos_create_v4.sql

export interface MulaSQL {
    id: number;
    id_proveedor: number;
    id_viaje?: number;
    fecha: Date;
    concepto: string;
    factura_num: string;
    foto_factura_url: string;
    valor: number;
    comprobante_url: string;
    created_at: Date;
}
