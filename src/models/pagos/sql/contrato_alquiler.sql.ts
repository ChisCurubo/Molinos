// Automáticamente generado a partir de migracion_contratos_alquiler_2026-10-18.sql

export interface ContratoAlquilerSQL {
    id: number;
    id_tipo?: number;
    id_proveedor: number;
    concepto: string;
    valor_mensual: number;
    fecha_inicio: Date;
    fecha_fin: Date;
    contrato_url?: string;
    created_at: Date;
    deleted_at?: Date;
}
