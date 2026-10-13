import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { IJornadaNocturnaLegalRepository } from '../../ports/nomina/repository_port/jornada_nocturna_legal.repository.interface';
import { JornadaNocturnaLegalSQL } from '../../models/nomina/sql/jornada_nocturna_legal.sql';

export class JornadaNocturnaLegalRepository implements IJornadaNocturnaLegalRepository {
    constructor(private db: Pool) {}

    async listar(): Promise<JornadaNocturnaLegalSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Jornada_Nocturna_Legal ORDER BY vigente_desde DESC`
        );
        return rows as JornadaNocturnaLegalSQL[];
    }

    async obtenerVigente(fecha: string): Promise<JornadaNocturnaLegalSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM Jornada_Nocturna_Legal WHERE vigente_desde <= ? ORDER BY vigente_desde DESC LIMIT 1`,
            [fecha]
        );
        return rows.length ? (rows[0] as JornadaNocturnaLegalSQL) : null;
    }

    async crear(data: { hora_inicio_nocturno: string; vigente_desde: string }): Promise<number> {
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Jornada_Nocturna_Legal (hora_inicio_nocturno, vigente_desde) VALUES (?, ?)`,
            [data.hora_inicio_nocturno, data.vigente_desde]
        );
        return result.insertId;
    }
}
