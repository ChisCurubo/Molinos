import { PoolConnection } from 'mysql2/promise';
import { IInventarioRepository, IInventarioService } from '../../ports/material/inventario.interface';

export class InventarioService implements IInventarioService {
    constructor(private repo: IInventarioRepository) {}

    async obtenerMaterialCrudo(): Promise<any[]> {
        return await this.repo.obtenerMaterialCrudo();
    }

    async obtenerConcentrado(): Promise<any[]> {
        return await this.repo.obtenerConcentrado();
    }

    async obtenerResumenLote(idLote: number): Promise<any> {
        const resumen = await this.repo.obtenerResumenLote(idLote);
        if (!resumen) throw new Error('Resumen de lote no encontrado');
        return resumen;
    }

    async obtenerResumenInventario(): Promise<any> {
        return await this.repo.obtenerResumenInventario();
    }

    // Trigger interno (reemplaza 'trg_after_insert_mpe'). Lo llama material.service
    // al registrar la entrada, dentro de la misma transacción (tx).
    async triggerAlCrearEntrada(entrada: any, tx?: PoolConnection): Promise<void> {
        return await this.repo.triggerAlCrearEntrada(entrada, tx);
    }

    // Trigger interno (reemplaza 'trg_after_update_mpe'). Lo llama analisis.service
    // al vincular/actualizar el análisis, dentro de la misma transacción (tx).
    async triggerAlActualizarAnalisis(oldEntrada: any, newEntrada: any, tx?: PoolConnection): Promise<void> {
        return await this.repo.triggerAlActualizarAnalisis(oldEntrada, newEntrada, tx);
    }
}
