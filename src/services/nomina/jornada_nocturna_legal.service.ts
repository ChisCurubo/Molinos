import { IJornadaNocturnaLegalRepository } from '../../ports/nomina/repository_port/jornada_nocturna_legal.repository.interface';
import { IJornadaNocturnaLegalService } from '../../ports/nomina/service_port/jornada_nocturna_legal.service.interface';
import { JornadaNocturnaLegalSQL } from '../../models/nomina/sql/jornada_nocturna_legal.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/**
 * Histórico del corte legal de jornada nocturna (Ley 2101 de 2021, se ha movido varias veces).
 * nomina_liquidacion.service.ts usa obtenerVigente(fecha) para saber, en la fecha de cada Turno,
 * a partir de qué hora cuenta como nocturno (siempre termina a las 06:00).
 */
export class JornadaNocturnaLegalService implements IJornadaNocturnaLegalService {
    constructor(private repo: IJornadaNocturnaLegalRepository) {}

    async listar(): Promise<JornadaNocturnaLegalSQL[]> {
        return this.repo.listar();
    }

    async crearVigencia(data: { hora_inicio_nocturno: string; vigente_desde: string }): Promise<JornadaNocturnaLegalSQL> {
        const hora = (data.hora_inicio_nocturno || '').trim();
        if (!HORA_RE.test(hora)) throw err('hora_inicio_nocturno debe tener formato HH:MM o HH:MM:SS');
        if (!data.vigente_desde) throw err('vigente_desde es requerida');

        try {
            const id = await this.repo.crear({ hora_inicio_nocturno: hora, vigente_desde: data.vigente_desde });
            const creada = (await this.repo.listar()).find(j => j.id === id);
            return creada!;
        } catch (e: any) {
            if (e?.errno === 1062) throw err('Ya existe un corte de jornada nocturna vigente desde esa fecha', 409);
            throw e;
        }
    }
}
