import { TipoAlquilerSQL } from '../../../models/pagos/sql/tipo_alquiler.sql';
import { AlquilerSQL } from '../../../models/pagos/sql/alquiler.sql';

// --- Original: tipo_alquiler ---
export interface ITipoAlquilerRepository {
    create(data: Omit<TipoAlquilerSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoAlquilerSQL | null>;
    update(id: number, data: Partial<TipoAlquilerSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAlquilerSQL[]>;
}

// --- Alquiler (contrato real, no el catálogo de tipos) ---
export interface IAlquilerRepository {
    create(data: Omit<AlquilerSQL, 'id' | 'created_at' | 'deleted_at'>): Promise<number>;
    getById(id: number): Promise<AlquilerSQL | null>;
    update(id: number, data: Partial<AlquilerSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(filtros?: { id_contrato?: number; mes?: number; anio?: number }): Promise<AlquilerSQL[]>;
}