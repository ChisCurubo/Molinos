import { CategoriaCxcSQL } from '../../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export interface ICategoriaCxCRepository {
    create(data: Omit<CategoriaCxcSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<CategoriaCxcSQL | null>;
    update(id: number, data: Partial<CategoriaCxcSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxcSQL[]>;
}

export interface FiltrosCxCPaginado {
    mes?: number;
    anio?: number;
    id_categoria?: number;
    estado?: string;
    page: number;
    limit: number;
}

// Cuentas_Por_Cobrar: la tabla existe en el esquema (espejo de Cuentas_Por_Pagar) pero
// hoy ningún módulo escribe en ella todavía — solo se expone el listado mes a mes.
export interface ICuentasPorCobrarRepository {
    listarPaginado(filtros: FiltrosCxCPaginado): Promise<{ rows: any[]; total: number }>;
}