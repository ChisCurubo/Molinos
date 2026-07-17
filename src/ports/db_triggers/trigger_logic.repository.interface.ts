import { PoolConnection } from 'mysql2/promise';

export interface TriggerLogicRepository {
    afterInsertMPE(newRow: any, tx?: PoolConnection): Promise<void>;
    afterUpdateMPE(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void>;
    afterInsertProcesamiento(newRow: any, tx?: PoolConnection): Promise<void>;
    beforeUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void>;
    afterUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void>;
    beforeInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void>;
    afterInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void>;
    afterDeleteViajeMaterial(oldRow: any, tx?: PoolConnection): Promise<void>;
}
