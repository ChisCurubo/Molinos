// Automáticamente generado a partir de molinos_create_v4.sql

export interface CuentaPorCobrarSQL {
    id: number;
    id_categoria: number;
    concepto: string;
    id_empleado?: number;
    id_minero?: number;
    id_dueno_volqueta?: number;
    id_proveedor?: number;
    valor_total: number;
    valor_cobrado: number;
    saldo: number;
    estado: string;
    fecha_creacion: Date;
    fecha_limite?: Date;
    created_at: Date;
    updated_at: Date;
}
