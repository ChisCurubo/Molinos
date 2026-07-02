import { TipoAlquilerSQL } from '../../models/pagos/sql/tipo_alquiler.sql';

// --- Original: tipo_alquiler ---
export interface ITipoAlquilerRepository {
    create(data: Omit<TipoAlquilerSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoAlquilerSQL | null>;
    update(id: number, data: Partial<TipoAlquilerSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAlquilerSQL[]>;
}