import { Pool, PoolConnection } from 'mysql2/promise';
import { FiltrosRetencionesAplicadas, IRetencionRepository } from '../../ports/pagos/repository_port/retencion.repository.interface';
import { IRetencionService } from '../../ports/pagos/service_port/retencion.service.interface';
import { ConceptoRetencionSQL, RetencionAplicadaSQL } from '../../models/pagos/sql/retencion.sql';
import { ajustarRetencionAplicada } from '../../repositories/pagos/retencion.repository';
import { AppError } from '../../errors/app-error';

const err = (msg: string, status = 400, code?: string): AppError => AppError.http(status, msg, code ?? (status === 400 ? 'BUSINESS_RULE' : undefined));

export class RetencionService implements IRetencionService {
    constructor(private repo: IRetencionRepository, private db: Pool) {}

    async list(): Promise<ConceptoRetencionSQL[]> {
        return this.repo.list();
    }

    async listarAplicados(filtros: FiltrosRetencionesAplicadas): Promise<RetencionAplicadaSQL[]> {
        return this.repo.listarAplicados(filtros);
    }

    // Diseño "híbrido": el catálogo calcula solo, pero esto permite corregir a mano un caso
    // puntual que no calce — ver ajustarRetencionAplicada en retencion.repository.ts.
    async ajustarAplicada(id: number, valorRetenido: number): Promise<RetencionAplicadaSQL> {
        const existente = await this.repo.obtenerAplicada(id);
        if (!existente) throw err('Retención aplicada no encontrada', 404);

        return this.tx(async conn => {
            try {
                await ajustarRetencionAplicada(conn, id, valorRetenido);
            } catch (e: any) {
                throw err(e.message, 409);
            }
            const actualizada = await this.repo.obtenerAplicada(id, conn);
            return actualizada!;
        });
    }

    private async tx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const out = await fn(conn);
            await conn.commit();
            return out;
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }
}
