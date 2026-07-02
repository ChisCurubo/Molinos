// Automáticamente generado a partir de molinos_create_v4.sql

export interface AnticipoTerceroSQL {
    id: number;
    id_minero?: number;
    id_dueno_volqueta?: number;
    id_proveedor?: number;
    fecha: Date;
    monto_inicial: number;
    monto_usado: number;
    saldo_disponible: number;
    descripcion: string;
    estado: string;
    created_at: Date;
}
