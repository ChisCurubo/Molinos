import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export interface ICategoriaCxCRepository {
    create(data: Omit<CategoriaCxcSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<CategoriaCxcSQL | null>;
    update(id: number, data: Partial<CategoriaCxcSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxcSQL[]>;
}