// Automáticamente generado a partir de molinos_create_v4.sql

export interface SaldoAFavorSQL {
    id: number;
    origen: string;
    id_abono_cxp_orig?: number;
    id_minero?: number;
    id_dueno_volqueta?: number;
    id_proveedor?: number;
    id_empleado?: number;
    id_cuenta_pagar?: number;
    monto_original: number;
    monto_aplicado: number;
    saldo_disponible: number;
    tipo_resolucion: string;
    estado: string;
    fecha: Date;
    descripcion: string;
    created_at: Date;
    updated_at: Date;
}
