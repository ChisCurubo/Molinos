import { PoolConnection } from 'mysql2/promise';

export interface TriggerLogicRepository {
    // NOTA: afterInsertMPE / afterUpdateMPE se migraron al módulo Inventario
    // (IInventarioService.triggerAlCrearEntrada / triggerAlActualizarAnalisis),
    // junto con la eliminación de los triggers de BD 'trg_after_insert_mpe' y 'trg_after_update_mpe'.
    afterInsertProcesamiento(newRow: any, tx?: PoolConnection): Promise<void>;
    beforeUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void>;
    afterUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void>;
    beforeInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void>;
    afterInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void>;
    afterDeleteViajeMaterial(oldRow: any, tx?: PoolConnection): Promise<void>;
}
