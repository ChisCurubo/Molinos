// Automáticamente generado a partir de molinos_create_v4.sql

export interface VolquetaVehiculoSQL {
    id: number;
    id_dueno_volqueta: number;
    placa: string;
    tipo_vehiculo: string;
    conductor: string;
    conductor_cc: string;
    capacidad_ton?: number;
    fecha?: Date;
    estado_pago: string;
    activo: boolean;
    created_at: Date;
}
