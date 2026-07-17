import { Pool } from 'mysql2/promise';
import { IViajesRepository } from '../../ports/material/viajes.interface';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';

export class ViajesService {
    private repo: IViajesRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;

    constructor(repo: IViajesRepository, db: Pool, triggerLogicRepo: TriggerLogicRepository) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
    }

    async crearCabeceraViaje(data: any): Promise<number> {
        return await this.repo.crearCabeceraViaje(data);
    }

    async asignarLoteAViajeTx(data: any): Promise<number> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const id = await this.repo.asignarLoteAViaje(data, conn);
            const newRow = await this.repo.obtenerLineaViajePorId(id, conn);

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_before_insert_viaje_material' de la BD.
            // await this.triggerLogicRepo.beforeInsertViajeMaterial(conn, newRow);

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_insert_viaje_material' de la BD.
            // await this.triggerLogicRepo.afterInsertViajeMaterial(conn, newRow);

            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async eliminarLineaViajeTx(idLinea: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const oldRow = await this.repo.obtenerLineaViajePorId(idLinea, conn);
            if (!oldRow) throw new Error('Línea de viaje no encontrada');

            await this.repo.eliminarLineaViaje(idLinea, conn);

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_delete_viaje_material' de la BD.
            // await this.triggerLogicRepo.afterDeleteViajeMaterial(conn, oldRow);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
