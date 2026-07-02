import { TipoGastoOperativoSQL } from '../../models/pagos/sql/tipo_gasto_operativo.sql';

// --- Original: tipo_gasto_operativo ---
export interface ITipoGastoOperativoRepository {
    create(data: Omit<TipoGastoOperativoSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoGastoOperativoSQL | null>;
    update(id: number, data: Partial<TipoGastoOperativoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoGastoOperativoSQL[]>;
}