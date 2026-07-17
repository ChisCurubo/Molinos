import { IInventarioRepository } from '../../ports/material/inventario.interface';

export class InventarioService {
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
}
