import { TipoAlquilerSQL } from '../../../models/pagos/sql/tipo_alquiler.sql';

// --- Original: tipo_alquiler ---
export interface ITipoAlquilerService {
    create(data: any): Promise<TipoAlquilerSQL>;
    getById(id: number): Promise<TipoAlquilerSQL | null>;
    update(id: number, data: any): Promise<TipoAlquilerSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAlquilerSQL[]>;
}