// Automáticamente generado a partir de molinos_create_v4.sql

export interface CuentaPorPagarSQL {
    id: number;
    id_categoria: number;
    concepto: string;
    id_proveedor?: number;
    id_empleado?: number;
    id_minero?: number;
    id_dueno_volqueta?: number;
    valor_total: number;
    valor_pagado: number;
    saldo: number;
    estado: string;
    fecha_creacion: Date;
    fecha_limite: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
}
