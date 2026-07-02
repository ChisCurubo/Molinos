// Automáticamente generado a partir de molinos_create_v4.sql

export interface AlquilerSQL {
    id: number;
    id_tipo: number;
    id_proveedor: number;
    fecha_inicio: Date;
    concepto: string;
    valor: number;
    created_at: Date;
    deleted_at?: Date;
}
