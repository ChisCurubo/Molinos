// Automáticamente generado a partir de molinos_create_v4.sql

export interface TurnoSQL {
    id: number;
    fecha: Date;
    id_empleado: number;
    id_tipo_turno: number;
    id_planta_proceso: number | null;
    horas_trabajadas: number;
    presente: boolean;
    es_festivo: boolean;
    comentarios: string;
    quincena: number;
    created_at: Date;
}
