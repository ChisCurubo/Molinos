import { TipoAlquilerSQL } from '../../../models/pagos/sql/tipo_alquiler.sql';
import { AlquilerSQL } from '../../../models/pagos/sql/alquiler.sql';

// --- Original: tipo_alquiler ---
export interface ITipoAlquilerService {
    create(data: any): Promise<TipoAlquilerSQL>;
    getById(id: number): Promise<TipoAlquilerSQL | null>;
    update(id: number, data: any): Promise<TipoAlquilerSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAlquilerSQL[]>;
}

// --- Alquiler (contrato real) ---
export interface IAlquilerService {
    create(data: any): Promise<AlquilerSQL>;
    getById(id: number): Promise<AlquilerSQL | null>;
    update(id: number, data: any): Promise<AlquilerSQL | null>;
    delete(id: number): Promise<boolean>;
    list(filtros?: { id_contrato?: number; mes?: number; anio?: number }): Promise<AlquilerSQL[]>;
}