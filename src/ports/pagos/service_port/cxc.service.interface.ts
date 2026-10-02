import { CategoriaCxcSQL } from '../../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export interface ICategoriaCxCService {
    create(data: any): Promise<CategoriaCxcSQL>;
    getById(id: number): Promise<CategoriaCxcSQL | null>;
    update(id: number, data: any): Promise<CategoriaCxcSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxcSQL[]>;
}

export interface ICuentasPorCobrarService {
    listarPaginado(filtros: { mes?: number; anio?: number; id_categoria?: number; estado?: string; page?: number; limit?: number }): Promise<any>;
}