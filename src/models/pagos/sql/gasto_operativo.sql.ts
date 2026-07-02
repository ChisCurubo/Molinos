// Automáticamente generado a partir de molinos_create_v4.sql

export interface GastoOperativoSQL {
    id: number;
    id_deposito: number;
    id_tipo_gasto: number;
    id_material_planta_entrada?: number;
    id_viaje?: number;
    fecha: Date;
    concepto: string;
    monto: number;
    saldo_resultante: number;
    mensaje_mauricio: string;
    created_at: Date;
}
