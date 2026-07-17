import { CategoriaCxcSQL } from '../../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export interface ICategoriaCxCService {
    create(data: any): Promise<CategoriaCxcSQL>;
    getById(id: number): Promise<CategoriaCxcSQL | null>;
    update(id: number, data: any): Promise<CategoriaCxcSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxcSQL[]>;
}