// Automáticamente generado a partir de molinos_create_v4.sql

export interface TurnoSQL {
    id: number;
    fecha: Date;
    id_empleado: number;
    id_tipo_turno: number;
    id_planta: number;
    proceso: string;
    horas_trabajadas: number;
    comentarios: string;
    quincena: number;
    created_at: Date;
}
