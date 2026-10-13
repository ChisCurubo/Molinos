import { JornadaNocturnaLegalSQL } from '../../../models/nomina/sql/jornada_nocturna_legal.sql';

export interface IJornadaNocturnaLegalRepository {
    listar(): Promise<JornadaNocturnaLegalSQL[]>;
    /** El corte vigente en `fecha`: la fila con mayor vigente_desde <= fecha. */
    obtenerVigente(fecha: string): Promise<JornadaNocturnaLegalSQL | null>;
    crear(data: { hora_inicio_nocturno: string; vigente_desde: string }): Promise<number>;
}
