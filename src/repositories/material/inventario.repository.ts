import { Pool } from 'mysql2/promise';
import { IInventarioRepository } from '../../ports/material/inventario.interface';

export class InventarioRepository implements IInventarioRepository {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    async obtenerMaterialCrudo(): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(`
            SELECT * FROM v_inventario_material_crudo ORDER BY fecha_llegada ASC
        `);
        return rows;
    }

    async obtenerConcentrado(): Promise<any[]> {
        const [rows] = await this.db.execute<any[]>(`
            SELECT * FROM v_inventario_concentrado ORDER BY fecha_fin ASC
        `);
        return rows;
    }

    async obtenerResumenLote(idLote: number): Promise<any> {
        const [rows] = await this.db.execute<any[]>(
            `SELECT * FROM v_resumen_lote WHERE id = ?`,
            [idLote]
        );
        return rows.length > 0 ? rows[0] : null;
    }
}
