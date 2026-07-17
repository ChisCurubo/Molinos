import { TipoGastoOperativoSQL } from '../../../models/pagos/sql/tipo_gasto_operativo.sql';

// --- Original: tipo_gasto_operativo ---
export interface ITipoGastoOperativoService {
    create(data: any): Promise<TipoGastoOperativoSQL>;
    getById(id: number): Promise<TipoGastoOperativoSQL | null>;
    update(id: number, data: any): Promise<TipoGastoOperativoSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoGastoOperativoSQL[]>;
}