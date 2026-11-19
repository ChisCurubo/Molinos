import { JornadaNocturnaLegalSQL } from '../../../models/nomina/sql/jornada_nocturna_legal.sql';

export interface IJornadaNocturnaLegalService {
    listar(): Promise<JornadaNocturnaLegalSQL[]>;
    /** Registra un nuevo corte (cuando la ley vuelva a mover la jornada nocturna). */
    crearVigencia(data: { hora_inicio_nocturno: string; vigente_desde: string }): Promise<JornadaNocturnaLegalSQL>;
}
