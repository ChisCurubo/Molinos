// Automáticamente generado a partir de molinos_create_v4.sql

export interface AlquilerSQL {
    id: number;
    id_tipo: number;
    id_proveedor: number;
    id_contrato?: number;
    fecha_inicio: Date;
    concepto: string;
    valor: number;
    valor_iva: number;
    retencion_fuente_manual?: number;
    reteiva_manual?: number;
    created_at: Date;
    deleted_at?: Date;
}
