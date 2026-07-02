import { TipoAnalisisSQL } from '../../models/material/sql/tipo_analisis.sql';

// --- Original: tipo_analisis ---
export interface ITipoAnalisisRepository {
    create(data: Omit<TipoAnalisisSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoAnalisisSQL | null>;
    update(id: number, data: Partial<TipoAnalisisSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAnalisisSQL[]>;
}